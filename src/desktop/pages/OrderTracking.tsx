import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../../backend/firebase/firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { Order, OrderStatus, StatusUpdate } from '../../shared/types';
import { Package, Truck, CheckCircle, Clock, MapPin, ArrowLeft, Loader2, AlertCircle, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import InvoiceModal from '../components/InvoiceModal';

const STATUS_CONFIG: Record<OrderStatus, { icon: any, color: string, label: string }> = {
  pending: { icon: Clock, color: 'text-[#22C55E]', label: 'Order Placed' },
  confirmed: { icon: CheckCircle, color: 'text-[#22C55E]', label: 'Order Confirmed' },
  packed: { icon: Package, color: 'text-[#22C55E]', label: 'Packed' },
  shipped: { icon: Truck, color: 'text-[#22C55E]', label: 'Shipped' },
  out_for_delivery: { icon: MapPin, color: 'text-[#22C55E]', label: 'Out for Delivery' },
  delivered: { icon: CheckCircle, color: 'text-[#22C55E]', label: 'Delivered' },
  cancelled: { icon: AlertCircle, color: 'text-red-500', label: 'Order Cancelled' },
  cancel_requested: { icon: Clock, color: 'text-red-500', label: 'Cancellation Requested' },
  cancel_rejected: { icon: AlertCircle, color: 'text-red-500', label: 'Cancellation Rejected' },
  returned: { icon: AlertCircle, color: 'text-red-500', label: 'Returned' },
  refunded: { icon: AlertCircle, color: 'text-red-500', label: 'Refunded' }
};

const TIMELINE_STEPS: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

const NORMAL_STEP_INDICES: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
};

const getCompletedStepsInfo = (order: Order): { completed: Set<number>, isTerminalRed: boolean, terminalLabel: string } => {
  const completed = new Set<number>();
  completed.add(0);

  const isCancelled = ['cancelled', 'cancel_requested', 'cancel_rejected'].includes(order.status);
  const isRefunded = ['returned', 'refunded'].includes(order.status);
  const isTerminalRed = isCancelled || isRefunded;

  let terminalLabel = 'Delivered';
  if (isRefunded) {
    terminalLabel = order.status === 'returned' ? 'Returned' : 'Refunded';
  } else if (isCancelled) {
    terminalLabel = 'Cancelled';
  }

  if (order.statusHistory && Array.isArray(order.statusHistory)) {
    order.statusHistory.forEach((update) => {
      const idx = NORMAL_STEP_INDICES[update.status];
      if (idx !== undefined && idx < 5) {
        completed.add(idx);
      }
    });
  }

  const currentIdx = NORMAL_STEP_INDICES[order.status];
  if (currentIdx !== undefined && currentIdx < 5) {
    for (let i = 0; i <= currentIdx; i++) {
      completed.add(i);
    }
  }

  if (order.status === 'delivered') {
    for (let i = 0; i <= 5; i++) {
      completed.add(i);
    }
  } else if (isTerminalRed) {
    completed.add(5);
  }

  return { completed, isTerminalRed, terminalLabel };
};

const getProgressWidthPercentage = (completedSteps: Set<number>): number => {
  if (completedSteps.size === 0) return 0;
  let maxCompletedIndex = 0;
  completedSteps.forEach((idx) => {
    if (idx > maxCompletedIndex) maxCompletedIndex = idx;
  });
  return (maxCompletedIndex / (TIMELINE_STEPS.length - 1)) * 100;
};

const getDotColorClass = (statusStr: string, messageStr: string = ''): string => {
  const s = (statusStr || '').toLowerCase();
  const m = (messageStr || '').toLowerCase();

  const yellowKeywords = ['requested', 'under_review', 'under review', 'pending', 'pickup_scheduled'];
  if (yellowKeywords.some(k => s.includes(k) || m.includes(k))) {
    return 'bg-amber-400 shadow-amber-400/50';
  }

  const redKeywords = ['cancel', 'cancelled', 'rejected', 'refunded', 'returned'];
  if (redKeywords.some(k => s.includes(k) || m.includes(k))) {
    return 'bg-[#EF4444] shadow-red-500/50';
  }

  return 'bg-[#22C55E] shadow-emerald-500/50';
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(orderId || '');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const orderRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        setLoading(false);
      } else {
        const q = query(collection(db, 'orders'), where('customOrderId', '==', orderId));
        getDocs(q).then((querySnap) => {
          if (!querySnap.empty) {
            const matchedDoc = querySnap.docs[0];
            setOrder({ id: matchedDoc.id, ...matchedDoc.data() } as Order);
          } else {
            setOrder(null);
          }
          setLoading(false);
        }).catch((err) => {
          console.error("Error querying order by customOrderId:", err);
          setOrder(null);
          setLoading(false);
        });
      }
    }, (error) => {
      console.error("Error listening to order:", error);
      setOrder(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const targetId = order.customOrderId || order.id;

    const cancelQuery = query(collection(db, 'cancellation_requests'), where('customOrderId', '==', targetId));
    const returnQuery = query(collection(db, 'return_requests'), where('customOrderId', '==', targetId));
    const refundQuery = query(collection(db, 'refund_requests'), where('customOrderId', '==', targetId));

    const unsubCancel = onSnapshot(cancelQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Cancellation' });
      }
    });

    const unsubReturn = onSnapshot(returnQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Return' });
      }
    });

    const unsubRefund = onSnapshot(refundQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Refund' });
      }
    });

    return () => {
      unsubCancel();
      unsubReturn();
      unsubRefund();
    };
  }, [order]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/track-order/${searchInput.trim()}`);
    }
  };

  if (!orderId && !order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-gray-100"
        >
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Track Your Order</h2>
          <p className="text-gray-500 mb-8 font-medium">Enter your Order ID to see real-time updates of your delivery.</p>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. VBM202606051234)"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all font-bold text-center"
              required
            />
            <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-primary-hover transition-all">
              Track Status
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-gray-100"
        >
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-500 mb-8 font-medium">We couldn't find order <span className="font-bold text-gray-900">{orderId}</span>. Try another ID below.</p>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. VBM202606051234)"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all font-bold text-center"
              required
            />
            <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-gray-200 hover:bg-black transition-all">
              Try Again
            </button>
          </form>

          <Link to="/profile" className="inline-block mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary transition-colors">
            Back to My Orders
          </Link>
        </motion.div>
      </div>
    );
  }

  const currentStatus = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const { completed: completedSteps, isTerminalRed, terminalLabel } = getCompletedStepsInfo(order);
  const progressPercentage = getProgressWidthPercentage(completedSteps);

  const timelineSteps = [
    { status: 'pending', label: 'Order Placed', icon: Clock },
    { status: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
    { status: 'packed', label: 'Packed', icon: Package },
    { status: 'shipped', label: 'Shipped', icon: Truck },
    { status: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
    { 
      status: isTerminalRed ? (terminalLabel === 'Refunded' || terminalLabel === 'Returned' ? 'refunded' : 'cancelled') : 'delivered', 
      label: terminalLabel, 
      icon: isTerminalRed ? AlertCircle : CheckCircle 
    },
  ];

  const getLatestStatusUpdate = () => {
    if (activeRequest) {
      const isPending = ['requested', 'under_review', 'pending', 'pickup_scheduled'].includes(activeRequest.status?.toLowerCase() || '');
      const isRejected = ['rejected', 'cancel_rejected'].includes(activeRequest.status?.toLowerCase() || '');
      
      let dotColor = 'bg-[#22C55E] shadow-emerald-500/50';
      if (isPending) dotColor = 'bg-amber-400 shadow-amber-400/50';
      else if (isRejected || activeRequest.status === 'cancelled') dotColor = 'bg-[#EF4444] shadow-red-500/50';

      return {
        message: `${activeRequest.requestType} Request: ${activeRequest.status ? activeRequest.status.replace(/_/g, ' ').toUpperCase() : 'UNDER REVIEW'}`,
        location: activeRequest.reason ? `Reason: ${activeRequest.reason}` : undefined,
        timestamp: activeRequest.updatedAt || activeRequest.createdAt || order.createdAt,
        dotColorClass: dotColor
      };
    }

    const sorted = [...(order.statusHistory || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (sorted.length > 0) {
      const top = sorted[0];
      return {
        message: top.message || top.status.charAt(0).toUpperCase() + top.status.slice(1).replace(/_/g, ' '),
        location: top.location,
        timestamp: top.timestamp,
        dotColorClass: getDotColorClass(top.status, top.message)
      };
    }

    return {
      message: STATUS_CONFIG[order.status]?.label || order.status.replace(/_/g, ' '),
      location: undefined,
      timestamp: order.createdAt,
      dotColorClass: getDotColorClass(order.status)
    };
  };

  const latestUpdate = getLatestStatusUpdate();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link to="/profile" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary font-black uppercase tracking-widest text-[10px] mb-8 transition-colors group">
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to My Orders
        </Link>

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-8 md:p-12 border-b border-gray-100 bg-gray-900 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Order Tracking</p>
                <div className="flex items-center gap-4">
                   <h1 className="text-3xl font-black tracking-tight">{order.customOrderId || order.id}</h1>
                   <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                     order.status === 'cancelled' || order.status === 'cancel_requested' || order.status === 'refunded' || order.status === 'returned'
                       ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                       : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                   }`}>
                     {currentStatus.label}
                   </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Order Date</p>
                <p className="text-lg font-black mb-4">{new Date(order.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">Expected Delivery</p>
                <p className="text-xl font-black">
                  {order.estimatedDelivery ? (
                    /^\d{4}-\d{2}-\d{2}$/.test(order.estimatedDelivery) 
                      ? new Date(order.estimatedDelivery).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                      : order.estimatedDelivery
                  ) : 'Calculating...'}
                </p>

                {order.status === 'delivered' && (
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Download Invoice
                  </button>
                )}
              </div>
            </div>
          </div>

          <InvoiceModal
            order={order}
            isOpen={showInvoiceModal}
            onClose={() => setShowInvoiceModal(false)}
          />

          <div className="p-8 md:p-12">
            {/* Timeline Progress Bar */}
            <div className="relative mb-20 px-4">
               {/* Base neutral connector line */}
               <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 -translate-y-1/2 rounded-full" />
               
               {/* Active green connector line */}
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progressPercentage}%` }}
                 transition={{ duration: 0.5, ease: 'easeOut' }}
                 className="absolute top-1/2 left-0 h-1.5 bg-[#22C55E] -translate-y-1/2 rounded-full z-10"
               />
               
               <div className="relative flex justify-between z-20">
                 {timelineSteps.map((stepConfig, index) => {
                   const Icon = stepConfig.icon;
                   const isCompleted = completedSteps.has(index);
                   const isStepRed = index === 5 && isTerminalRed;

                   return (
                     <div key={stepConfig.status} className="flex flex-col items-center">
                        <div 
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md ${
                            isStepRed
                              ? 'bg-[#EF4444] text-white shadow-red-500/30 scale-105 z-20'
                              : isCompleted 
                              ? 'bg-[#22C55E] text-white shadow-[#22C55E]/30 scale-105 z-20' 
                              : 'bg-gray-100 text-gray-400 border border-gray-200 scale-100'
                          }`}
                        >
                           <Icon className="w-6 h-6" />
                        </div>
                        <div className="absolute top-16 text-center whitespace-nowrap">
                           <p className={`text-[10px] font-black uppercase tracking-widest ${isStepRed ? 'text-red-500' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                             {stepConfig.label}
                           </p>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-gray-100">
               {/* Status History Section - Show only latest update */}
               <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Latest Status Update</h3>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex gap-4 items-start shadow-sm">
                     <div className={`w-4 h-4 rounded-full mt-1 z-10 shrink-0 shadow-sm ${latestUpdate.dotColorClass}`} />
                     <div>
                        <p className="text-base font-black text-gray-900 leading-snug">
                          {latestUpdate.message}
                        </p>
                        {latestUpdate.location && (
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> {latestUpdate.location}
                          </p>
                        )}
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">
                          {latestUpdate.timestamp ? new Date(latestUpdate.timestamp).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          }) : ''}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Shipping & Order Summary Details */}
               <div className="space-y-8">
                  <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                     <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Delivery Details</h3>
                     <div className="space-y-4">
                        <div className="flex items-start gap-4">
                           <div className="bg-white p-3 rounded-2xl shadow-sm">
                              <MapPin className="w-5 h-5 text-primary" />
                           </div>
                           <div>
                              <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Shipping Address</p>
                              <p className="text-sm text-gray-500 font-medium mt-1 leading-relaxed">
                                {order.address.street},<br />
                                {order.address.city}, {order.address.state} - {order.address.zip}
                              </p>
                           </div>
                        </div>

                        {order.trackingId && (
                          <div className="flex items-start gap-4 pt-4 border-t border-gray-100">
                             <div className="bg-white p-3 rounded-2xl shadow-sm">
                                <Truck className="w-5 h-5 text-primary" />
                             </div>
                             <div>
                                <p className="text-xs font-black text-gray-900 uppercase tracking-widest">Tracking Info</p>
                                <p className="text-sm font-black text-primary mt-1">{order.carrier}: {order.trackingId}</p>
                             </div>
                          </div>
                        )}
                     </div>
                  </div>

                  <div className="bg-blue-600 p-8 rounded-3xl text-white relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                     <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-60">Items in this order</h3>
                     <div className="space-y-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-4 items-center">
                             <img src={item.image} className="w-12 h-12 rounded-xl object-cover border border-white/20" alt="" />
                             <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{item.name}</p>
                                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mt-0.5">Quantity: {item.quantity}</p>
                             </div>
                          </div>
                        ))}
                     </div>
                     <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-widest opacity-60">Total Paid</span>
                        <span className="text-2xl font-black">₹{order.total.toLocaleString()}</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

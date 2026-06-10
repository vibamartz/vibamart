import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Order, OrderStatus } from '../types';
import { Package, Truck, CheckCircle, Clock, MapPin, ArrowLeft, ChevronRight, Loader2, AlertCircle, X } from 'lucide-react';
import { motion } from 'motion/react';

const STATUS_CONFIG: Record<OrderStatus, { icon: any, color: string, label: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Order Placed' },
  confirmed: { icon: CheckCircle, color: 'text-blue-500', label: 'Order Confirmed' },
  packed: { icon: Package, color: 'text-indigo-500', label: 'Packed' },
  shipped: { icon: Truck, color: 'text-purple-500', label: 'Shipped' },
  out_for_delivery: { icon: MapPin, color: 'text-orange-500', label: 'Out for Delivery' },
  delivered: { icon: CheckCircle, color: 'text-emerald-500', label: 'Delivered' },
  cancelled: { icon: AlertCircle, color: 'text-gray-500', label: 'Cancelled' },
  cancel_requested: { icon: Clock, color: 'text-orange-500', label: 'Cancellation Requested' },
  cancel_rejected: { icon: AlertCircle, color: 'text-red-500', label: 'Cancellation Rejected' },
  returned: { icon: AlertCircle, color: 'text-red-500', label: 'Returned' },
  refunded: { icon: AlertCircle, color: 'text-pink-500', label: 'Refunded' }
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(orderId || '');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setOrder(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const docRef = doc(db, 'orders', orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
        } else {
          setOrder(null);
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

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
  const steps: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
  const currentStepIndex = steps.indexOf(order.status);

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
                   <h1 className="text-3xl font-black tracking-tight">{order.id}</h1>
                   <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentStatus.color.replace('text-', 'bg-').replace('500', '100')} ${currentStatus.color}`}>
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
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            {/* Progress Bar */}
            <div className="relative mb-20 px-4">
               <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-100 -translate-y-1/2 rounded-full" />
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                 className="absolute top-1/2 left-0 h-1.5 bg-primary -translate-y-1/2 rounded-full z-10"
               />
               
               <div className="relative flex justify-between z-20">
                 {steps.map((step, index) => {
                   const config = STATUS_CONFIG[step];
                   const Icon = config.icon;
                   const isCompleted = index <= currentStepIndex;
                   const isCurrent = index === currentStepIndex;

                   return (
                     <div key={step} className="flex flex-col items-center">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                          isCompleted ? 'bg-primary text-white rotate-0' : 'bg-white text-gray-300 border border-gray-100 rotate-12'
                        } ${isCurrent ? 'scale-125 z-30 shadow-primary/20' : 'scale-100'}`}>
                           <Icon className="w-6 h-6" />
                        </div>
                        <div className="absolute top-16 text-center whitespace-nowrap">
                           <p className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-gray-900' : 'text-gray-300'}`}>
                             {config.label}
                           </p>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-gray-50">
               {/* Order History */}
               <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Status History</h3>
                  <div className="space-y-8">
                     {(order.statusHistory || []).slice().reverse().map((update, index) => (
                       <div key={index} className="flex gap-6 relative">
                          {index !== (order.statusHistory?.length || 0) - 1 && (
                            <div className="absolute top-4 left-2 w-0.5 h-full bg-gray-50 -translate-x-1/2" />
                          )}
                          <div className={`w-4 h-4 rounded-full mt-1.5 z-10 ${index === 0 ? 'bg-primary' : 'bg-gray-200'}`} />
                          <div>
                             <p className="text-sm font-black text-gray-900">{update.message || update.status.charAt(0).toUpperCase() + update.status.slice(1)}</p>
                             {update.location && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1"><MapPin className="w-2.5 h-2.5 inline mr-1" /> {update.location}</p>}
                             <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-2">{new Date(update.timestamp).toLocaleString()}</p>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>

               {/* Shipping Details */}
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

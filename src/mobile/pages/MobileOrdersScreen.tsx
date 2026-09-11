import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Clock, CheckCircle2, Truck, AlertTriangle, ChevronRight, ArrowRight, ShieldCheck, RefreshCcw, Star
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Order } from '../../shared/types';
import { useAuthStore } from '../../backend/store';
import { motion } from 'motion/react';
import ReviewModal from '../../shared/components/ReviewModal';
import { formatDeliveredDate } from '../../shared/utilities/dateUtils';

export default function MobileOrdersScreen() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [requestsMap, setRequestsMap] = useState<Record<string, any>>({});
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewOrder, setSelectedReviewOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(docs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching user orders:", err);
      setLoading(false);
    });

    // Listen to user requests to populate request status on order cards
    const userEmail = (user.email || '').toLowerCase();
    const cancelQuery = query(collection(db, 'cancellation_requests'), where('contactEmail', '==', userEmail));
    const returnQuery = query(collection(db, 'return_requests'), where('contactEmail', '==', userEmail));
    const refundQuery = query(collection(db, 'refund_requests'), where('contactEmail', '==', userEmail));

    let cancels: any[] = [];
    let returns: any[] = [];
    let refunds: any[] = [];

    const mergeRequests = () => {
      const map: Record<string, any> = {};
      cancels.forEach(r => { map[r.customOrderId || r.orderId] = { ...r, type: 'cancellation' }; });
      returns.forEach(r => { map[r.customOrderId || r.orderId] = { ...r, type: 'return' }; });
      refunds.forEach(r => { map[r.customOrderId || r.orderId] = { ...r, type: 'refund' }; });
      setRequestsMap(map);
    };

    const unsubCancel = onSnapshot(cancelQuery, (snap) => {
      cancels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeRequests();
    });
    const unsubReturn = onSnapshot(returnQuery, (snap) => {
      returns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeRequests();
    });
    const unsubRefund = onSnapshot(refundQuery, (snap) => {
      refunds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      mergeRequests();
    });

    return () => {
      unsubscribe();
      unsubCancel();
      unsubReturn();
      unsubRefund();
    };
  }, [user]);

  const filteredOrders = orders.filter(o => {
    if (filterTab === 'active') return ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(o.status);
    if (filterTab === 'delivered') return o.status === 'delivered';
    if (filterTab === 'cancelled') return ['cancelled', 'cancel_requested', 'returned', 'refunded'].includes(o.status);
    return true;
  });

  const getStatusBadge = (order: Order) => {
    const displayId = order.customOrderId || `VBM-${order.id.slice(-6).toUpperCase()}`;
    const req = requestsMap[displayId] || requestsMap[order.id];

    if (req) {
      const typeStr = (req.type || req.requestType || '').toLowerCase();
      if (typeStr.includes('cancel') || ['cancelled', 'cancel_requested', 'cancel_rejected'].includes(order.status)) {
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Canceled</span>;
      }
      if (typeStr.includes('return') || order.status === 'returned') {
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Returned</span>;
      }
      if (typeStr.includes('refund') || order.status === 'refunded') {
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Refunded</span>;
      }
      return <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">Under Review</span>;
    }

    switch (order.status) {
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> {formatDeliveredDate(order)}</span>;
      case 'shipped':
      case 'out_for_delivery':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><Truck className="w-3 h-3 text-blue-600" /> Out for Delivery</span>;
      case 'pending':
      case 'confirmed':
      case 'packed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> In Progress</span>;
      case 'cancelled':
      case 'cancel_requested':
      case 'cancel_rejected':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Canceled</span>;
      case 'returned':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Returned</span>;
      case 'refunded':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> Refunded</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">{order.status}</span>;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center">
        <Package className="w-12 h-12 text-gray-400 mb-3" />
        <h2 className="text-base font-black text-gray-900">Please Login</h2>
        <p className="text-xs text-gray-500 font-medium mt-1 mb-4">Login to see your order history and track live shipments.</p>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase">Login</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-36 sm:pb-40 font-sans select-none px-4 py-4 space-y-5">
      {/* Title & Filter Tabs */}
      <div className="pb-3 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900">My Orders ({orders.length})</h2>
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'active', label: 'In Progress' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                filterTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="divide-y divide-gray-100">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="py-4 animate-pulse space-y-2">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-12 bg-gray-50 rounded" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {filteredOrders.map((order) => {
            const displayId = order.customOrderId || `VBM-${order.id.slice(-6).toUpperCase()}`;
            const firstItem = order.items?.[0];

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/track-order/${order.id}`)}
                className="py-4 space-y-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-gray-900">{displayId}</span>
                    <span className="text-[10px] text-gray-400 font-medium block">
                      Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {getStatusBadge(order)}
                </div>

                {order.status === 'delivered' && (
                  <div className="pt-1 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-black text-gray-900">Rate your Experience</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReviewOrder(order);
                        setShowReviewModal(true);
                      }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                    >
                      <Star className="w-3 h-3 fill-gray-950" /> Rate
                    </button>
                  </div>
                )}

                {/* Items Summary */}
                <div className="flex items-center gap-3">
                  <img
                    src={firstItem?.image || 'https://via.placeholder.com/60'}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-gray-900 truncate">
                      {firstItem?.name || 'Order Package'}
                    </h4>
                    {order.items.length > 1 && (
                      <span className="text-[10px] font-bold text-gray-500">
                        + {order.items.length - 1} more items
                      </span>
                    )}
                    <p className="text-xs font-black text-emerald-700 mt-0.5">
                      ₹{order.total.toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center space-y-3">
          <Package className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-xs font-bold text-gray-600">No orders found in this section.</p>
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase"
          >
            Start Shopping
          </button>
        </div>
      )}

      {selectedReviewOrder && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedReviewOrder(null);
          }}
          order={selectedReviewOrder}
          user={user}
        />
      )}
    </div>
  );
}

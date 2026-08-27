import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Clock, CheckCircle2, Truck, AlertTriangle, ChevronRight, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Order } from '../../shared/types';
import { useAuthStore } from '../../backend/store';
import { motion } from 'motion/react';

export default function MobileOrdersScreen() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

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

    return () => unsubscribe();
  }, [user]);

  const filteredOrders = orders.filter(o => {
    if (filterTab === 'active') return ['pending', 'confirmed', 'packed', 'shipped', 'out_for_delivery'].includes(o.status);
    if (filterTab === 'delivered') return o.status === 'delivered';
    if (filterTab === 'cancelled') return ['cancelled', 'cancel_requested', 'returned', 'refunded'].includes(o.status);
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Delivered</span>;
      case 'shipped':
      case 'out_for_delivery':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><Truck className="w-3 h-3 text-blue-600" /> Out for Delivery</span>;
      case 'pending':
      case 'confirmed':
      case 'packed':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3 text-amber-600" /> In Progress</span>;
      case 'cancelled':
      case 'returned':
      case 'refunded':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-600" /> {status}</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">{status}</span>;
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
    <div className="min-h-screen bg-[#FFF3EB] pb-36 sm:pb-40 font-sans select-none p-3 space-y-3">
      {/* Title & Filter Tabs */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">My Orders ({orders.length})</h2>
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
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
        <div className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-yellow-100" />
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const displayId = order.customOrderId || `VBM-${order.id.slice(-6).toUpperCase()}`;
            const firstItem = order.items?.[0];

            return (
              <motion.div
                key={order.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/track-order/${order.id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3 cursor-pointer hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-xs font-black text-gray-900">{displayId}</span>
                    <span className="text-[10px] text-gray-400 font-medium block">
                      Placed on {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

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
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-yellow-100 space-y-2">
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
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Search, Package } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order } from '../types';
import toast from 'react-hot-toast';

export default function AdminCancellationManagementView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'cancel_requested' | 'cancelled' | 'cancel_rejected'>('cancel_requested');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Only fetch orders that have something to do with cancellation
    const q = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Filter locally because we can't reliably index 'status' with 'IN' alongside 'orderBy' without manual index
      const cancellationOrders = data.filter(o => 
        o.status === 'cancel_requested' || 
        o.status === 'cancel_rejected' || 
        (o.status === 'cancelled' && o.cancellationReason)
      );
      setOrders(cancellationOrders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (orderId: string) => {
    const tid = toast.loading('Approving cancellation...');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/orders/approve-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Cancellation approved', { id: tid });
      } else {
        toast.error(data.error || 'Approval failed', { id: tid });
      }
    } catch (err) {
      toast.error('Network error', { id: tid });
    }
  };

  const handleReject = async (orderId: string) => {
    const tid = toast.loading('Rejecting cancellation...');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/orders/reject-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Cancellation rejected', { id: tid });
      } else {
        toast.error(data.error || 'Rejection failed', { id: tid });
      }
    } catch (err) {
      toast.error('Network error', { id: tid });
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (searchTerm) {
      return o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (o.contactEmail && o.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Cancellation Requests</h3>
            <p className="text-sm text-gray-500 font-medium">Review and manage manual order cancellations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search order ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 w-full"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl overflow-x-auto scrollbar-none gap-1">
              {(['all', 'cancel_requested', 'cancelled', 'cancel_rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50">
              <tr>
                <th className="px-4 py-6">Order ID</th>
                <th className="px-4 py-6">Customer</th>
                <th className="px-4 py-6">Reason</th>
                <th className="px-4 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold italic">Loading...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={4} className="py-20 text-center text-gray-300 font-bold">No cancellations found.</td></tr>
              ) : filteredOrders.map(order => (
                <tr key={order.id} className="group hover:bg-gray-50/50 transition-all">
                  <td className="px-4 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 tracking-tight">#{order.id.startsWith('VBM') ? order.id : order.id.slice(-8).toUpperCase()}</span>
                      <span className={`text-[9px] font-black uppercase tracking-widest mt-1.5 w-fit px-2.5 py-1 rounded-lg ${
                        order.status === 'cancel_requested' ? 'bg-amber-100 text-amber-600' :
                        order.status === 'cancelled' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-sm font-bold text-gray-900">{order.contactName}</p>
                    <p className="text-xs text-gray-500">{order.contactEmail}</p>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-xs text-gray-500 font-medium line-clamp-2 max-w-xs">{order.cancellationReason}</p>
                  </td>
                  <td className="px-4 py-6 text-right">
                    {order.status === 'cancel_requested' ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleApprove(order.id)} className="p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Approve">
                          <Check className="w-5 h-5" /> 
                        </button>
                        <button onClick={() => handleReject(order.id)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Reject">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resolved</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

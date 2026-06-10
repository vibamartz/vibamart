import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, CreditCard, CheckCircle } from 'lucide-react';
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, ReturnRequest } from '../types';
import toast from 'react-hot-toast';

export default function AdminRefundManagementView() {
  const [refundItems, setRefundItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'refunded'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // We need to fetch both Orders and Returns
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      updateCombinedList(ordersData, null);
    });
    
    const unsubReturns = onSnapshot(collection(db, 'returns'), (snapshot) => {
      const returnsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReturnRequest));
      updateCombinedList(null, returnsData);
    });

    let currentOrders: Order[] = [];
    let currentReturns: ReturnRequest[] = [];

    const updateCombinedList = (newOrders: Order[] | null, newReturns: ReturnRequest[] | null) => {
      if (newOrders) currentOrders = newOrders;
      if (newReturns) currentReturns = newReturns;

      const combined: any[] = [];
      
      currentOrders.forEach(o => {
        if ((o.status === 'cancelled' || o.status === 'refunded') && ((o.paymentStatus as any) === 'paid' || (o.paymentStatus as any) === 'refunded')) {
          combined.push({
            type: 'order',
            id: o.id,
            customer: o.contactName,
            email: o.contactEmail,
            amount: o.total,
            method: o.paymentMethod,
            status: (o.paymentStatus as any) === 'refunded' ? 'refunded' : 'pending',
            date: o.createdAt
          });
        }
      });

      // Returns
      currentReturns.forEach(r => {
        if (r.status === 'received_back' || r.status === 'refund_processed' || r.status === 'refunded') {
          combined.push({
            type: 'return',
            id: r.id,
            orderId: r.orderId,
            amount: r.refundAmount || 0,
            status: r.status === 'refunded' ? 'refunded' : 'pending',
            date: r.createdAt
          });
        }
      });

      combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRefundItems(combined);
      setLoading(false);
    };

    return () => {
      unsubOrders();
      unsubReturns();
    };
  }, []);

  const handleMarkRefunded = async (item: any) => {
    const tid = toast.loading('Processing refund...');
    try {
      if (item.type === 'order') {
        await updateDoc(doc(db, 'orders', item.id), {
          paymentStatus: 'refunded',
          status: 'refunded'
        });
      } else {
        await updateDoc(doc(db, 'returns', item.id), {
          status: 'refunded'
        });
        await updateDoc(doc(db, 'orders', item.orderId), {
          status: 'refunded'
        });
      }
      toast.success('Marked as refunded', { id: tid });
    } catch (err) {
      toast.error('Failed to update', { id: tid });
    }
  };

  const filteredItems = refundItems.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (searchTerm) {
      return item.id.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Refund Management</h3>
            <p className="text-sm text-gray-500 font-medium">Track and process refunds for returns and cancellations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 w-full"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="flex bg-gray-50 p-1.5 rounded-2xl overflow-x-auto scrollbar-none gap-1">
              {(['all', 'pending', 'refunded'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-50">
              <tr>
                <th className="px-4 py-6">ID & Type</th>
                <th className="px-4 py-6">Amount</th>
                <th className="px-4 py-6">Date</th>
                <th className="px-4 py-6">Status</th>
                <th className="px-4 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold italic">Loading refunds...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold">No refunds pending.</td></tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                  <td className="px-4 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 tracking-tight">#{item.id.slice(-8).toUpperCase()}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 text-gray-400">
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-lg font-black text-gray-900 italic">₹{item.amount.toLocaleString()}</p>
                    {item.method && <p className="text-[9px] uppercase tracking-widest text-gray-400 mt-1">{item.method}</p>}
                  </td>
                  <td className="px-4 py-6 text-xs text-gray-500 font-bold">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-6">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      item.status === 'refunded' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-6 text-right">
                    {item.status === 'pending' ? (
                      <button onClick={() => handleMarkRefunded(item)} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 ml-auto">
                        <CreditCard className="w-3 h-3" /> Process
                      </button>
                    ) : (
                      <span className="flex items-center justify-end gap-1 text-[10px] font-black text-green-500 uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3" /> Done
                      </span>
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

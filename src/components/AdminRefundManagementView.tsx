import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Search, CreditCard } from 'lucide-react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';

export default function AdminRefundManagementView() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'requested' | 'refunded' | 'rejected'>('requested');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('type', '==', 'refund')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (requestId: string, status: string) => {
    const tid = toast.loading('Updating...');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ requestId, status })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status updated to ${status}`, { id: tid });
      } else {
        toast.error(data.error || 'Update failed', { id: tid });
      }
    } catch (err) {
      toast.error('Network error', { id: tid });
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (searchTerm) {
      return r.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Refund Requests</h3>
            <p className="text-sm text-gray-500 font-medium">Review and manage manual refund requests</p>
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
              {(['all', 'requested', 'refunded', 'rejected'] as const).map(s => (
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
                <th className="px-4 py-6">Order ID</th>
                <th className="px-4 py-6">Date & Reason</th>
                <th className="px-4 py-6">Amount</th>
                <th className="px-4 py-6">Status</th>
                <th className="px-4 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold italic">Loading requests...</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-bold">No requests found.</td></tr>
              ) : filteredRequests.map(req => (
                <tr key={req.id} className="group hover:bg-gray-50/50 transition-all">
                  <td className="px-4 py-6">
                    <span className="text-sm font-black text-gray-900 tracking-tight">#{req.orderId.slice(-8).toUpperCase()}</span>
                  </td>
                  <td className="px-4 py-6">
                    <p className="text-xs font-bold text-gray-600 mb-1">{new Date(req.createdAt).toLocaleString()}</p>
                    <p className="text-[11px] text-gray-500 max-w-[200px] truncate">{req.reason}</p>
                  </td>
                  <td className="px-4 py-6">
                    <span className="text-lg font-black text-gray-900 italic">₹{req.refundAmount?.toLocaleString() || 0}</span>
                  </td>
                  <td className="px-4 py-6">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      req.status === 'refunded' ? 'bg-green-100 text-green-600' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-6 text-right">
                    {req.status === 'requested' && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => handleUpdateStatus(req.id, 'refunded')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors flex items-center gap-1" title="Approve">
                          <CreditCard className="w-4 h-4" /> Process
                        </button>
                        <button onClick={() => handleUpdateStatus(req.id, 'rejected')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors" title="Reject">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
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

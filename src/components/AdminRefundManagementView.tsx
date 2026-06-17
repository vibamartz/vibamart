import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Search, CreditCard, Eye, Clock } from 'lucide-react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import toast from 'react-hot-toast';

const REFUND_STATUSES = [
  { value: 'requested', label: 'Requested' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'refund_sent', label: 'Refund Sent' },
  { value: 'refund_completed', label: 'Refund Completed' },
  { value: 'rejected', label: 'Rejected' }
];

export default function AdminRefundManagementView() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'requested' | 'under_review' | 'approved' | 'processing' | 'refund_sent' | 'refund_completed' | 'rejected'>('requested');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | string>('');
  const [refundMethod, setRefundMethod] = useState('');
  const [refundTransactionId, setRefundTransactionId] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('type', '==', 'refund')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // sort by date locally
      data.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.createdDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.createdDate || 0).getTime();
        return timeB - timeA;
      });
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdate = async () => {
    if (!selectedRequest) return;
    setIsUpdating(true);
    const tid = toast.loading('Updating request status...');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ 
          requestId: selectedRequest.id, 
          status: newStatus,
          adminNotes,
          refundAmount: refundAmount !== '' ? Number(refundAmount) : undefined,
          refundMethod: refundMethod || undefined,
          refundTransactionId: refundTransactionId || undefined,
          estimatedCompletionDate: estimatedCompletionDate || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Request updated successfully`, { id: tid });
        setSelectedRequest(null);
      } else {
        toast.error(data.error || 'Update failed', { id: tid });
      }
    } catch (err) {
      toast.error('Network error', { id: tid });
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (searchTerm) {
      return r.orderId.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toLowerCase().includes(searchTerm.toLowerCase());
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
              {(['all', 'requested', 'under_review', 'approved', 'processing', 'refund_sent', 'refund_completed', 'rejected'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s as any)}
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
                    <p className="text-xs font-bold text-gray-600 mb-1">{new Date(req.createdAt || req.createdDate).toLocaleString()}</p>
                    <p className="text-[11px] text-gray-500 max-w-[200px] truncate">{req.reason || req.requestReason}</p>
                  </td>
                  <td className="px-4 py-6">
                    <span className="text-lg font-black text-gray-900 italic">₹{req.refundAmount?.toLocaleString() || 0}</span>
                  </td>
                  <td className="px-4 py-6">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      ['approved', 'refund_completed', 'refunded'].includes(req.status) ? 'bg-green-100 text-green-600' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-6 text-right">
                    <button 
                      onClick={() => {
                        setSelectedRequest(req);
                        setAdminNotes(req.adminNotes || '');
                        setRefundAmount(req.refundAmount !== undefined ? req.refundAmount : '');
                        setRefundMethod(req.refundMethod || '');
                        setRefundTransactionId(req.refundTransactionId || '');
                        setEstimatedCompletionDate(req.estimatedCompletionDate || '');
                        setNewStatus(req.status);
                      }} 
                      className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details & Update Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedRequest(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-[40px] w-full max-w-2xl p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Refund Request Details</h3>
                  <p className="text-sm text-gray-500 font-medium">Request ID: #{selectedRequest.id.slice(-8).toUpperCase()} • Order ID: #{selectedRequest.orderId}</p>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Details Section */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                      <Clock className="w-3 h-3"/> Request Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Submitted At</span>
                        <span className="text-xs font-bold text-gray-900">{new Date(selectedRequest.createdAt || selectedRequest.createdDate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Current Status</span>
                        <span className="text-xs font-black uppercase text-primary">{selectedRequest.status.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Reason</span>
                        <span className="text-xs font-bold text-gray-900 max-w-[180px] text-right">{selectedRequest.reason || selectedRequest.requestReason}</span>
                      </div>
                      {selectedRequest.adminNotes && (
                        <div className="flex flex-col gap-1 pt-2 border-t border-gray-200/50">
                          <span className="text-xs text-gray-500">Previous Admin Note</span>
                          <span className="text-xs font-medium text-gray-700 bg-white p-2 rounded-xl border border-gray-100">{selectedRequest.adminNotes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Refund Status */}
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                      <CreditCard className="w-3 h-3"/> Refund Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Refund Amount</span>
                        <span className="text-sm font-bold text-gray-900">₹{selectedRequest.refundAmount !== undefined ? selectedRequest.refundAmount : 'Not set'}</span>
                      </div>
                      {selectedRequest.refundMethod && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Refund Method</span>
                          <span className="text-xs font-bold text-gray-900 uppercase">{selectedRequest.refundMethod}</span>
                        </div>
                      )}
                      {selectedRequest.refundTransactionId && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Transaction ID</span>
                          <span className="text-xs font-bold text-gray-900 italic">{selectedRequest.refundTransactionId}</span>
                        </div>
                      )}
                      {selectedRequest.estimatedCompletionDate && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Est. Completion</span>
                          <span className="text-xs font-bold text-gray-900">{selectedRequest.estimatedCompletionDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Edit & Action Section */}
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Update Action</h4>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Target Status</label>
                      <select 
                        value={newStatus} 
                        onChange={e => setNewStatus(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-primary transition-all"
                      >
                        {REFUND_STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Admin Note</label>
                      <textarea 
                        value={adminNotes} 
                        onChange={e => setAdminNotes(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs outline-none focus:border-primary transition-all" 
                        placeholder="Internal or client-facing notes..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Refund Amount (₹)</label>
                      <input 
                        type="number"
                        value={refundAmount} 
                        onChange={e => setRefundAmount(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all font-bold" 
                        placeholder="e.g. 599"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Refund Method</label>
                      <select
                        value={refundMethod} 
                        onChange={e => setRefundMethod(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all"
                      >
                        <option value="">Select Method (Optional)</option>
                        <option value="original_source">Original Source (Card/UPI)</option>
                        <option value="wallet">Store Wallet</option>
                        <option value="bank_transfer">Manual Bank Transfer</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Transaction ID</label>
                      <input 
                        type="text"
                        value={refundTransactionId} 
                        onChange={e => setRefundTransactionId(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all italic" 
                        placeholder="e.g. TXN100239209"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Est. Completion Date</label>
                      <input 
                        type="date"
                        value={estimatedCompletionDate} 
                        onChange={e => setEstimatedCompletionDate(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-primary transition-all" 
                      />
                    </div>

                    <button 
                      onClick={handleUpdate} 
                      disabled={isUpdating}
                      className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover shadow-lg transition-all"
                    >
                      {isUpdating ? 'Updating...' : 'Save & Sync Request'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

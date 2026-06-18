import React, { useState, useEffect } from 'react';
import { ReturnRequest, Order } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Clock, CreditCard, Box, Image as ImageIcon, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, auth } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const safeFormatDate = (val: any): string => {
  if (!val) return 'N/A';
  let dateObj: Date;
  if (typeof val.toDate === 'function') {
    dateObj = val.toDate();
  } else if (val.seconds) {
    dateObj = new Date(val.seconds * 1000);
  } else {
    dateObj = new Date(val);
  }
  return isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString();
};

export default function AdminReturnsManagementView({ 
  returns,
  onUpdateStatus 
}: { 
  returns: ReturnRequest[],
  onUpdateStatus?: (id: string, status: string, adminNotes: string) => Promise<void>
}) {
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);
  const [orderCache, setOrderCache] = useState<Record<string, Order>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Pending');
  
  // Modal State
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState<number | string>('');
  const [refundMethod, setRefundMethod] = useState('');
  const [refundTransactionId, setRefundTransactionId] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      const newCache = { ...orderCache };
      for (const r of returns) {
        const orderKey = r.customOrderId || r.orderId;
        if (orderKey && !newCache[orderKey]) {
          const docRef = doc(db, 'orders', orderKey);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            newCache[orderKey] = { id: snap.id, ...snap.data() } as Order;
          }
        }
      }
      setOrderCache(newCache);
    };
    if (returns.length > 0) fetchOrders();
  }, [returns]);

  const filteredReturns = returns.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = 
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (r.customOrderId || r.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.contactEmail || r.userId || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleUpdateStatus = async (statusValue: string) => {
    if (!selectedReturn) return;
    setIsUpdating(true);
    const tid = toast.loading(`Updating request to ${statusValue}...`);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/requests/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ 
          requestId: selectedReturn.id, 
          status: statusValue,
          adminNotes,
          refundAmount: refundAmount !== '' ? Number(refundAmount) : undefined,
          refundMethod: refundMethod || undefined,
          refundTransactionId: refundTransactionId || undefined,
          estimatedCompletionDate: estimatedCompletionDate || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Return request updated to ${statusValue}`, { id: tid });
        setSelectedReturn(null);
        if (onUpdateStatus) {
          await onUpdateStatus(selectedReturn.id, statusValue, adminNotes);
        }
      } else {
        toast.error(data.error || 'Update failed', { id: tid });
      }
    } catch (err) {
      toast.error('Network error', { id: tid });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-2xl flex-1 border border-transparent focus-within:border-primary/20 focus-within:bg-white transition-all">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by Return, Order, or Customer ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-sm font-medium"
          />
        </div>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all"
        >
          <option value="all">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Processed">Processed</option>
        </select>
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Return ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Reason</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 font-medium">No return requests found.</td>
                </tr>
              ) : (
                filteredReturns.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 text-sm font-bold text-gray-900">#{req.id.slice(-6).toUpperCase()}</td>
                    <td className="p-4 text-sm font-bold text-gray-600">#{req.customOrderId || req.orderId}</td>
                    <td className="p-4 text-xs font-bold text-gray-650">{req.contactEmail || req.userId || 'N/A'}</td>
                    <td className="p-4 text-xs font-bold text-gray-505">{safeFormatDate(req.createdAt)}</td>
                    <td className="p-4 text-xs font-medium text-gray-700 max-w-[150px] truncate">{req.reason}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        req.status === 'Approved' ? 'bg-green-100 text-green-600' :
                        req.status === 'Rejected' ? 'bg-red-100 text-red-600' :
                        req.status === 'Processed' ? 'bg-blue-100 text-blue-600' :
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedReturn(req);
                          setAdminNotes(req.adminNotes || '');
                          setRefundAmount(req.refundAmount !== undefined ? req.refundAmount : '');
                          setRefundMethod(req.refundMethod || '');
                          setRefundTransactionId(req.refundTransactionId || '');
                          setEstimatedCompletionDate(req.estimatedCompletionDate || '');
                        }}
                        className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedReturn && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedReturn(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-[40px] w-full max-w-4xl p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Return Request Details</h3>
                  <p className="text-sm text-gray-500 font-medium">#{selectedReturn.id.slice(-6).toUpperCase()} • Order #{selectedReturn.customOrderId || selectedReturn.orderId}</p>
                </div>
                <button onClick={() => setSelectedReturn(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Details Column */}
                <div className="space-y-6">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Clock className="w-3 h-3"/> Request Info</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Date</span><span className="text-sm font-bold text-gray-900">{safeFormatDate(selectedReturn.createdAt)}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Status</span><span className="text-sm font-bold uppercase tracking-widest text-primary">{selectedReturn.status}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Reason</span><span className="text-sm font-bold text-gray-900">{selectedReturn.reason}</span></div>
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Comments</span><span className="text-sm font-medium text-gray-700 max-w-[200px] text-right">{selectedReturn.comments || 'None'}</span></div>
                      {selectedReturn.adminNotes && (
                        <div className="flex justify-between"><span className="text-sm text-gray-500">Admin Notes</span><span className="text-sm font-bold text-primary max-w-[200px] text-right">{selectedReturn.adminNotes}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><CreditCard className="w-3 h-3"/> Refund Info</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Amount</span><span className="text-lg font-black text-gray-900">₹{selectedReturn.refundAmount !== undefined ? selectedReturn.refundAmount : 'Not set'}</span></div>
                      {orderCache[selectedReturn.customOrderId || selectedReturn.orderId] && (
                        <div className="flex justify-between"><span className="text-sm text-gray-500">Payment Method</span><span className="text-sm font-bold uppercase text-gray-900">{orderCache[selectedReturn.customOrderId || selectedReturn.orderId].paymentMethod}</span></div>
                      )}
                      {selectedReturn.refundMethod && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Refund Method</span>
                          <span className="text-sm font-bold text-gray-900 uppercase">{selectedReturn.refundMethod}</span>
                        </div>
                      )}
                      {selectedReturn.refundTransactionId && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Transaction ID</span>
                          <span className="text-sm font-bold text-gray-900 italic">{selectedReturn.refundTransactionId}</span>
                        </div>
                      )}
                      {selectedReturn.estimatedCompletionDate && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Est. Completion</span>
                          <span className="text-sm font-bold text-gray-900">{selectedReturn.estimatedCompletionDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><ImageIcon className="w-3 h-3"/> Proof Images</h4>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {selectedReturn.images?.map((img: string, idx: number) => (
                        <a href={img} target="_blank" rel="noreferrer" key={idx} className="w-24 h-24 flex-shrink-0 rounded-2xl border border-gray-200 overflow-hidden block hover:opacity-80 transition-opacity">
                          <img src={img} alt="proof" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Edit & Action Column */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Update Action</h4>
                    
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

                    <div className="flex flex-col gap-2 pt-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Admin Actions</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleUpdateStatus('Approved')}
                          disabled={isUpdating}
                          className="py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus('Rejected')}
                          disabled={isUpdating}
                          className="py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleUpdateStatus('Processed')}
                          disabled={isUpdating}
                          className="py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-md transition-all flex items-center justify-center gap-1"
                        >
                          Processed
                        </button>
                      </div>
                    </div>
                  </div>

                  {orderCache[selectedReturn.customOrderId || selectedReturn.orderId] && (
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Box className="w-3 h-3"/> Items in Order</h4>
                      <div className="space-y-3 max-h-[200px] overflow-y-auto">
                        {orderCache[selectedReturn.customOrderId || selectedReturn.orderId].items.map((item, idx) => {
                          const isSelectedForReturn = selectedReturn.productIds?.includes(item.productId) || selectedReturn.productId === item.productId;
                          return (
                            <div key={idx} className={`flex gap-4 items-center p-3 rounded-2xl border ${
                              isSelectedForReturn ? 'bg-orange-50/50 border-orange-200' : 'bg-white border-gray-100'
                            }`}>
                              <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="text-[10px] text-gray-500">Qty: {item.quantity} • ₹{item.price}</p>
                              </div>
                              {isSelectedForReturn && (
                                <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-orange-100 text-orange-600 rounded">Returning</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

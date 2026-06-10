import React, { useState, useEffect } from 'react';
import { ReturnRequest, Order } from '../types';
import { motion } from 'motion/react';
import { Eye, Check, X, Search, Clock, CreditCard, Box, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminReturnsManagementView({ 
  returns, 
  onUpdateStatus 
}: { 
  returns: ReturnRequest[],
  onUpdateStatus: (id: string, status: string, adminNotes: string) => Promise<void>
}) {
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [orderCache, setOrderCache] = useState<Record<string, Order>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      const newCache = { ...orderCache };
      for (const r of returns) {
        if (!newCache[r.orderId]) {
          const docRef = doc(db, 'orders', r.orderId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            newCache[r.orderId] = { id: snap.id, ...snap.data() } as Order;
          }
        }
      }
      setOrderCache(newCache);
    };
    if (returns.length > 0) fetchOrders();
  }, [returns]);

  const filteredReturns = returns.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSearch = r.id.toLowerCase().includes(searchTerm.toLowerCase()) || r.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleUpdate = async (status: string) => {
    if (!selectedReturn) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(selectedReturn.id, status, adminNotes);
      setSelectedReturn({ ...selectedReturn, status: status as any, adminNotes });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 bg-gray-50 px-4 py-3 rounded-2xl flex-1 border border-transparent focus-within:border-primary/20 focus-within:bg-white transition-all">
          <Search className="w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by Return ID or Order ID..." 
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
          <option value="requested">Requested</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="received_back">Received Back</option>
          <option value="refund_processed">Refund Processed</option>
        </select>
      </div>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Return ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Order ID</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Reason</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 font-medium">No return requests found.</td>
                </tr>
              ) : (
                filteredReturns.map((req) => (
                  <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 text-sm font-bold text-gray-900">#{req.id.slice(-6).toUpperCase()}</td>
                    <td className="p-4 text-sm font-bold text-gray-600">#{req.orderId.startsWith('VBM') ? req.orderId : req.orderId.slice(-8).toUpperCase()}</td>
                    <td className="p-4 text-xs font-bold text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-xs font-medium text-gray-700 max-w-[150px] truncate">{req.reason}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        req.status === 'requested' ? 'bg-orange-100 text-orange-600' :
                        req.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                        req.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        req.status === 'refund_processed' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        {req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setSelectedReturn(req)}
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

      {selectedReturn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedReturn(null)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[40px] w-full max-w-4xl p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-gray-900">Return Request Details</h3>
                <p className="text-sm text-gray-500 font-medium">#{selectedReturn.id.slice(-6).toUpperCase()} • Order #{selectedReturn.orderId.startsWith('VBM') ? selectedReturn.orderId : selectedReturn.orderId.slice(-8).toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedReturn(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Clock className="w-3 h-3"/> Request Info</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Date</span><span className="text-sm font-bold text-gray-900">{new Date(selectedReturn.createdAt).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Status</span><span className="text-sm font-bold uppercase tracking-widest text-primary">{selectedReturn.status.replace('_', ' ')}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Reason</span><span className="text-sm font-bold text-gray-900">{selectedReturn.reason}</span></div>
                    <div className="flex justify-between"><span className="text-sm text-gray-500">Comments</span><span className="text-sm font-medium text-gray-700 max-w-[200px] text-right">{selectedReturn.comments || 'None'}</span></div>
                    {selectedReturn.adminNotes && (
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Admin Notes</span><span className="text-sm font-bold text-primary max-w-[200px] text-right">{selectedReturn.adminNotes}</span></div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><CreditCard className="w-3 h-3"/> Refund Info</h4>
                  <div className="flex justify-between"><span className="text-sm text-gray-500">Amount</span><span className="text-lg font-black text-gray-900">₹{selectedReturn.refundAmount?.toLocaleString()}</span></div>
                  {orderCache[selectedReturn.orderId] && (
                    <div className="flex justify-between mt-2"><span className="text-sm text-gray-500">Payment Method</span><span className="text-sm font-bold uppercase text-gray-900">{orderCache[selectedReturn.orderId].paymentMethod}</span></div>
                  )}
                </div>
                
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><ImageIcon className="w-3 h-3"/> Proof Images</h4>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {selectedReturn.images?.map((img, idx) => (
                      <a href={img} target="_blank" rel="noreferrer" key={idx} className="w-24 h-24 flex-shrink-0 rounded-2xl border border-gray-200 overflow-hidden block hover:opacity-80 transition-opacity">
                        <img src={img} alt="proof" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Update Status</h4>
                  <div className="space-y-3">
                    {selectedReturn.status === 'requested' && (
                      <>
                        <button disabled={isUpdating} onClick={() => handleUpdate('under_review')} className="w-full py-3 bg-purple-50 text-purple-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-100 transition-colors">Mark Under Review</button>
                        <button disabled={isUpdating} onClick={() => handleUpdate('approved')} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">Approve Request</button>
                        <button disabled={isUpdating} onClick={() => handleUpdate('rejected')} className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Reject Request</button>
                      </>
                    )}
                    {selectedReturn.status === 'under_review' && (
                      <>
                        <button disabled={isUpdating} onClick={() => handleUpdate('approved')} className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-colors">Approve Request</button>
                        <button disabled={isUpdating} onClick={() => handleUpdate('rejected')} className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Reject Request</button>
                      </>
                    )}
                    {selectedReturn.status === 'approved' && (
                      <button disabled={isUpdating} onClick={() => handleUpdate('received_back')} className="w-full py-3 bg-orange-50 text-orange-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-orange-100 transition-colors">Mark Received Back</button>
                    )}
                    {selectedReturn.status === 'received_back' && (
                      <button disabled={isUpdating} onClick={() => handleUpdate('refund_processed')} className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors">Process Refund</button>
                    )}
                    {selectedReturn.status === 'refund_processed' && (
                      <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold text-center">Refund Processed & Completed</div>
                    )}
                    {selectedReturn.status === 'rejected' && (
                      <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-bold text-center">Request Rejected</div>
                    )}
                  </div>
                  {['requested', 'under_review', 'approved', 'received_back'].includes(selectedReturn.status) && (
                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Add Admin Note</label>
                      <textarea 
                        value={adminNotes} 
                        onChange={e => setAdminNotes(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:bg-white focus:border-primary outline-none transition-all"
                        placeholder="Internal notes..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {orderCache[selectedReturn.orderId] && (
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2"><Box className="w-3 h-3"/> Items in Order</h4>
                    <div className="space-y-3">
                      {orderCache[selectedReturn.orderId].items.map((item, idx) => (
                        <div key={idx} className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-gray-100">
                          <img src={item.image} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                            <p className="text-[10px] text-gray-500">Qty: {item.quantity} • ₹{item.price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

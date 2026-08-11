import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  RefreshCcw, XCircle, Clock, Upload, CheckCircle2, AlertTriangle, ShieldCheck, Image as ImageIcon 
} from 'lucide-react';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ReturnRequest, Order } from '../../types';
import { useAuthStore, useSettingsStore } from '../../store';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileRequestScreens() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();

  const reqTypeParam = (searchParams.get('type') || 'return') as 'return' | 'cancellation' | 'refund';
  const prefilledOrderId = searchParams.get('orderId') || '';

  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [requestType, setRequestType] = useState<'return' | 'cancellation' | 'refund'>(reqTypeParam);

  // Form State
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(prefilledOrderId);
  const [reason, setReason] = useState<string>('defective_item');
  const [comments, setComments] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Requests History
  const [myRequests, setMyRequests] = useState<ReturnRequest[]>([]);

  // Fetch user orders & existing requests
  useEffect(() => {
    if (!user) return;

    // Fetch user orders
    const qOrders = query(collection(db, 'orders'), where('customerId', '==', user.uid));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      setUserOrders(ordersData);
      if (!selectedOrderId && ordersData.length > 0) {
        setSelectedOrderId(ordersData[0].id);
      }
    });

    // Fetch user requests from 'return_requests' collection
    const qReqs = query(collection(db, 'return_requests'), where('userId', '==', user.uid));
    const unsubReqs = onSnapshot(qReqs, (snap) => {
      const reqsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReturnRequest));
      setMyRequests(reqsData);
    });

    return () => {
      unsubOrders();
      unsubReqs();
    };
  }, [user, selectedOrderId]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert file to base64 preview for submission
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrls(prev => [...prev, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });
    toast.success("Image uploaded!");
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to submit requests");
      navigate('/login');
      return;
    }
    if (!selectedOrderId) {
      toast.error("Please select an order");
      return;
    }

    const selectedOrder = userOrders.find(o => o.id === selectedOrderId);
    if (!selectedOrder) {
      toast.error("Invalid order selected");
      return;
    }

    // Return policy verification: 7 days check for return
    if (requestType === 'return') {
      if (selectedOrder.status !== 'delivered') {
        toast.error("Returns can only be requested for delivered orders.");
        return;
      }
      const delDate = selectedOrder.deliveryDate ? new Date(selectedOrder.deliveryDate) : new Date(selectedOrder.createdAt);
      const daysDiff = Math.floor((new Date().getTime() - delDate.getTime()) / (1000 * 3600 * 24));
      const windowDays = settings.returnWindowDays || 7;
      if (daysDiff > windowDays) {
        toast.error(`Return policy window (${windowDays} days) has expired for this order.`);
        return;
      }
      if (imageUrls.length === 0) {
        toast.error("Please upload proof images of the wrong or defective product.");
        return;
      }
    }

    setIsSubmitting(true);

    const newRequest: Omit<ReturnRequest, 'id'> = {
      orderId: selectedOrder.id,
      customOrderId: selectedOrder.customOrderId || `VBM-${selectedOrder.id.slice(-6)}`,
      userId: user.uid,
      contactEmail: user.email,
      type: requestType,
      productId: selectedOrder.items?.[0]?.productId || '',
      productIds: selectedOrder.items?.map(i => i.productId) || [],
      reason,
      comments: comments.trim(),
      images: imageUrls,
      status: 'requested',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'return_requests'), newRequest);
      toast.success(`${requestType.toUpperCase()} request submitted! Admin will verify.`, { icon: '📝' });
      setComments('');
      setImageUrls([]);
      setActiveTab('list');
    } catch (err) {
      console.error("Failed to submit request:", err);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('approved') || s.includes('processed') || s.includes('completed')) {
      return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">Approved</span>;
    }
    if (s.includes('reject')) {
      return <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">Rejected</span>;
    }
    return <span className="bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">Requested / Under Review</span>;
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none p-3 space-y-3">
      {/* Header & Tabs */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-orange-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">Returns & Cancellations</h2>
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>

        {/* Action Toggle Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'create' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Submit Request
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            My Requests ({myRequests.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form onSubmit={handleSubmitRequest} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
          {/* Request Type Selector */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Request Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'return', label: 'Return' },
                { type: 'cancellation', label: 'Cancel Order' },
                { type: 'refund', label: 'Refund' },
              ].map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setRequestType(t.type as any)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    requestType === t.type
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select Order */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Select Order</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {userOrders.length > 0 ? (
                userOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Order #{o.customOrderId || o.id.slice(-6)} (₹{o.total.toLocaleString()}) - {o.status.toUpperCase()}
                  </option>
                ))
              ) : (
                <option value="">No orders found</option>
              )}
            </select>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason for {requestType}</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="defective_item">Defective or Damaged Product</option>
              <option value="wrong_item">Received Wrong Item / Size</option>
              <option value="quality_issue">Product Quality Not as Expected</option>
              <option value="changed_mind">Order Created by Mistake</option>
            </select>
          </div>

          {/* Comments / Details */}
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Additional Details</label>
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Describe the issue in detail..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Proof Image Upload (Mandatory for Returns) */}
          {requestType === 'return' && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="text-[10px] font-black uppercase text-gray-500 block">
                Upload Proof Images (Required for Defective/Wrong Product Return)
              </label>

              <div className="flex items-center gap-2">
                <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-gray-50 transition-all">
                  <Upload className="w-5 h-5 text-gray-400 mb-1" />
                  <span className="text-[10px] font-bold text-gray-600">Choose Image File</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>

                {imageUrls.map((img, idx) => (
                  <div key={idx} className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Trigger */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md disabled:opacity-50 active:scale-95"
          >
            {isSubmitting ? 'Submitting Request...' : `Submit ${requestType.toUpperCase()} Request`}
          </button>
        </form>
      ) : (
        /* Requests History List */
        <div className="space-y-3">
          {myRequests.length > 0 ? (
            myRequests.map((req) => (
              <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-xs font-black text-gray-900">
                    Request #{req.id.slice(-6).toUpperCase()} ({req.type?.toUpperCase() || 'RETURN'})
                  </span>
                  {getStatusBadge(req.status)}
                </div>

                <div className="text-xs space-y-1 text-gray-700">
                  <p><strong>Order Ref:</strong> {req.customOrderId || req.orderId}</p>
                  <p><strong>Reason:</strong> {req.reason}</p>
                  {req.comments && <p className="text-gray-500">"{req.comments}"</p>}
                  <p className="text-[10px] text-gray-400">Submitted: {new Date(req.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center border border-orange-100">
              <p className="text-xs font-bold text-gray-500">No requests submitted yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

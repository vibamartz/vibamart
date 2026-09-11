import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Package, Clock, Truck, ShieldCheck, FileText, Download, 
  ArrowLeft, MapPin, AlertCircle, RefreshCcw, XCircle, Upload, X, HelpCircle, CreditCard, Sparkles, Star
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, getDocs, limit } from 'firebase/firestore';
import { db, auth, storage } from '../../backend/firebase/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Order, OrderStatus, Product } from '../../shared/types';
import { useAuthStore, useSettingsStore } from '../../backend/store';
import InvoiceModal from '../../desktop/components/InvoiceModal';
import ReviewModal from '../../shared/components/ReviewModal';
import { formatDeliveredDate } from '../../shared/utilities/dateUtils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileOrderDetailsScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  // Active Request State
  const [activeRequest, setActiveRequest] = useState<any | null>(null);

  // Modal States
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewProductId, setSelectedReviewProductId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Inputs
  const [cancelReason, setCancelReason] = useState('Order Created by Mistake');
  const [cancelComments, setCancelComments] = useState('');

  const [returnReason, setReturnReason] = useState('defective_item');
  const [returnComments, setReturnComments] = useState('');
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [selectedReturnProducts, setSelectedReturnProducts] = useState<string[]>([]);

  const [refundReason, setRefundReason] = useState('Order Cancelled/Returned');

  // Fetch Order
  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'orders', orderId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const ordData = { id: snap.id, ...snap.data() } as Order;
          setOrder(ordData);
          setSelectedReturnProducts(ordData.items?.map(i => i.productId) || []);
        } else {
          toast.error("Order not found");
          navigate('/orders');
        }
      } catch (err) {
        console.error("Error fetching order:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

  // Listen to Firestore requests for this order
  useEffect(() => {
    if (!order) return;
    const targetId = order.customOrderId || order.id;

    const cancelQuery = query(collection(db, 'cancellation_requests'), where('customOrderId', '==', targetId));
    const returnQuery = query(collection(db, 'return_requests'), where('customOrderId', '==', targetId));
    const refundQuery = query(collection(db, 'refund_requests'), where('customOrderId', '==', targetId));

    const unsubCancel = onSnapshot(cancelQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'cancellation' });
      }
    });

    const unsubReturn = onSnapshot(returnQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'return' });
      }
    });

    const unsubRefund = onSnapshot(refundQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'refund' });
      }
    });

    return () => {
      unsubCancel();
      unsubReturn();
      unsubRefund();
    };
  }, [order]);

  // Fetch Recommended Products
  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        const q = query(collection(db, 'products'), limit(4));
        const snap = await getDocs(q);
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setRecommendedProducts(prods);
      } catch (err) {
        console.error("Error fetching recommended products:", err);
      }
    };
    fetchRecommended();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setReturnImages(prev => [...prev, reader.result as string].slice(0, 3));
        }
      };
      reader.readAsDataURL(file);
    });
    toast.success("Image added!");
  };

  const removeReturnImage = (index: number) => {
    setReturnImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !user) return;
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          customOrderId: order.customOrderId || order.id, 
          contactEmail: user.email, 
          reason: `${cancelReason}${cancelComments ? `: ${cancelComments}` : ''}` 
        })
      });

      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        toast.success(data.message || "Cancellation request submitted!");
      } else {
        await addDoc(collection(db, 'cancellation_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user.uid,
          contactEmail: user.email,
          reason: `${cancelReason}${cancelComments ? `: ${cancelComments}` : ''}`,
          status: 'requested',
          type: 'cancellation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Cancellation request submitted successfully!");
      }
      setShowCancelModal(false);
    } catch (err: any) {
      console.error("Cancel order error:", err);
      toast.error(err.message || "Failed to submit cancellation request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !user) return;

    if (returnImages.length === 0) {
      toast.error("Please upload at least 1 proof image of the product.");
      return;
    }
    if (selectedReturnProducts.length === 0) {
      toast.error("Please select at least 1 item to return.");
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedImageUrls = await Promise.all(returnImages.map(async (imgBase64, index) => {
        if (!storage.app.options.storageBucket) {
          return imgBase64;
        }
        try {
          const imageRef = ref(storage, `returns/${order.id}_${Date.now()}_${index}`);
          await uploadString(imageRef, imgBase64, 'data_url');
          return await getDownloadURL(imageRef);
        } catch (error) {
          return imgBase64;
        }
      }));

      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/returns/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          customOrderId: order.customOrderId || order.id, 
          contactEmail: user.email,
          productIds: selectedReturnProducts,
          reason: returnReason,
          comments: returnComments,
          images: uploadedImageUrls 
        })
      });

      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        toast.success(data.message || "Return request submitted!");
      } else {
        await addDoc(collection(db, 'return_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user.uid,
          contactEmail: user.email,
          type: 'return',
          productId: selectedReturnProducts[0] || '',
          productIds: selectedReturnProducts,
          reason: returnReason,
          comments: returnComments,
          images: uploadedImageUrls,
          status: 'requested',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Return request submitted successfully!");
      }
      setShowReturnModal(false);
    } catch (err: any) {
      console.error("Return request error:", err);
      toast.error(err.message || "Failed to submit return request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !user) return;
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          customOrderId: order.customOrderId || order.id, 
          contactEmail: user.email,
          reason: refundReason
        })
      });

      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (response.ok && data?.success) {
        toast.success(data.message || "Refund request submitted!");
      } else {
        await addDoc(collection(db, 'refund_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user.uid,
          contactEmail: user.email,
          type: 'refund',
          reason: refundReason,
          refundAmount: order.total,
          status: 'requested',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Refund request submitted successfully!");
      }
      setShowRefundModal(false);
    } catch (err: any) {
      console.error("Refund request error:", err);
      toast.error(err.message || "Failed to submit refund request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading Order Details...</span>
        </div>
      </div>
    );
  }

  const STAGES: { key: OrderStatus; label: string }[] = [
    { key: 'pending', label: 'Order Placed' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'packed', label: 'Packed' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const getStageIndex = (status: OrderStatus) => {
    const idx = STAGES.findIndex(s => s.key === status);
    return idx >= 0 ? idx : (status === 'delivered' ? 5 : 0);
  };

  const currentStageIndex = getStageIndex(order.status);
  const isCancelled = ['cancelled', 'cancel_requested', 'cancel_rejected', 'returned', 'refunded'].includes(order.status);
  const displayId = order.customOrderId || `VBM-${order.id.slice(-6).toUpperCase()}`;

  const windowDays = settings?.returnWindowDays || 7;
  const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date(order.createdAt);
  const daysDiff = Math.floor((new Date().getTime() - deliveryDate.getTime()) / (1000 * 3600 * 24));
  const isReturnEligible = order.status === 'delivered' && daysDiff <= windowDays;

  const canCancel = ['pending', 'confirmed', 'packed'].includes(order.status) && !activeRequest;
  const canReturn = isReturnEligible && !activeRequest;
  const canRefund = ['cancelled', 'returned'].includes(order.status) && order.paymentStatus !== 'refunded' && !activeRequest;

  const getCustomerStatusWord = (req: any, orderStatus: OrderStatus): string => {
    if (req) {
      const typeStr = (req.requestType || req.type || '').toLowerCase();
      if (typeStr.includes('cancel')) return 'Canceled';
      if (typeStr.includes('return')) return 'Returned';
      if (typeStr.includes('refund')) return 'Refunded';
    }
    if (['cancelled', 'cancel_requested', 'cancel_rejected'].includes(orderStatus)) return 'Canceled';
    if (orderStatus === 'returned') return 'Returned';
    if (orderStatus === 'refunded') return 'Refunded';
    if (orderStatus === 'delivered' && order) return formatDeliveredDate(order);
    return orderStatus;
  };

  const statusDisplayWord = getCustomerStatusWord(activeRequest, order.status);

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-36 sm:pb-40 font-sans select-none p-3 space-y-3">
      
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400">Order Reference</span>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-base font-black text-gray-900">{displayId}</h2>
              {order.status === 'delivered' ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full">
                  {formatDeliveredDate(order)}
                </span>
              ) : isCancelled ? (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-full">
                  {statusDisplayWord}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {new Date(order.createdAt).toLocaleDateString()}
            </span>
            {/* Help Button inside Order Details Header */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" /> Help
            </button>
          </div>
        </div>

        {order.status === 'delivered' && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                <FileText className="w-4 h-4 text-emerald-600" /> Tax Invoice Available
              </span>
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> View Invoice
              </button>
            </div>

            {/* Rate your Experience Section */}
            <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <div>
                  <span className="text-xs font-black text-gray-900 block">Rate your Experience</span>
                  <span className="text-[10px] text-gray-500 font-bold">Share product review</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedReviewProductId(order.items?.[0]?.productId);
                  setShowReviewModal(true);
                }}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 fill-gray-950" /> Rate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LIVE REQUEST STATUS CARD */}
      {activeRequest && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-200 space-y-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-black text-gray-900 uppercase">
                Request Record
              </h3>
            </div>
            <span className="bg-rose-100 text-rose-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
              {statusDisplayWord}
            </span>
          </div>

          <div className="space-y-1 text-xs text-gray-700 pt-1">
            <p><strong>Reason:</strong> {activeRequest.reason}</p>
            {activeRequest.comments && <p className="text-gray-500 italic">"{activeRequest.comments}"</p>}
            
            {activeRequest.images && activeRequest.images.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold text-gray-400 block mb-1">Proof Images:</span>
                <div className="flex gap-2">
                  {activeRequest.images.map((img: string, idx: number) => (
                    <img key={idx} src={img} alt="Proof" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Triggers: Cancel / Return / Refund Requests inside Order Details */}
      {(canCancel || canReturn || canRefund) && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-yellow-100 space-y-2">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Available Order Actions</h3>
          
          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4 text-rose-600" /> Cancel Order
            </button>
          )}

          {canReturn && (
            <button
              onClick={() => setShowReturnModal(true)}
              className="w-full py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4 text-amber-600" /> Request {windowDays}-Day Return
            </button>
          )}

          {canRefund && (
            <button
              onClick={() => setShowRefundModal(true)}
              className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4 text-indigo-600" /> Request Refund
            </button>
          )}
        </div>
      )}

      {/* Shipment Tracking Pipeline */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
          Shipment Tracking Pipeline
        </h3>

        {!isCancelled ? (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {STAGES.map((stage, idx) => {
              const isCompleted = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div key={stage.key} className="relative flex items-center justify-between text-xs">
                  <div
                    className={`absolute -left-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-amber-500 border-amber-500 text-white animate-pulse'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </div>

                  <span className={`font-bold ${isCompleted ? 'text-emerald-900' : isCurrent ? 'text-amber-900 font-extrabold' : 'text-gray-400'}`}>
                    {stage.label}
                  </span>

                  {isCurrent && (
                    <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Live State
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>This order status is {statusDisplayWord}.</span>
          </div>
        )}
      </div>

      {/* STRICT SECTION ORDER (1. PRODUCTS -> 2. DELIVERY DETAILS -> 3. PRICE DETAILS -> 4. PRODUCTS FOR YOU) */}
      <div className="space-y-3">

        {/* 1. PRODUCTS */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              1. Products ({order.items.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {order.items.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                <img
                  src={item.image || 'https://via.placeholder.com/50'}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                  <span className="text-[10px] text-gray-500 font-semibold block">Qty: {item.quantity}</span>
                  {order.status === 'delivered' && (
                    <button
                      onClick={() => {
                        setSelectedReviewProductId(item.productId);
                        setShowReviewModal(true);
                      }}
                      className="mt-1 text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                    >
                      <Star className="w-2.5 h-2.5 fill-amber-600 text-amber-600" /> Rate
                    </button>
                  )}
                </div>
                <span className="text-xs font-black text-gray-900">
                  ₹{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. DELIVERY DETAILS */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              2. Delivery Details
            </h3>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-1">
            <span className="text-[9px] font-black uppercase text-gray-400 block">Customer Name</span>
            <p className="font-extrabold text-gray-900">{order.contactName || order.address.fullName}</p>
            <span className="text-[9px] font-black uppercase text-gray-400 block pt-1">Delivery Address</span>
            <p className="text-gray-700 font-medium">{order.address.house ? `${order.address.house}, ` : ''}{order.address.street}</p>
            <p className="text-gray-600 font-medium">{order.address.city}, {order.address.state} - {order.address.zip}</p>
            <span className="text-[9px] font-black uppercase text-gray-400 block pt-1">Contact Information</span>
            <p className="text-emerald-700 font-bold">Phone: {order.contactPhone || order.address.phone}</p>
            <p className="text-gray-600 font-medium">Email: {order.contactEmail || user?.email || 'N/A'}</p>
          </div>
        </div>

        {/* 3. PRICE DETAILS */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              3. Price Details
            </h3>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-2">
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Items Subtotal</span>
              <span>₹{(order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600 font-medium">
              <span>Delivery Charges</span>
              <span className="text-emerald-600 font-bold">FREE</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-sm font-black text-gray-900">
              <span>Total Paid</span>
              <span className="text-base text-emerald-700">₹{order.total.toLocaleString()}</span>
            </div>
            <div className="pt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">
              <span>Payment Method: {order.paymentMethod || 'Online'}</span>
              <span className="text-emerald-600">Status: Paid</span>
            </div>
          </div>
        </div>

        {/* 4. PRODUCTS FOR YOU */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              4. Products For You
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recommendedProducts.map((p) => (
              <Link key={p.id} to={`/products/${p.slug || p.id}`} className="bg-gray-50 p-2.5 rounded-xl border border-gray-200/80 flex flex-col justify-between">
                <div className="aspect-square bg-white rounded-lg overflow-hidden mb-2 border border-gray-100">
                  <img src={p.image || p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs font-black text-emerald-700 mt-0.5">₹{p.price.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* HELP MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-black text-gray-900">Order Help & Support</h3>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              {activeRequest ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 uppercase">Existing Request Info</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                      {statusDisplayWord}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">Reason: {activeRequest.reason}</p>
                  {activeRequest.comments && <p className="text-gray-500 italic">"{activeRequest.comments}"</p>}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-gray-600">Need assistance with order {displayId}? Choose an option below:</p>
                  
                  {canCancel && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowCancelModal(true); }}
                      className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" /> Cancel Order
                    </button>
                  )}

                  {canReturn && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowReturnModal(true); }}
                      className="w-full py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4 text-amber-600" /> Request Return
                    </button>
                  )}

                  {canRefund && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowRefundModal(true); }}
                      className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4 text-indigo-600" /> Request Refund
                    </button>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                <p className="font-bold text-gray-800">Need further support?</p>
                <p>Contact customer care at <span className="text-emerald-700 font-bold">viba.mart@hotmail.com</span></p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          order={order}
        />
      )}

      {/* CANCEL ORDER MODAL */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-black text-gray-900">Cancel Order Request</h3>
                <button onClick={() => setShowCancelModal(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmitCancel} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason for Cancellation</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Order Created by Mistake">Order Created by Mistake</option>
                    <option value="Item Price Changed / High Shipping">Item Price Changed / High Shipping</option>
                    <option value="Found Better Price Elsewhere">Found Better Price Elsewhere</option>
                    <option value="Delivery Duration Too Long">Delivery Duration Too Long</option>
                    <option value="Other Reason">Other Reason</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Additional Details (Optional)</label>
                  <textarea
                    rows={2}
                    value={cancelComments}
                    onChange={(e) => setCancelComments(e.target.value)}
                    placeholder="Provide details..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Cancellation'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REQUEST RETURN MODAL */}
      <AnimatePresence>
        {showReturnModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-black text-gray-900">Request {windowDays}-Day Return</h3>
                <button onClick={() => setShowReturnModal(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmitReturn} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Select Item(s) to Return</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {order.items.map((item) => (
                      <label key={item.productId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedReturnProducts.includes(item.productId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReturnProducts(prev => [...prev, item.productId]);
                            } else {
                              setSelectedReturnProducts(prev => prev.filter(id => id !== item.productId));
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="truncate flex-1">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason for Return</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="defective_item">Defective or Damaged Product</option>
                    <option value="wrong_item">Received Wrong Item / Size</option>
                    <option value="quality_issue">Product Quality Not as Expected</option>
                    <option value="changed_mind">Order Created by Mistake</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Issue Details</label>
                  <textarea
                    rows={2}
                    value={returnComments}
                    onChange={(e) => setReturnComments(e.target.value)}
                    placeholder="Describe the issue with the item..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 block">
                    Upload Proof Images <span className="text-rose-500">*Required</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-gray-50">
                      <Upload className="w-4 h-4 text-gray-400 mb-0.5" />
                      <span className="text-[10px] font-bold text-gray-600">Choose Image File</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>

                    {returnImages.map((img, idx) => (
                      <div key={idx} className="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeReturnImage(idx)} className="absolute top-0 right-0 bg-rose-500 text-white p-0.5"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REQUEST REFUND MODAL */}
      <AnimatePresence>
        {showRefundModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: 0 }} className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-black text-gray-900">Request Refund</h3>
                <button onClick={() => setShowRefundModal(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSubmitRefund} className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason for Refund</label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Order Cancelled/Returned">Order Cancelled / Returned</option>
                    <option value="Payment Deducted but Order Pending">Payment Deducted but Order Pending</option>
                    <option value="Duplicate Payment Charged">Duplicate Payment Charged</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Refund Request'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {order && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          order={order}
          user={user}
          initialProductId={selectedReviewProductId}
        />
      )}

    </div>
  );
}

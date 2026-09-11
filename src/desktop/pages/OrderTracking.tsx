import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, auth, storage } from '../../backend/firebase/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Order, OrderStatus, Product } from '../../shared/types';
import { useAuthStore, useSettingsStore } from '../../backend/store';
import { 
  Package, Truck, CheckCircle, Clock, MapPin, ArrowLeft, Loader2, AlertCircle, FileText, 
  RefreshCcw, XCircle, CreditCard, Upload, X, ShieldCheck, HelpCircle, Sparkles, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import InvoiceModal from '../components/InvoiceModal';
import ReviewModal from '../../shared/components/ReviewModal';
import { formatDeliveredDate } from '../../shared/utilities/dateUtils';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<OrderStatus, { icon: any, color: string, label: string }> = {
  pending: { icon: Clock, color: 'text-[#22C55E]', label: 'Order Placed' },
  confirmed: { icon: CheckCircle, color: 'text-[#22C55E]', label: 'Order Confirmed' },
  packed: { icon: Package, color: 'text-[#22C55E]', label: 'Packed' },
  shipped: { icon: Truck, color: 'text-[#22C55E]', label: 'Shipped' },
  out_for_delivery: { icon: MapPin, color: 'text-[#22C55E]', label: 'Out for Delivery' },
  delivered: { icon: CheckCircle, color: 'text-[#22C55E]', label: 'Delivered' },
  cancelled: { icon: AlertCircle, color: 'text-red-500', label: 'Canceled' },
  cancel_requested: { icon: Clock, color: 'text-red-500', label: 'Canceled' },
  cancel_rejected: { icon: AlertCircle, color: 'text-red-500', label: 'Canceled' },
  returned: { icon: AlertCircle, color: 'text-red-500', label: 'Returned' },
  refunded: { icon: AlertCircle, color: 'text-red-500', label: 'Refunded' }
};

const TIMELINE_STEPS: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock },
  { status: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle },
];

const NORMAL_STEP_INDICES: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  packed: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
};

const getCompletedStepsInfo = (order: Order): { completed: Set<number>, isTerminalRed: boolean, terminalLabel: string } => {
  const completed = new Set<number>();
  completed.add(0);

  const isCancelled = ['cancelled', 'cancel_requested', 'cancel_rejected'].includes(order.status);
  const isRefunded = ['returned', 'refunded'].includes(order.status);
  const isTerminalRed = isCancelled || isRefunded;

  let terminalLabel = 'Delivered';
  if (isRefunded) {
    terminalLabel = order.status === 'returned' ? 'Returned' : 'Refunded';
  } else if (isCancelled) {
    terminalLabel = 'Canceled';
  }

  if (order.statusHistory && Array.isArray(order.statusHistory)) {
    order.statusHistory.forEach((update) => {
      const idx = NORMAL_STEP_INDICES[update.status];
      if (idx !== undefined && idx < 5) {
        completed.add(idx);
      }
    });
  }

  const currentIdx = NORMAL_STEP_INDICES[order.status];
  if (currentIdx !== undefined && currentIdx < 5) {
    for (let i = 0; i <= currentIdx; i++) {
      completed.add(i);
    }
  }

  if (order.status === 'delivered') {
    for (let i = 0; i <= 5; i++) {
      completed.add(i);
    }
  } else if (isTerminalRed) {
    completed.add(5);
  }

  return { completed, isTerminalRed, terminalLabel };
};

const getProgressWidthPercentage = (completedSteps: Set<number>): number => {
  if (completedSteps.size === 0) return 0;
  let maxCompletedIndex = 0;
  completedSteps.forEach((idx) => {
    if (idx > maxCompletedIndex) maxCompletedIndex = idx;
  });
  return (maxCompletedIndex / (TIMELINE_STEPS.length - 1)) * 100;
};

const getDotColorClass = (statusStr: string, messageStr: string = ''): string => {
  const s = (statusStr || '').toLowerCase();
  const m = (messageStr || '').toLowerCase();

  const redKeywords = ['cancel', 'cancelled', 'rejected', 'refunded', 'returned'];
  if (redKeywords.some(k => s.includes(k) || m.includes(k))) {
    return 'bg-[#EF4444] shadow-red-500/50';
  }

  return 'bg-[#22C55E] shadow-emerald-500/50';
};

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();

  const [order, setOrder] = useState<Order | null>(null);
  const [activeRequest, setActiveRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(orderId || '');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  // Action Modals State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewProductId, setSelectedReviewProductId] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Inputs
  const [cancelReason, setCancelReason] = useState('Order Created by Mistake');
  const [returnReason, setReturnReason] = useState('Wrong Product Received');
  const [returnComments, setReturnComments] = useState('');
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [selectedReturnProducts, setSelectedReturnProducts] = useState<string[]>([]);
  const [refundReason, setRefundReason] = useState('Order Cancelled/Returned');

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const orderRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        const ord = { id: docSnap.id, ...docSnap.data() } as Order;
        setOrder(ord);
        setSelectedReturnProducts(ord.items?.map(i => i.productId) || []);
        setLoading(false);
      } else {
        const q = query(collection(db, 'orders'), where('customOrderId', '==', orderId));
        getDocs(q).then((querySnap) => {
          if (!querySnap.empty) {
            const matchedDoc = querySnap.docs[0];
            const ord = { id: matchedDoc.id, ...matchedDoc.data() } as Order;
            setOrder(ord);
            setSelectedReturnProducts(ord.items?.map(i => i.productId) || []);
          } else {
            setOrder(null);
          }
          setLoading(false);
        }).catch((err) => {
          console.error("Error querying order by customOrderId:", err);
          setOrder(null);
          setLoading(false);
        });
      }
    }, (error) => {
      console.error("Error listening to order:", error);
      setOrder(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const targetId = order.customOrderId || order.id;

    const cancelQuery = query(collection(db, 'cancellation_requests'), where('customOrderId', '==', targetId));
    const returnQuery = query(collection(db, 'return_requests'), where('customOrderId', '==', targetId));
    const refundQuery = query(collection(db, 'refund_requests'), where('customOrderId', '==', targetId));

    const unsubCancel = onSnapshot(cancelQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Cancellation' });
      }
    });

    const unsubReturn = onSnapshot(returnQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Return' });
      }
    });

    const unsubRefund = onSnapshot(refundQuery, (snap) => {
      if (!snap.empty) {
        setActiveRequest({ ...snap.docs[0].data(), id: snap.docs[0].id, requestType: 'Refund' });
      }
    });

    return () => {
      unsubCancel();
      unsubReturn();
      unsubRefund();
    };
  }, [order]);

  // Fetch Recommended Products for "Products For You"
  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        const q = query(collection(db, 'products'), limit(15));
        const snap = await getDocs(q);
        const rewardIds = await getRewardProductIds();
        const prods = filterOutRewardProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)), rewardIds).slice(0, 4);
        setRecommendedProducts(prods);
      } catch (err) {
        console.error("Error fetching recommended products:", err);
      }
    };
    fetchRecommended();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/track-order/${searchInput.trim()}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReturnImages(prev => [...prev, reader.result as string].slice(0, 3));
      };
      reader.readAsDataURL(file);
      toast.success("Image attached!");
    }
  };

  const removeReturnImage = (index: number) => {
    setReturnImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCancelOrder = async () => {
    if (!order || !cancelReason) return;
    setIsSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ customOrderId: order.customOrderId || order.id, contactEmail: user?.email || order.contactEmail, reason: cancelReason })
      });
      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch { data = null; }

      if (response.ok && data?.success) {
        toast.success(data.message || 'Cancellation request submitted');
      } else {
        await addDoc(collection(db, 'cancellation_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user?.uid || '',
          contactEmail: user?.email || order.contactEmail,
          reason: cancelReason,
          status: 'requested',
          type: 'cancellation',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Cancellation request submitted successfully!");
      }
      setShowCancelModal(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during cancellation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!order || !returnReason || returnImages.length === 0 || selectedReturnProducts.length === 0) {
      toast.error('Please select items, reason, and upload at least one proof image');
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
        } catch {
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
          contactEmail: user?.email || order.contactEmail,
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
      } catch { data = null; }

      if (response.ok && data?.success) {
        toast.success(data.message || 'Return request submitted');
      } else {
        await addDoc(collection(db, 'return_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user?.uid || '',
          contactEmail: user?.email || order.contactEmail,
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
      toast.error(err.message || 'An error occurred during return request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!order || !refundReason) {
      toast.error('Please select refund reason');
      return;
    }
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
          contactEmail: user?.email || order.contactEmail,
          reason: refundReason
        })
      });
      let data;
      try {
        const text = await response.text();
        data = JSON.parse(text);
      } catch { data = null; }

      if (response.ok && data?.success) {
        toast.success(data.message || 'Refund request submitted');
      } else {
        await addDoc(collection(db, 'refund_requests'), {
          orderId: order.id,
          customOrderId: order.customOrderId || order.id,
          userId: user?.uid || '',
          contactEmail: user?.email || order.contactEmail,
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
      toast.error(err.message || 'An error occurred during refund request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!orderId && !order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-gray-100"
        >
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Truck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Track Your Order</h2>
          <p className="text-gray-500 mb-8 font-medium">Enter your Order ID to see real-time updates of your delivery.</p>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. VBM202606051234)"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all font-bold text-center"
              required
            />
            <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 hover:bg-primary-hover transition-all">
              Track Status
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-gray-100"
        >
          <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2">Order Not Found</h2>
          <p className="text-gray-500 mb-8 font-medium">We couldn't find order <span className="font-bold text-gray-900">{orderId}</span>. Try another ID below.</p>
          
          <form onSubmit={handleSearch} className="space-y-4">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter Order ID (e.g. VBM202606051234)"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all font-bold text-center"
              required
            />
            <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-gray-200 hover:bg-black transition-all">
              Try Again
            </button>
          </form>

          <Link to="/profile" className="inline-block mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-primary transition-colors">
            Back to My Orders
          </Link>
        </motion.div>
      </div>
    );
  }

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
    return STATUS_CONFIG[orderStatus]?.label || orderStatus;
  };

  const statusDisplayWord = getCustomerStatusWord(activeRequest, order.status);
  const { completed: completedSteps, isTerminalRed, terminalLabel } = getCompletedStepsInfo(order);
  const progressPercentage = getProgressWidthPercentage(completedSteps);

  const timelineSteps = [
    { status: 'pending', label: 'Order Placed', icon: Clock },
    { status: 'confirmed', label: 'Order Confirmed', icon: CheckCircle },
    { status: 'packed', label: 'Packed', icon: Package },
    { status: 'shipped', label: 'Shipped', icon: Truck },
    { status: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
    { 
      status: isTerminalRed ? (terminalLabel === 'Refunded' || terminalLabel === 'Returned' ? 'refunded' : 'cancelled') : 'delivered', 
      label: terminalLabel, 
      icon: isTerminalRed ? AlertCircle : CheckCircle 
    },
  ];

  const getLatestStatusUpdate = () => {
    if (activeRequest) {
      return {
        message: statusDisplayWord,
        location: activeRequest.reason ? `Reason: ${activeRequest.reason}` : undefined,
        timestamp: activeRequest.updatedAt || activeRequest.createdAt || order.createdAt,
        dotColorClass: 'bg-[#EF4444] shadow-red-500/50'
      };
    }

    const sorted = [...(order.statusHistory || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (sorted.length > 0) {
      const top = sorted[0];
      let msg = top.message;
      const s = (top.status || '').toLowerCase();
      if (s.includes('cancel')) msg = 'Canceled';
      else if (s.includes('return')) msg = 'Returned';
      else if (s.includes('refund')) msg = 'Refunded';

      return {
        message: msg || statusDisplayWord,
        location: top.location,
        timestamp: top.timestamp,
        dotColorClass: getDotColorClass(top.status, top.message)
      };
    }

    return {
      message: statusDisplayWord,
      location: undefined,
      timestamp: order.createdAt,
      dotColorClass: getDotColorClass(order.status)
    };
  };

  const latestUpdate = getLatestStatusUpdate();

  // Return Eligibility Check
  const windowDays = settings?.returnWindowDays || 7;
  const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date(order.createdAt);
  const daysDiff = Math.floor((new Date().getTime() - deliveryDate.getTime()) / (1000 * 3600 * 24));
  const isReturnEligible = order.status === 'delivered' && daysDiff <= windowDays;

  // Eligibility triggers
  const canCancel = ['pending', 'confirmed', 'packed'].includes(order.status) && !activeRequest;
  const canReturn = isReturnEligible && !activeRequest;
  const canRefund = ['cancelled', 'returned'].includes(order.status) && order.paymentStatus !== 'refunded' && !activeRequest;

  return (
    <div className="min-h-screen bg-white py-8 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* HEADER BAR */}
        <div className="p-8 md:p-10 rounded-3xl bg-gray-900 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Order Details</p>
              <div className="flex items-center gap-4">
                 <h1 className="text-3xl font-black tracking-tight">{order.customOrderId || order.id}</h1>
                 <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                   ['cancelled', 'cancel_requested', 'cancel_rejected', 'refunded', 'returned'].includes(order.status) || activeRequest
                     ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                     : 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30'
                 }`}>
                   {statusDisplayWord}
                 </span>
              </div>
            </div>
            <div className="text-right flex flex-col md:items-end gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-0.5">Order Date</p>
              <p className="text-lg font-black">{new Date(order.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-0.5 mt-2">Expected Delivery</p>
              <p className="text-xl font-black">
                {order.estimatedDelivery ? (
                  /^\d{4}-\d{2}-\d{2}$/.test(order.estimatedDelivery) 
                    ? new Date(order.estimatedDelivery).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                    : order.estimatedDelivery
                ) : 'Calculating...'}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {order.status === 'delivered' && (
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Download Invoice
                  </button>
                )}

                {/* Help Button inside Order Details */}
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-black uppercase tracking-wider rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-gray-950" /> Help
                </button>
              </div>
            </div>

            {/* Rate your Experience Section for Delivered Orders */}
            {order.status === 'delivered' && (
              <div className="mt-6 pt-5 border-t border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-400/20 rounded-2xl border border-amber-400/30">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Rate your Experience</h4>
                    <p className="text-xs text-gray-400 font-medium">Delivered · Tell us about your order & products</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedReviewProductId(order.items?.[0]?.productId);
                    setShowReviewModal(true);
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4 fill-gray-950" /> Rate your Experience
                </button>
              </div>
            )}
          </div>
        </div>

        <InvoiceModal
          order={order}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />

        <div className="space-y-10">
          
          {/* Action Bar / Trigger Buttons inside Order Details */}
          {(canCancel || canReturn || canRefund) && (
            <div className="pb-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Eligible Actions for this Order</h4>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Submit your request directly from this order details section.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-6 py-3 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
                  >
                    <XCircle className="w-4 h-4" /> Cancel Order
                  </button>
                )}

                {canReturn && (
                  <button
                    onClick={() => setShowReturnModal(true)}
                    className="px-6 py-3 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCcw className="w-4 h-4 text-amber-600" /> Request Return
                  </button>
                )}

                {canRefund && (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="px-6 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
                  >
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Request Refund
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Request Status Card (If Active Request Exists) */}
          {activeRequest && (
            <div className="pb-6 border-b border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Request Record</p>
                    <h3 className="text-lg font-black text-gray-900">{statusDisplayWord}</h3>
                  </div>
                </div>
                <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-800">
                  {statusDisplayWord}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Reason</span>
                  <p className="font-bold text-gray-900">{activeRequest.reason}</p>
                  {activeRequest.comments && <p className="text-gray-600 italic mt-1">"{activeRequest.comments}"</p>}
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Submitted On</span>
                  <p className="font-bold text-gray-900">{new Date(activeRequest.createdAt || activeRequest.updatedAt).toLocaleString()}</p>
                </div>

                {activeRequest.images && activeRequest.images.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 block mb-2">Uploaded Return Proof Images</span>
                    <div className="flex gap-3">
                      {activeRequest.images.map((img: string, idx: number) => (
                        <img key={idx} src={img} alt="Proof" className="w-16 h-16 rounded-xl object-cover border border-gray-200 shadow-sm" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Progress Bar */}
          <div className="relative pb-8 border-b border-gray-100 px-4">
             <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-200 -translate-y-1/2 rounded-full" />
             
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progressPercentage}%` }}
               transition={{ duration: 0.5, ease: 'easeOut' }}
               className="absolute top-1/2 left-0 h-1.5 bg-[#22C55E] -translate-y-1/2 rounded-full z-10"
             />
             
             <div className="relative flex justify-between z-20">
               {timelineSteps.map((stepConfig, index) => {
                 const Icon = stepConfig.icon;
                 const isCompleted = completedSteps.has(index);
                 const isStepRed = index === 5 && isTerminalRed;

                 return (
                   <div key={stepConfig.status} className="flex flex-col items-center">
                      <div 
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-md ${
                          isStepRed
                            ? 'bg-[#EF4444] text-white shadow-red-500/30 scale-105 z-20'
                            : isCompleted 
                            ? 'bg-[#22C55E] text-white shadow-[#22C55E]/30 scale-105 z-20' 
                            : 'bg-gray-100 text-gray-400 border border-gray-200 scale-100'
                        }`}
                      >
                         <Icon className="w-6 h-6" />
                      </div>
                      <div className="absolute top-16 text-center whitespace-nowrap">
                         <p className={`text-[10px] font-black uppercase tracking-widest ${isStepRed ? 'text-red-500' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                           {stepConfig.label}
                         </p>
                      </div>
                   </div>
                 );
               })}
             </div>
          </div>

          {/* Status History Section - Show only latest update */}
          <div className="pb-8 border-b border-gray-100">
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Latest Status Update</h3>
             <div className="flex gap-4 items-start max-w-lg">
                <div className={`w-4 h-4 rounded-full mt-1 z-10 shrink-0 shadow-sm ${latestUpdate.dotColorClass}`} />
                <div>
                   <p className="text-base font-black text-gray-900 leading-snug">
                     {latestUpdate.message}
                   </p>
                   {latestUpdate.location && (
                     <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                       <MapPin className="w-3.5 h-3.5 text-gray-400" /> {latestUpdate.location}
                     </p>
                   )}
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">
                     {latestUpdate.timestamp ? new Date(latestUpdate.timestamp).toLocaleString(undefined, {
                       dateStyle: 'medium',
                       timeStyle: 'short'
                     }) : ''}
                   </p>
                </div>
             </div>
          </div>

          {/* STRICT SECTION ORDER (1. PRODUCTS -> 2. DELIVERY DETAILS -> 3. PRICE DETAILS -> 4. PRODUCTS FOR YOU) */}
          <div className="space-y-10">

            {/* 1. PRODUCTS */}
            <div className="pb-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="bg-blue-100 p-2.5 rounded-2xl">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Section 1</span>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Products</h3>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-4 flex items-center justify-between gap-4">
                    <img src={item.image} className="w-16 h-16 rounded-2xl object-cover border border-gray-200 shadow-sm" alt={item.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs font-semibold text-gray-500 mt-1">Quantity: {item.quantity}</p>
                      {order.status === 'delivered' && (
                        <button
                          onClick={() => {
                            setSelectedReviewProductId(item.productId);
                            setShowReviewModal(true);
                          }}
                          className="mt-2 text-[10px] font-black uppercase tracking-wider text-amber-700 hover:text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Star className="w-3 h-3 fill-amber-600 text-amber-600" /> Rate your Experience
                        </button>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 font-bold">₹{item.price.toLocaleString()} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. DELIVERY DETAILS */}
            <div className="pb-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="bg-emerald-100 p-2.5 rounded-2xl">
                  <MapPin className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Section 2</span>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Delivery Details</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm py-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Customer Name</span>
                  <p className="font-bold text-gray-900">{order.contactName || order.address.fullName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Delivery Address</span>
                  <p className="font-medium text-gray-700 leading-relaxed">
                    {order.address.house ? `${order.address.house}, ` : ''}{order.address.street},<br />
                    {order.address.city}, {order.address.state} - {order.address.zip}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block mb-1">Contact Information</span>
                  <p className="font-bold text-gray-900">Phone: {order.contactPhone || order.address.phone}</p>
                  <p className="font-medium text-gray-600 text-xs mt-1">Email: {order.contactEmail || user?.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* 3. PRICE DETAILS */}
            <div className="pb-8 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="bg-indigo-100 p-2.5 rounded-2xl">
                  <CreditCard className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Section 3</span>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Price Details</h3>
                </div>
              </div>

              <div className="max-w-xl space-y-3 text-sm py-2">
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Items Subtotal</span>
                  <span>₹{(order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600 font-medium">
                  <span>Delivery Fee</span>
                  <span className="text-emerald-600 font-bold">FREE</span>
                </div>
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-lg font-black text-gray-900">
                  <span>Total Paid</span>
                  <span className="text-2xl text-primary">₹{order.total.toLocaleString()}</span>
                </div>
                <div className="pt-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                  <span>Payment Method: {order.paymentMethod || 'Online Payment'}</span>
                  <span className="text-emerald-600">Status: Paid</span>
                </div>
              </div>
            </div>

            {/* 4. PRODUCTS FOR YOU */}
            <div className="pb-4">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="bg-amber-100 p-2.5 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest block">Section 4</span>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider">Products For You</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {recommendedProducts.map((p) => (
                  <Link key={p.id} to={`/products/${p.slug || p.id}`} className="group py-2">
                    <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden mb-3 border border-gray-100 group-hover:opacity-90 transition-opacity">
                      <img src={p.image || p.images?.[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <p className="text-xs font-bold text-gray-900 truncate group-hover:text-primary transition-colors">{p.name}</p>
                    <p className="text-sm font-black text-gray-900 mt-1">₹{p.price.toLocaleString()}</p>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

      {/* HELP MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-black text-gray-900">Order Help & Support</h3>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              {activeRequest ? (
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-900 uppercase">Existing Request Info</span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800">
                      {statusDisplayWord}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-800">Reason: {activeRequest.reason}</p>
                  {activeRequest.comments && <p className="text-xs text-gray-600 italic">"{activeRequest.comments}"</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-600">Need help with order {order.customOrderId || order.id}? Choose an option below:</p>
                  
                  {canCancel && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowCancelModal(true); }}
                      className="w-full py-3 px-4 bg-red-50 text-red-600 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Cancel Order
                    </button>
                  )}

                  {canReturn && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowReturnModal(true); }}
                      className="w-full py-3 px-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCcw className="w-4 h-4 text-amber-600" /> Request Return
                    </button>
                  )}

                  {canRefund && (
                    <button
                      onClick={() => { setShowHelpModal(false); setShowRefundModal(true); }}
                      className="w-full py-3 px-4 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4 text-indigo-600" /> Request Refund
                    </button>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <p className="font-bold text-gray-900">Customer Support Assistance</p>
                <p>For urgent order queries or assistance, contact support at <span className="text-primary font-bold">viba.mart@hotmail.com</span></p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CANCEL MODAL */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-black text-gray-900">Cancel Order Request</h3>
                <button onClick={() => setShowCancelModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Reason for Cancellation</label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-12 rounded-2xl px-4 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Order Created by Mistake">Order Created by Mistake</option>
                    <option value="Item Price Changed / High Shipping">Item Price Changed / High Shipping</option>
                    <option value="Found Better Price Elsewhere">Found Better Price Elsewhere</option>
                    <option value="Delivery Duration Too Long">Delivery Duration Too Long</option>
                    <option value="Other Reason">Other Reason</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowCancelModal(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl text-xs font-black uppercase">Cancel</button>
                  <button onClick={handleCancelOrder} disabled={isSubmitting} className="px-6 py-3 bg-red-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Confirm Cancellation'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RETURN MODAL */}
      <AnimatePresence>
        {showReturnModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-black text-gray-900">Request {windowDays}-Day Return</h3>
                <button onClick={() => setShowReturnModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Select Item(s) to Return</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {order.items.map((item) => (
                      <label key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-bold cursor-pointer">
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
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span className="truncate flex-1">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Reason for Return</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-12 rounded-2xl px-4 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="defective_item">Defective or Damaged Product</option>
                    <option value="wrong_item">Received Wrong Item / Size</option>
                    <option value="quality_issue">Product Quality Not as Expected</option>
                    <option value="changed_mind">Order Created by Mistake</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Issue Details / Comments</label>
                  <textarea
                    rows={3}
                    value={returnComments}
                    onChange={(e) => setReturnComments(e.target.value)}
                    placeholder="Describe the issue in detail..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 block mb-2">
                    Upload Proof Images <span className="text-red-500">*Required</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-primary rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-gray-50">
                      <Upload className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs font-bold text-gray-600">Upload File</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>

                    {returnImages.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 shrink-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeReturnImage(idx)} className="absolute top-0 right-0 bg-red-500 text-white p-1"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowReturnModal(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl text-xs font-black uppercase">Cancel</button>
                  <button onClick={handleRequestReturn} disabled={isSubmitting} className="px-6 py-3 bg-amber-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Submit Return'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REFUND MODAL */}
      <AnimatePresence>
        {showRefundModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-black text-gray-900">Request Refund</h3>
                <button onClick={() => setShowRefundModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-2">Reason for Refund</label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 h-12 rounded-2xl px-4 text-xs font-bold text-gray-900 focus:outline-none"
                  >
                    <option value="Order Cancelled/Returned">Order Cancelled / Returned</option>
                    <option value="Payment Deducted but Order Pending">Payment Deducted but Order Pending</option>
                    <option value="Duplicate Payment Charged">Duplicate Payment Charged</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button onClick={() => setShowRefundModal(false)} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl text-xs font-black uppercase">Cancel</button>
                  <button onClick={handleRequestRefund} disabled={isSubmitting} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'Submitting...' : 'Confirm Refund Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HELP MODAL */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black text-gray-900">Order Help & Support</h3>
                </div>
                <button onClick={() => setShowHelpModal(false)} className="p-2 rounded-full text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <p className="font-medium text-gray-600">Need help with order <span className="font-bold text-gray-900">#{order?.customOrderId || order?.id}</span>? Our customer service team is here 24/7.</p>
                
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200/80 space-y-2">
                  <p className="font-bold text-gray-900">Customer Support Desk:</p>
                  <p className="text-gray-700 font-medium">Email: <a href="mailto:support@vibamart.com" className="text-emerald-700 font-bold underline">support@vibamart.com</a></p>
                  <p className="text-gray-700 font-medium">Toll-Free Phone: <span className="font-bold text-gray-900">1800-123-4567</span></p>
                  <p className="text-xs text-gray-500 font-normal">Available Mon-Sat, 9:00 AM - 9:00 PM</p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowHelpModal(false);
                      navigate('/faq');
                    }}
                    className="w-full py-3 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-black transition-all shadow-md"
                  >
                    View FAQs & Help Banners
                  </button>
                </div>
              </div>
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
    </div>
  );
}

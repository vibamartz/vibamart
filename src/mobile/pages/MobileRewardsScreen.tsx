import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Award, Sparkles, Tag, ChevronRight, Clock,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Check, Copy,
  AlertCircle, Lock, Trophy, FileText, Info, AlertTriangle,
  ExternalLink, Search, Filter, ShoppingBag, CheckCircle2, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRewardsStore, useFeatureStore, useAuthStore } from '../../backend/store';
import { BrandCoupon, RewardOrder } from '../../shared/types';
import { getValidBrandUrl } from '../../shared/utils/url';
import { processPayment } from '../../shared/utils/razorpay';
import toast from 'react-hot-toast';

// Countdown Timer Component
function ExpiryCountdownMobile({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false
  });

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiryDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [expiryDate]);

  if (timeLeft.isExpired) {
    return <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
      <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
      <span>{String(timeLeft.days).padStart(2, '0')}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m</span>
    </div>
  );
}

export default function MobileRewardsScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { config, offers, rewardOrders, loading, initRewards, placeRewardOrder } = useRewardsStore();
  const { isFeatureEnabled } = useFeatureStore();

  const [activeTab, setActiveTab] = useState<'vouchers' | 'history' | 'rules'>('vouchers');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'confirmed' | 'used'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Search & Mobile Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);

  // Details Modal & Buy Now Modal
  const [selectedCoupon, setSelectedCoupon] = useState<BrandCoupon | null>(null);
  const [selectedGalleryImgIndex, setSelectedGalleryImgIndex] = useState(0);
  const [buyNowCoupon, setBuyNowCoupon] = useState<BrandCoupon | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod' | 'wallet'>('upi');
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    initRewards(user?.uid);
  }, [user]);

  const enabled = isFeatureEnabled('rewards') && config.enabled;

  if (!enabled) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] p-6 flex flex-col items-center justify-center text-center font-sans">
        <div className="w-16 h-16 bg-yellow-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Rewards Temporarily Offline</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-xs">
          The Rewards & Loyalty program is currently disabled by the store admin. Check back soon!
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-500/20"
        >
          Return Home
        </button>
      </div>
    );
  }

  const allCategories = Array.from(new Set(offers.map(o => o.category).filter(Boolean)));

  // Filter Logic
  const filteredCoupons = offers.filter(coupon => {
    if (!coupon.active) return false;

    const matchesSearch = (coupon.brandName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (coupon.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || coupon.category === selectedCategory;

    const now = Date.now();
    const expiryTime = coupon.expiryDate ? new Date(coupon.expiryDate).getTime() : Infinity;
    const isExpiringSoon = expiryTime - now > 0 && expiryTime - now <= 48 * 60 * 60 * 1000;

    if (onlyExpiringSoon && !isExpiringSoon) return false;

    return matchesSearch && matchesCategory;
  });

  const myOrders = rewardOrders.filter(o => !user || o.userId === user.uid);
  const filteredHistory = myOrders.filter(o => {
    if (historyFilter === 'pending') return o.paymentStatus === 'pending' || o.paymentStatus === 'submitted';
    if (historyFilter === 'confirmed') return o.paymentStatus === 'confirmed';
    if (historyFilter === 'used') return o.couponStatus === 'used';
    return true;
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const loadRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleStartBuyNow = async (coupon: BrandCoupon) => {
    if (!user) {
      toast.error('Please log in to purchase reward coupons');
      navigate('/login');
      return;
    }

    if ((coupon.remainingQuantity ?? 0) <= 0) {
      toast.error('This brand coupon is currently Sold Out.');
      return;
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) {
      toast.error('This brand coupon has Expired.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const payResult = await processPayment({
        amount: coupon.buyNowPrice,
        currency: 'INR',
        name: 'ViBa Mart Rewards',
        description: `Reward Coupon: ${coupon.title}`,
        prefill: {
          name: user.displayName || '',
          email: user.email || '',
          contact: user.phone || ''
        }
      });

      if (payResult.success) {
        const paymentTxId = payResult.paymentId || `PAY-RWD-${Date.now()}`;
        const res = await placeRewardOrder({
          couponId: coupon.id,
          brandName: coupon.brandName,
          brandLogo: coupon.brandLogo,
          productTitle: coupon.title,
          productImage: coupon.productImage,
          couponTitle: coupon.title,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          amountPaid: coupon.buyNowPrice,
          paymentMethod: 'razorpay',
          paymentReference: paymentTxId,
          validFrom: coupon.validFrom,
          expiryDate: coupon.expiryDate,
          brandWebsiteUrl: coupon.brandWebsiteUrl
        });

        if (res.success) {
          toast.success('Payment completed via ViBa Mart Payment Gateway! Order submitted for confirmation.');
          setSelectedCoupon(null);
          setActiveTab('history');
        } else {
          toast.error(res.message);
        }
      } else {
        if (payResult.error && payResult.error !== 'Payment cancelled by user') {
          toast.error(payResult.error);
        } else if (payResult.error === 'Payment cancelled by user') {
          toast.error('Payment cancelled');
        }
      }
    } catch (err) {
      console.error('Razorpay Error:', err);
      setBuyNowCoupon(coupon);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSubmitBuyNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyNowCoupon) return;

    setSubmittingOrder(true);
    try {
      const res = await placeRewardOrder({
        couponId: buyNowCoupon.id,
        brandName: buyNowCoupon.brandName,
        brandLogo: buyNowCoupon.brandLogo,
        productTitle: buyNowCoupon.title,
        productImage: buyNowCoupon.productImage,
        couponTitle: buyNowCoupon.title,
        discountType: buyNowCoupon.discountType,
        discountValue: buyNowCoupon.discountValue,
        amountPaid: buyNowCoupon.buyNowPrice,
        paymentMethod,
        paymentReference: paymentRef,
        validFrom: buyNowCoupon.validFrom,
        expiryDate: buyNowCoupon.expiryDate,
        brandWebsiteUrl: buyNowCoupon.brandWebsiteUrl
      });

      if (res.success) {
        toast.success(res.message);
        setBuyNowCoupon(null);
        setSelectedCoupon(null);
        setActiveTab('history');
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('Failed to submit order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans">
      {/* PERMANENT MANDATORY TOP NOTICE */}
      <div className="bg-amber-500 text-white p-3.5 text-center flex items-center justify-center gap-2 shadow-md">
        <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
        <span className="font-black text-xs tracking-wider uppercase">{config.nonRefundableNotice || '⚠️ NON REFUNDABLE'}</span>
      </div>

      {/* Mobile Top Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white p-5 rounded-b-[2rem] shadow-xl relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl">
              <Gift className="w-4 h-4 text-amber-400" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              {config.badgeText || 'ViBa Official Brand Coupons'}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-amber-300">
            Official Rewards
          </span>
        </div>

        <div>
          <h1 className="text-xl font-black leading-tight text-white">{config.title}</h1>
          <p className="text-xs text-slate-300 mt-1 line-clamp-2">{config.subtitle}</p>
        </div>
      </div>

      {/* Mobile Search & Filter Bar */}
      <div className="px-4 mt-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brand or coupon..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-amber-100 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
          />
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              selectedCategory === 'all' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-amber-100'
            }`}
          >
            All Brands
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                selectedCategory === cat ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-amber-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 mt-4">
        <div className="flex bg-white p-1 rounded-2xl border border-amber-100 shadow-sm gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'vouchers' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-600'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Coupons ({filteredCoupons.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'history' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-600'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> My Orders ({myOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'rules' ? 'bg-amber-500 text-white shadow-md' : 'text-gray-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Flow
          </button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="px-4 mt-4">
        {/* COUPONS STOREFRONT */}
        {activeTab === 'vouchers' && (
          <div className="space-y-4">
            {filteredCoupons.map((coupon) => (
              <motion.div
                key={coupon.id}
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-3xl p-4 border border-amber-100 shadow-md space-y-3 relative overflow-hidden"
              >
                {/* Brand Header */}
                <div className="flex items-center justify-between" onClick={() => setSelectedCoupon(coupon)}>
                  <div className="flex items-center gap-2.5">
                    <img src={coupon.brandLogo} alt="" className="w-9 h-9 rounded-full object-cover border" />
                    <div>
                      <h3 className="font-black text-gray-900 text-xs">{coupon.brandName}</h3>
                      <span className="text-[10px] text-amber-600 font-bold">{coupon.category}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full">
                    {coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                  </span>
                </div>

                {/* Main Image */}
                <div className="h-36 rounded-2xl overflow-hidden bg-gray-100 relative" onClick={() => setSelectedCoupon(coupon)}>
                  <img src={coupon.productImage} alt="" className="w-full h-full object-cover" />
                  <div className="absolute left-2 bottom-2">
                    <ExpiryCountdownMobile expiryDate={coupon.expiryDate} />
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-bold text-gray-900 text-xs line-clamp-1">{coupon.title}</h4>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  {(coupon.remainingQuantity ?? 0) <= 0 ? (
                    <button
                      disabled
                      className="flex-1 py-2.5 bg-gray-200 text-gray-500 rounded-xl text-xs font-black cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Sold Out
                    </button>
                  ) : (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) ? (
                    <button
                      disabled
                      className="flex-1 py-2.5 bg-rose-100 text-rose-500 rounded-xl text-xs font-black cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      Expired
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartBuyNow(coupon)}
                      disabled={submittingOrder}
                      className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center justify-center gap-1"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> Buy Now (₹{coupon.buyNowPrice})
                    </button>
                  )}

                  {getValidBrandUrl(coupon.brandWebsiteUrl) && (
                    <a
                      href={getValidBrandUrl(coupon.brandWebsiteUrl)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      Official <ExternalLink className="w-3 h-3 text-gray-400" />
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* MY ORDERS & UNLOCKED COUPONS */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-amber-100 text-gray-400 text-xs">
                No reward order history.
              </div>
            ) : (
              filteredHistory.map((order) => {
                const isConfirmed = order.paymentStatus === 'confirmed';

                return (
                  <div key={order.id} className="bg-white p-4 rounded-3xl border border-amber-100 shadow-md space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <img src={order.brandLogo || order.productImage} alt="" className="w-7 h-7 rounded-full border object-cover" />
                        <span className="font-black text-xs text-amber-700">{order.brandName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">{order.id}</span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-xs">{order.productTitle}</h4>

                    {/* Code Display */}
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Coupon Code:</span>
                      {isConfirmed ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 block text-center">
                            COUPON CODE: {order.unlockedCode || 'UNLOCKED'}
                          </span>
                          <button
                            onClick={() => copyToClipboard(order.unlockedCode || '')}
                            className="w-full py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Copy className="w-3 h-3" /> {copiedCode === order.unlockedCode ? 'Copied Code!' : 'Copy Code'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-xs font-mono font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded block text-center">
                            XXX-XXX-XXX-XXX
                          </span>
                          <p className="text-[10px] text-amber-600 font-bold text-center">Coupon code will unlock after payment confirmation</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span>Paid: <strong>₹{order.amountPaid}</strong></span>
                      {getValidBrandUrl(order.brandWebsiteUrl) && (
                        <a href={getValidBrandUrl(order.brandWebsiteUrl)!} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold flex items-center gap-0.5">
                          Visit Official Brand <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* RULES */}
        {activeTab === 'rules' && (
          <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-md space-y-3 text-xs text-gray-600">
            <h3 className="font-black text-gray-900 text-sm">Security & Unlocking Flow</h3>
            <p>1. Order reward coupon by selecting payment method.</p>
            <p>2. Status remains Pending Payment (code hidden as XXX-XXX-XXX-XXX).</p>
            <p>3. Admin verifies payment and unlocks the official brand code.</p>
            <p>4. Unlocked coupon code appears instantly in My Orders with 1-click copy.</p>
          </div>
        )}
      </div>

      {/* MOBILE COUPON DETAILS BOTTOM SHEET */}
      <AnimatePresence>
        {selectedCoupon && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <img src={selectedCoupon.brandLogo} alt="" className="w-8 h-8 rounded-full border object-cover" />
                  <span className="font-black text-xs text-gray-900">{selectedCoupon.brandName}</span>
                </div>
                <button onClick={() => setSelectedCoupon(null)} className="p-1 text-gray-400">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="h-44 rounded-2xl overflow-hidden bg-gray-100 border">
                <img
                  src={(selectedCoupon.catalogImages && selectedCoupon.catalogImages[selectedGalleryImgIndex]) || selectedCoupon.productImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              {selectedCoupon.catalogImages && selectedCoupon.catalogImages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedCoupon.catalogImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedGalleryImgIndex(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 ${selectedGalleryImgIndex === idx ? 'border-amber-500' : 'border-gray-200'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <h3 className="font-black text-sm text-gray-900">{selectedCoupon.title}</h3>
              <p className="text-xs text-gray-500 line-clamp-3">{selectedCoupon.description || selectedCoupon.terms}</p>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setSelectedCoupon(null); handleStartBuyNow(selectedCoupon); }}
                  className="flex-1 py-3 bg-amber-500 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-4 h-4" /> Buy Now (₹{selectedCoupon.buyNowPrice})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE BUY NOW MODAL */}
      <AnimatePresence>
        {buyNowCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full p-5 space-y-4 max-w-sm font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h3 className="font-black text-xs text-gray-900">Purchase Coupon</h3>
                <button onClick={() => setBuyNowCoupon(null)} className="p-1 text-gray-400">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                <img src={buyNowCoupon.productImage} alt="" className="w-12 h-12 rounded-xl object-cover" />
                <div>
                  <span className="text-[10px] font-black text-amber-700 block">{buyNowCoupon.brandName}</span>
                  <h4 className="font-bold text-gray-900 text-xs line-clamp-1">{buyNowCoupon.title}</h4>
                  <span className="text-xs font-black text-gray-900">Price: ₹{buyNowCoupon.buyNowPrice}</span>
                </div>
              </div>

              <form onSubmit={handleSubmitBuyNow} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold outline-none bg-white"
                  >
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="wallet">ViBa Wallet</option>
                    <option value="cod">Cash / Offline Store</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Transaction Ref / UTR (Optional)</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Enter reference #"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingOrder}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {submittingOrder ? 'Submitting...' : `Submit Payment (₹${buyNowCoupon.buyNowPrice})`}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

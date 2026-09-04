import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Award, Sparkles, Tag, Clock, ArrowUpRight,
  ShieldCheck, Check, Copy, Lock, Trophy, Star, ChevronRight,
  Info, ExternalLink, AlertTriangle, Search, Filter, RefreshCw,
  ShoppingBag, CheckCircle2, XCircle, AlertCircle, Eye, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRewardsStore, useFeatureStore, useAuthStore } from '../../backend/store';
import { BrandCoupon, RewardOrder } from '../../shared/types';
import { getRewardSlug } from '../../shared/utilities/slug';
import { getValidBrandUrl } from '../../shared/utils/url';
import { processPayment } from '../../shared/utils/razorpay';
import toast from 'react-hot-toast';

// Countdown Timer Component
function ExpiryCountdown({ expiryDate }: { expiryDate: string }) {
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
    return <span className="text-[11px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60">
      <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
      <span>{String(timeLeft.days).padStart(2, '0')}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
}

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { config, offers, rewardOrders, loading, initRewards, placeRewardOrder } = useRewardsStore();
  const { isFeatureEnabled } = useFeatureStore();

  const [activeTab, setActiveTab] = useState<'vouchers' | 'history' | 'rules'>('vouchers');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'confirmed' | 'expired' | 'used'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(500);
  const [onlyValidToday, setOnlyValidToday] = useState(false);
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'discount' | 'brand' | 'popular'>('newest');

  // Coupon Details Modal
  const [selectedCoupon, setSelectedCoupon] = useState<BrandCoupon | null>(null);
  const [selectedGalleryImgIndex, setSelectedGalleryImgIndex] = useState(0);

  // Buy Now Checkout Modal
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
      <div className="max-w-4xl mx-auto my-16 p-12 bg-white rounded-3xl border border-gray-100 shadow-xl text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-yellow-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900">Rewards & Brand Coupons Currently Offline</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          The Rewards program is temporarily disabled by the store admin. Please check back later.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-colors"
        >
          Return to Storefront
        </button>
      </div>
    );
  }

  // Unique Brands & Categories for filters
  const allBrands = Array.from(new Set(offers.map(o => o.brandName).filter(Boolean)));
  const allCategories = Array.from(new Set(offers.map(o => o.category).filter(Boolean)));

  // Filter & Sort Logic
  const filteredCoupons = offers.filter(coupon => {
    if (!coupon.active) return false;

    const matchesSearch = (coupon.brandName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (coupon.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBrand = selectedBrand === 'all' || coupon.brandName === selectedBrand;
    const matchesCategory = selectedCategory === 'all' || coupon.category === selectedCategory;
    const matchesPrice = (coupon.buyNowPrice || 0) <= maxPriceFilter;

    const now = Date.now();
    const validFromTime = coupon.validFrom ? new Date(coupon.validFrom).getTime() : 0;
    const expiryTime = coupon.expiryDate ? new Date(coupon.expiryDate).getTime() : Infinity;

    const isValidToday = validFromTime <= now && now <= expiryTime;
    const isExpiringSoon = expiryTime - now > 0 && expiryTime - now <= 48 * 60 * 60 * 1000;

    if (onlyValidToday && !isValidToday) return false;
    if (onlyExpiringSoon && !isExpiringSoon) return false;

    return matchesSearch && matchesBrand && matchesCategory && matchesPrice;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (sortBy === 'discount') return b.discountValue - a.discountValue;
    if (sortBy === 'brand') return (a.brandName || '').localeCompare(b.brandName || '');
    if (sortBy === 'popular') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    return 0;
  });

  // User History
  const myOrders = rewardOrders.filter(o => !user || o.userId === user.uid);
  const filteredHistory = myOrders.filter(o => {
    if (historyFilter === 'pending') return o.paymentStatus === 'pending' || o.paymentStatus === 'submitted';
    if (historyFilter === 'confirmed') return o.paymentStatus === 'confirmed';
    if (historyFilter === 'used') return o.couponStatus === 'used';
    if (historyFilter === 'expired') return new Date(o.expiryDate).getTime() < Date.now();
    return true;
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const handleOpenDetails = (coupon: BrandCoupon) => {
    setSelectedCoupon(coupon);
    setSelectedGalleryImgIndex(0);
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
      toast.error('Failed to submit reward purchase');
      console.error(err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* PERMANENT TOP WARNING NOTICE - MANDATORY */}
      <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-yellow-200 animate-pulse" />
          </div>
          <div>
            <span className="font-black text-sm tracking-wider uppercase block">{config.nonRefundableNotice || '⚠️ NON REFUNDABLE'}</span>
            <p className="text-xs text-amber-100">All brand reward coupon purchases are strictly non-refundable and non-exchangeable after payment confirmation.</p>
          </div>
        </div>
        <span className="hidden md:inline-block px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-100">
          Official Policy
        </span>
      </div>

      {/* Hero Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-3xl p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-white/10 rounded-full text-xs font-bold text-amber-300 backdrop-blur-md border border-white/10">
              <Gift className="w-4 h-4 text-amber-400" /> {config.badgeText || 'ViBa Official Brand Coupons'}
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              {config.title || 'Exclusive Brand Rewards & Instant Discount Vouchers'}
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              {config.subtitle || 'Claim premium brand coupons, cash discounts, and partner vouchers across Top Brands. Verified after payment confirmation.'}
            </p>
          </div>

          {/* Direct Rewards Summary Card */}
          <div className="bg-white/10 border border-white/20 backdrop-blur-md p-6 rounded-2xl space-y-4 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Brand Coupons Available</span>
                <span className="text-4xl font-black text-white flex items-center gap-2 mt-1">
                  {offers.length} <Tag className="w-6 h-6 text-amber-400" />
                </span>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-wider">
                Partner Store
              </span>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10 text-xs text-slate-300 font-medium">
              <div className="flex justify-between">
                <span>Verification Flow:</span>
                <span className="text-amber-400 font-bold">Secure Admin Unlocked</span>
              </div>
              <div className="flex justify-between">
                <span>Pre-Confirmation Code:</span>
                <span className="font-mono text-slate-400">XXX-XXX-XXX-XXX</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'vouchers'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Tag className="w-4 h-4" /> Brand Coupons ({filteredCoupons.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" /> My Rewards Orders ({myOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Terms & Verification Flow
          </button>
        </div>
      </div>

      {/* TAB 1: BRAND COUPONS STOREFRONT */}
      {activeTab === 'vouchers' && (
        <div className="space-y-6 font-sans">
          {/* SEARCH & INTELLIGENT FILTER BAR */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search Bar */}
              <div className="relative md:col-span-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search brand, product or discount..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Brand Filter */}
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="all">All Brands</option>
                {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="newest">Newest First</option>
                <option value="discount">Highest Discount</option>
                <option value="brand">A–Z Brand Name</option>
                <option value="popular">Popular & Featured</option>
              </select>
            </div>

            {/* Quick Toggle Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs font-bold">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setOnlyValidToday(!onlyValidToday)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    onlyValidToday ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ✓ Valid Today
                </button>
                <button
                  onClick={() => setOnlyExpiringSoon(!onlyExpiringSoon)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    onlyExpiringSoon ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ⚡ Expiring Soon (&lt;48h)
                </button>
              </div>

              <div className="flex items-center gap-2 text-gray-500">
                <span>Max Buy Price: ₹{maxPriceFilter}</span>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="10"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                  className="accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* COUPON CARDS GRID */}
          {filteredCoupons.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 space-y-3">
              <Tag className="w-12 h-12 text-gray-300 mx-auto" />
              <h3 className="text-lg font-bold text-gray-900">No brand coupons found</h3>
              <p className="text-xs text-gray-500">Try broadening your search term or adjusting filter options.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCoupons.map((coupon) => {
                const discountText = coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`;

                return (
                  <motion.div
                    key={coupon.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => navigate(`/rewards/${getRewardSlug(coupon)}`)}
                    className="bg-white rounded-3xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      {/* Product & Brand Image Header */}
                      <div className="h-48 relative overflow-hidden bg-gray-100">
                        <img
                          src={coupon.productImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop'}
                          alt={coupon.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* Brand Logo & Name */}
                        <div className="absolute left-4 bottom-3 flex items-center gap-2.5 z-10">
                          <img
                            src={coupon.brandLogo || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop'}
                            alt={coupon.brandName}
                            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-lg bg-white"
                          />
                          <div>
                            <span className="text-white font-black text-sm block leading-tight drop-shadow">{coupon.brandName}</span>
                            <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">{coupon.category || 'Official Partner'}</span>
                          </div>
                        </div>

                        {/* Discount Badge */}
                        <div className="absolute right-4 top-4 z-10">
                          <span className="px-3 py-1 bg-amber-500 text-white font-black text-xs rounded-full shadow-lg shadow-amber-500/30">
                            {discountText}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-3">
                        <h3
                          className="font-black text-gray-900 text-base leading-snug line-clamp-1 group-hover:text-amber-600 transition-colors"
                        >
                          {coupon.title}
                        </h3>

                        {/* Countdown & Expiry */}
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-gray-500 font-medium">Valid Until: {new Date(coupon.expiryDate).toLocaleDateString()}</span>
                          <ExpiryCountdown expiryDate={coupon.expiryDate} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-2xl text-gray-600 font-bold border border-gray-100">
                          <div><span className="text-gray-400 block font-normal">Remaining:</span> {coupon.remainingQuantity} left</div>
                          <div><span className="text-gray-400 block font-normal">Min Spend:</span> ₹{coupon.minOrderValue || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {(coupon.remainingQuantity ?? 0) <= 0 || !coupon.active || (user && rewardOrders.some(ro => ro.couponId === coupon.id && ro.userId === user.uid)) ? (
                        <button
                          disabled
                          className="flex-1 py-2.5 bg-rose-100 text-rose-600 rounded-xl text-xs font-black cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          Expired/Used
                        </button>
                      ) : (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < Date.now()) ? (
                        <button
                          disabled
                          className="flex-1 py-2.5 bg-rose-100 text-rose-500 rounded-xl text-xs font-black cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          Expired
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartBuyNow(coupon); }}
                          disabled={submittingOrder}
                          className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                        >
                          <ShoppingBag className="w-4 h-4" /> {submittingOrder ? 'Processing...' : `Buy Coupon (₹${coupon.buyNowPrice})`}
                        </button>
                      )}

                      {getValidBrandUrl(coupon.brandWebsiteUrl) && (
                        <a
                          href={getValidBrandUrl(coupon.brandWebsiteUrl)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                          title="Visit Official Brand Webpage"
                        >
                          Visit Official Brand <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY REWARDS ORDERS & SECURITY STATUS FLOW */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-6 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-black text-gray-900">My Rewards Orders & Unlocked Coupons</h2>
              <p className="text-xs text-gray-500">Track payment status and retrieve unlocked brand coupon codes after payment confirmation.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-bold">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg ${historyFilter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                All ({myOrders.length})
              </button>
              <button
                onClick={() => setHistoryFilter('pending')}
                className={`px-3 py-1.5 rounded-lg ${historyFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}
              >
                Payment Pending
              </button>
              <button
                onClick={() => setHistoryFilter('confirmed')}
                className={`px-3 py-1.5 rounded-lg ${historyFilter === 'confirmed' ? 'bg-emerald-500 text-white' : 'text-gray-500'}`}
              >
                Payment Confirmed
              </button>
              <button
                onClick={() => setHistoryFilter('used')}
                className={`px-3 py-1.5 rounded-lg ${historyFilter === 'used' ? 'bg-slate-800 text-white' : 'text-gray-500'}`}
              >
                Used
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-gray-400 space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto opacity-30" />
              <h3 className="text-base font-bold text-gray-900">No reward order history found</h3>
              <p className="text-xs text-gray-500">Buy brand coupons to start saving across top official partner stores.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((order) => {
                const isConfirmed = order.paymentStatus === 'confirmed';
                const isPending = order.paymentStatus === 'pending' || order.paymentStatus === 'submitted';

                return (
                  <div key={order.id} className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200/80 space-y-4 hover:border-amber-300 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-200/60">
                      <div className="flex items-center gap-3">
                        <img src={order.brandLogo || order.productImage} alt="" className="w-10 h-10 rounded-full object-cover border bg-white" />
                        <div>
                          <span className="text-xs font-black text-amber-700 block">{order.brandName}</span>
                          <h4 className="font-bold text-gray-900 text-sm">{order.productTitle}</h4>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-gray-400 block">{order.id}</span>
                        <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Customer Flow Progress Step Bar */}
                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs font-bold grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                      <div className={`p-2 rounded-lg ${isPending || isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-400'}`}>
                        1. Payment Completed
                      </div>
                      <div className={`p-2 rounded-lg ${isPending ? 'bg-amber-100 text-amber-800 animate-pulse' : isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-400'}`}>
                        2. Payment Verification
                      </div>
                      <div className={`p-2 rounded-lg ${isConfirmed ? 'bg-emerald-100 text-emerald-800 font-black' : 'bg-gray-50 text-gray-400'}`}>
                        3. Payment Confirmed
                      </div>
                      <div className={`p-2 rounded-lg ${isConfirmed ? 'bg-emerald-500 text-white font-black' : 'bg-gray-50 text-gray-400'}`}>
                        4. Coupon Unlocked
                      </div>
                    </div>

                    {/* Unlocked Code vs Masked Code Display */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Coupon Code:</span>
                        {isConfirmed ? (
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-base font-mono font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              COUPON CODE: {order.unlockedCode || 'UNLOCKED'}
                            </span>
                            <button
                              onClick={() => copyToClipboard(order.unlockedCode || '')}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
                            >
                              <Copy className="w-3.5 h-3.5" /> {copiedCode === order.unlockedCode ? 'Copied!' : 'Copy Code'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-base font-mono font-black text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
                              XXX-XXX-XXX-XXX
                            </span>
                            <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-1.5 rounded-lg">
                              Coupon code will unlock after payment confirmation
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-xs font-bold text-gray-700">Amount Paid: <strong className="text-gray-900">₹{order.amountPaid}</strong></div>
                        {getValidBrandUrl(order.brandWebsiteUrl) && (
                          <a
                            href={getValidBrandUrl(order.brandWebsiteUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                          >
                            Visit Official Brand <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROGRAM RULES & POLICY */}
      {activeTab === 'rules' && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl space-y-6 text-xs leading-relaxed text-gray-600 font-sans">
          <h2 className="text-xl font-black text-gray-900 border-b border-gray-100 pb-4">Rewards Verification & Coupon Security Policy</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
              <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Non-Refundable Notice
              </h3>
              <p>All reward coupon purchases are final and non-refundable. Once payment is submitted, reward product codes are allocated specifically to your account.</p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
              <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Security Flow
              </h3>
              <p>Coupon codes remain strictly encrypted as XXX-XXX-XXX-XXX until payment verification is approved by Admin. Upon confirmation, actual codes unlock instantly.</p>
            </div>
          </div>
        </div>
      )}

      {/* COUPON DETAILS MODAL */}
      <AnimatePresence>
        {selectedCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-gray-100 my-8 font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <img src={selectedCoupon.brandLogo} alt="" className="w-9 h-9 rounded-full object-cover border" />
                  <div>
                    <h2 className="text-base font-black text-gray-900">{selectedCoupon.brandName}</h2>
                    <span className="text-xs text-amber-600 font-bold">{selectedCoupon.category}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedCoupon(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Main Image Gallery */}
              <div className="space-y-3">
                <div className="h-64 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 relative">
                  <img
                    src={(selectedCoupon.catalogImages && selectedCoupon.catalogImages[selectedGalleryImgIndex]) || selectedCoupon.productImage}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute right-4 top-4 bg-amber-500 text-white font-black text-xs px-3 py-1 rounded-full shadow-lg">
                    {selectedCoupon.discountType === 'percent' ? `${selectedCoupon.discountValue}% OFF` : `₹${selectedCoupon.discountValue} OFF`}
                  </div>
                </div>

                {/* Catalog Thumbnails */}
                {selectedCoupon.catalogImages && selectedCoupon.catalogImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedCoupon.catalogImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGalleryImgIndex(idx)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                          selectedGalleryImgIndex === idx ? 'border-amber-500 scale-95' : 'border-gray-200 opacity-60'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-black text-gray-900">{selectedCoupon.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{selectedCoupon.description || selectedCoupon.terms}</p>

                <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div><span className="text-gray-400 block font-normal">Buy Price:</span> <strong className="text-amber-600 text-sm">₹{selectedCoupon.buyNowPrice}</strong></div>
                  <div><span className="text-gray-400 block font-normal">Min Spend:</span> <strong className="text-gray-900">₹{selectedCoupon.minOrderValue || 0}</strong></div>
                  <div><span className="text-gray-400 block font-normal">Valid Until:</span> <strong className="text-gray-900">{new Date(selectedCoupon.expiryDate).toLocaleDateString()}</strong></div>
                  <div><span className="text-gray-400 block font-normal">Stock Left:</span> <strong className="text-gray-900">{selectedCoupon.remainingQuantity}</strong></div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { setSelectedCoupon(null); handleStartBuyNow(selectedCoupon); }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" /> Buy Now (₹{selectedCoupon.buyNowPrice})
                </button>

                {selectedCoupon.brandWebsiteUrl && (
                  <a
                    href={selectedCoupon.brandWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    Visit Official Brand <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BUY NOW CHECKOUT MODAL */}
      <AnimatePresence>
        {buyNowCoupon && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100 font-sans my-8"
            >
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                <h3 className="text-base font-black text-gray-900">Purchase Reward Coupon</h3>
                <button onClick={() => setBuyNowCoupon(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded-full">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Product Summary */}
              <div className="flex items-center gap-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-100">
                <img src={buyNowCoupon.productImage} alt="" className="w-14 h-14 rounded-xl object-cover border" />
                <div>
                  <span className="text-[10px] font-black text-amber-700 uppercase block">{buyNowCoupon.brandName}</span>
                  <h4 className="font-bold text-gray-900 text-xs line-clamp-1">{buyNowCoupon.title}</h4>
                  <span className="text-xs font-black text-gray-900">Total: ₹{buyNowCoupon.buyNowPrice}</span>
                </div>
              </div>

              <form onSubmit={handleSubmitBuyNow} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Select Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                  >
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="card">Credit / Debit Card</option>
                    <option value="wallet">ViBa Wallet</option>
                    <option value="cod">Cash / Offline Store Payment</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">Transaction Reference / UTR # (Optional)</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Enter UPI reference or receipt ID"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-gray-500 space-y-1">
                  <p className="font-bold text-amber-700">⚠️ Code Security notice:</p>
                  <p>Upon submitting payment, code remains <strong className="font-mono text-gray-800">XXX-XXX-XXX-XXX</strong> until Admin verifies payment. Actual code will unlock in your Rewards Order History.</p>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setBuyNowCoupon(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {submittingOrder ? 'Submitting...' : `Submit Payment (₹${buyNowCoupon.buyNowPrice})`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

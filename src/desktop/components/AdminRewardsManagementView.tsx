import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Sparkles, Award, Tag, Trophy, Plus, Edit3, Trash2,
  Check, Eye, Save, RefreshCw, Smartphone, Monitor, ShieldCheck,
  AlertCircle, ChevronRight, Lock, Image as ImageIcon, Link as LinkIcon,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, Info, ExternalLink,
  Calendar, Clock, DollarSign, Layers, ShoppingBag, Search, Filter, AlertTriangle
} from 'lucide-react';
import { useRewardsStore } from '../../backend/store';
import { BrandCoupon, RewardsSectionConfig, RewardOrder } from '../../shared/types';
import { getValidBrandUrl } from '../../shared/utils/url';
import toast from 'react-hot-toast';

const PRESET_ICONS = ['Gift', 'Sparkles', 'Award', 'Tag', 'Trophy', 'ShieldCheck'];

export default function AdminRewardsManagementView() {
  const {
    config,
    offers,
    rewardOrders,
    updateRewardsConfig,
    addRewardOffer,
    updateRewardOffer,
    toggleRewardOffer,
    deleteRewardOffer,
    reorderRewardOffers,
    confirmRewardOrderPayment,
    rejectRewardOrderPayment,
    markRewardOrderUsed,
    initRewards
  } = useRewardsStore();

  const [activeTab, setActiveTab] = useState<'general' | 'coupons' | 'orders' | 'preview'>('general');
  const [formConfig, setFormConfig] = useState<RewardsSectionConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);

  // Coupon Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<BrandCoupon | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Coupon Search & Filter
  const [couponSearch, setCouponSearch] = useState('');
  const [couponCategoryFilter, setCouponCategoryFilter] = useState('all');

  // Orders Filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'expired' | 'used'>('all');

  // Coupon Form State
  const [couponForm, setCouponForm] = useState<Partial<BrandCoupon>>({
    brandName: '',
    brandLogo: '',
    brandWebsiteUrl: '',
    title: '',
    code: '',
    discountType: 'flat',
    discountValue: 100,
    minOrderValue: 499,
    maxDiscount: 100,
    productImage: '',
    catalogImages: [],
    buyNowPrice: 49,
    validFrom: new Date().toISOString().slice(0, 16),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    totalQuantity: 100,
    remainingQuantity: 100,
    active: true,
    featured: false,
    category: 'Fashion & Apparel',
    subcategory: '',
    terms: 'Valid on official brand web store. One voucher per order.',
    order: 1
  });

  const [catalogInput, setCatalogInput] = useState('');

  useEffect(() => {
    initRewards();
  }, []);

  useEffect(() => {
    setFormConfig(config);
  }, [config]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await updateRewardsConfig(formConfig);
      toast.success('Rewards settings updated successfully!');
    } catch (err) {
      toast.error('Failed to update rewards settings');
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const openAddCouponModal = () => {
    setEditingCoupon(null);
    setCouponForm({
      brandName: '',
      brandLogo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&h=150&fit=crop',
      brandWebsiteUrl: 'https://',
      title: '',
      code: `REWARD-${Math.floor(1000 + Math.random() * 9000)}`,
      discountType: 'flat',
      discountValue: 100,
      minOrderValue: 499,
      maxDiscount: 100,
      productImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop',
      catalogImages: [],
      buyNowPrice: 49,
      validFrom: new Date().toISOString().slice(0, 16),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      totalQuantity: 100,
      remainingQuantity: 100,
      active: true,
      featured: false,
      category: 'Fashion & Apparel',
      subcategory: '',
      terms: 'Valid on official brand store orders.',
      order: offers.length + 1
    });
    setCatalogInput('');
    setIsCouponModalOpen(true);
  };

  const openEditCouponModal = (coupon: BrandCoupon) => {
    setEditingCoupon(coupon);
    setCouponForm({
      ...coupon,
      validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
    setCatalogInput('');
    setIsCouponModalOpen(true);
  };

  const handleAddCatalogImage = () => {
    if (!catalogInput.trim()) return;
    const updated = [...(couponForm.catalogImages || []), catalogInput.trim()];
    setCouponForm({ ...couponForm, catalogImages: updated });
    setCatalogInput('');
  };

  const handleRemoveCatalogImage = (index: number) => {
    const updated = [...(couponForm.catalogImages || [])];
    updated.splice(index, 1);
    setCouponForm({ ...couponForm, catalogImages: updated });
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.brandName || !couponForm.title || !couponForm.code) {
      toast.error('Please fill in all required fields (Brand Name, Title, Coupon Code).');
      return;
    }

    setSavingCoupon(true);
    try {
      const validatedUrl = getValidBrandUrl(couponForm.brandWebsiteUrl);
      const payload: Partial<BrandCoupon> = {
        ...couponForm,
        brandWebsiteUrl: validatedUrl || '',
        validFrom: couponForm.validFrom ? new Date(couponForm.validFrom).toISOString() : new Date().toISOString(),
        expiryDate: couponForm.expiryDate ? new Date(couponForm.expiryDate).toISOString() : new Date(Date.now() + 30*86400000).toISOString(),
        discountValue: Number(couponForm.discountValue || 0),
        buyNowPrice: Number(couponForm.buyNowPrice || 0),
        minOrderValue: Number(couponForm.minOrderValue || 0),
        maxDiscount: Number(couponForm.maxDiscount || 0),
        totalQuantity: Number(couponForm.totalQuantity || 0),
        remainingQuantity: Number(couponForm.remainingQuantity ?? couponForm.totalQuantity ?? 0)
      };

      if (editingCoupon) {
        await updateRewardOffer(editingCoupon.id, payload);
        toast.success(`Brand coupon "${payload.title}" updated successfully.`);
      } else {
        await addRewardOffer(payload as Omit<BrandCoupon, 'id'>);
        toast.success(`New brand coupon "${payload.title}" created!`);
      }
      setIsCouponModalOpen(false);
    } catch (err) {
      toast.error('Failed to save brand coupon');
      console.error(err);
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleToggleCoupon = async (coupon: BrandCoupon) => {
    try {
      await toggleRewardOffer(coupon.id, !coupon.active);
      toast.success(`Coupon "${coupon.title}" is now ${!coupon.active ? 'Active' : 'Inactive'}`);
    } catch (err) {
      toast.error('Failed to toggle coupon status');
    }
  };

  const handleDeleteCoupon = async (couponId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteRewardOffer(couponId);
      toast.success(`Deleted coupon "${title}".`);
    } catch (err) {
      toast.error('Failed to delete brand coupon');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const newOffers = [...offers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOffers.length) return;

    const temp = newOffers[index];
    newOffers[index] = newOffers[targetIndex];
    newOffers[targetIndex] = temp;

    try {
      await reorderRewardOffers(newOffers);
      toast.success('Display order updated.');
    } catch (err) {
      toast.error('Failed to reorder coupons.');
    }
  };

  // Orders Actions
  const handleConfirmPayment = async (orderId: string) => {
    if (!window.confirm('Confirm payment and unlock actual coupon code for customer?')) return;
    const res = await confirmRewardOrderPayment(orderId);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleRejectPayment = async (orderId: string) => {
    const reason = prompt('Reason for payment rejection:', 'Payment verification failed / invalid reference');
    if (reason === null) return;
    const res = await rejectRewardOrderPayment(orderId, reason);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleMarkUsed = async (orderId: string) => {
    const res = await markRewardOrderUsed(orderId);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  // Filtered Coupons
  const filteredCoupons = offers.filter(c => {
    const matchesSearch = (c.brandName || '').toLowerCase().includes(couponSearch.toLowerCase()) ||
                          (c.title || '').toLowerCase().includes(couponSearch.toLowerCase()) ||
                          (c.code || '').toLowerCase().includes(couponSearch.toLowerCase());
    const matchesCategory = couponCategoryFilter === 'all' || c.category === couponCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered Reward Orders
  const filteredOrders = rewardOrders.filter(o => {
    if (orderStatusFilter === 'pending') return o.paymentStatus === 'pending' || o.paymentStatus === 'submitted';
    if (orderStatusFilter === 'confirmed') return o.paymentStatus === 'confirmed';
    if (orderStatusFilter === 'used') return o.couponStatus === 'used';
    if (orderStatusFilter === 'expired') return new Date(o.expiryDate).getTime() < Date.now();
    return true;
  });

  const pendingOrdersCount = rewardOrders.filter(o => o.paymentStatus === 'pending' || o.paymentStatus === 'submitted').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Rewards & Brand Coupons Management</h1>
            <p className="text-xs text-gray-500">Configure storewide rewards section, create brand coupons, set discounts, and verify customer payments.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold">
            <span className="text-gray-500">System Status:</span>
            <span className={config.enabled ? 'text-emerald-600 font-black flex items-center gap-1' : 'text-rose-500 font-black flex items-center gap-1'}>
              {config.enabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {config.enabled ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('preview')}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Eye className="w-4 h-4" /> Live Preview
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Gift className="w-4 h-4" /> Section & Branding Settings
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'coupons'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Tag className="w-4 h-4" /> Brand Coupons ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap relative ${
            activeTab === 'orders'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Reward Orders & Payment Verification ({rewardOrders.length})
          {pendingOrdersCount > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black animate-pulse">
              {pendingOrdersCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'preview'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Eye className="w-4 h-4" /> Device Preview
        </button>
      </div>

      {/* TAB 1: SECTION & BRANDING SETTINGS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveConfig} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Rewards Section & Branding Settings</h2>
              <p className="text-xs text-gray-500">Manage visibility, title, header banner, icon, and permanent notices.</p>
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingConfig ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Enable/Disable */}
            <div className="col-span-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-gray-900 block">Enable Rewards & Brand Coupons Section</span>
                <span className="text-xs text-gray-500">Toggle whether customer storefront rewards page is active.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConfig.enabled}
                  onChange={(e) => setFormConfig({ ...formConfig, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Rewards Main Title</label>
              <input
                type="text"
                value={formConfig.title}
                onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Exclusive Brand Rewards & Instant Discount Vouchers"
              />
            </div>

            {/* Badge Text */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Badge / Tagline Text</label>
              <input
                type="text"
                value={formConfig.badgeText}
                onChange={(e) => setFormConfig({ ...formConfig, badgeText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="ViBa Official Brand Coupons"
              />
            </div>

            {/* Subtitle */}
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-700 block mb-1">Sub-heading Description</label>
              <textarea
                rows={2}
                value={formConfig.subtitle}
                onChange={(e) => setFormConfig({ ...formConfig, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Claim premium brand coupons across Top Brands..."
              />
            </div>

            {/* Banner Image URL */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Rewards Banner Image URL</label>
              <input
                type="text"
                value={formConfig.bannerImage || ''}
                onChange={(e) => setFormConfig({ ...formConfig, bannerImage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            {/* Non-Refundable Notice Text */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Permanent Notice Header</label>
              <input
                type="text"
                value={formConfig.nonRefundableNotice || '⚠️ NON REFUNDABLE'}
                onChange={(e) => setFormConfig({ ...formConfig, nonRefundableNotice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="⚠️ NON REFUNDABLE"
              />
            </div>

            {/* Earning & Redemption Terms */}
            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Redemption Rules Text</label>
                <textarea
                  rows={3}
                  value={formConfig.redemptionRules}
                  onChange={(e) => setFormConfig({ ...formConfig, redemptionRules: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Terms & Conditions</label>
                <textarea
                  rows={3}
                  value={formConfig.termsAndConditions}
                  onChange={(e) => setFormConfig({ ...formConfig, termsAndConditions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: BRAND COUPONS MANAGEMENT */}
      {activeTab === 'coupons' && (
        <div className="space-y-6 font-sans">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={couponSearch}
                  onChange={(e) => setCouponSearch(e.target.value)}
                  placeholder="Search brand, coupon title, code..."
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <select
                value={couponCategoryFilter}
                onChange={(e) => setCouponCategoryFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none bg-white"
              >
                <option value="all">All Categories</option>
                <option value="Fashion & Apparel">Fashion & Apparel</option>
                <option value="Electronics">Electronics</option>
                <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                <option value="Sports & Outdoors">Sports & Outdoors</option>
                <option value="Grocery & Dining">Grocery & Dining</option>
              </select>
            </div>

            <button
              onClick={openAddCouponModal}
              className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> Create Brand Coupon
            </button>
          </div>

          {/* Coupons List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoupons.map((coupon, idx) => (
              <div key={coupon.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  {/* Top Image & Logo Header */}
                  <div className="h-40 relative bg-gray-100 overflow-hidden">
                    <img src={coupon.productImage || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop'} alt={coupon.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                    {/* Brand Logo Badge */}
                    <div className="absolute left-4 bottom-3 flex items-center gap-2 z-10">
                      <img src={coupon.brandLogo || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop'} alt={coupon.brandName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md bg-white" />
                      <div>
                        <span className="text-white font-black text-xs block leading-tight">{coupon.brandName}</span>
                        <span className="text-[10px] text-amber-300 font-bold">{coupon.category || 'General'}</span>
                      </div>
                    </div>

                    {/* Featured & Active Badges */}
                    <div className="absolute right-3 top-3 flex items-center gap-1.5 z-10">
                      {coupon.featured && (
                        <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-full shadow-sm">
                          FEATURED
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black text-white ${coupon.active ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                        {coupon.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{coupon.title}</h3>
                      <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg shrink-0 ml-2">
                        {coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2">{coupon.description || coupon.terms}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-xl text-gray-600 font-medium">
                      <div><span className="text-gray-400">Code:</span> <strong className="font-mono text-gray-900">{coupon.code}</strong></div>
                      <div><span className="text-gray-400">Buy Price:</span> <strong className="text-amber-600">₹{coupon.buyNowPrice}</strong></div>
                      <div><span className="text-gray-400">Stock:</span> <strong className="text-gray-900">{coupon.remainingQuantity} / {coupon.totalQuantity}</strong></div>
                      <div><span className="text-gray-400">Min Order:</span> <strong className="text-gray-900">₹{coupon.minOrderValue || 0}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveOrder(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 hover:bg-white rounded-lg text-gray-500 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(idx, 'down')}
                      disabled={idx === offers.length - 1}
                      className="p-1.5 hover:bg-white rounded-lg text-gray-500 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleCoupon(coupon)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        coupon.active ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openEditCouponModal(coupon)}
                      className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
                      title="Edit Coupon"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id, coupon.title)}
                      className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-lg"
                      title="Delete Coupon"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REWARD ORDERS & PAYMENT VERIFICATION */}
      {activeTab === 'orders' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6 font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Customer Reward Orders & Payment Approvals</h2>
              <p className="text-xs text-gray-500">Verify customer payments. Confirming payment unlocks the real coupon code for the customer.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-bold">
              <button
                onClick={() => setOrderStatusFilter('all')}
                className={`px-3 py-1 rounded-lg ${orderStatusFilter === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
              >
                All ({rewardOrders.length})
              </button>
              <button
                onClick={() => setOrderStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1 ${orderStatusFilter === 'pending' ? 'bg-white shadow text-amber-600 font-black' : 'text-gray-500'}`}
              >
                Pending ({pendingOrdersCount})
              </button>
              <button
                onClick={() => setOrderStatusFilter('confirmed')}
                className={`px-3 py-1 rounded-lg ${orderStatusFilter === 'confirmed' ? 'bg-white shadow text-emerald-600 font-black' : 'text-gray-500'}`}
              >
                Confirmed
              </button>
              <button
                onClick={() => setOrderStatusFilter('used')}
                className={`px-3 py-1 rounded-lg ${orderStatusFilter === 'used' ? 'bg-white shadow text-slate-700' : 'text-gray-500'}`}
              >
                Used
              </button>
            </div>
          </div>

          {/* Table */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-bold">No reward orders match the current filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                    <th className="p-3">Order ID & Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Brand & Product</th>
                    <th className="p-3">Amount Paid</th>
                    <th className="p-3">Payment Status</th>
                    <th className="p-3">Coupon Code Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const isPending = order.paymentStatus === 'pending' || order.paymentStatus === 'submitted';
                    const isConfirmed = order.paymentStatus === 'confirmed';

                    return (
                      <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-gray-900">
                          <div>{order.id}</div>
                          <div className="text-[10px] text-gray-400 font-normal">{new Date(order.createdAt).toLocaleString()}</div>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-gray-900">{order.userName || 'Customer'}</div>
                          <div className="text-[10px] text-gray-500">{order.userEmail || order.userPhone}</div>
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-amber-700">{order.brandName}</div>
                          <div className="text-gray-800 line-clamp-1">{order.productTitle}</div>
                        </td>

                        <td className="p-3 font-black text-gray-900">
                          ₹{order.amountPaid}
                          <span className="block text-[10px] font-normal text-gray-400 uppercase">{order.paymentMethod}</span>
                          {order.paymentReference && <span className="block text-[10px] font-mono text-gray-500">Ref: {order.paymentReference}</span>}
                        </td>

                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                            isConfirmed ? 'bg-emerald-100 text-emerald-700' : isPending ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isConfirmed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {order.paymentStatus}
                          </span>
                        </td>

                        <td className="p-3">
                          {isConfirmed ? (
                            <div>
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold rounded text-[11px]">
                                {order.unlockedCode || 'UNLOCKED'}
                              </span>
                              <span className="block text-[10px] text-gray-400 mt-0.5">Unlocked</span>
                            </div>
                          ) : (
                            <div>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-400 font-mono font-bold rounded text-[11px]">
                                XXX-XXX-XXX-XXX
                              </span>
                              <span className="block text-[10px] text-amber-600 font-bold mt-0.5">Locked until admin confirm</span>
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          {isPending && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleConfirmPayment(order.id)}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 shadow-sm flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Confirm & Unlock
                              </button>
                              <button
                                onClick={() => handleRejectPayment(order.id)}
                                className="px-2.5 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-lg font-bold text-[11px]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {isConfirmed && order.couponStatus !== 'used' && (
                            <button
                              onClick={() => handleMarkUsed(order.id)}
                              className="px-2.5 py-1 bg-slate-800 text-white hover:bg-slate-900 rounded-lg font-bold text-[11px]"
                            >
                              Mark as Used
                            </button>
                          )}
                          {order.couponStatus === 'used' && (
                            <span className="text-[10px] font-bold text-gray-400">USED</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LIVE PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4 font-sans">
          <div className="flex justify-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                previewDevice === 'desktop' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Monitor className="w-4 h-4" /> Desktop Preview
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                previewDevice === 'mobile' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Smartphone className="w-4 h-4" /> Mobile Preview
            </button>
          </div>

          <div className={`mx-auto bg-white rounded-3xl border-4 border-slate-900 shadow-2xl overflow-hidden transition-all duration-300 ${
            previewDevice === 'mobile' ? 'max-w-[390px] min-h-[700px]' : 'max-w-6xl min-h-[600px]'
          }`}>
            {/* Live Storefront Mock Header */}
            <div className="bg-amber-500 p-4 text-white text-center">
              <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-200" />
                {config.nonRefundableNotice || '⚠️ NON REFUNDABLE'}
              </div>
            </div>

            <div className="p-6 space-y-6 bg-[#FFF9F5]">
              <div className="bg-gradient-to-r from-slate-900 to-amber-950 p-6 rounded-2xl text-white space-y-2">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">{config.badgeText}</span>
                <h2 className="text-xl font-black">{config.title}</h2>
                <p className="text-xs text-slate-300">{config.subtitle}</p>
              </div>

              {/* Sample Coupons */}
              <div className={`grid gap-4 ${previewDevice === 'mobile' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
                {offers.slice(0, 3).map(coupon => (
                  <div key={coupon.id} className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                      <img src={coupon.brandLogo} alt="" className="w-8 h-8 rounded-full object-cover border" />
                      <div>
                        <h4 className="text-xs font-black text-gray-900">{coupon.brandName}</h4>
                        <span className="text-[10px] text-emerald-600 font-bold">{coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}</span>
                      </div>
                    </div>
                    <img src={coupon.productImage} alt="" className="w-full h-32 object-cover rounded-xl" />
                    <h5 className="text-xs font-bold text-gray-900">{coupon.title}</h5>
                    <div className="flex gap-2">
                      <button className="flex-1 py-1.5 bg-amber-500 text-white rounded-xl text-[11px] font-black">Buy Now (₹{coupon.buyNowPrice})</button>
                      <button className="px-3 py-1.5 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-600">Official Brand</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BRAND COUPON MODAL */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-6 shadow-2xl border border-gray-100 my-8 font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-black text-gray-900">
                    {editingCoupon ? 'Edit Brand Coupon' : 'Create Unlimited Brand Coupon'}
                  </h2>
                </div>
                <button
                  onClick={() => setIsCouponModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCoupon} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brand Name */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Brand Name *</label>
                    <input
                      type="text"
                      required
                      value={couponForm.brandName}
                      onChange={(e) => setCouponForm({ ...couponForm, brandName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Nike, Apple, Puma, Sephora"
                    />
                  </div>

                  {/* Brand Logo URL */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Brand Logo Image URL</label>
                    <input
                      type="text"
                      value={couponForm.brandLogo}
                      onChange={(e) => setCouponForm({ ...couponForm, brandLogo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  {/* Official Brand Website URL */}
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-700 block mb-1">Official Brand Website URL ("Visit Official Brand")</label>
                    <input
                      type="url"
                      value={couponForm.brandWebsiteUrl}
                      onChange={(e) => setCouponForm({ ...couponForm, brandWebsiteUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="https://www.nike.com"
                    />
                  </div>

                  {/* Coupon Title */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Coupon Title *</label>
                    <input
                      type="text"
                      required
                      value={couponForm.title}
                      onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Flat ₹500 Off Nike Footwear"
                    />
                  </div>

                  {/* Secret Coupon Code */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Actual Secret Coupon Code *</label>
                    <input
                      type="text"
                      required
                      value={couponForm.code}
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. NIKE-SUMMER-500"
                    />
                  </div>

                  {/* Discount Type */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Discount Type</label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                    >
                      <option value="flat">Flat Amount (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>

                  {/* Discount Value */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Discount Value</label>
                    <input
                      type="number"
                      required
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold text-amber-600"
                    />
                  </div>

                  {/* Buy Now Price */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Buy Now Price (Amount Paid by Customer ₹)</label>
                    <input
                      type="number"
                      value={couponForm.buyNowPrice}
                      onChange={(e) => setCouponForm({ ...couponForm, buyNowPrice: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                    />
                  </div>

                  {/* Minimum Order Value */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Minimum Order Value (₹)</label>
                    <input
                      type="number"
                      value={couponForm.minOrderValue}
                      onChange={(e) => setCouponForm({ ...couponForm, minOrderValue: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Main Product Image */}
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-700 block mb-1">Main Product Image URL</label>
                    <input
                      type="text"
                      value={couponForm.productImage}
                      onChange={(e) => setCouponForm({ ...couponForm, productImage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Catalog Images Gallery Uploader */}
                  <div className="col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <label className="text-xs font-bold text-gray-700 block">Product Catalog Gallery (Multiple Images)</label>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={catalogInput}
                        onChange={(e) => setCatalogInput(e.target.value)}
                        placeholder="Paste image URL..."
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddCatalogImage}
                        className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
                      >
                        Add Image
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      {couponForm.catalogImages?.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-300 group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveCatalogImage(idx)}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Validity Date & Time */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Validity Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={couponForm.validFrom}
                      onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Expiry Date & Time */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Expiry End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={couponForm.expiryDate}
                      onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Quantities */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Total Coupon Quantity</label>
                    <input
                      type="number"
                      value={couponForm.totalQuantity}
                      onChange={(e) => setCouponForm({ ...couponForm, totalQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Remaining Coupons</label>
                    <input
                      type="number"
                      value={couponForm.remainingQuantity}
                      onChange={(e) => setCouponForm({ ...couponForm, remainingQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  {/* Category & Subcategory */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Category</label>
                    <select
                      value={couponForm.category}
                      onChange={(e) => setCouponForm({ ...couponForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                    >
                      <option value="Fashion & Apparel">Fashion & Apparel</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Beauty & Personal Care">Beauty & Personal Care</option>
                      <option value="Sports & Outdoors">Sports & Outdoors</option>
                      <option value="Grocery & Dining">Grocery & Dining</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Subcategory</label>
                    <input
                      type="text"
                      value={couponForm.subcategory}
                      onChange={(e) => setCouponForm({ ...couponForm, subcategory: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                      placeholder="e.g. Footwear, Audio, Skincare"
                    />
                  </div>

                  {/* Active & Featured Flags */}
                  <div className="col-span-2 flex items-center gap-6 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                      <input
                        type="checkbox"
                        checked={couponForm.active}
                        onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
                        className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                      />
                      Active Status
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                      <input
                        type="checkbox"
                        checked={couponForm.featured}
                        onChange={(e) => setCouponForm({ ...couponForm, featured: e.target.checked })}
                        className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                      />
                      Featured / Priority Badge
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCoupon}
                    className="px-6 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {savingCoupon ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Brand Coupon'}
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

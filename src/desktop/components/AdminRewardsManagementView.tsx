import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Sparkles, Award, Tag, Trophy, Plus, Edit3, Trash2,
  Check, Eye, Save, RefreshCw, Smartphone, Monitor, ShieldCheck,
  AlertCircle, ChevronRight, Lock, Image as ImageIcon, Link as LinkIcon,
  CheckCircle2, XCircle, ArrowUp, ArrowDown, Info
} from 'lucide-react';
import { useRewardsStore } from '../../backend/store';
import { RewardOffer, RewardsSectionConfig } from '../../shared/types';
import toast from 'react-hot-toast';

const PRESET_ICONS = ['Gift', 'Sparkles', 'Award', 'Tag', 'Trophy', 'ShieldCheck'];

export default function AdminRewardsManagementView() {
  const { config, offers, updateRewardsConfig, addRewardOffer, updateRewardOffer, toggleRewardOffer, deleteRewardOffer, initRewards } = useRewardsStore();

  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'offers' | 'preview'>('general');
  const [formConfig, setFormConfig] = useState<RewardsSectionConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);

  // Offer Modal State
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<RewardOffer | null>(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Offer Form State
  const [offerForm, setOfferForm] = useState<Partial<RewardOffer>>({
    title: '',
    description: '',
    pointsRequired: 100,
    discountValue: 100,
    discountType: 'fixed',
    code: '',
    minPurchase: 0,
    expiryDays: 30,
    usageLimit: 1,
    eligibilityTier: 'all',
    active: true,
    order: 1,
    category: 'Storewide',
    icon: 'Gift',
    imageUrl: ''
  });

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

  const openAddOfferModal = () => {
    setEditingOffer(null);
    setOfferForm({
      title: '',
      description: '',
      pointsRequired: 100,
      discountValue: 100,
      discountType: 'fixed',
      code: `REWARD${Math.floor(100 + Math.random() * 900)}`,
      minPurchase: 0,
      expiryDays: 30,
      usageLimit: 1,
      eligibilityTier: 'all',
      active: true,
      order: offers.length + 1,
      category: 'Storewide',
      icon: 'Gift',
      imageUrl: ''
    });
    setIsOfferModalOpen(true);
  };

  const openEditOfferModal = (offer: RewardOffer) => {
    setEditingOffer(offer);
    setOfferForm({ ...offer });
    setIsOfferModalOpen(true);
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerForm.title || !offerForm.code || !offerForm.pointsRequired) {
      toast.error('Please fill in all required offer fields.');
      return;
    }

    setSavingOffer(true);
    try {
      if (editingOffer) {
        await updateRewardOffer(editingOffer.id, offerForm);
        toast.success(`Reward offer "${offerForm.title}" updated.`);
      } else {
        await addRewardOffer(offerForm as Omit<RewardOffer, 'id'>);
        toast.success(`New reward offer "${offerForm.title}" created!`);
      }
      setIsOfferModalOpen(false);
    } catch (err) {
      toast.error('Failed to save reward offer');
      console.error(err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleToggleOffer = async (offer: RewardOffer) => {
    try {
      await toggleRewardOffer(offer.id, !offer.active);
      toast.success(`Offer "${offer.title}" set to ${!offer.active ? 'Active' : 'Inactive'}`);
    } catch (err) {
      toast.error('Failed to toggle offer status');
    }
  };

  const handleDeleteOffer = async (offerId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteRewardOffer(offerId);
      toast.success(`Deleted reward offer "${title}".`);
    } catch (err) {
      toast.error('Failed to delete reward offer');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <Gift className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rewards & Loyalty Management</h1>
            <p className="text-xs text-gray-500">Configure storewide rewards section, earning/redemption rules, and vouchers in real time.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold">
            <span className="text-gray-500">Status:</span>
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

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'general'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Gift className="w-4 h-4" /> Section & Branding
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Points & Rules
        </button>
        <button
          onClick={() => setActiveTab('offers')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'offers'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Tag className="w-4 h-4" /> Reward Offers ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'preview'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
          }`}
        >
          <Monitor className="w-4 h-4" /> Device Preview
        </button>
      </div>

      {/* Tab 1: General Section Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Storefront Banner & Branding</h2>
              <p className="text-xs text-gray-500">Configure how the Rewards section title, banner, card text, and icons display on storefront pages.</p>
            </div>

            {/* Master Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700">Enable Rewards Program</span>
              <button
                type="button"
                onClick={() => setFormConfig({ ...formConfig, enabled: !formConfig.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formConfig.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Header Badge Text</label>
              <input
                type="text"
                value={formConfig.badgeText}
                onChange={(e) => setFormConfig({ ...formConfig, badgeText: e.target.value })}
                placeholder="e.g. ViBa Club Rewards"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Section Main Title</label>
              <input
                type="text"
                value={formConfig.title}
                onChange={(e) => setFormConfig({ ...formConfig, title: e.target.value })}
                placeholder="e.g. Shop, Earn Points & Unlock Exclusive Discounts"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-gray-700">Subtitle / Description</label>
              <textarea
                rows={3}
                value={formConfig.subtitle}
                onChange={(e) => setFormConfig({ ...formConfig, subtitle: e.target.value })}
                placeholder="Describe how customers earn and redeem reward points..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Header Icon Preset</label>
              <select
                value={formConfig.headerIcon}
                onChange={(e) => setFormConfig({ ...formConfig, headerIcon: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              >
                {PRESET_ICONS.map(iconName => (
                  <option key={iconName} value={iconName}>{iconName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Custom Header Icon URL (Optional)</label>
              <input
                type="url"
                value={formConfig.headerIconUrl || ''}
                onChange={(e) => setFormConfig({ ...formConfig, headerIconUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Homepage Reward Card Highlight Text</label>
              <input
                type="text"
                value={formConfig.cardText}
                onChange={(e) => setFormConfig({ ...formConfig, cardText: e.target.value })}
                placeholder="e.g. Earn 1 point per ₹10 spent. Redeem points for instant discounts & vouchers!"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Primary Redeem Button Text</label>
              <input
                type="text"
                value={formConfig.buttonText}
                onChange={(e) => setFormConfig({ ...formConfig, buttonText: e.target.value })}
                placeholder="e.g. Redeem Voucher"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Rewards Section Target Link / Route</label>
              <input
                type="text"
                value={formConfig.targetLink}
                onChange={(e) => setFormConfig({ ...formConfig, targetLink: e.target.value })}
                placeholder="e.g. /rewards"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Banner Background Image URL (Optional)</label>
              <input
                type="url"
                value={formConfig.cardImage || ''}
                onChange={(e) => setFormConfig({ ...formConfig, cardImage: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Section Settings
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Points & Rules */}
      {activeTab === 'rules' && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">Earning Rules, Points Calculation & Terms</h2>
            <p className="text-xs text-gray-500">Define welcome bonuses, earning multipliers, and store policy text.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Points Earned per ₹ Spent</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formConfig.pointsPerRupee}
                onChange={(e) => setFormConfig({ ...formConfig, pointsPerRupee: parseFloat(e.target.value) || 0.1 })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <p className="text-[11px] text-gray-400">e.g. 0.1 means 1 point for every ₹10 spent.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Welcome Bonus Points</label>
              <input
                type="number"
                min="0"
                value={formConfig.welcomeBonusPoints}
                onChange={(e) => setFormConfig({ ...formConfig, welcomeBonusPoints: parseInt(e.target.value) || 250 })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <p className="text-[11px] text-gray-400">Credited to newly created user accounts.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700">Minimum Redemption Points</label>
              <input
                type="number"
                min="0"
                value={formConfig.minRedeemPoints}
                onChange={(e) => setFormConfig({ ...formConfig, minRedeemPoints: parseInt(e.target.value) || 100 })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <p className="text-[11px] text-gray-400">Minimum points user must hold to unlock voucher redemptions.</p>
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-bold text-gray-700">Earning Rules Explanation</label>
              <textarea
                rows={3}
                value={formConfig.earningRules}
                onChange={(e) => setFormConfig({ ...formConfig, earningRules: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-bold text-gray-700">Redemption Rules Explanation</label>
              <textarea
                rows={3}
                value={formConfig.redemptionRules}
                onChange={(e) => setFormConfig({ ...formConfig, redemptionRules: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-3 space-y-2">
              <label className="text-xs font-bold text-gray-700">Terms & Conditions</label>
              <textarea
                rows={3}
                value={formConfig.termsAndConditions}
                onChange={(e) => setFormConfig({ ...formConfig, termsAndConditions: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Points & Rules
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Reward Offers Manager */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-gray-900">Manage Reward Offers & Vouchers</h2>
              <p className="text-xs text-gray-500">Create, activate, edit, reorder, or delete reward vouchers for storefront users.</p>
            </div>
            <button
              onClick={openAddOfferModal}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Reward Offer
            </button>
          </div>

          {/* Offers Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`bg-white rounded-2xl border ${offer.active ? 'border-gray-200 shadow-sm' : 'border-gray-200 bg-gray-50 opacity-75'} p-5 flex flex-col justify-between space-y-4`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-black rounded-xl">
                      {offer.pointsRequired} pts required
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        offer.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {offer.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Priority: #{offer.order}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base mb-1">{offer.title}</h3>
                  <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{offer.description}</p>

                  <div className="space-y-1 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex justify-between">
                      <span>Code: <strong className="text-gray-800">{offer.code}</strong></span>
                      <span>Discount: <strong className="text-emerald-600">{offer.discountType === 'percentage' ? `${offer.discountValue}%` : `₹${offer.discountValue}`}</strong></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Purchase: <strong>₹{offer.minPurchase || 0}</strong></span>
                      <span>Eligibility: <strong className="capitalize">{offer.eligibilityTier || 'all'}</strong></span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expiry: <strong>{offer.expiryDays} Days</strong></span>
                      <span>Category: <strong>{offer.category || 'Storewide'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleOffer(offer)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      offer.active
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {offer.active ? 'Deactivate' : 'Activate'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditOfferModal(offer)}
                      className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                      title="Edit Offer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOffer(offer.id, offer.title)}
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Delete Offer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Live Device Preview */}
      {activeTab === 'preview' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Live Device Storefront Preview</h2>
              <p className="text-xs text-gray-500">Preview how Admin Rewards configuration renders on Desktop and Mobile user screens.</p>
            </div>

            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  previewDevice === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  previewDevice === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
            </div>
          </div>

          {!formConfig.enabled && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Note: Rewards program is currently <strong>DISABLED</strong>. Storefront users will see an offline banner.</span>
            </div>
          )}

          {previewDevice === 'desktop' ? (
            /* Desktop Mockup Preview */
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-slate-50 p-6 space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-yellow-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-3 max-w-xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-yellow-300">
                      <Gift className="w-3.5 h-3.5" /> {formConfig.badgeText || 'ViBa Club Rewards'}
                    </div>
                    <h2 className="text-2xl font-black">{formConfig.title || 'Shop, Earn Points & Unlock Exclusive Discounts'}</h2>
                    <p className="text-slate-300 text-xs leading-relaxed">{formConfig.subtitle}</p>
                  </div>

                  <div className="bg-white/10 border border-white/20 p-5 rounded-2xl space-y-2 text-right shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Sample Points Balance</span>
                    <div className="text-3xl font-black text-amber-400">250 pts</div>
                  </div>
                </div>
              </div>

              {/* Sample Offers Preview */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Active Reward Vouchers Preview</h4>
                <div className="grid grid-cols-3 gap-4">
                  {offers.filter(o => o.active).map(offer => (
                    <div key={offer.id} className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-gray-900">{offer.title}</span>
                        <span className="text-amber-600 font-black">{offer.pointsRequired} pts</span>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-2">{offer.description}</p>
                      <button className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold">
                        {formConfig.buttonText || 'Redeem Voucher'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Mobile Mockup Preview */
            <div className="max-w-sm mx-auto border-4 border-gray-800 rounded-[2.5rem] bg-[#FFF3EB] p-4 shadow-2xl space-y-4">
              {/* Mobile Banner */}
              <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-yellow-950 text-white p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-yellow-300 font-bold">{formConfig.badgeText || 'ViBa Club Rewards'}</span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">Silver Tier</span>
                </div>
                <div className="text-xl font-black text-amber-400">250 Pts</div>
              </div>

              {/* Mobile Card Preview */}
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-900 uppercase">REWARDS</span>
                    <p className="text-[10px] text-gray-500 line-clamp-1">{formConfig.cardText}</p>
                  </div>
                </div>
              </div>

              {/* Mobile Offer List */}
              <div className="space-y-2">
                {offers.filter(o => o.active).slice(0, 2).map(offer => (
                  <div key={offer.id} className="bg-white p-3 rounded-xl border border-yellow-100 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-gray-900">{offer.title}</div>
                      <div className="text-[10px] text-gray-400">{offer.pointsRequired} pts</div>
                    </div>
                    <button className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-bold">
                      Redeem
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offer Modal Form */}
      <AnimatePresence>
        {isOfferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">
                  {editingOffer ? 'Edit Reward Offer' : 'Create New Reward Offer'}
                </h3>
                <button
                  onClick={() => setIsOfferModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveOffer} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Offer Title *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      placeholder="e.g. ₹100 Instant Discount"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Coupon Code *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.code}
                      onChange={(e) => setOfferForm({ ...offerForm, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. REWARD100"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Description</label>
                    <textarea
                      rows={2}
                      value={offerForm.description}
                      onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                      placeholder="Short terms or conditions for claiming this voucher..."
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Points Required *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={offerForm.pointsRequired}
                      onChange={(e) => setOfferForm({ ...offerForm, pointsRequired: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Discount Type</label>
                    <select
                      value={offerForm.discountType}
                      onChange={(e) => setOfferForm({ ...offerForm, discountType: e.target.value as any })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                    >
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Discount Value *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={offerForm.discountValue}
                      onChange={(e) => setOfferForm({ ...offerForm, discountValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Minimum Purchase (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={offerForm.minPurchase}
                      onChange={(e) => setOfferForm({ ...offerForm, minPurchase: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Expiry (Days)</label>
                    <input
                      type="number"
                      min="1"
                      value={offerForm.expiryDays}
                      onChange={(e) => setOfferForm({ ...offerForm, expiryDays: parseInt(e.target.value) || 30 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Eligibility Tier</label>
                    <select
                      value={offerForm.eligibilityTier}
                      onChange={(e) => setOfferForm({ ...offerForm, eligibilityTier: e.target.value as any })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                    >
                      <option value="all">All Members</option>
                      <option value="Silver">Silver Tier & Above</option>
                      <option value="Gold">Gold Tier & Above</option>
                      <option value="Platinum">Platinum Tier Only</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Priority Order</label>
                    <input
                      type="number"
                      min="1"
                      value={offerForm.order}
                      onChange={(e) => setOfferForm({ ...offerForm, order: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">Status</label>
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="status"
                          checked={offerForm.active === true}
                          onChange={() => setOfferForm({ ...offerForm, active: true })}
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer font-medium">
                        <input
                          type="radio"
                          name="status"
                          checked={offerForm.active === false}
                          onChange={() => setOfferForm({ ...offerForm, active: false })}
                        />
                        Inactive
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsOfferModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOffer}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-500/20"
                  >
                    {savingOffer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingOffer ? 'Save Changes' : 'Create Offer'}
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

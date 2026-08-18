import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Gift, Award, Sparkles, Tag, Clock, ArrowUpRight,
  ArrowDownLeft, ShieldCheck, Check, Copy, Lock, Trophy,
  Star, ChevronRight, Info, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRewardsStore, useFeatureStore, useAuthStore } from '../../backend/store';
import toast from 'react-hot-toast';

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { rewards, config, offers, loading, initRewards, claimVoucher } = useRewardsStore();
  const { isFeatureEnabled } = useFeatureStore();
  const [activeTab, setActiveTab] = useState<'vouchers' | 'history' | 'rules'>('vouchers');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    initRewards(user?.uid);
  }, [user]);

  const enabled = isFeatureEnabled('rewards') && config.enabled;

  if (!enabled) {
    return (
      <div className="max-w-4xl mx-auto my-16 p-12 bg-white rounded-3xl border border-gray-100 shadow-xl text-center space-y-4 font-sans">
        <div className="w-16 h-16 bg-yellow-100 text-primary rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-gray-900">Rewards Program Currently Offline</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          The Rewards & Loyalty program is temporarily disabled by the store admin. Please check back later.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 hover:bg-yellow-600 transition-colors"
        >
          Return to Storefront
        </button>
      </div>
    );
  }

  const activeOffers = offers.filter(o => o.active !== false);

  const handleClaim = async (voucherId: string) => {
    if (!user) {
      toast.error('Please log in to claim reward vouchers');
      navigate('/login');
      return;
    }

    const res = await claimVoucher(voucherId);
    if (res.success) {
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code ${code} copied!`);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Desktop Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-yellow-950 rounded-3xl p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-yellow-300 backdrop-blur-md">
              <Gift className="w-3.5 h-3.5" /> {config.badgeText || 'ViBa Mart Club Rewards'}
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
              {config.title || 'Shop, Earn Points & Unlock Exclusive Discounts'}
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              {config.subtitle}
            </p>
          </div>

          {/* User Points Card */}
          <div className="bg-white/10 border border-white/20 backdrop-blur-md p-6 rounded-2xl space-y-4 shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Available Points</span>
                <span className="text-4xl font-black text-white flex items-center gap-2 mt-1">
                  {rewards?.pointsBalance ?? config.welcomeBonusPoints ?? 250} <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                </span>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-black uppercase tracking-wider">
                {rewards?.tier || 'Silver'} Tier
              </span>
            </div>

            <div className="space-y-1.5 pt-4 border-t border-white/10">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Progress to Gold Tier</span>
                <span>{(rewards?.pointsBalance ?? config.welcomeBonusPoints ?? 250)} / 500 pts</span>
              </div>
              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (((rewards?.pointsBalance ?? config.welcomeBonusPoints ?? 250)) / 500) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'vouchers'
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Tag className="w-4 h-4" /> Available Vouchers ({activeOffers.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Transaction History
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Program Rules & Policy
          </button>
        </div>

        <div className="text-xs font-bold text-gray-400">
          Shared ViBa Mart Points Ledger
        </div>
      </div>

      {/* Grid Content */}
      {activeTab === 'vouchers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activeOffers.map((voucher) => {
            const isClaimed = rewards?.claimedVouchers?.includes(voucher.id);
            const canAfford = (rewards?.pointsBalance ?? 0) >= voucher.pointsRequired;

            return (
              <motion.div
                key={voucher.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                      <Gift className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-black rounded-xl">
                      {voucher.pointsRequired} pts
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 text-base mb-1">{voucher.title}</h3>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">{voucher.description}</p>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex justify-between items-center text-[11px] text-gray-400 font-bold uppercase">
                    <span>Valid: {voucher.expiryDays} Days</span>
                    <span>{voucher.category || 'Storewide'}</span>
                  </div>

                  {isClaimed ? (
                    <button
                      onClick={() => copyToClipboard(voucher.code)}
                      className="w-full py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedCode === voucher.code ? 'Copied to Clipboard!' : `Code: ${voucher.code}`}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClaim(voucher.id)}
                      disabled={!canAfford}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        canAfford
                          ? 'bg-primary text-white hover:bg-yellow-600 shadow-primary/30'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? (config.buttonText || 'Redeem Voucher') : `Need ${voucher.pointsRequired - (rewards?.pointsBalance ?? 0)} More Pts`}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 space-y-4">
          <h3 className="text-base font-bold text-gray-900 mb-4">Points Activity & Ledger</h3>
          {(!rewards?.transactions || rewards.transactions.length === 0) ? (
            <div className="text-center py-12 text-sm text-gray-400 italic">No points transactions recorded yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {rewards.transactions.map((tx) => (
                <div key={tx.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${tx.type === 'earned' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {tx.type === 'earned' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{tx.title}</div>
                      <div className="text-xs text-gray-500">{tx.description}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-black text-sm ${tx.type === 'earned' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'earned' ? '+' : '-'}{tx.points} pts
                    </div>
                    <div className="text-[11px] text-gray-400 font-medium">
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Rewards Program Rules & Terms</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-100 space-y-2">
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" /> How to Earn Points
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                {config.earningRules || 'Earn points for every purchase made on ViBa Mart.'}
              </p>
              <div className="pt-2 text-[11px] font-bold text-amber-700">
                Rate: Earn {config.pointsPerRupee ? Math.round(1 / config.pointsPerRupee) : 10} ₹ = 1 Point
              </div>
            </div>

            <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-2">
              <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" /> Redemption Rules
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {config.redemptionRules || 'Redeem points for instant store discount vouchers.'}
              </p>
              <div className="pt-2 text-[11px] font-bold text-emerald-700">
                Minimum Points Required: {config.minRedeemPoints || 100} Pts
              </div>
            </div>

            <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600" /> Terms & Conditions
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {config.termsAndConditions || 'Reward points and vouchers are subject to store validity terms.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

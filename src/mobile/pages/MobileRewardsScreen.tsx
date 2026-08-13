import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Award, Sparkles, Tag, ChevronRight, Clock,
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Check, Copy,
  AlertCircle, Lock, Trophy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRewardsStore, useFeatureStore, useAuthStore } from '../../backend/store';
import { DEFAULT_VOUCHERS } from '../../shared/constants';
import toast from 'react-hot-toast';

export default function MobileRewardsScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { rewards, loading, initRewards, claimVoucher } = useRewardsStore();
  const { isFeatureEnabled } = useFeatureStore();
  const [activeTab, setActiveTab] = useState<'vouchers' | 'history'>('vouchers');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    initRewards(user?.uid);
  }, [user]);

  const enabled = isFeatureEnabled('rewards');

  if (!enabled) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] p-6 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-yellow-100 text-primary rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Rewards Temporarily Offline</h2>
        <p className="text-sm text-gray-600 mb-6 max-w-xs">
          The Rewards & Loyalty program is currently disabled by the store admin. Check back soon!
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-primary text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-primary/20"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handleClaim = async (voucherId: string) => {
    if (!user) {
      toast.error('Please log in to claim vouchers');
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

  const tierColors = {
    Bronze: 'from-amber-700 to-amber-900',
    Silver: 'from-slate-600 to-slate-800',
    Gold: 'from-amber-500 to-yellow-700',
    Platinum: 'from-indigo-600 to-purple-900'
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans">
      {/* Mobile Top Header Banner */}
      <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-yellow-950 text-white p-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <Gift className="w-5 h-5 text-yellow-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-300">ViBa Club Rewards</span>
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 border border-white/20`}>
            {rewards?.tier || 'Silver'} Tier
          </span>
        </div>

        {/* Balance Card */}
        <div className="bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl p-5 mt-2 space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">Available Points</div>
              <div className="text-3xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                {rewards?.pointsBalance ?? 250} <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-300">Total Earned</div>
              <div className="text-sm font-black text-amber-300">{rewards?.totalEarned ?? 250} pts</div>
            </div>
          </div>

          {/* Progress to Next Tier */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-[10px] font-bold text-slate-300">
              <span>Next Tier: Gold</span>
              <span>{(rewards?.pointsBalance ?? 250)} / 500 pts</span>
            </div>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 to-yellow-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((rewards?.pointsBalance ?? 250) / 500) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-yellow-100 shadow-sm">
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'vouchers'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Claim Vouchers ({DEFAULT_VOUCHERS.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Points History
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 mt-4 space-y-4">
        {activeTab === 'vouchers' && (
          <div className="space-y-3">
            {DEFAULT_VOUCHERS.map((voucher) => {
              const isClaimed = rewards?.claimedVouchers?.includes(voucher.id);
              const canAfford = (rewards?.pointsBalance ?? 0) >= voucher.pointsRequired;

              return (
                <motion.div
                  key={voucher.id}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white rounded-2xl p-4 border border-yellow-100/60 shadow-sm flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-yellow-50 text-primary rounded-xl shrink-0">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm leading-snug">{voucher.title}</h3>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{voucher.description}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl">
                        {voucher.pointsRequired} pts
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {voucher.category || 'Storewide'}
                    </span>

                    {isClaimed ? (
                      <button
                        onClick={() => copyToClipboard(voucher.code)}
                        className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1.5"
                      >
                        <Copy className="w-3 h-3" />
                        {copiedCode === voucher.code ? 'Copied!' : voucher.code}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClaim(voucher.id)}
                        disabled={!canAfford}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          canAfford
                            ? 'bg-primary text-white hover:bg-yellow-600 active:scale-95'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Redeem Voucher' : `Need ${voucher.pointsRequired - (rewards?.pointsBalance ?? 0)} pts`}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl p-4 border border-yellow-100 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Transactions</h3>
            {(!rewards?.transactions || rewards.transactions.length === 0) ? (
              <div className="text-center py-8 text-xs text-gray-400 italic">No transactions logged yet.</div>
            ) : (
              rewards.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-left">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${tx.type === 'earned' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {tx.type === 'earned' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900">{tx.title}</div>
                      <div className="text-[10px] text-gray-400 font-medium">
                        {new Date(tx.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-black ${tx.type === 'earned' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'earned' ? '+' : '-'}{tx.points} pts
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

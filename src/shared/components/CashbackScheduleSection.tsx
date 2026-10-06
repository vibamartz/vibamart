import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles, Check, Clock, Calendar,
  ShieldCheck, Wallet, RefreshCw, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCashbackStore, useAuthStore, getMonthKey } from '../../backend/store';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Order } from '../types';
import CashbackTermsModal from './CashbackTermsModal';
import CashbackHistoryModal from './CashbackHistoryModal';

interface CashbackScheduleSectionProps {
  isMobile?: boolean;
}

export default function CashbackScheduleSection({ isMobile = false }: CashbackScheduleSectionProps) {
  const { config, records, initCashback, syncCustomerOrdersWithCashback } = useCashbackStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<'history' | 'payout_settings'>('history');

  // Initialize store and subscribe
  useEffect(() => {
    const unsub = initCashback(user?.uid, user?.role);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, user?.role]);

  // Listen to user orders to automatically sync monthly eligible sequence
  useEffect(() => {
    if (!user?.uid) return;

    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('customerId', '==', user.uid));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Auto sync cashback records in background
      syncCustomerOrdersWithCashback(user.uid, orders, user);
    });

    return () => unsubOrders();
  }, [user?.uid]);

  // Current calendar month details
  const currentMonth = useMemo(() => getMonthKey(), []);

  // Filter user records for current calendar month
  const currentMonthRecords = useMemo(() => {
    if (!user?.uid) return [];
    return records.filter(r => r.userId === user.uid && r.monthKey === currentMonth.key && r.status !== 'failed');
  }, [records, user?.uid, currentMonth.key]);

  // 0, 1, 2, or 3
  const currentProgressPoint = Math.min(3, Math.max(0, currentMonthRecords.length));

  // If program is disabled by Admin, don't render section
  if (config.enabled === false) {
    return null;
  }

  // 4 Progress Points (0, 1, 2, 3)
  const points = [0, 1, 2, 3];

  return (
    <>
      <section className={`w-full max-w-7xl mx-auto ${isMobile ? 'px-0 py-1' : 'px-4 sm:px-6 lg:px-8 py-1.5'}`}>
        <div className="relative bg-gradient-to-r from-[#044e3b] via-[#065f46] to-[#0d5c52] rounded-3xl sm:rounded-[32px] p-3.5 sm:p-5 text-white shadow-sm border border-emerald-400/20 overflow-hidden">
          {/* Background Ambient Glows */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar: Title, Badges & Quick Action Buttons */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-400/20 text-amber-200 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-300/30 backdrop-blur-md">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                Monthly Cashback Schedule
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/10 text-emerald-100 text-[9px] sm:text-[10px] font-bold rounded-full border border-white/10 backdrop-blur-md">
                <RefreshCw className="w-2.5 h-2.5" />
                Resets 1st of month
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsTermsOpen(true)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-[11px] font-bold rounded-xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-1 active:scale-95"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-200" />
                Terms
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setHistoryTab('history');
                    setIsHistoryOpen(true);
                  }
                }}
                className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-900 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1 active:scale-95"
              >
                <Wallet className="w-3 h-3 text-gray-900" />
                Cashback History
              </button>
            </div>
          </div>

          {/* 4-Point Connected Progress Sequence (0 -> 1 -> 2 -> 3) */}
          <div className="relative z-10 py-3 sm:py-4 px-2 sm:px-6">
            {/* Top Cashback Range Badges over the 3 connecting segments */}
            <div className="grid grid-cols-3 gap-2 text-center mb-1.5 sm:mb-2 px-4 sm:px-8">
              {[1, 2, 3].map((stepIdx) => {
                const isStepUnlocked = currentProgressPoint >= stepIdx;
                return (
                  <div key={`badge-${stepIdx}`} className="flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[11px] font-black tracking-tight border transition-all ${
                      isStepUnlocked
                        ? 'bg-amber-400 text-gray-950 border-amber-300 shadow-sm shadow-amber-400/20'
                        : 'bg-white/15 text-emerald-50 border-white/15'
                    }`}>
                      <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                      ₹30 – ₹100
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Connecting Track & 4 Nodes Container */}
            <div className="relative flex items-center justify-between">
              {/* Background Grey Track Line */}
              <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 sm:h-2 bg-white/20 rounded-full z-0" />

              {/* Active Filled Progress Line */}
              <motion.div
                className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 sm:h-2 bg-gradient-to-r from-emerald-400 via-amber-300 to-amber-400 rounded-full z-0 shadow-xs"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentProgressPoint / 3) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  maxWidth: 'calc(100% - 32px)',
                }}
              />

              {/* 4 Progress Points (0, 1, 2, 3) */}
              {points.map((pt) => {
                const isReached = currentProgressPoint >= pt;
                const isCurrent = currentProgressPoint === pt;

                return (
                  <div key={pt} className="relative z-10 flex flex-col items-center">
                    {/* Node Circle */}
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all duration-300 shadow-md ${
                        isCurrent
                          ? 'bg-amber-400 text-gray-950 ring-4 ring-amber-400/30 scale-110'
                          : isReached
                          ? 'bg-emerald-400 text-emerald-950 ring-2 ring-emerald-300/40'
                          : 'bg-[#064e3b] text-white/70 border-2 border-white/30'
                      }`}
                    >
                      {pt === 0 ? (
                        isReached ? '0' : '0'
                      ) : isReached ? (
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      ) : (
                        pt
                      )}
                    </div>

                    {/* Point Label: ONLY 0, 1, 2, 3 */}
                    <span className={`text-[11px] sm:text-xs font-black mt-1 transition-colors ${
                      isCurrent ? 'text-amber-300 font-black' : isReached ? 'text-white' : 'text-emerald-100/60'
                    }`}>
                      {pt}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Compact Footer: Monthly Status & Payout Shortcut */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px] sm:text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-100/90 font-medium">
              <Calendar className="w-3 h-3 text-amber-300 shrink-0" />
              <span>
                <strong className="text-white font-bold">{currentMonth.name}:</strong> {user ? `Point ${currentProgressPoint} of 3 active` : 'Log in to track monthly progress'}
              </span>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  navigate('/login');
                } else {
                  setHistoryTab('payout_settings');
                  setIsHistoryOpen(true);
                }
              }}
              className="text-amber-300 hover:text-white font-bold underline transition-colors flex items-center gap-1 ml-auto"
            >
              UPI / Bank Account <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Terms & Conditions Modal */}
      <CashbackTermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      {/* Customer Cashback History & Payout Settings Modal */}
      <CashbackHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        defaultTab={historyTab}
      />
    </>
  );
}

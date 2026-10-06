import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles, Check, Calendar,
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

  // Exactly 4 Progress Points (0, 1, 2, 3)
  const points = [0, 1, 2, 3];

  return (
    <>
      {/* Scoped CSS for smooth continuous RGB / Rainbow running animation */}
      <style>{`
        @keyframes rgbRunningFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes rgbBorderFlow {
          0% { border-color: #ec4899; }
          25% { border-color: #8b5cf6; }
          50% { border-color: #3b82f6; }
          75% { border-color: #10b981; }
          100% { border-color: #ec4899; }
        }
        .cashback-rgb-running {
          background: linear-gradient(90deg, #ec4899, #8b5cf6, #3b82f6, #06b6d4, #10b981, #f59e0b, #ef4444, #ec4899);
          background-size: 300% 300%;
          animation: rgbRunningFlow 6s linear infinite;
        }
        .cashback-rgb-text {
          background: linear-gradient(90deg, #f43f5e, #a855f7, #3b82f6, #06b6d4, #10b981, #f59e0b, #f43f5e);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: rgbRunningFlow 6s linear infinite;
        }
        .cashback-rgb-glow {
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.45), 0 0 30px rgba(6, 182, 212, 0.25);
        }
      `}</style>

      <section className={`w-full max-w-7xl mx-auto ${isMobile ? 'px-0 py-1' : 'px-4 sm:px-6 lg:px-8 py-1.5'}`}>
        <div className="relative bg-gradient-to-r from-[#031d16] via-[#063328] to-[#05221b] rounded-3xl sm:rounded-[32px] p-3.5 sm:p-5 text-white shadow-sm border border-emerald-400/25 overflow-hidden">
          {/* Subtle Ambient Background Lighting */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar: Title & Quick Action Buttons */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-full border border-white/15 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full cashback-rgb-running shrink-0" />
                <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                Monthly Cashback Schedule
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white/5 text-emerald-100 text-[9px] sm:text-[10px] font-bold rounded-full border border-white/10 backdrop-blur-md">
                <RefreshCw className="w-2.5 h-2.5 text-emerald-300" />
                Resets 1st of month
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsTermsOpen(true)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] sm:text-[11px] font-bold rounded-xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-300" />
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
                className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 cashback-rgb-running text-white text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer hover:brightness-110"
              >
                <Wallet className="w-3 h-3 text-white" />
                Cashback History
              </button>
            </div>
          </div>

          {/* Main Body: Single Large ₹30 – ₹100 Amount + 4-Point Progress (0 -> 1 -> 2 -> 3) */}
          <div className="relative z-10 py-3 sm:py-4 px-1 sm:px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
              
              {/* 1. ONE Large Prominent Cashback Amount Display */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left shrink-0">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-200/90 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Monthly Cashback Offer
                </span>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight cashback-rgb-text leading-none py-1">
                  ₹30 – ₹100
                </div>
                <span className="text-[10px] sm:text-[11px] text-white/75 font-medium">
                  Earn on your first 3 eligible orders each month
                </span>
              </div>

              {/* 2. Four Progress Points (0 → 1 → 2 → 3) with Smooth Running RGB Animation */}
              <div className="w-full md:flex-1 max-w-xl">
                <div className="relative flex items-center justify-between px-3 sm:px-5 py-2">
                  {/* Base Track Line */}
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-2 sm:h-2.5 bg-white/15 rounded-full z-0" />

                  {/* Active Filled Progress Line with Continuous Running RGB Color */}
                  <motion.div
                    className="absolute left-6 top-1/2 -translate-y-1/2 h-2 sm:h-2.5 cashback-rgb-running rounded-full z-0 cashback-rgb-glow"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(currentProgressPoint / 3) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      maxWidth: 'calc(100% - 48px)',
                    }}
                  />

                  {/* Exactly 4 Progress Points: 0, 1, 2, 3 */}
                  {points.map((pt) => {
                    const isReached = currentProgressPoint >= pt;
                    const isCurrent = currentProgressPoint === pt;

                    return (
                      <div key={pt} className="relative z-10 flex flex-col items-center">
                        {/* Node Circle with Running RGB Color for Active/Completed Points */}
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-xs sm:text-sm transition-all duration-300 ${
                            isCurrent
                              ? 'cashback-rgb-running text-white ring-4 ring-white/40 scale-110 shadow-lg cashback-rgb-glow'
                              : isReached
                              ? 'cashback-rgb-running text-white ring-2 ring-white/30 shadow-md'
                              : 'bg-[#06261e] text-white/50 border-2 border-white/20'
                          }`}
                        >
                          {pt === 0 ? (
                            '0'
                          ) : isReached ? (
                            <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[3] text-white" />
                          ) : (
                            pt
                          )}
                        </div>

                        {/* Point Indicator (0, 1, 2, 3) */}
                        <span className={`text-[11px] sm:text-xs font-black mt-1.5 transition-colors ${
                          isCurrent
                            ? 'text-amber-300'
                            : isReached
                            ? 'text-white'
                            : 'text-white/40'
                        }`}>
                          {pt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Bottom Compact Footer: Current Monthly Status & Direct Payout Shortcut */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[10px] sm:text-[11px]">
            <div className="flex items-center gap-1.5 text-emerald-100/90 font-medium">
              <Calendar className="w-3 h-3 text-amber-300 shrink-0" />
              <span>
                <strong className="text-white font-bold">{currentMonth.name}:</strong> {user ? `Point ${currentProgressPoint} of 3 completed` : 'Log in to view your monthly progress'}
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
              className="text-amber-300 hover:text-white font-bold underline transition-colors flex items-center gap-1 ml-auto cursor-pointer"
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


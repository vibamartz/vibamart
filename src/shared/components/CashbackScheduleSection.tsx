import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, ShieldCheck, Wallet, RefreshCw, ArrowRight
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
      <style>{`
        @keyframes cashbackRgbFlow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .cashback-rgb-bg {
          background: linear-gradient(135deg, #ef4444, #2563eb, #10b981, #dc2626, #3b82f6, #059669, #ef4444);
          background-size: 400% 400%;
          animation: cashbackRgbFlow 10s ease infinite;
        }
      `}</style>

      <section className={`w-full max-w-7xl mx-auto ${isMobile ? 'px-0 py-0.5' : 'px-4 sm:px-6 lg:px-8 py-1.5'}`}>
        <div className="cashback-rgb-bg relative rounded-2xl sm:rounded-[32px] p-2.5 sm:p-6 text-white shadow-xl border border-white/25 overflow-hidden">
          {/* Subtle Ambient Contrast Overlay */}
          <div className="absolute inset-0 bg-black/10 pointer-events-none" />

          {/* Top Bar: Big Title, Reset Text & Quick Action Buttons */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2.5 pb-1.5 sm:pb-3 border-b border-white/20">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <h2 className="text-base sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                Monthly Cashback Schedule
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 bg-white/20 text-white text-[11px] sm:text-sm font-bold rounded-full border border-white/25 backdrop-blur-md shadow-xs">
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                (resets 1st of month)
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsTermsOpen(true)}
                className="px-2 py-1 sm:px-3 sm:py-1.5 bg-white/20 hover:bg-white/30 text-white text-[11px] sm:text-sm font-bold rounded-xl border border-white/30 backdrop-blur-md transition-all flex items-center gap-1 active:scale-95"
              >
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
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
                className="px-2.5 py-1 sm:px-4 sm:py-2 bg-white hover:bg-gray-100 text-gray-900 text-[11px] sm:text-sm font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-1 active:scale-95"
              >
                <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-900" />
                Cashback History
              </button>
            </div>
          </div>

          {/* Directly below: Single Large Prominent Cashback Amount Display */}
          <div className="relative z-10 pt-1.5 sm:pt-4 pb-0.5 sm:pb-1 text-center sm:text-left flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <span className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">
                ₹30 – ₹100
              </span>
              <span className="text-[10px] sm:text-xs text-white/80 font-medium">
                Cashback per eligible order
              </span>
            </div>
            <div className="text-[10px] sm:text-sm text-white/90 font-bold">
              {currentMonth.name} Schedule
            </div>
          </div>

          {/* Single Progress Line with 4 Centered Points (0 ───── 1 ───── 2 ───── 3) */}
          <div className="relative z-10 py-2 sm:py-6 px-3 sm:px-8">
            <div className="relative flex items-center justify-between">
              {/* Background Track Line */}
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-1.5 sm:h-2 bg-white/30 rounded-full z-0" />

              {/* Active Filled Progress Line */}
              <motion.div
                className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 sm:h-2 bg-white rounded-full z-0 shadow-sm"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentProgressPoint / 3) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  maxWidth: 'calc(100% - 24px)',
                }}
              />

              {/* 4 Points (0, 1, 2, 3) Centered on the Line */}
              {points.map((pt) => {
                const isReached = currentProgressPoint >= pt;
                const isCurrent = currentProgressPoint === pt;

                return (
                  <div
                    key={pt}
                    className={`relative z-10 w-6 h-6 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-[11px] sm:text-sm transition-all duration-300 shadow-md ${
                      isCurrent
                        ? 'bg-white text-gray-950 ring-4 ring-white/40 scale-110'
                        : isReached
                        ? 'bg-white text-gray-950 ring-2 ring-white/50'
                        : 'bg-black/30 text-white/80 border-2 border-white/40'
                    }`}
                  >
                    {pt}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Compact Footer */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 pt-1.5 sm:pt-2.5 border-t border-white/20 text-[11px] sm:text-sm">
            <div className="flex items-center gap-1.5 text-white/90 font-medium">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
              <span>
                {user ? `Monthly Progress Active` : 'Log in to track monthly progress'}
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
              className="text-white hover:text-amber-200 font-bold underline transition-colors flex items-center gap-1 ml-auto"
            >
              UPI / Bank Account <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
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

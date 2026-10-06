import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Gift, Sparkles, CheckCircle2, Clock, Calendar,
  ArrowRight, ShieldCheck, Wallet, ChevronRight,
  TrendingUp, RefreshCw, Info, Lock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
  const [userOrders, setUserOrders] = useState<Order[]>([]);

  // Initialize store and subscribe
  useEffect(() => {
    const unsub = initCashback(user?.uid, user?.role);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, user?.role]);

  // Listen to user orders to automatically sync monthly eligible sequence
  useEffect(() => {
    if (!user?.uid) {
      setUserOrders([]);
      return;
    }

    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('customerId', '==', user.uid));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setUserOrders(orders);
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

  const currentMonthOrderCount = Math.min(3, currentMonthRecords.length);

  // If program is disabled by Admin, don't render section
  if (config.enabled === false) {
    return null;
  }

  const orderCards = [
    {
      position: 1,
      title: '1st Order',
      amount: config.firstOrderAmount || 50,
      subtitle: 'On your 1st monthly order',
      badge: 'Step 1',
      isUnlocked: currentMonthOrderCount >= 1,
      isNext: currentMonthOrderCount === 0,
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50/70',
      borderLight: 'border-emerald-200/70',
      textColor: 'text-emerald-700',
    },
    {
      position: 2,
      title: '2nd Order',
      amount: config.secondOrderAmount || 75,
      subtitle: 'On your 2nd monthly order',
      badge: 'Step 2',
      isUnlocked: currentMonthOrderCount >= 2,
      isNext: currentMonthOrderCount === 1,
      gradient: 'from-teal-600 to-cyan-700',
      bgLight: 'bg-teal-50/70',
      borderLight: 'border-teal-200/70',
      textColor: 'text-teal-700',
    },
    {
      position: 3,
      title: '3rd Order',
      amount: config.thirdOrderAmount || 100,
      subtitle: 'On your 3rd monthly order',
      badge: 'Max Reward',
      isUnlocked: currentMonthOrderCount >= 3,
      isNext: currentMonthOrderCount === 2,
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50/70',
      borderLight: 'border-amber-200/70',
      textColor: 'text-amber-700',
    },
  ];

  return (
    <>
      <section className={`w-full max-w-7xl mx-auto ${isMobile ? 'px-0 py-1' : 'px-4 sm:px-6 lg:px-8 py-2'}`}>
        <div className="relative bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e] rounded-3xl sm:rounded-[32px] p-4 sm:p-6 lg:p-7 text-white shadow-md border border-emerald-400/20 overflow-hidden">
          {/* Subtle luxury glow effect in background */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/15">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/20 text-amber-200 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-300/30 backdrop-blur-md">
                  <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                  Monthly Cashback Program
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 text-emerald-100 text-[9px] sm:text-[10px] font-bold rounded-full border border-white/10 backdrop-blur-md">
                  <RefreshCw className="w-2.5 h-2.5" />
                  Resets 1st of every month
                </span>
              </div>

              <h2 className="text-base sm:text-xl lg:text-2xl font-black text-white tracking-tight leading-tight">
                {config.title || 'Earn Cashback on Your First 3 Orders'}
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-100/80 font-medium max-w-2xl leading-relaxed">
                {config.subtitle || 'Get guaranteed cashback on your first 3 eligible orders of each calendar month. Automatically credited to your UPI or Bank account.'}
              </p>
            </div>

            {/* Quick Actions (Terms & Conditions + History) */}
            <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
              <button
                onClick={() => setIsTermsOpen(true)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white/10 hover:bg-white/20 text-white text-[11px] sm:text-xs font-bold rounded-xl border border-white/20 backdrop-blur-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
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
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-gray-900 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Wallet className="w-3.5 h-3.5 text-gray-900" />
                Cashback History
              </button>
            </div>
          </div>

          {/* 3-Card Monthly Schedule Grid */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 sm:pt-5">
            {orderCards.map((card) => {
              const activeRecord = currentMonthRecords.find(r => r.position === card.position);
              const recordStatus = activeRecord?.status;

              return (
                <motion.div
                  key={card.position}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between overflow-hidden border transition-all ${
                    card.isUnlocked
                      ? 'bg-white text-gray-900 border-amber-300/80 shadow-lg ring-2 ring-amber-400/30'
                      : card.isNext
                      ? 'bg-white/95 text-gray-900 border-white shadow-md'
                      : 'bg-white/10 text-white border-white/15 backdrop-blur-md'
                  }`}
                >
                  {/* Top Row: Order Badge & Step */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      card.isUnlocked
                        ? 'bg-emerald-100 text-emerald-900'
                        : card.isNext
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-white/15 text-white/90'
                    }`}>
                      {card.title}
                    </span>

                    {/* Dynamic Status Pill */}
                    {card.isUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {recordStatus === 'paid' ? 'Paid' : recordStatus === 'eligible' ? 'Eligible' : 'Pending'}
                      </span>
                    ) : card.isNext ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                        Next Reward
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-100/70">
                        <Lock className="w-2.5 h-2.5" />
                        Order #{card.position}
                      </span>
                    )}
                  </div>

                  {/* Middle Row: Cashback Big Amount */}
                  <div className="my-2 sm:my-3">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight ${
                        card.isUnlocked || card.isNext ? 'text-emerald-700' : 'text-white'
                      }`}>
                        ₹{card.amount}
                      </span>
                      <span className={`text-xs font-black uppercase tracking-wider ${
                        card.isUnlocked || card.isNext ? 'text-gray-500' : 'text-emerald-100/80'
                      }`}>
                        Cashback
                      </span>
                    </div>
                    <p className={`text-[11px] font-medium mt-1 ${
                      card.isUnlocked || card.isNext ? 'text-gray-600' : 'text-emerald-100/70'
                    }`}>
                      {card.subtitle}
                    </p>
                  </div>

                  {/* Bottom Row: Context Action / Hint */}
                  <div className={`pt-3 border-t text-[10px] sm:text-[11px] font-bold flex items-center justify-between ${
                    card.isUnlocked
                      ? 'border-gray-100 text-emerald-700'
                      : card.isNext
                      ? 'border-gray-100 text-amber-800'
                      : 'border-white/10 text-emerald-100/60'
                  }`}>
                    <span>
                      {card.isUnlocked
                        ? activeRecord ? `Order #${activeRecord.customOrderId || activeRecord.orderId.slice(-6).toUpperCase()} linked` : 'Order Completed'
                        : card.isNext
                        ? 'Shop now to unlock'
                        : `After order ${card.position - 1}`}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Customer Monthly Status Summary Banner */}
          <div className="relative z-10 mt-4 sm:mt-5 bg-black/20 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <p className="font-black text-white flex items-center gap-1.5">
                  <span>{currentMonth.name} Cycle</span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 px-2 py-0.2 rounded-full">
                    {user ? `${currentMonthOrderCount} of 3 Orders Completed` : 'Log in to track monthly progress'}
                  </span>
                </p>
                <p className="text-[11px] text-emerald-100/80 font-medium mt-0.5">
                  {currentMonthOrderCount === 3
                    ? '🎉 You have unlocked all 3 cashback rewards for this month! Starts again from Order 1 on next 1st.'
                    : currentMonthOrderCount === 2
                    ? `Next eligible order unlocks ₹${config.thirdOrderAmount} cashback!`
                    : currentMonthOrderCount === 1
                    ? `Next eligible order unlocks ₹${config.secondOrderAmount} cashback!`
                    : `Your first eligible order this month unlocks ₹${config.firstOrderAmount} cashback!`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    setHistoryTab('payout_settings');
                    setIsHistoryOpen(true);
                  }
                }}
                className="text-[11px] font-black text-amber-300 hover:text-white underline transition-colors flex items-center gap-1"
              >
                Configure UPI / Bank Account <ArrowRight className="w-3 h-3" />
              </button>
            </div>
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

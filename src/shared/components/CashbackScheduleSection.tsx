import React, { useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar, ShieldCheck, Wallet, RefreshCw, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCashbackStore, useAuthStore, getMonthKey } from '../../backend/store';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Order } from '../types';

interface CashbackScheduleSectionProps {
  isMobile?: boolean;
}

// Subtle Twinkling Sparkle Particle
function GoldSparkle({
  size = 14,
  className = '',
  style = {},
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none pointer-events-none drop-shadow-[0_0_8px_rgba(253,224,71,0.9)] ${className}`}
      style={style}
    >
      <path
        d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
        fill="url(#sparkleGoldGradVivid)"
      />
      <defs>
        <radialGradient id="sparkleGoldGradVivid" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#FEF08A" />
          <stop offset="75%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// Realistic 3D Indian ₹100 Rupee Note Component
function INR100Note3D({
  width = 86,
  className = '',
  style = {},
  blur = false,
  opacity = 0.9,
}: {
  width?: number;
  className?: string;
  style?: React.CSSProperties;
  blur?: boolean;
  opacity?: number;
}) {
  return (
    <div
      className={`relative select-none pointer-events-none rounded-[5px] overflow-hidden drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)] ${
        blur ? 'blur-[0.5px]' : ''
      } ${className}`}
      style={{
        width: `${width}px`,
        aspectRatio: '1449 / 618',
        opacity,
        boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.45), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        transformStyle: 'preserve-3d',
        ...style,
      }}
    >
      <img
        src="/assets/inr-100-note.png"
        alt="₹100 Note"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover rounded-[5px] block select-none pointer-events-none"
        style={{
          filter: 'contrast(1.05) saturate(1.05) brightness(1.02)',
        }}
      />
      {/* 3D Specular Sheen Sweep for Realistic Crisp Finish */}
      <div
        className="absolute inset-0 pointer-events-none rounded-[5px]"
        style={{
          background:
            'linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.15) 75%, rgba(255,255,255,0) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.35)',
        }}
      />
    </div>
  );
}

// Background Floating 3D Layer for Cashback Section (Full coverage, clearly visible across entire card using supplied ₹100 note)
function Floating3DCashbackBackground({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ perspective: '800px' }}>
        {/* Top-Left: ₹100 Note */}
        <div className="absolute top-1 left-2 animate-float-note-1 opacity-90">
          <INR100Note3D width={58} />
        </div>

        {/* Top-Right: ₹100 Note */}
        <div className="absolute top-1 right-2 animate-float-note-2 opacity-90">
          <INR100Note3D width={62} />
        </div>

        {/* Center-Left: ₹100 Note */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1 animate-float-note-3 opacity-80">
          <INR100Note3D width={54} blur />
        </div>

        {/* Center-Middle (Subtly behind Amount): ₹100 Note */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 animate-float-note-5 opacity-40">
          <INR100Note3D width={66} />
        </div>

        {/* Center-Right: ₹100 Note */}
        <div className="absolute top-1/2 -translate-y-1/2 right-1 animate-float-note-4 opacity-85">
          <INR100Note3D width={56} />
        </div>

        {/* Bottom-Left: ₹100 Note */}
        <div className="absolute bottom-1 left-3 animate-float-note-2 opacity-85">
          <INR100Note3D width={58} />
        </div>

        {/* Bottom-Right: ₹100 Note */}
        <div className="absolute bottom-1 right-2 animate-float-note-1 opacity-90">
          <INR100Note3D width={60} />
        </div>

        {/* Twinkling Gold Sparkles across mobile section */}
        <div className="absolute top-2 left-1/4 animate-twinkle opacity-95">
          <GoldSparkle size={12} />
        </div>
        <div className="absolute top-3 right-1/3 animate-twinkle-delay opacity-95">
          <GoldSparkle size={14} />
        </div>
        <div className="absolute bottom-2 left-1/3 animate-twinkle opacity-90">
          <GoldSparkle size={11} />
        </div>
        <div className="absolute bottom-2 right-1/4 animate-twinkle-delay opacity-95">
          <GoldSparkle size={13} />
        </div>
      </div>
    );
  }

  // Desktop Floating 3D Assets Layer (Full Coverage Across Entire Section using ₹100 note)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ perspective: '1000px' }}>
      {/* ── TOP REGION ── */}
      {/* Top-Left: ₹100 Note */}
      <div className="absolute top-2 left-8 animate-float-note-1 opacity-90">
        <INR100Note3D width={96} />
      </div>

      {/* Top-Center-Left: ₹100 Note */}
      <div className="absolute top-2 left-[28%] animate-float-note-3 opacity-85">
        <INR100Note3D width={86} />
      </div>

      {/* Top-Center-Right: ₹100 Note */}
      <div className="absolute top-2 right-[28%] animate-float-note-2 opacity-85">
        <INR100Note3D width={88} />
      </div>

      {/* Top-Right: ₹100 Note */}
      <div className="absolute top-2 right-10 animate-float-note-4 opacity-90">
        <INR100Note3D width={100} />
      </div>

      {/* ── MIDDLE REGION (Behind Amount & Progress Line) ── */}
      {/* Middle-Far-Left: ₹100 Note */}
      <div className="absolute top-1/2 -translate-y-1/2 left-3 animate-float-note-2 opacity-85">
        <INR100Note3D width={92} />
      </div>

      {/* Middle-Left: ₹100 Note */}
      <div className="absolute top-1/2 -translate-y-1/2 left-[16%] animate-float-note-1 opacity-80">
        <INR100Note3D width={84} blur />
      </div>

      {/* Middle-Center (Behind Amount Display): ₹100 Note floating subtly */}
      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 animate-float-note-5 opacity-45">
        <INR100Note3D width={94} />
      </div>

      {/* Middle-Right: ₹100 Note */}
      <div className="absolute top-1/2 -translate-y-1/2 right-[16%] animate-float-note-4 opacity-80">
        <INR100Note3D width={84} blur />
      </div>

      {/* Middle-Far-Right: ₹100 Note */}
      <div className="absolute top-1/2 -translate-y-1/2 right-3 animate-float-note-1 opacity-90">
        <INR100Note3D width={96} />
      </div>

      {/* ── BOTTOM REGION ── */}
      {/* Bottom-Left: ₹100 Note */}
      <div className="absolute bottom-2 left-12 animate-float-note-4 opacity-85">
        <INR100Note3D width={92} />
      </div>

      {/* Bottom-Center-Left: ₹100 Note */}
      <div className="absolute bottom-2 left-[36%] animate-float-note-2 opacity-85">
        <INR100Note3D width={86} />
      </div>

      {/* Bottom-Center-Right: ₹100 Note */}
      <div className="absolute bottom-2 right-[36%] animate-float-note-3 opacity-85">
        <INR100Note3D width={88} />
      </div>

      {/* Bottom-Right: ₹100 Note */}
      <div className="absolute bottom-2 right-12 animate-float-note-1 opacity-90">
        <INR100Note3D width={96} />
      </div>

      {/* ── GOLDEN PARTICLES & SPARKLES ACROSS THE SECTION ── */}
      <div className="absolute top-4 left-[20%] animate-twinkle opacity-95">
        <GoldSparkle size={16} />
      </div>
      <div className="absolute top-4 right-[20%] animate-twinkle-delay opacity-95">
        <GoldSparkle size={18} />
      </div>
      <div className="absolute top-1/2 left-[8%] animate-twinkle opacity-90">
        <GoldSparkle size={14} />
      </div>
      <div className="absolute top-1/2 right-[8%] animate-twinkle-delay opacity-90">
        <GoldSparkle size={15} />
      </div>
      <div className="absolute bottom-4 left-[25%] animate-twinkle-delay opacity-95">
        <GoldSparkle size={15} />
      </div>
      <div className="absolute bottom-4 right-[25%] animate-twinkle opacity-95">
        <GoldSparkle size={16} />
      </div>
    </div>
  );
}

export default function CashbackScheduleSection({ isMobile = false }: CashbackScheduleSectionProps) {
  const { config, records, initCashback, syncCustomerOrdersWithCashback } = useCashbackStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

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
  const currentMonthName = useMemo(() => new Date().toLocaleString('en-US', { month: 'long' }), []);

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

  // Render Mobile Mode
  if (isMobile) {
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
          @keyframes float3DNote1 {
            0%, 100% {
              transform: translateY(0px) rotateX(15deg) rotateY(-18deg) rotateZ(-10deg) scale(1);
            }
            50% {
              transform: translateY(-8px) rotateX(20deg) rotateY(-12deg) rotateZ(-6deg) scale(1.03);
            }
          }
          @keyframes float3DNote2 {
            0%, 100% {
              transform: translateY(0px) rotateX(-15deg) rotateY(16deg) rotateZ(8deg) scale(1);
            }
            50% {
              transform: translateY(7px) rotateX(-20deg) rotateY(22deg) rotateZ(12deg) scale(0.97);
            }
          }
          @keyframes float3DNote3 {
            0%, 100% {
              transform: translateY(0px) rotateX(18deg) rotateY(12deg) rotateZ(6deg) scale(1);
            }
            50% {
              transform: translateY(-7px) rotateX(12deg) rotateY(6deg) rotateZ(2deg) scale(1.02);
            }
          }
          @keyframes float3DNote4 {
            0%, 100% {
              transform: translateY(0px) rotateX(-16deg) rotateY(-15deg) rotateZ(-8deg) scale(1);
            }
            50% {
              transform: translateY(8px) rotateX(-10deg) rotateY(-20deg) rotateZ(-12deg) scale(0.98);
            }
          }
          @keyframes float3DNote5 {
            0%, 100% {
              transform: translateY(0px) rotateX(12deg) rotateY(-8deg) rotateZ(-4deg) scale(1);
            }
            50% {
              transform: translateY(-6px) rotateX(16deg) rotateY(-2deg) rotateZ(0deg) scale(1.02);
            }
          }
          @keyframes twinkleGlint {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.7) rotate(0deg);
            }
            50% {
              opacity: 0.95;
              transform: scale(1.2) rotate(45deg);
            }
          }
          .cashback-rgb-bg {
            background: linear-gradient(135deg, #ef4444, #2563eb, #10b981, #dc2626, #3b82f6, #059669, #ef4444);
            background-size: 400% 400%;
            animation: cashbackRgbFlow 10s ease infinite;
          }
          .animate-float-note-1 {
            animation: float3DNote1 5.5s ease-in-out infinite;
          }
          .animate-float-note-2 {
            animation: float3DNote2 6.5s ease-in-out infinite;
          }
          .animate-float-note-3 {
            animation: float3DNote3 7s ease-in-out infinite;
          }
          .animate-float-note-4 {
            animation: float3DNote4 6s ease-in-out infinite;
          }
          .animate-float-note-5 {
            animation: float3DNote5 6.2s ease-in-out infinite;
          }
          .animate-twinkle {
            animation: twinkleGlint 3s ease-in-out infinite;
          }
          .animate-twinkle-delay {
            animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-float-note-1,
            .animate-float-note-2,
            .animate-float-note-3,
            .animate-float-note-4,
            .animate-float-note-5,
            .animate-twinkle,
            .animate-twinkle-delay,
            .cashback-rgb-bg {
              animation: none !important;
            }
          }
        `}</style>

        <section className="w-full max-w-7xl mx-auto px-0 py-0">
          <div className="cashback-rgb-bg relative rounded-2xl py-1.5 px-2.5 text-white shadow-lg border border-white/25 overflow-hidden">
            {/* Subtle Ambient Contrast Overlay */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none z-0" />

            {/* Live Floating 3D Decorative Assets in Background */}
            <Floating3DCashbackBackground isMobile={true} />

            {/* Top Bar: Title & Reset badge on Left, Cashback History & Terms buttons on Right */}
            <div className="relative z-10 flex items-start justify-between gap-2 pb-1 border-b border-white/30">
              {/* Top Left: Title & Reset Badge */}
              <div className="flex flex-col items-start gap-0.5">
                <h2 className="text-base font-black text-white tracking-tight leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                  Monthly Cashback
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/40 text-amber-300 text-[10px] font-black rounded-full border border-amber-300/40 backdrop-blur-md shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  <RefreshCw className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  (resets 1st of month)
                </span>
              </div>

              {/* Top Right: Cashback History button + Terms button directly below it */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                    } else {
                      navigate('/cashback-history');
                    }
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-950 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md border border-white transition-all flex items-center gap-1 active:scale-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                >
                  <Wallet className="w-3 h-3 text-gray-950 shrink-0" />
                  Cashback History
                </button>

                <button
                  onClick={() => navigate('/cashback-terms')}
                  className="px-2.5 py-0.5 bg-black/40 hover:bg-black/60 text-white text-[10px] font-bold rounded-lg border border-white/40 backdrop-blur-md transition-all flex items-center gap-1 active:scale-95 shadow-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                >
                  <ShieldCheck className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                  Terms
                </button>
              </div>
            </div>

            {/* Center Prominent Amount & Description */}
            <div className="relative z-10 pt-1 pb-0.5 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-amber-300 tracking-tight leading-tight drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)]">
                ₹30 – ₹100
              </span>
              <span className="text-xs text-white font-bold tracking-wide mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/35 px-2.5 py-0.5 rounded-full border border-white/20 backdrop-blur-xs">
                Cashback per eligible order
              </span>
            </div>

            {/* Progress Line with 4 Centered Points (0 ───── 1 ───── 2 ───── 3) */}
            <div className="relative z-10 py-1 px-3">
              <div className="relative flex items-center justify-between">
                {/* Background Track Line */}
                <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-2 bg-black/40 border border-white/30 rounded-full z-0 shadow-inner" />

                {/* Active Filled Progress Line */}
                <motion.div
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-2 bg-white rounded-full z-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
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
                      className={`relative z-10 w-5.5 h-5.5 rounded-full flex items-center justify-center font-black text-[10px] transition-all duration-300 shadow-lg ${isCurrent
                        ? 'bg-amber-300 text-gray-950 ring-4 ring-black/40 scale-110 border-2 border-white'
                        : isReached
                          ? 'bg-white text-gray-950 ring-2 ring-black/30 border border-gray-300'
                          : 'bg-gray-950/80 text-white border-2 border-white/60 shadow-md'
                        }`}
                    >
                      {pt}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Compact Footer */}
            <div className="relative z-10 flex items-center justify-between gap-1 pt-1 border-t border-white/30 text-[10px]">
              <div className="flex items-center gap-1 text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                <Calendar className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                  {user ? `${currentMonthName} 2026 Schedule` : 'Log in to track monthly progress'}
                </span>
              </div>

              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    navigate('/cashback-history?tab=payout_settings');
                  }
                }}
                className="text-amber-300 hover:text-amber-200 font-black underline transition-colors flex items-center gap-0.5 ml-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
              >
                UPI / Bank Account <ArrowRight className="w-2.5 h-2.5 text-amber-300" />
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  // Render Desktop Mode
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
        @keyframes float3DNote1 {
          0%, 100% {
            transform: translateY(0px) rotateX(15deg) rotateY(-18deg) rotateZ(-10deg) scale(1);
          }
          50% {
            transform: translateY(-9px) rotateX(20deg) rotateY(-12deg) rotateZ(-6deg) scale(1.03);
          }
        }
        @keyframes float3DNote2 {
          0%, 100% {
            transform: translateY(0px) rotateX(-15deg) rotateY(16deg) rotateZ(8deg) scale(1);
          }
          50% {
            transform: translateY(8px) rotateX(-20deg) rotateY(22deg) rotateZ(12deg) scale(0.97);
          }
        }
        @keyframes float3DNote3 {
          0%, 100% {
            transform: translateY(0px) rotateX(18deg) rotateY(12deg) rotateZ(6deg) scale(1);
          }
          50% {
            transform: translateY(-8px) rotateX(12deg) rotateY(6deg) rotateZ(2deg) scale(1.02);
          }
        }
        @keyframes float3DNote4 {
          0%, 100% {
            transform: translateY(0px) rotateX(-16deg) rotateY(-15deg) rotateZ(-8deg) scale(1);
          }
          50% {
            transform: translateY(9px) rotateX(-10deg) rotateY(-20deg) rotateZ(-12deg) scale(0.98);
          }
        }
        @keyframes float3DNote5 {
          0%, 100% {
            transform: translateY(0px) rotateX(12deg) rotateY(-8deg) rotateZ(-4deg) scale(1);
          }
          50% {
            transform: translateY(-7px) rotateX(16deg) rotateY(-2deg) rotateZ(0deg) scale(1.02);
          }
        }
        @keyframes twinkleGlint {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.7) rotate(0deg);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.2) rotate(45deg);
          }
        }
        .cashback-rgb-bg {
          background: linear-gradient(135deg, #ef4444, #2563eb, #10b981, #dc2626, #3b82f6, #059669, #ef4444);
          background-size: 400% 400%;
          animation: cashbackRgbFlow 10s ease infinite;
        }
        .animate-float-note-1 {
          animation: float3DNote1 6.5s ease-in-out infinite;
        }
        .animate-float-note-2 {
          animation: float3DNote2 7.5s ease-in-out infinite;
        }
        .animate-float-note-3 {
          animation: float3DNote3 8s ease-in-out infinite;
        }
        .animate-float-note-4 {
          animation: float3DNote4 7s ease-in-out infinite;
        }
        .animate-float-note-5 {
          animation: float3DNote5 7.2s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: twinkleGlint 3s ease-in-out infinite;
        }
        .animate-twinkle-delay {
          animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-note-1,
          .animate-float-note-2,
          .animate-float-note-3,
          .animate-float-note-4,
          .animate-float-note-5,
          .animate-twinkle,
          .animate-twinkle-delay,
          .cashback-rgb-bg {
            animation: none !important;
          }
        }
      `}</style>

      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
        <div className="cashback-rgb-bg relative rounded-2xl sm:rounded-[32px] py-2.5 px-3 sm:py-3.5 sm:px-6 text-white shadow-xl border border-white/25 overflow-hidden">
          {/* Subtle Ambient Contrast Overlay */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none z-0" />

          {/* Live Floating 3D Decorative Assets in Background */}
          <Floating3DCashbackBackground isMobile={false} />

          {/* Top Bar: Big Title, Reset Text & Quick Action Buttons */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2.5 pb-1 sm:pb-1.5 border-b border-white/30">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
              <h2 className="text-base sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]">
                Monthly Cashback
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-black/40 text-amber-300 text-[11px] sm:text-sm font-black rounded-full border border-amber-300/40 backdrop-blur-md shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
                (resets 1st of month)
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => navigate('/cashback-terms')}
                className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-black/40 hover:bg-black/60 text-white text-[11px] sm:text-sm font-bold rounded-xl border border-white/40 backdrop-blur-md transition-all flex items-center gap-1 active:scale-95 shadow-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
              >
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 shrink-0" />
                Terms
              </button>

              <button
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                  } else {
                    navigate('/cashback-history');
                  }
                }}
                className="px-3 py-1 sm:px-4 sm:py-2 bg-white hover:bg-gray-100 text-gray-950 text-[11px] sm:text-sm font-black uppercase tracking-wider rounded-xl shadow-lg border border-white transition-all flex items-center gap-1.5 active:scale-95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              >
                <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-950 shrink-0" />
                Cashback History
              </button>
            </div>
          </div>

          {/* Center Prominent Amount & Description */}
          <div className="relative z-10 pt-1.5 pb-1 sm:pt-2 sm:pb-1.5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl sm:text-4xl md:text-5xl font-black text-amber-300 tracking-tight leading-tight drop-shadow-[0_4px_10px_rgba(0,0,0,0.95)]">
              ₹30 – ₹100
            </span>
            <span className="text-sm sm:text-base md:text-lg text-white font-bold tracking-wide mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] bg-black/35 px-4 py-0.5 rounded-full border border-white/20 backdrop-blur-xs">
              Cashback per eligible order
            </span>
          </div>

          {/* Single Progress Line with 4 Centered Points (0 ───── 1 ───── 2 ───── 3) */}
          <div className="relative z-10 py-1 sm:py-2.5 px-2.5 sm:px-8">
            <div className="relative flex items-center justify-between">
              {/* Background Track Line */}
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-2 sm:h-2.5 bg-black/40 border border-white/30 rounded-full z-0 shadow-inner" />

              {/* Active Filled Progress Line */}
              <motion.div
                className="absolute left-3 top-1/2 -translate-y-1/2 h-2 sm:h-2.5 bg-white rounded-full z-0 shadow-[0_0_10px_rgba(255,255,255,0.9)]"
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
                    className={`relative z-10 w-6 h-6 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-[11px] sm:text-sm transition-all duration-300 shadow-xl ${isCurrent
                      ? 'bg-amber-300 text-gray-950 ring-4 ring-black/40 scale-110 border-2 border-white'
                      : isReached
                        ? 'bg-white text-gray-950 ring-2 ring-black/30 border border-gray-300'
                        : 'bg-gray-950/80 text-white border-2 border-white/60 shadow-md'
                      }`}
                  >
                    {pt}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Compact Footer */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-1 pt-1.5 sm:pt-2 border-t border-white/30 text-[10px] sm:text-sm">
            <div className="flex items-center gap-1.5 text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 shrink-0" />
              <span className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {user ? `${currentMonthName} 2026 Schedule` : 'Log in to track monthly progress'}
              </span>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  navigate('/login');
                } else {
                  navigate('/cashback-history?tab=payout_settings');
                }
              }}
              className="text-amber-300 hover:text-amber-200 font-black underline transition-colors flex items-center gap-1 ml-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
            >
              UPI / Bank Account <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}


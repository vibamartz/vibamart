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

// 3D Decorative Gold Coin SVG Component (Ultra-vibrant, glossy, embossed)
function GoldCoin3D({
  size = 40,
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
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)] select-none pointer-events-none ${className}`}
      style={style}
    >
      <defs>
        {/* Outer 3D Coin Bevel Rim Gradient */}
        <linearGradient id="coinGoldRimVivid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="20%" stopColor="#FDE047" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#B45309" />
          <stop offset="90%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Inner Coin Core Radial Polish */}
        <radialGradient id="coinGoldCoreVivid" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="95%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#78350F" />
        </radialGradient>

        {/* Embossed Rupee Shadow */}
        <linearGradient id="coinEmbossVivid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#FEF9C3" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Glass Specular Sheen Reflection */}
        <linearGradient id="coinSheenVivid" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer 3D Rim Base */}
      <circle cx="50" cy="50" r="47" fill="url(#coinGoldRimVivid)" stroke="#78350F" strokeWidth="1.5" />

      {/* Inner Beveled Surface Disc */}
      <circle cx="50" cy="50" r="41" fill="url(#coinGoldCoreVivid)" stroke="#FEF08A" strokeWidth="1.8" />

      {/* Beaded Edge Ring */}
      <circle
        cx="50"
        cy="50"
        r="35"
        fill="none"
        stroke="#FFFBEB"
        strokeWidth="1.8"
        strokeDasharray="2.5 2.5"
        opacity="0.9"
      />

      {/* Inner Concentric Bevel Ring */}
      <circle cx="50" cy="50" r="30" fill="none" stroke="#92400E" strokeWidth="1.2" opacity="0.75" />

      {/* Center 3D Embossed Rupee Symbol with Deep Shadow */}
      <text
        x="51.5"
        y="62.5"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="#451A03"
        opacity="0.65"
      >
        ₹
      </text>
      <text
        x="50"
        y="60.5"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="url(#coinEmbossVivid)"
        stroke="#78350F"
        strokeWidth="0.8"
      >
        ₹
      </text>

      {/* Specular Highlight Arc */}
      <path
        d="M 18 30 Q 50 14 82 30 Q 62 56 18 30 Z"
        fill="url(#coinSheenVivid)"
      />
    </svg>
  );
}

// 3D Decorative Indian Rupee Note Component (Crisp, High Contrast, Clearly Visible)
function RupeeNote3D({
  denomination = '500',
  width = 90,
  height = 48,
  theme = 'emerald', // 'emerald' (₹500), 'saffron' (₹200), 'purple' (₹100), 'turquoise' (₹50)
  className = '',
  style = {},
}: {
  denomination?: string;
  width?: number;
  height?: number;
  theme?: 'emerald' | 'saffron' | 'purple' | 'turquoise';
  className?: string;
  style?: React.CSSProperties;
}) {
  const gradients = {
    emerald: {
      bg: 'linear-gradient(135deg, #064e3b 0%, #059669 45%, #10b981 75%, #047857 100%)',
      accent: '#a7f3d0',
      strip: '#34d399',
      border: 'rgba(255, 255, 255, 0.65)',
      text: '#ffffff',
      badgeBg: 'rgba(6, 78, 59, 0.75)',
    },
    saffron: {
      bg: 'linear-gradient(135deg, #9a3412 0%, #ea580c 45%, #fb923c 75%, #c2410c 100%)',
      accent: '#fed7aa',
      strip: '#f97316',
      border: 'rgba(255, 255, 255, 0.65)',
      text: '#ffffff',
      badgeBg: 'rgba(154, 52, 18, 0.75)',
    },
    purple: {
      bg: 'linear-gradient(135deg, #581c87 0%, #9333ea 45%, #c084fc 75%, #7e22ce 100%)',
      accent: '#f3e8ff',
      strip: '#d8b4fe',
      border: 'rgba(255, 255, 255, 0.65)',
      text: '#ffffff',
      badgeBg: 'rgba(88, 28, 135, 0.75)',
    },
    turquoise: {
      bg: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 45%, #67e8f9 75%, #0891b2 100%)',
      accent: '#cffafe',
      strip: '#22d3ee',
      border: 'rgba(255, 255, 255, 0.65)',
      text: '#ffffff',
      badgeBg: 'rgba(14, 116, 144, 0.75)',
    },
  }[theme];

  return (
    <div
      className={`relative select-none pointer-events-none rounded-[6px] overflow-hidden drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)] ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        background: gradients.bg,
        border: `1.5px solid ${gradients.border}`,
        boxShadow: 'inset 0 0 14px rgba(255,255,255,0.4), 0 10px 20px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {/* Banknote Micro Guilloche Pattern */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, ${gradients.accent} 1.2px, transparent 1.2px)`,
          backgroundSize: '5px 5px',
        }}
      />

      {/* Holographic / Security Strip with Metallic Glow */}
      <div
        className="absolute top-0 bottom-0 left-[26%] w-[11%] opacity-90"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(251,191,36,0.95) 45%, rgba(245,158,11,0.95) 75%, rgba(255,255,255,0.9) 100%)',
          boxShadow: '0 0 8px rgba(251,191,36,0.8)',
        }}
      />

      {/* Decorative Border Frame */}
      <div
        className="absolute inset-[2.5px] rounded-[4px] border border-white/40 pointer-events-none flex flex-col justify-between p-1"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between text-[7px] font-black tracking-wider text-white leading-none drop-shadow-sm">
          <span className="opacity-95 text-[6.5px]">RESERVE BANK</span>
          <span style={{ color: gradients.accent }} className="font-extrabold font-mono text-[7.5px] bg-black/25 px-0.5 rounded">₹{denomination}</span>
        </div>

        {/* Center Note Emblem & Rupee Symbol */}
        <div className="flex items-center justify-center gap-1.5 my-auto">
          <div
            className="w-4 h-4 rounded-full border border-white/60 flex items-center justify-center text-[9px] font-black text-white shadow-md shrink-0"
            style={{ background: gradients.badgeBg }}
          >
            ₹
          </div>
          <span
            className="text-[13px] font-black tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] leading-none"
            style={{ color: gradients.text }}
          >
            ₹{denomination}
          </span>
        </div>

        {/* Bottom Bar in Note */}
        <div className="flex items-center justify-between text-[6px] font-bold text-white/90 leading-none drop-shadow-xs">
          <span className="tracking-tighter font-extrabold">VIBA MART</span>
          <span className="font-mono tracking-widest font-black">INDIA</span>
        </div>
      </div>

      {/* 3D Specular Highlight Sweep */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background: 'linear-gradient(115deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.3) 75%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  );
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

// Background Floating 3D Layer for Cashback Section (Full coverage, clearly visible across entire card)
function Floating3DCashbackBackground({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-Left: 3D Gold Coin */}
        <div
          className="absolute top-1 left-2 animate-float-slow-1 opacity-90"
          style={{ transform: 'rotateX(15deg) rotateY(-20deg) rotateZ(-10deg)' }}
        >
          <GoldCoin3D size={32} />
        </div>

        {/* Top-Right: ₹500 Emerald Note */}
        <div
          className="absolute top-1 right-2 animate-float-slow-2 opacity-85"
          style={{ transform: 'rotateX(20deg) rotateY(15deg) rotateZ(12deg)' }}
        >
          <RupeeNote3D denomination="500" width={60} height={32} theme="emerald" />
        </div>

        {/* Center-Left: 3D Gold Coin */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-1 animate-float-slow-3 opacity-90"
          style={{ transform: 'rotateX(-15deg) rotateY(25deg) rotateZ(8deg)' }}
        >
          <GoldCoin3D size={30} />
        </div>

        {/* Center-Middle (Behind Amount): ₹200 Saffron Note */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 animate-float-slow-4 opacity-75"
          style={{ transform: 'rotateX(14deg) rotateY(-12deg) rotateZ(-6deg)' }}
        >
          <RupeeNote3D denomination="200" width={56} height={30} theme="saffron" />
        </div>

        {/* Center-Right: 3D Gold Coin */}
        <div
          className="absolute top-1/2 -translate-y-1/2 right-1 animate-float-slow-1 opacity-90"
          style={{ transform: 'rotateX(18deg) rotateY(-22deg) rotateZ(-8deg)' }}
        >
          <GoldCoin3D size={32} />
        </div>

        {/* Bottom-Left: ₹100 Purple Note */}
        <div
          className="absolute bottom-1 left-3 animate-float-slow-2 opacity-85"
          style={{ transform: 'rotateX(-18deg) rotateY(-15deg) rotateZ(-8deg)' }}
        >
          <RupeeNote3D denomination="100" width={56} height={29} theme="purple" />
        </div>

        {/* Bottom-Center: 3D Gold Coin */}
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 animate-float-slow-3 opacity-85"
          style={{ transform: 'rotateX(12deg) rotateY(18deg) rotateZ(6deg)' }}
        >
          <GoldCoin3D size={28} />
        </div>

        {/* Bottom-Right: 3D Gold Coin */}
        <div
          className="absolute bottom-1 right-2 animate-float-slow-4 opacity-90"
          style={{ transform: 'rotateX(-12deg) rotateY(18deg) rotateZ(10deg)' }}
        >
          <GoldCoin3D size={30} />
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

  // Desktop Floating 3D Assets Layer (Full Coverage Across Entire Section)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* ── TOP REGION ── */}
      {/* Top-Left: Large 3D Gold Coin */}
      <div
        className="absolute top-2 left-8 animate-float-slow-1 opacity-90"
        style={{ transform: 'rotateX(18deg) rotateY(-24deg) rotateZ(-12deg)' }}
      >
        <GoldCoin3D size={48} />
      </div>

      {/* Top-Center-Left: ₹100 Purple Note */}
      <div
        className="absolute top-2 left-[28%] animate-float-slow-3 opacity-85"
        style={{ transform: 'rotateX(20deg) rotateY(12deg) rotateZ(8deg)' }}
      >
        <RupeeNote3D denomination="100" width={82} height={44} theme="purple" />
      </div>

      {/* Top-Center-Right: 3D Gold Coin */}
      <div
        className="absolute top-2 right-[28%] animate-float-slow-2 opacity-90"
        style={{ transform: 'rotateX(-16deg) rotateY(20deg) rotateZ(-10deg)' }}
      >
        <GoldCoin3D size={42} />
      </div>

      {/* Top-Right: ₹500 Emerald Note */}
      <div
        className="absolute top-2 right-10 animate-float-slow-4 opacity-90"
        style={{ transform: 'rotateX(22deg) rotateY(-18deg) rotateZ(14deg)' }}
      >
        <RupeeNote3D denomination="500" width={92} height={48} theme="emerald" />
      </div>

      {/* ── MIDDLE REGION (Behind Amount & Progress Line) ── */}
      {/* Middle-Far-Left: 3D Gold Coin */}
      <div
        className="absolute top-1/2 -translate-y-1/2 left-3 animate-float-slow-2 opacity-90"
        style={{ transform: 'rotateX(-20deg) rotateY(26deg) rotateZ(12deg)' }}
      >
        <GoldCoin3D size={46} />
      </div>

      {/* Middle-Left: ₹200 Saffron Note */}
      <div
        className="absolute top-1/2 -translate-y-1/2 left-[16%] animate-float-slow-1 opacity-85"
        style={{ transform: 'rotateX(16deg) rotateY(-15deg) rotateZ(-8deg)' }}
      >
        <RupeeNote3D denomination="200" width={84} height={45} theme="saffron" />
      </div>

      {/* Middle-Center (Behind Amount Display): ₹500 Note floating subtly */}
      <div
        className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 animate-float-slow-3 opacity-65"
        style={{ transform: 'rotateX(14deg) rotateY(8deg) rotateZ(-4deg)' }}
      >
        <RupeeNote3D denomination="500" width={88} height={46} theme="emerald" />
      </div>

      {/* Middle-Right: ₹50 Turquoise Note */}
      <div
        className="absolute top-1/2 -translate-y-1/2 right-[16%] animate-float-slow-4 opacity-85"
        style={{ transform: 'rotateX(-15deg) rotateY(20deg) rotateZ(10deg)' }}
      >
        <RupeeNote3D denomination="50" width={82} height={44} theme="turquoise" />
      </div>

      {/* Middle-Far-Right: Large 3D Gold Coin */}
      <div
        className="absolute top-1/2 -translate-y-1/2 right-3 animate-float-slow-1 opacity-90"
        style={{ transform: 'rotateX(24deg) rotateY(-28deg) rotateZ(-16deg)' }}
      >
        <GoldCoin3D size={50} />
      </div>

      {/* ── BOTTOM REGION ── */}
      {/* Bottom-Left: ₹500 Emerald Note */}
      <div
        className="absolute bottom-2 left-12 animate-float-slow-4 opacity-85"
        style={{ transform: 'rotateX(-20deg) rotateY(-16deg) rotateZ(-8deg)' }}
      >
        <RupeeNote3D denomination="500" width={86} height={45} theme="emerald" />
      </div>

      {/* Bottom-Center-Left: 3D Gold Coin */}
      <div
        className="absolute bottom-2 left-[36%] animate-float-slow-2 opacity-90"
        style={{ transform: 'rotateX(16deg) rotateY(-22deg) rotateZ(8deg)' }}
      >
        <GoldCoin3D size={40} />
      </div>

      {/* Bottom-Center-Right: 3D Gold Coin */}
      <div
        className="absolute bottom-2 right-[36%] animate-float-slow-3 opacity-90"
        style={{ transform: 'rotateX(-14deg) rotateY(20deg) rotateZ(-6deg)' }}
      >
        <GoldCoin3D size={42} />
      </div>

      {/* Bottom-Right: ₹200 Saffron Note & Gold Coin */}
      <div
        className="absolute bottom-2 right-12 animate-float-slow-1 opacity-85"
        style={{ transform: 'rotateX(18deg) rotateY(16deg) rotateZ(10deg)' }}
      >
        <RupeeNote3D denomination="200" width={86} height={45} theme="saffron" />
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
          @keyframes floatSlow1 {
            0%, 100% {
              transform: translateY(0px) rotate(0deg) scale(1);
            }
            50% {
              transform: translateY(-8px) rotate(4deg) scale(1.04);
            }
          }
          @keyframes floatSlow2 {
            0%, 100% {
              transform: translateY(0px) rotate(0deg) scale(1);
            }
            50% {
              transform: translateY(7px) rotate(-5deg) scale(0.97);
            }
          }
          @keyframes floatSlow3 {
            0%, 100% {
              transform: translateY(0px) rotate(0deg) scale(1);
            }
            50% {
              transform: translateY(-6px) rotate(-4deg) scale(1.03);
            }
          }
          @keyframes floatSlow4 {
            0%, 100% {
              transform: translateY(0px) rotate(0deg) scale(1);
            }
            50% {
              transform: translateY(8px) rotate(6deg) scale(1.02);
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
          .animate-float-slow-1 {
            animation: floatSlow1 5.5s ease-in-out infinite;
          }
          .animate-float-slow-2 {
            animation: floatSlow2 6.5s ease-in-out infinite;
          }
          .animate-float-slow-3 {
            animation: floatSlow3 7s ease-in-out infinite;
          }
          .animate-float-slow-4 {
            animation: floatSlow4 6s ease-in-out infinite;
          }
          .animate-twinkle {
            animation: twinkleGlint 3s ease-in-out infinite;
          }
          .animate-twinkle-delay {
            animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
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
        @keyframes floatSlow1 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          50% {
            transform: translateY(-9px) rotate(4deg) scale(1.04);
          }
        }
        @keyframes floatSlow2 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          50% {
            transform: translateY(8px) rotate(-5deg) scale(0.97);
          }
        }
        @keyframes floatSlow3 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          50% {
            transform: translateY(-8px) rotate(-4deg) scale(1.03);
          }
        }
        @keyframes floatSlow4 {
          0%, 100% {
            transform: translateY(0px) rotate(0deg) scale(1);
          }
          50% {
            transform: translateY(9px) rotate(5deg) scale(1.02);
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
        .animate-float-slow-1 {
          animation: floatSlow1 6s ease-in-out infinite;
        }
        .animate-float-slow-2 {
          animation: floatSlow2 7s ease-in-out infinite;
        }
        .animate-float-slow-3 {
          animation: floatSlow3 7.5s ease-in-out infinite;
        }
        .animate-float-slow-4 {
          animation: floatSlow4 6.5s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: twinkleGlint 3s ease-in-out infinite;
        }
        .animate-twinkle-delay {
          animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
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


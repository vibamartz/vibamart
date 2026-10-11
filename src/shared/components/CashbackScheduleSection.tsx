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

// 3D Decorative Gold Coin SVG Component (Ultra-premium, realistic metallic finish & 3D depth)
function GoldCoin3D({
  size = 56,
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
      className={`drop-shadow-[0_12px_22px_rgba(0,0,0,0.55)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)] drop-shadow-[0_0_12px_rgba(245,158,11,0.22)] select-none pointer-events-none ${className}`}
      style={style}
    >
      <defs>
        {/* Physical 3D Edge Rim Cylinder Gradient */}
        <linearGradient id="coinEdgeRim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="50%" stopColor="#5B2104" />
          <stop offset="100%" stopColor="#290E00" />
        </linearGradient>

        {/* Outer 3D Coin Metallic Bevel Rim Gradient */}
        <linearGradient id="coinMetallicRim" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#FFFEEA" />
          <stop offset="14%" stopColor="#FDE047" />
          <stop offset="32%" stopColor="#F59E0B" />
          <stop offset="55%" stopColor="#B45309" />
          <stop offset="78%" stopColor="#FBBF24" />
          <stop offset="90%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Inner Field Metallic Brushed Polish Radial Gradient */}
        <radialGradient id="coinMetallicField" cx="36%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FFFBEB" />
          <stop offset="25%" stopColor="#FEF08A" />
          <stop offset="52%" stopColor="#F59E0B" />
          <stop offset="78%" stopColor="#D97706" />
          <stop offset="93%" stopColor="#92400E" />
          <stop offset="100%" stopColor="#692800" />
        </radialGradient>

        {/* Embossed Chiseled Rupee Face Gradient */}
        <linearGradient id="coinEmbossChisel" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="28%" stopColor="#FEF9C3" />
          <stop offset="65%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>

        {/* Specular Curved Sheen Luster */}
        <linearGradient id="coinSpecularSheen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Ambient Bottom Reflection Luster */}
        <linearGradient id="coinBounceGlow" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 3D Physical Edge Thickness Base (giving tangible depth under the coin) */}
      <circle cx="50" cy="52.5" r="46.5" fill="url(#coinEdgeRim)" />

      {/* Outer Coin Disc with Bevel Rim */}
      <circle cx="50" cy="50" r="46.5" fill="url(#coinMetallicRim)" stroke="#78350F" strokeWidth="1.2" />

      {/* Outer Reeded Edge / Dentils Ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#451A03"
        strokeWidth="1.6"
        strokeDasharray="1.8 2.2"
        opacity="0.8"
      />

      {/* Outer Bevel Highlight Step */}
      <circle cx="50" cy="50" r="41.5" fill="none" stroke="#FFFDF0" strokeWidth="1.4" opacity="0.9" />

      {/* Inner Recessed Coin Field */}
      <circle cx="50" cy="50" r="39" fill="url(#coinMetallicField)" stroke="#92400E" strokeWidth="1" />

      {/* Minted Decorative Beaded Ring */}
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke="#FFFBEB"
        strokeWidth="1.4"
        strokeDasharray="2.2 2.6"
        opacity="0.85"
      />

      {/* Inner Concentric Lathe Ring Groove */}
      <circle cx="50" cy="50" r="28" fill="none" stroke="#78350F" strokeWidth="0.8" opacity="0.5" />

      {/* Decorative Minted Stars Flanking Rupee */}
      <path
        d="M24 50 L25.2 46 L26.4 50 L25.2 54 Z"
        fill="#FEF9C3"
        stroke="#78350F"
        strokeWidth="0.5"
        opacity="0.8"
      />
      <path
        d="M76 50 L74.8 46 L73.6 50 L74.8 54 Z"
        fill="#FEF9C3"
        stroke="#78350F"
        strokeWidth="0.5"
        opacity="0.8"
      />

      {/* Center 3D Minted Indian Rupee Symbol */}
      {/* 1. Deep Bas-Relief Bronze Cast Shadow */}
      <text
        x="51.8"
        y="62.8"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="#381500"
        opacity="0.75"
      >
        ₹
      </text>

      {/* 2. Top-Left Chiseled Highlight Relief */}
      <text
        x="49"
        y="59.2"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="#FFFEE5"
        opacity="0.9"
      >
        ₹
      </text>

      {/* 3. Main High-Relief Embossed Symbol */}
      <text
        x="50"
        y="60.5"
        textAnchor="middle"
        fontFamily="sans-serif"
        fontSize="34"
        fontWeight="900"
        fill="url(#coinEmbossChisel)"
        stroke="#78350F"
        strokeWidth="0.8"
      >
        ₹
      </text>

      {/* Specular Curved Glint Sweep */}
      <path
        d="M 17 32 Q 50 14 83 32 Q 62 55 17 32 Z"
        fill="url(#coinSpecularSheen)"
      />

      {/* Ambient Bounce Glow Arc at bottom rim */}
      <path
        d="M 28 82 Q 50 88 72 82 Q 50 94 28 82 Z"
        fill="url(#coinBounceGlow)"
      />
    </svg>
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

// Background Floating 3D Layer for Cashback Section (Premium 3D gold coins & sparkles)
function Floating3DCashbackBackground({ isMobile = false }: { isMobile?: boolean }) {
  if (isMobile) {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ perspective: '800px' }}>
        {/* Top-Left: 3D Gold Coin */}
        <div className="absolute top-1 left-2 animate-float-coin-1 opacity-90">
          <GoldCoin3D size={38} />
        </div>

        {/* Top-Center: 3D Gold Coin */}
        <div className="absolute top-0.5 left-[48%] animate-float-coin-2 opacity-90">
          <GoldCoin3D size={36} />
        </div>

        {/* Top-Right: 3D Gold Coin */}
        <div className="absolute top-1 right-2 animate-float-coin-3 opacity-90">
          <GoldCoin3D size={38} />
        </div>

        {/* Center-Left Flank: 3D Gold Coin */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1 animate-float-coin-2 opacity-85">
          <GoldCoin3D size={42} />
        </div>
        <div className="absolute top-[38%] left-[16%] animate-float-coin-4 opacity-35">
          <GoldCoin3D size={34} />
        </div>

        {/* Center-Right Flank: 3D Gold Coin */}
        <div className="absolute top-[38%] right-[16%] animate-float-coin-1 opacity-35">
          <GoldCoin3D size={34} />
        </div>
        <div className="absolute top-1/2 -translate-y-1/2 right-1 animate-float-coin-3 opacity-85">
          <GoldCoin3D size={42} />
        </div>

        {/* Bottom-Left: 3D Gold Coin */}
        <div className="absolute bottom-1 left-3 animate-float-coin-4 opacity-85">
          <GoldCoin3D size={38} />
        </div>

        {/* Bottom-Center: 3D Gold Coin */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 animate-float-coin-1 opacity-90">
          <GoldCoin3D size={36} />
        </div>

        {/* Bottom-Right: 3D Gold Coin */}
        <div className="absolute bottom-1 right-3 animate-float-coin-2 opacity-85">
          <GoldCoin3D size={38} />
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

  // Desktop Floating 3D Assets Layer (Large, Premium 3D Gold Coins)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ perspective: '1000px' }}>
      {/* ── TOP REGION ── */}
      {/* Top-Left: Large 3D Gold Coin */}
      <div className="absolute top-2 left-8 animate-float-coin-1 opacity-90">
        <GoldCoin3D size={52} />
      </div>

      {/* Top-Center-Left: 3D Gold Coin */}
      <div className="absolute top-1 left-[26%] animate-float-coin-4 opacity-85">
        <GoldCoin3D size={46} />
      </div>

      {/* Top-Center: Large 3D Gold Coin */}
      <div className="absolute top-1 left-[50%] -translate-x-1/2 animate-float-coin-2 opacity-90">
        <GoldCoin3D size={54} />
      </div>

      {/* Top-Center-Right: 3D Gold Coin */}
      <div className="absolute top-1 right-[26%] animate-float-coin-3 opacity-85">
        <GoldCoin3D size={46} />
      </div>

      {/* Top-Right: Large 3D Gold Coin */}
      <div className="absolute top-2 right-8 animate-float-coin-1 opacity-90">
        <GoldCoin3D size={52} />
      </div>

      {/* ── MIDDLE FLANKS & DEPTH REGION ── */}
      {/* Middle-Far-Left Flank: Prominent 3D Gold Coin */}
      <div className="absolute top-1/2 -translate-y-1/2 left-3 animate-float-coin-2 opacity-90">
        <GoldCoin3D size={58} />
      </div>
      <div className="absolute top-[28%] left-[12%] animate-float-coin-3 opacity-85">
        <GoldCoin3D size={48} />
      </div>

      {/* Middle Subtle Depth Coins (Behind/Flanking Amount without obstructing text) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-[24%] animate-float-coin-4 opacity-35">
        <GoldCoin3D size={44} />
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-[24%] animate-float-coin-1 opacity-35">
        <GoldCoin3D size={44} />
      </div>

      {/* Middle-Far-Right Flank: Prominent 3D Gold Coin */}
      <div className="absolute top-[28%] right-[12%] animate-float-coin-2 opacity-85">
        <GoldCoin3D size={48} />
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-3 animate-float-coin-4 opacity-90">
        <GoldCoin3D size={58} />
      </div>

      {/* ── BOTTOM REGION ── */}
      {/* Bottom-Left: Large 3D Gold Coin */}
      <div className="absolute bottom-2 left-10 animate-float-coin-4 opacity-85">
        <GoldCoin3D size={54} />
      </div>

      {/* Bottom-Center-Left: 3D Gold Coin */}
      <div className="absolute bottom-2 left-[32%] animate-float-coin-1 opacity-90">
        <GoldCoin3D size={48} />
      </div>

      {/* Bottom-Center-Right: 3D Gold Coin */}
      <div className="absolute bottom-2 right-[32%] animate-float-coin-3 opacity-90">
        <GoldCoin3D size={48} />
      </div>

      {/* Bottom-Right: Large 3D Gold Coin */}
      <div className="absolute bottom-2 right-10 animate-float-coin-2 opacity-85">
        <GoldCoin3D size={54} />
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
          @keyframes fastMoveEntireBgOrb1Mobile {
            0% {
              left: -15%;
              top: -20%;
              transform: scale(1);
            }
            25% {
              left: 40%;
              top: 45%;
              transform: scale(1.15);
            }
            50% {
              left: 80%;
              top: -15%;
              transform: scale(0.92);
            }
            75% {
              left: 35%;
              top: 50%;
              transform: scale(1.12);
            }
            100% {
              left: -15%;
              top: -20%;
              transform: scale(1);
            }
          }
          @keyframes fastMoveEntireBgOrb2Mobile {
            0% {
              left: 80%;
              top: 45%;
              transform: scale(0.92);
            }
            25% {
              left: 35%;
              top: -20%;
              transform: scale(1.15);
            }
            50% {
              left: -15%;
              top: 40%;
              transform: scale(0.9);
            }
            75% {
              left: 40%;
              top: -10%;
              transform: scale(1.12);
            }
            100% {
              left: 80%;
              top: 45%;
              transform: scale(0.92);
            }
          }
          @keyframes float3DCoin1 {
            0%, 100% {
              transform: translateY(0px) rotateX(16deg) rotateY(-22deg) rotateZ(-12deg) scale(1);
            }
            50% {
              transform: translateY(-7px) rotateX(24deg) rotateY(-14deg) rotateZ(-6deg) scale(1.04);
            }
          }
          @keyframes float3DCoin2 {
            0%, 100% {
              transform: translateY(0px) rotateX(-18deg) rotateY(24deg) rotateZ(10deg) scale(1);
            }
            50% {
              transform: translateY(6px) rotateX(-12deg) rotateY(18deg) rotateZ(6deg) scale(0.96);
            }
          }
          @keyframes float3DCoin3 {
            0%, 100% {
              transform: translateY(0px) rotateX(14deg) rotateY(-18deg) rotateZ(8deg) scale(1);
            }
            50% {
              transform: translateY(-6px) rotateX(20deg) rotateY(-10deg) rotateZ(12deg) scale(1.03);
            }
          }
          @keyframes float3DCoin4 {
            0%, 100% {
              transform: translateY(0px) rotateX(-14deg) rotateY(18deg) rotateZ(-8deg) scale(1);
            }
            50% {
              transform: translateY(7px) rotateX(-20deg) rotateY(26deg) rotateZ(-4deg) scale(0.97);
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
          .cashback-blue-bg {
            background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #1e40af 100%);
            position: relative;
          }
          .cashback-purple-orb-1 {
            position: absolute;
            width: 150px;
            height: 150px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(168, 85, 247, 0.85) 0%, rgba(147, 51, 234, 0.6) 45%, rgba(126, 34, 206, 0.2) 75%, transparent 100%);
            filter: blur(35px);
            pointer-events: none;
            z-index: 0;
            animation: fastMoveEntireBgOrb1Mobile 3.6s ease-in-out infinite;
            will-change: left, top, transform;
          }
          .cashback-purple-orb-2 {
            position: absolute;
            width: 130px;
            height: 130px;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(192, 132, 252, 0.85) 0%, rgba(168, 85, 247, 0.6) 45%, rgba(147, 51, 234, 0.2) 75%, transparent 100%);
            filter: blur(30px);
            pointer-events: none;
            z-index: 0;
            animation: fastMoveEntireBgOrb2Mobile 4.2s ease-in-out infinite;
            will-change: left, top, transform;
          }
          .animate-float-coin-1 {
            animation: float3DCoin1 5.2s ease-in-out infinite;
          }
          .animate-float-coin-2 {
            animation: float3DCoin2 6.2s ease-in-out infinite;
          }
          .animate-float-coin-3 {
            animation: float3DCoin3 5.8s ease-in-out infinite;
          }
          .animate-float-coin-4 {
            animation: float3DCoin4 6.8s ease-in-out infinite;
          }
          .animate-twinkle {
            animation: twinkleGlint 3s ease-in-out infinite;
          }
          .animate-twinkle-delay {
            animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-float-coin-1,
            .animate-float-coin-2,
            .animate-float-coin-3,
            .animate-float-coin-4,
            .animate-twinkle,
            .animate-twinkle-delay,
            .cashback-purple-orb-1,
            .cashback-purple-orb-2 {
              animation: none !important;
            }
          }
        `}</style>

        <section className="w-full max-w-7xl mx-auto px-0 py-0">
          <div className="cashback-blue-bg relative rounded-2xl py-1.5 px-2.5 text-white shadow-lg border border-white/25 overflow-hidden">
            {/* 2 Softly blurred fast floating purple circular elements */}
            <div className="cashback-purple-orb-1" />
            <div className="cashback-purple-orb-2" />

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
        @keyframes fastMoveEntireBgOrb1Desktop {
          0% {
            left: -5%;
            top: -15%;
            transform: scale(1);
          }
          25% {
            left: 45%;
            top: 40%;
            transform: scale(1.18);
          }
          50% {
            left: 85%;
            top: -10%;
            transform: scale(0.95);
          }
          75% {
            left: 40%;
            top: 50%;
            transform: scale(1.12);
          }
          100% {
            left: -5%;
            top: -15%;
            transform: scale(1);
          }
        }
        @keyframes fastMoveEntireBgOrb2Desktop {
          0% {
            left: 85%;
            top: 45%;
            transform: scale(0.95);
          }
          25% {
            left: 40%;
            top: -15%;
            transform: scale(1.15);
          }
          50% {
            left: -5%;
            top: 40%;
            transform: scale(0.92);
          }
          75% {
            left: 45%;
            top: -10%;
            transform: scale(1.18);
          }
          100% {
            left: 85%;
            top: 45%;
            transform: scale(0.95);
          }
        }
        @keyframes float3DCoin1 {
          0%, 100% {
            transform: translateY(0px) rotateX(16deg) rotateY(-22deg) rotateZ(-12deg) scale(1);
          }
          50% {
            transform: translateY(-8px) rotateX(24deg) rotateY(-14deg) rotateZ(-6deg) scale(1.04);
          }
        }
        @keyframes float3DCoin2 {
          0%, 100% {
            transform: translateY(0px) rotateX(-18deg) rotateY(24deg) rotateZ(10deg) scale(1);
          }
          50% {
            transform: translateY(7px) rotateX(-12deg) rotateY(18deg) rotateZ(6deg) scale(0.96);
          }
        }
        @keyframes float3DCoin3 {
          0%, 100% {
            transform: translateY(0px) rotateX(14deg) rotateY(-18deg) rotateZ(8deg) scale(1);
          }
          50% {
            transform: translateY(-7px) rotateX(20deg) rotateY(-10deg) rotateZ(12deg) scale(1.03);
          }
        }
        @keyframes float3DCoin4 {
          0%, 100% {
            transform: translateY(0px) rotateX(-14deg) rotateY(18deg) rotateZ(-8deg) scale(1);
          }
          50% {
            transform: translateY(8px) rotateX(-20deg) rotateY(26deg) rotateZ(-4deg) scale(0.97);
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
        .cashback-blue-bg {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #1e40af 100%);
          position: relative;
        }
        .cashback-purple-orb-1 {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(168, 85, 247, 0.85) 0%, rgba(147, 51, 234, 0.6) 45%, rgba(126, 34, 206, 0.2) 75%, transparent 100%);
          filter: blur(55px);
          pointer-events: none;
          z-index: 0;
          animation: fastMoveEntireBgOrb1Desktop 3.8s ease-in-out infinite;
          will-change: left, top, transform;
        }
        .cashback-purple-orb-2 {
          position: absolute;
          width: 280px;
          height: 280px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(192, 132, 252, 0.85) 0%, rgba(168, 85, 247, 0.6) 45%, rgba(147, 51, 234, 0.2) 75%, transparent 100%);
          filter: blur(50px);
          pointer-events: none;
          z-index: 0;
          animation: fastMoveEntireBgOrb2Desktop 4.5s ease-in-out infinite;
          will-change: left, top, transform;
        }
        .animate-float-coin-1 {
          animation: float3DCoin1 6s ease-in-out infinite;
        }
        .animate-float-coin-2 {
          animation: float3DCoin2 7.2s ease-in-out infinite;
        }
        .animate-float-coin-3 {
          animation: float3DCoin3 6.8s ease-in-out infinite;
        }
        .animate-float-coin-4 {
          animation: float3DCoin4 7.6s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: twinkleGlint 3s ease-in-out infinite;
        }
        .animate-twinkle-delay {
          animation: twinkleGlint 3.5s ease-in-out infinite 1.5s;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-coin-1,
          .animate-float-coin-2,
          .animate-float-coin-3,
          .animate-float-coin-4,
          .animate-twinkle,
          .animate-twinkle-delay,
          .cashback-purple-orb-1,
          .cashback-purple-orb-2 {
            animation: none !important;
          }
        }
      `}</style>

      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1">
        <div className="cashback-blue-bg relative rounded-2xl sm:rounded-[32px] py-2.5 px-3 sm:py-3.5 sm:px-6 text-white shadow-xl border border-white/25 overflow-hidden">
          {/* 2 Softly blurred fast floating purple circular elements */}
          <div className="cashback-purple-orb-1" />
          <div className="cashback-purple-orb-2" />

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


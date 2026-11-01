import React from 'react';
import { RotateCw, ArrowRight } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';

interface OfflineSplashScreenProps {
  onRetrySuccess?: () => void;
  onContinueOffline?: () => void;
  className?: string;
}

/**
 * Friendly Shopping Bag Illustration with Disconnected Wi-Fi Symbol
 */
function ShoppingBagOfflineIllustration({ className = 'w-44 h-44 sm:w-52 sm:h-52' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        <defs>
          <linearGradient id="vibaBagGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="vibaBagOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="vibaBagBadgeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ambient Ground Shadow */}
        <ellipse cx="120" cy="218" rx="72" ry="10" fill="#0f172a" opacity="0.08" />

        {/* Shopping Bag Dual Handles */}
        <path
          d="M 88 95 C 88 45, 152 45, 152 95"
          fill="none"
          stroke="#ea580c"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 94 95 C 94 55, 146 55, 146 95"
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.65"
        />

        {/* Main Bag Body */}
        <path
          d="M 64 92 L 52 205 C 51 211 56 216 62 216 H 178 C 184 216 189 211 188 205 L 176 92 Z"
          fill="url(#vibaBagGreen)"
          stroke="#14532d"
          strokeWidth="2"
        />

        {/* Side Crease Highlights */}
        <path
          d="M 64 92 L 78 216 M 176 92 L 162 216"
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.15"
        />

        {/* Cheerful ViBa Smile on Bag */}
        {/* Friendly eyes */}
        <circle cx="102" cy="138" r="4.5" fill="#ffffff" />
        <circle cx="138" cy="138" r="4.5" fill="#ffffff" />
        {/* Warm smile */}
        <path
          d="M 108 152 Q 120 166 132 152"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Cute blush cheeks */}
        <circle cx="94" cy="148" r="5" fill="#fca5a5" opacity="0.75" />
        <circle cx="146" cy="148" r="5" fill="#fca5a5" opacity="0.75" />

        {/* ViBa Brand Emblem Tag */}
        <rect x="100" y="180" width="40" height="18" rx="5" fill="#ea580c" />
        <text
          x="120"
          y="193"
          textAnchor="middle"
          fill="#ffffff"
          fontWeight="800"
          fontSize="10"
          letterSpacing="1"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ViBa
        </text>

        {/* Disconnected Wi-Fi Symbol Badge */}
        <g filter="url(#vibaBagBadgeGlow)">
          <circle cx="178" cy="80" r="27" fill="#ffffff" stroke="#fed7aa" strokeWidth="3" />

          {/* Wi-Fi Waves */}
          <path
            d="M 163 76 A 15 15 0 0 1 193 76"
            stroke="#15803d"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 169 83 A 9 9 0 0 1 187 83"
            stroke="#ea580c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="178" cy="90" r="2.5" fill="#ea580c" />

          {/* Red Slashed Disconnection Indicator */}
          <line
            x1="162"
            y1="64"
            x2="194"
            y2="96"
            stroke="#ef4444"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * 3. Offline Splash Screen
 * - Cream background with soft orange and green decorative shapes
 * - Center the ViBa Mart logo above a shopping bag illustration with a disconnected Wi-Fi symbol
 * - Heading: “Stay Connected”
 * - Message: “We’ll be back online soon!”
 * - Green rounded “Try Again” button
 * - Bottom text: “Shop • Save • Smile”
 */
export default function OfflineSplashScreen({
  onRetrySuccess,
  onContinueOffline,
  className = '',
}: OfflineSplashScreenProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-6 px-4 sm:py-8 sm:px-6 bg-[#FAF7F2] relative overflow-hidden select-none text-center z-[9999] ${className}`}
    >
      {/* Cream background with soft orange and green decorative shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-orange-200/40 to-amber-100/30 blur-3xl" />
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-200/35 to-green-100/25 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-emerald-200/35 to-teal-100/25 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-200/40 to-orange-100/30 blur-3xl" />

        {/* Soft decorative floating dots */}
        <div className="absolute top-16 left-12 w-4 h-4 rounded-full bg-emerald-500/20" />
        <div className="absolute top-28 right-16 w-5 h-5 rounded-full bg-orange-400/25" />
        <div className="absolute bottom-28 left-16 w-6 h-6 rounded-full bg-orange-400/20" />
        <div className="absolute bottom-20 right-14 w-4 h-4 rounded-full bg-emerald-500/20" />
      </div>

      {/* Top spacer */}
      <div className="relative z-10 shrink-0 h-2 sm:h-4" />

      {/* Center: ViBa Mart logo above shopping bag illustration with disconnected Wi-Fi symbol */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto py-2 px-4">
        {/* ViBa Mart logo centered */}
        <div className="mb-2 sm:mb-3 shrink-0">
          <Logo showTextOnMobile={true} className="scale-105 sm:scale-120" />
        </div>

        {/* Shopping bag illustration with disconnected Wi-Fi symbol */}
        <ShoppingBagOfflineIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[25vh] mb-3 sm:mb-4 shrink-0" />

        {/* Heading: “Stay Connected” */}
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1.5 sm:mb-2">
          Stay Connected
        </h1>

        {/* Message: “We’ll be back online soon!” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">
          We’ll be back online soon!
        </p>

        {/* Green rounded “Try Again” button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3 sm:px-9 sm:py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-2.5"
        >
          <RotateCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>

        {/* Optional continue offline button */}
        {onContinueOffline && (
          <button
            onClick={onContinueOffline}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-emerald-700 transition-colors py-1 px-3 rounded-lg hover:bg-black/5"
          >
            <span>Browse saved items offline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom text: “Shop • Save • Smile” */}
      <div className="relative z-10 pb-2 sm:pb-3 shrink-0">
        <p className="text-xs sm:text-sm font-extrabold text-gray-700 tracking-widest uppercase">
          Shop • Save • Smile
        </p>
      </div>
    </div>
  );
}

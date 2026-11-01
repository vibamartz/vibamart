import React from 'react';
import { RotateCw, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';
import { useCartStore } from '../../../backend/store';

interface NoInternetScreenProps {
  onRetrySuccess?: () => void;
  className?: string;
}

/**
 * Friendly Shopping Storefront Illustration
 * Styled with ViBa Mart's signature emerald green and warm orange tones.
 */
function StorefrontIllustration({ className = 'w-44 h-44 sm:w-56 sm:h-56' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 280 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="vibaStoreGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="vibaStoreOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="vibaStoreWindow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
          <filter id="vibaBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ambient Ground Shadow */}
        <ellipse cx="140" cy="236" rx="105" ry="10" fill="#0f172a" opacity="0.08" />

        {/* Store Building Main Body */}
        <rect x="52" y="86" width="176" height="144" rx="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2.5" />

        {/* ViBa Mart Top Header Signboard */}
        <rect x="44" y="40" width="192" height="40" rx="10" fill="url(#vibaStoreGreen)" />
        <rect x="48" y="44" width="184" height="32" rx="7" fill="#15803d" stroke="#86efac" strokeWidth="1" strokeOpacity="0.35" />
        <text
          x="140"
          y="65"
          textAnchor="middle"
          fill="#ffffff"
          fontWeight="900"
          fontSize="15"
          letterSpacing="2"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ViBa MART
        </text>

        {/* Striped Green & Orange Awning */}
        <g>
          {/* Awning Fabric Stripes */}
          <path d="M 42 80 L 54 116 L 76 116 L 68 80 Z" fill="url(#vibaStoreOrange)" />
          <path d="M 68 80 L 76 116 L 100 116 L 92 80 Z" fill="url(#vibaStoreGreen)" />
          <path d="M 92 80 L 100 116 L 124 116 L 116 80 Z" fill="url(#vibaStoreOrange)" />
          <path d="M 116 80 L 124 116 L 148 116 L 140 80 Z" fill="url(#vibaStoreGreen)" />
          <path d="M 140 80 L 148 116 L 172 116 L 164 80 Z" fill="url(#vibaStoreOrange)" />
          <path d="M 164 80 L 172 116 L 196 116 L 188 80 Z" fill="url(#vibaStoreGreen)" />
          <path d="M 188 80 L 196 116 L 218 116 L 212 80 Z" fill="url(#vibaStoreOrange)" />
          <path d="M 212 80 L 218 116 L 238 116 L 238 80 Z" fill="url(#vibaStoreGreen)" />

          {/* Scalloped Awning Valance */}
          <path
            d="M 42 116 Q 53 126 64 116 Q 75 126 86 116 Q 97 126 108 116 Q 119 126 130 116 Q 141 126 152 116 Q 163 126 174 116 Q 185 126 196 116 Q 207 126 218 116 Q 228 126 238 116"
            fill="none"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Showcase Glass Window */}
        <rect x="66" y="132" width="68" height="76" rx="8" fill="url(#vibaStoreWindow)" stroke="#cbd5e1" strokeWidth="2" />
        {/* Glass reflection streaks */}
        <line x1="72" y1="138" x2="108" y2="174" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
        <line x1="86" y1="138" x2="120" y2="172" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />

        {/* Display Shelf with Groceries */}
        <rect x="72" y="190" width="56" height="5" rx="2.5" fill="#94a3b8" />
        <rect x="76" y="174" width="15" height="16" rx="3" fill="#f97316" />
        <rect x="95" y="170" width="14" height="20" rx="3" fill="#15803d" />
        <circle cx="117" cy="182" r="7" fill="#eab308" />

        {/* Glass Front Door */}
        <rect x="148" y="132" width="64" height="98" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
        <rect x="154" y="138" width="52" height="42" rx="4" fill="url(#vibaStoreWindow)" />
        {/* Door handle */}
        <circle cx="198" cy="182" r="4.5" fill="#f97316" />

        {/* Welcome Mat */}
        <path d="M 142 230 L 218 230 L 224 237 L 136 237 Z" fill="#15803d" />

        {/* Warm Side Lantern */}
        <g>
          <path d="M 38 132 L 47 132 L 47 137 L 38 137 Z" fill="#64748b" />
          <path d="M 42 137 L 42 143" stroke="#64748b" strokeWidth="2" />
          <circle cx="42" cy="149" r="8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <circle cx="42" cy="149" r="14" fill="#fef08a" opacity="0.25" />
        </g>

        {/* Friendly Potted Plant by Door */}
        <g>
          <path d="M 224 209 L 242 209 L 239 230 L 227 230 Z" fill="#ea580c" />
          <ellipse cx="233" cy="198" rx="10" ry="12" fill="#16a34a" />
          <ellipse cx="228" cy="202" rx="8" ry="9" fill="#22c55e" />
          <ellipse cx="238" cy="202" rx="8" ry="9" fill="#15803d" />
        </g>

        {/* Disconnected Wi-Fi / Offline Badge Floating in Top Corner */}
        <g filter="url(#vibaBadgeShadow)">
          <circle cx="238" cy="46" r="23" fill="#ffffff" stroke="#fed7aa" strokeWidth="2.5" />
          {/* Wi-Fi Waves */}
          <path d="M 226 45 A 12 12 0 0 1 250 45" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 230 50 A 7 7 0 0 1 246 50" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
          <circle cx="238" cy="56" r="1.8" fill="#f97316" />
          {/* Disconnection Red Strike */}
          <line x1="224" y1="33" x2="252" y2="59" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 1. No Internet Connection Screen
 * - Cream background with green and orange decorative elements
 * - ViBa Mart logo at the top
 * - Heading: “No Internet Connection”
 * - Message: “You’re offline. Check your connection and try again.”
 * - Green rounded “Try Again” button with a refresh icon
 * - Friendly shopping storefront illustration
 */
export default function NoInternetScreen({ onRetrySuccess, className = '' }: NoInternetScreenProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();
  const { items: cartItems } = useCartStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-5 px-4 sm:py-8 sm:px-6 bg-[#FAF7F2] relative overflow-hidden text-center select-none z-50 ${className}`}
    >
      {/* Cream background with green and orange decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-orange-200/40 to-amber-100/30 blur-3xl" />
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-200/35 to-green-100/25 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-emerald-200/35 to-teal-100/25 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-200/40 to-orange-100/30 blur-3xl" />

        {/* Decorative soft geometric elements */}
        <div className="absolute top-12 left-10 w-4 h-4 rounded-full bg-emerald-500/20" />
        <div className="absolute top-28 right-12 w-6 h-6 rounded-full bg-orange-400/20" />
        <div className="absolute bottom-24 left-14 w-8 h-8 rounded-full border-2 border-dashed border-orange-400/30" />
        <div className="absolute bottom-16 right-14 w-5 h-5 rounded-full bg-emerald-500/20" />
      </div>

      {/* ViBa Mart logo at the top */}
      <div className="relative z-10 pt-1 sm:pt-3 shrink-0">
        <Logo showTextOnMobile={true} className="scale-100 sm:scale-110" />
      </div>

      {/* Center content: Friendly shopping storefront illustration, Heading, Message, Try Again */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto px-4 py-2">
        {/* Friendly shopping storefront illustration */}
        <StorefrontIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[25vh] mb-3 sm:mb-4 shrink-0" />

        {/* Heading: “No Internet Connection” */}
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-2.5">
          No Internet Connection
        </h1>

        {/* Message: “You’re offline. Check your connection and try again.” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed px-2 mb-5 sm:mb-6 max-w-sm">
          You’re offline. Check your connection and try again.
        </p>

        {/* Green rounded “Try Again” button with a refresh icon */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3 sm:px-9 sm:py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
          </button>

          {cartItems.length > 0 && (
            <Link
              to="/cart"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-bold text-xs sm:text-sm rounded-full border border-emerald-200 shadow-sm transition-all duration-200"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>Saved Cart ({cartItems.length})</span>
            </Link>
          )}
        </div>
      </div>

      {/* Bottom subtle branding text */}
      <div className="relative z-10 pb-2 sm:pb-3 shrink-0">
        <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest">
          ViBa Mart Offline Mode
        </span>
      </div>
    </div>
  );
}

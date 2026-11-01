import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCw, ShoppingBag } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';

export interface OfflineCartSectionProps {
  className?: string;
  onContinueShopping?: () => void;
  onRetrySuccess?: () => void;
}

/**
 * Friendly Shopping Cart Illustration with Disconnected Wi-Fi Icon
 */
function ShoppingCartOfflineIllustration({ className = 'w-40 h-40 sm:w-48 sm:h-48' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 240 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="vibaCartGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="vibaCartOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="vibaCartBadgeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ambient Ground Shadow */}
        <ellipse cx="118" cy="198" rx="80" ry="10" fill="#0f172a" opacity="0.08" />

        {/* Cart items packed in basket */}
        {/* Orange Grocery Package */}
        <rect x="74" y="86" width="34" height="42" rx="6" fill="url(#vibaCartOrange)" transform="rotate(-6 74 86)" />
        <line x1="77" y1="103" x2="104" y2="100" stroke="#ffedd5" strokeWidth="2" strokeDasharray="3 2" />

        {/* Green Fresh Grocery Box */}
        <rect x="105" y="78" width="40" height="48" rx="6" fill="url(#vibaCartGreen)" />
        <rect x="113" y="94" width="24" height="12" rx="3" fill="#ffffff" opacity="0.25" />

        {/* Golden Produce Circle */}
        <circle cx="152" cy="104" r="16" fill="#fde047" stroke="#ca8a04" strokeWidth="2" />
        <path d="M 144 104 L 160 104 M 152 96 L 152 112" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

        {/* Shopping Cart Basket Wireframe */}
        <path
          d="M 38 60 H 54 L 74 145 H 168 L 186 78 H 62"
          stroke="#15803d"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cart Wire Grid Lines */}
        <path
          d="M 76 96 H 180 M 80 120 H 172"
          stroke="#15803d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />
        <path
          d="M 102 80 L 98 142 M 132 80 L 130 142 M 160 80 L 156 142"
          stroke="#15803d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Cart Chassis Lower Frame */}
        <path
          d="M 78 158 H 158 L 168 174"
          stroke="#334155"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cart Wheels */}
        <circle cx="90" cy="182" r="12" fill="#ffffff" stroke="#15803d" strokeWidth="5" />
        <circle cx="90" cy="182" r="4" fill="#ea580c" />

        <circle cx="156" cy="182" r="12" fill="#ffffff" stroke="#15803d" strokeWidth="5" />
        <circle cx="156" cy="182" r="4" fill="#ea580c" />

        {/* Orange Cart Handle */}
        <path
          d="M 36 60 L 46 60"
          stroke="#ea580c"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Disconnected Wi-Fi Icon Badge on Cart */}
        <g filter="url(#vibaCartBadgeGlow)">
          <circle cx="188" cy="52" r="27" fill="#ffffff" stroke="#fdba74" strokeWidth="3" />

          {/* Wi-Fi Signal Arcs */}
          <path
            d="M 173 47 A 16 16 0 0 1 203 47"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 179 54 A 10 10 0 0 1 197 54"
            stroke="#15803d"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="188" cy="62" r="2.5" fill="#ea580c" />

          {/* Disconnection Strike */}
          <line
            x1="172"
            y1="36"
            x2="204"
            y2="68"
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
 * Offline Cart Section / Full Screen
 * - Displays ONLY the Offline Cart screen when offline.
 * - Completely covers the viewport so no cart products or content appear below.
 * - All cart data in state/storage is preserved for when connectivity returns.
 */
export function OfflineCartSection({
  className = '',
  onContinueShopping,
  onRetrySuccess,
}: OfflineCartSectionProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();

  // Prevent background scrolling while offline cart screen is presented
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, []);

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-5 px-4 sm:py-8 sm:px-6 bg-[#FAF7F2] overflow-y-auto overflow-x-hidden text-center select-none ${className}`}
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

      {/* Center content: Shopping cart illustration, Heading, Message, Confirmation, Action Buttons */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto px-4 py-2">
        {/* Shopping cart illustration with a disconnected Wi-Fi icon */}
        <ShoppingCartOfflineIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-50 sm:h-50 max-h-[25vh] mb-3 sm:mb-4 shrink-0" />

        {/* Heading: “You’re Offline” */}
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-2.5">
          You’re Offline
        </h1>

        {/* Message: “Your cart is saved. Some features may be limited until you’re back online.” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed px-2 mb-3.5 sm:mb-4 max-w-sm">
          Your cart is saved. Some features may be limited until you’re back online.
        </p>

        {/* Confirmation message: “Your cart items are safely saved on your device.” */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs sm:text-sm font-semibold mb-5 sm:mb-6 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Your cart items are safely saved on your device.</span>
        </div>

        {/* Action Buttons: Green “Continue Shopping” button & Try Again button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          {/* Green “Continue Shopping” button */}
          <Link
            to="/"
            onClick={onContinueShopping}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 sm:px-8 sm:py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-xs sm:text-base rounded-full shadow-lg shadow-emerald-900/15 transition-all duration-200 cursor-pointer w-full sm:w-auto"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>

          {/* Try Again button */}
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3.5 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-bold text-xs sm:text-base rounded-full border border-emerald-200 shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
          </button>
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

/**
 * Default export as Standalone Offline Cart Screen
 */
export default OfflineCartSection;

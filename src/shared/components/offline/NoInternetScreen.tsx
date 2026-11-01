import React from 'react';
import { RotateCw, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';
import { useCartStore } from '../../../backend/store';
import { StorefrontIllustration, DecorativeBackgroundElements } from './illustrations';

interface NoInternetScreenProps {
  onRetrySuccess?: () => void;
  className?: string;
}

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
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-6 px-4 sm:py-8 sm:px-6 bg-[#FAF7F2] relative overflow-hidden text-center select-none z-50 ${className}`}
    >
      {/* Cream background with green and orange decorative elements */}
      <DecorativeBackgroundElements />

      {/* Top: ViBa Mart Logo */}
      <div className="relative z-10 pt-1 sm:pt-3 shrink-0">
        <Logo showTextOnMobile={true} className="scale-100 sm:scale-110" />
      </div>

      {/* Center: Friendly storefront illustration, Heading, Message, Try Again button */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto px-4 py-2">
        <StorefrontIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[26vh] mb-3 sm:mb-5 shrink-0" />

        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2 sm:mb-3">
          No Internet Connection
        </h1>

        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed px-2 mb-5 sm:mb-7 max-w-sm">
          You’re offline. Check your connection and try again.
        </p>

        {/* Green rounded “Try Again” button with a refresh icon */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3 sm:px-8 sm:py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
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
              <span>View Saved Cart ({cartItems.length})</span>
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

import React from 'react';
import { RotateCw, ShoppingCart, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';
import { useCartStore, useAuthStore } from '../../../backend/store';
import { StorefrontIllustration, DecorativeBackgroundElements } from './illustrations';

interface OfflineHomeScreenProps {
  onRetrySuccess?: () => void;
  className?: string;
}

export default function OfflineHomeScreen({ onRetrySuccess, className = '' }: OfflineHomeScreenProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();
  const { items: cartItems } = useCartStore();
  const { user } = useAuthStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  const wishlistCount = user?.wishlist?.length || 0;

  return (
    <div
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-5 px-4 sm:py-7 sm:px-6 bg-[#FAF7F2] relative overflow-hidden select-none text-center z-50 ${className}`}
    >
      {/* Cream background with green and orange decorative elements */}
      <DecorativeBackgroundElements />

      {/* Top: ViBa Mart Logo */}
      <div className="relative z-10 pt-1 sm:pt-2 shrink-0">
        <Logo showTextOnMobile={true} className="scale-100 sm:scale-110" />
      </div>

      {/* Center: Friendly storefront illustration, Heading, Message, Try Again button, Quick navigation cards */}
      <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto my-auto px-4 py-2">
        <StorefrontIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[22vh] mb-2 sm:mb-3 shrink-0" />

        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1 sm:mb-2">
          You’re Offline
        </h1>

        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed px-3 mb-3 sm:mb-4 max-w-sm sm:max-w-md">
          No internet connection. Some features may be limited, but you can still browse your saved items and cart.
        </p>

        {/* Green rounded "Try Again" button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2 px-7 py-2.5 sm:px-8 sm:py-3 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-xs sm:text-base rounded-full shadow-md shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-4 sm:mb-5"
        >
          <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>

        {/* Quick offline browsing cards for saved cart & saved items */}
        <div className="w-full max-w-sm sm:max-w-md grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Saved Cart card */}
          <Link
            to="/cart"
            className="flex items-center gap-2.5 p-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-xs hover:shadow-sm hover:border-emerald-300 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">Saved Cart</p>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </Link>

          {/* Saved Items / Wishlist card */}
          <Link
            to="/wishlist"
            className="flex items-center gap-2.5 p-3 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-xs hover:shadow-sm hover:border-orange-300 transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold shrink-0">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">Wishlist</p>
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {wishlistCount} {wishlistCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Bottom subtle text */}
      <div className="relative z-10 pb-2 sm:pb-3 shrink-0">
        <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest">
          ViBa Mart • Seamless Shopping
        </span>
      </div>
    </div>
  );
}

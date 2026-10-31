import React from 'react';
import { RotateCw, ShoppingCart, Heart, ArrowRight } from 'lucide-react';
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
      className={`min-h-[85vh] w-full flex flex-col items-center justify-between py-10 px-4 sm:px-6 bg-[#FAF7F2] relative overflow-hidden select-none ${className}`}
    >
      <DecorativeBackgroundElements />

      {/* Top: ViBa Mart Logo */}
      <div className="relative z-10 pt-2 sm:pt-4">
        <Logo showTextOnMobile={true} className="scale-105 sm:scale-115" />
      </div>

      {/* Center: Friendly storefront illustration, Heading, Message, Green outlined Try Again button */}
      <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto my-auto py-6 text-center">
        <StorefrontIllustration className="w-52 h-52 sm:w-60 sm:h-60 mb-5" />

        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
          You’re Offline
        </h1>

        <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed px-4 mb-7 max-w-md">
          No internet connection. Some features may be limited, but you can still browse your saved items and cart.
        </p>

        {/* Green outlined "Try Again" button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3 bg-white hover:bg-emerald-50 active:scale-95 text-[#15803d] font-bold text-sm sm:text-base rounded-xl border-2 border-[#15803d] shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-8"
        >
          <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>

        {/* Quick offline browsing cards for saved cart & saved items */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          {/* Saved Cart card */}
          <Link
            to="/cart"
            className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Your Saved Cart</p>
                <p className="text-xs text-gray-500 font-medium">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} saved locally
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Saved Items / Wishlist card */}
          <Link
            to="/wishlist"
            className="flex items-center justify-between p-4 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md hover:border-orange-300 transition-all text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                <Heart className="w-5 h-5 fill-current" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Saved Wishlist</p>
                <p className="text-xs text-gray-500 font-medium">
                  {wishlistCount} {wishlistCount === 1 ? 'item' : 'items'} in wishlist
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Bottom subtle text */}
      <div className="relative z-10 pb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          ViBa Mart • Seamless Shopping
        </span>
      </div>
    </div>
  );
}


import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCw, ShoppingBag } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { ShoppingCartOfflineIllustration, DecorativeBackgroundElements } from './illustrations';
import { useNetworkStore } from '../../utilities/networkStatus';
import { useCartStore } from '../../../backend/store';

interface OfflineCartScreenProps {
  className?: string;
  onContinueShopping?: () => void;
  onRetrySuccess?: () => void;
}

export default function OfflineCartScreen({
  className = '',
  onContinueShopping,
  onRetrySuccess,
}: OfflineCartScreenProps) {
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

      {/* Center: Shopping Cart Offline Illustration, Heading, Message, Confirmation badge & Buttons */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto px-4 py-2">
        {/* Shopping cart illustration with a disconnected Wi-Fi icon */}
        <ShoppingCartOfflineIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[25vh] mb-2 sm:mb-3 shrink-0" />

        {/* Heading: “You’re Offline” */}
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1.5 sm:mb-2">
          You’re Offline
        </h1>

        {/* Message: “Your cart is saved. Some features may be limited until you’re back online.” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed max-w-sm sm:max-w-md mb-3 sm:mb-4 px-2">
          Your cart is saved. Some features may be limited until you’re back online.
        </p>

        {/* Confirmation message: “Your cart items are safely saved on your device.” */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs sm:text-sm font-semibold mb-4 sm:mb-6 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Your cart items are safely saved on your device.{cartItems.length > 0 ? ` (${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'})` : ''}
          </span>
        </div>

        {/* Action Buttons: Green "Continue Shopping" button and functional retry check button */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {/* Green “Continue Shopping” button */}
          <Link
            to="/"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-xs sm:text-base rounded-full shadow-md shadow-emerald-900/15 transition-all duration-200 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>

          {/* Functional Retry check button */}
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-bold text-xs sm:text-base rounded-full border border-emerald-200 shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check Connection'}</span>
          </button>
        </div>
      </div>

      {/* Bottom subtle branding text */}
      <div className="relative z-10 pb-2 sm:pb-3 shrink-0">
        <span className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-widest">
          ViBa Mart • Secure Offline Cart
        </span>
      </div>
    </div>
  );
}

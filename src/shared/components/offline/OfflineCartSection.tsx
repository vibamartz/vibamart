import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCw, ShoppingBag } from 'lucide-react';
import { ShoppingCartOfflineIllustration } from './illustrations';
import { useNetworkStore } from '../../utilities/networkStatus';

interface OfflineCartSectionProps {
  className?: string;
  onContinueShopping?: () => void;
}

export default function OfflineCartSection({ className = '', onContinueShopping }: OfflineCartSectionProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();

  return (
    <div
      className={`bg-gradient-to-br from-[#FAF7F2] via-[#FFFDF9] to-[#FEF3C7]/20 border border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-sm mb-8 text-center relative overflow-hidden select-none ${className}`}
    >
      {/* Decorative soft circles */}
      <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-orange-100/40 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-emerald-100/40 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
        {/* Shopping cart illustration with a disconnected Wi-Fi icon */}
        <ShoppingCartOfflineIllustration className="w-40 h-40 sm:w-48 sm:h-48 mb-4" />

        {/* Heading: “You’re Offline” */}
        <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          You’re Offline
        </h2>

        {/* Message: “Your cart is saved. Some features may be limited until you’re back online.” */}
        <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed max-w-md mb-4">
          Your cart is saved. Some features may be limited until you’re back online.
        </p>

        {/* Confirmation message badge: “Your cart items are safely saved on your device.” */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs sm:text-sm font-semibold mb-6 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Your cart items are safely saved on your device.</span>
        </div>

        {/* Action Buttons: Green "Continue Shopping" button and retry check button */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Green “Continue Shopping” button */}
          <Link
            to="/"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-xl shadow-md shadow-emerald-900/15 transition-all duration-200 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>

          {/* Quick retry button */}
          <button
            onClick={() => checkConnectivity()}
            disabled={isChecking}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-bold text-sm sm:text-base rounded-xl border border-emerald-200 shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Check Connection'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}


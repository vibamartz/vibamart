import React, { useState } from 'react';
import { RefreshCw, ShoppingCart, Heart, ArrowRight } from 'lucide-react';
import { StorefrontIllustration } from './OfflineIllustrations';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../../../backend/store';

interface HomeOfflineSectionProps {
  onRetry?: () => Promise<boolean> | void;
}

export default function HomeOfflineSection({ onRetry }: HomeOfflineSectionProps) {
  const { retryConnection, isRetrying } = useNetworkStatus();
  const [localRetrying, setLocalRetrying] = useState(false);
  const navigate = useNavigate();
  const { items } = useCartStore();
  const { user } = useAuthStore();

  const handleRetry = async () => {
    setLocalRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        const restored = await retryConnection();
        if (restored) {
          window.location.reload();
        }
      }
    } finally {
      setLocalRetrying(false);
    }
  };

  const busy = isRetrying || localRetrying;
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const wishItemCount = user?.wishlist?.length || 0;

  return (
    <section className="w-full py-6 sm:py-10 px-4 flex flex-col items-center justify-center text-center select-none min-w-0">
      <div className="w-full max-w-lg bg-gradient-to-b from-white via-[#FAF7F2] to-[#FAF7F2] rounded-3xl p-6 sm:p-8 border border-emerald-900/10 shadow-sm relative overflow-hidden">
        {/* Soft Background Accents */}
        <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-orange-100/50 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-emerald-100/40 blur-2xl pointer-events-none" />

        {/* Friendly Shopping Storefront Illustration */}
        <div className="relative z-10 mb-5 flex items-center justify-center">
          <StorefrontIllustration className="w-56 h-44 sm:w-64 sm:h-52" />
        </div>

        {/* Heading: “You’re Offline” */}
        <h2 className="relative z-10 text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2.5">
          You’re Offline
        </h2>

        {/* Message: “No internet connection. Some features may be limited, but you can still browse your saved items and cart.” */}
        <p className="relative z-10 text-xs sm:text-sm text-gray-600 font-medium max-w-md mx-auto mb-6 leading-relaxed">
          No internet connection. Some features may be limited, but you can still browse your saved items and cart.
        </p>

        {/* Green outlined “Try Again” button */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={busy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 text-emerald-700 font-black text-xs sm:text-sm rounded-2xl transition-all active:scale-95 cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-600 ${busy ? 'animate-spin' : ''}`} />
            <span>{busy ? 'Checking Connection...' : 'Try Again'}</span>
          </button>

          {/* Direct shortcut to saved cart */}
          {cartItemCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>View Saved Cart ({cartItemCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Saved Storage Confirmation Banner */}
        <div className="relative z-10 mt-6 pt-4 border-t border-gray-200/60 flex items-center justify-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50/70 py-2 px-3 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Your cached categories and saved offline items are securely preserved.</span>
        </div>
      </div>
    </section>
  );
}


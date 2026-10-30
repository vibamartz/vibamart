import React, { useState } from 'react';
import { ShoppingBag, ShieldCheck, RefreshCw, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { CartDisconnectedIllustration } from './OfflineIllustrations';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useNavigate } from 'react-router-dom';

interface CartOfflineBannerProps {
  onContinueShopping?: () => void;
}

export default function CartOfflineBanner({ onContinueShopping }: CartOfflineBannerProps) {
  const { retryConnection, isRetrying } = useNetworkStatus();
  const [localRetrying, setLocalRetrying] = useState(false);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (onContinueShopping) {
      onContinueShopping();
    } else {
      navigate('/');
    }
  };

  const handleRetry = async () => {
    setLocalRetrying(true);
    try {
      await retryConnection();
    } finally {
      setLocalRetrying(false);
    }
  };

  const busy = isRetrying || localRetrying;

  return (
    <div className="w-full bg-gradient-to-br from-[#FAF7F2] via-white to-[#FDF8F3] rounded-3xl p-5 sm:p-7 border border-emerald-900/10 shadow-sm relative overflow-hidden select-none mb-4">
      {/* Soft Background Tint Blobs */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-orange-100/50 blur-xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-emerald-100/40 blur-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-5 sm:gap-6">
        {/* Shopping Cart Illustration with Disconnected Wi-Fi Icon */}
        <div className="shrink-0 flex items-center justify-center">
          <CartDisconnectedIllustration className="w-36 h-32 sm:w-44 sm:h-36" />
        </div>

        {/* Content & Actions */}
        <div className="flex-1 text-center md:text-left space-y-2.5 min-w-0">
          {/* Offline Badge */}
          <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200/80 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span>Offline Mode</span>
          </div>

          {/* Heading: “You’re Offline” */}
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            You’re Offline
          </h2>

          {/* Message: “Your cart is saved. Some features may be limited until you’re back online.” */}
          <p className="text-xs sm:text-sm text-gray-600 font-medium leading-relaxed max-w-lg">
            Your cart is saved. Some features may be limited until you’re back online.
          </p>

          {/* Confirmation Message: “Your cart items are safely saved on your device.” */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/90 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Your cart items are safely saved on your device.</span>
          </div>

          {/* Buttons: Green “Continue Shopping” button and Check Connection */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            {/* Green “Continue Shopping” button */}
            <button
              type="button"
              onClick={handleContinue}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </button>

            {/* Check Connection Retry */}
            <button
              type="button"
              onClick={handleRetry}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${busy ? 'animate-spin' : ''}`} />
              <span>{busy ? 'Checking...' : 'Check Connection'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


import React from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import CartOfflineIllustration from './CartOfflineIllustration';
import { useNetworkStore } from './useNetworkStore';
import toast from 'react-hot-toast';

interface OfflineCartBannerProps {
  className?: string;
  onRetry?: () => void;
}

export default function OfflineCartBanner({ className = '', onRetry }: OfflineCartBannerProps) {
  const navigate = useNavigate();
  const { checkConnectivity, isChecking } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline) {
      toast.success('Connection restored!');
      if (onRetry) {
        onRetry();
      }
    } else {
      toast.error("You're still offline.");
    }
  };

  return (
    <div
      className={`w-full bg-[#FAF7F2] border border-amber-200/80 rounded-3xl p-5 sm:p-7 shadow-xs relative overflow-hidden select-none mb-6 ${className}`}
    >
      {/* Decorative soft gradient blobs */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
        {/* Shopping cart illustration with disconnected Wi-Fi icon */}
        <div className="shrink-0 flex items-center justify-center">
          <CartOfflineIllustration size={140} />
        </div>

        {/* Text Content */}
        <div className="flex-1 text-center md:text-left space-y-2.5">
          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            You’re Offline
          </h2>

          {/* Message */}
          <p className="text-xs sm:text-sm font-medium text-gray-600 max-w-xl leading-relaxed">
            Your cart is saved. Some features may be limited until you’re back online.
          </p>

          {/* Confirmation Message */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-xs sm:text-sm font-semibold shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Your cart items are safely saved on your device.</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
            {/* Green "Continue Shopping" button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-full shadow-sm shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Continue Shopping</span>
            </motion.button>

            {/* Check Connection Button */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleRetry}
              disabled={isChecking}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold text-xs sm:text-sm rounded-full transition-all cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking...' : 'Check Connection'}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}


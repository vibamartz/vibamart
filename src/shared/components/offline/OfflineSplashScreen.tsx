import React from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../../../desktop/components/Logo';
import ShoppingBagWifiIllustration from './ShoppingBagWifiIllustration';
import { useNetworkStore } from './useNetworkStore';
import toast from 'react-hot-toast';

interface OfflineSplashScreenProps {
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function OfflineSplashScreen({ onRetry, onDismiss, className = '' }: OfflineSplashScreenProps) {
  const { checkConnectivity, isChecking } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline) {
      toast.success('Connection restored!');
      if (onRetry) {
        onRetry();
      } else if (onDismiss) {
        onDismiss();
      } else {
        window.location.reload();
      }
    } else {
      toast.error("You're still offline. Check your connection.");
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#FAF7F2] text-gray-800 flex flex-col justify-between items-center relative overflow-hidden px-4 py-8 sm:py-12 select-none ${className}`}
    >
      {/* Soft Orange & Green Decorative Shapes */}
      <div className="absolute top-[-100px] right-[-80px] w-72 h-72 rounded-full bg-emerald-500/12 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-80px] w-80 h-80 rounded-full bg-orange-500/12 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-[-60px] w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Subtle Floating Shapes */}
      <div className="absolute top-24 left-12 w-5 h-5 rounded-full bg-emerald-600/15 pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-4 h-4 rounded-full bg-orange-500/20 pointer-events-none" />
      <div className="absolute bottom-28 left-20 w-6 h-6 rounded-full bg-amber-500/20 pointer-events-none" />
      <div className="absolute bottom-24 right-14 w-8 h-8 rounded-full bg-emerald-600/10 pointer-events-none" />

      {/* Spacer Top */}
      <div className="w-full h-2" />

      {/* Center Section: ViBa Mart Logo ABOVE Shopping Bag Illustration */}
      <main className="relative z-10 w-full max-w-sm flex flex-col items-center text-center px-4 my-auto">
        {/* ViBa Mart Logo at center above illustration */}
        <div className="mb-6 scale-110 sm:scale-125 transform transition-transform">
          <Logo showTextOnMobile={true} />
        </div>

        {/* Friendly Shopping Bag Illustration with disconnected Wi-Fi symbol */}
        <div className="mb-6">
          <ShoppingBagWifiIllustration size={170} />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          Stay Connected
        </h1>

        {/* Message */}
        <p className="text-sm sm:text-base font-medium text-gray-600 max-w-xs leading-relaxed mb-7">
          We’ll be back online soon!
        </p>

        {/* Green rounded "Try Again" button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-primary hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm sm:text-base rounded-full shadow-md shadow-emerald-700/20 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </motion.button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 text-xs font-bold text-emerald-800/80 hover:text-emerald-900 underline underline-offset-4 cursor-pointer"
          >
            Browse saved items offline →
          </button>
        )}
      </main>

      {/* Bottom text: Shop • Save • Smile */}
      <footer className="relative z-10 pt-4 text-xs sm:text-sm font-extrabold text-emerald-800/80 tracking-widest uppercase">
        Shop • Save • Smile
      </footer>
    </div>
  );
}

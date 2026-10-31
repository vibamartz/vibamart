import React from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../../../desktop/components/Logo';
import WifiDisconnectedIllustration from './WifiDisconnectedIllustration';
import { useNetworkStore } from './useNetworkStore';
import toast from 'react-hot-toast';

interface NoInternetScreenProps {
  onRetry?: () => void;
  className?: string;
}

export default function NoInternetScreen({ onRetry, className = '' }: NoInternetScreenProps) {
  const { checkConnectivity, isChecking } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline) {
      toast.success('Connection restored!');
      if (onRetry) {
        onRetry();
      } else {
        window.location.reload();
      }
    } else {
      toast.error("You're still offline. Check your connection.");
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#FAF7F2] text-gray-800 flex flex-col justify-between items-center relative overflow-hidden px-4 py-8 sm:py-12 select-none ${className}`}
    >
      {/* Decorative Organic Elements (Green & Orange) */}
      <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-[-60px] w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-60px] left-1/3 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

      {/* Floating Accent Shapes */}
      <div className="absolute top-20 right-12 w-6 h-6 rounded-full bg-emerald-600/15 pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-4 h-4 rounded-full bg-orange-500/20 pointer-events-none" />
      <div className="absolute bottom-32 right-16 w-5 h-5 rounded-full bg-amber-500/20 pointer-events-none" />
      <div className="absolute bottom-20 left-16 w-8 h-8 rounded-full bg-emerald-600/10 pointer-events-none" />

      {/* Header: ViBa Mart logo at the top */}
      <header className="relative z-10 w-full max-w-md flex justify-center pt-2">
        <Logo showTextOnMobile={true} className="scale-105 sm:scale-110" />
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-md flex flex-col items-center text-center px-4 my-auto">
        {/* Centered Wi-Fi disconnected illustration */}
        <div className="mb-6">
          <WifiDisconnectedIllustration size={170} />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
          No Internet Connection
        </h1>

        {/* Message */}
        <p className="text-sm sm:text-base font-medium text-gray-600 max-w-xs sm:max-w-sm leading-relaxed mb-8">
          You’re offline. Check your connection and try again.
        </p>

        {/* Green rounded "Try Again" button with a refresh icon */}
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
      </main>

      {/* Footer Branding subtle line */}
      <footer className="relative z-10 pt-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
        ViBa Mart • Premium Lifestyle
      </footer>
    </div>
  );
}


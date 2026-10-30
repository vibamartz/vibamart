import React, { useState } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { ShoppingBagDisconnectedIllustration } from './OfflineIllustrations';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface OfflineSplashScreenProps {
  onRetrySuccess?: () => void;
  onContinueOffline?: () => void;
}

export default function OfflineSplashScreen({ onRetrySuccess, onContinueOffline }: OfflineSplashScreenProps) {
  const { retryConnection, isRetrying } = useNetworkStatus();
  const [localRetrying, setLocalRetrying] = useState(false);

  const handleRetry = async () => {
    setLocalRetrying(true);
    try {
      const restored = await retryConnection();
      if (restored) {
        if (onRetrySuccess) {
          onRetrySuccess();
        } else {
          window.location.reload();
        }
      }
    } finally {
      setLocalRetrying(false);
    }
  };

  const busy = isRetrying || localRetrying;

  return (
    <div
      className="fixed inset-0 z-[99999] flex flex-col justify-between items-center px-4 py-8 sm:py-12 bg-[#FAF7F2] select-none font-sans overflow-hidden"
      style={{
        backgroundColor: '#FAF7F2',
        backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(22, 163, 74, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(234, 88, 12, 0.08) 0%, transparent 40%)'
      }}
    >
      {/* Soft Orange & Green Decorative Shapes */}
      <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-orange-200/30 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-40px] left-[-40px] w-64 h-64 rounded-full bg-emerald-200/35 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-4 w-28 h-28 rounded-full bg-yellow-200/25 blur-2xl pointer-events-none" />
      <div className="absolute top-1/3 right-8 w-24 h-24 rounded-full bg-emerald-100/40 blur-2xl pointer-events-none" />

      {/* Decorative Dots */}
      <div className="absolute top-14 left-10 w-3 h-3 rounded-full bg-emerald-500/25 animate-pulse pointer-events-none" />
      <div className="absolute top-28 right-12 w-2.5 h-2.5 rounded-full bg-orange-500/30 pointer-events-none" />
      <div className="absolute bottom-24 right-16 w-3 h-3 rounded-full bg-orange-400/25 pointer-events-none" />
      <div className="absolute bottom-32 left-14 w-2 h-2 rounded-full bg-emerald-600/30 pointer-events-none" />

      {/* Empty Top Anchor (for balanced flex-between) */}
      <div className="w-full max-w-sm h-4" />

      {/* Center Container: Logo above Friendly Shopping Bag Illustration with Disconnected Wi-Fi Symbol */}
      <main className="relative z-10 w-full max-w-md flex flex-col items-center text-center my-auto px-4">
        {/* ViBa Mart Logo Centered */}
        <div className="mb-4 transform transition-transform hover:scale-105">
          <Logo showTextOnMobile={true} className="scale-120 sm:scale-135" />
        </div>

        {/* Friendly Shopping Bag Illustration with Disconnected Wi-Fi Symbol */}
        <div className="my-3 transform transition-transform hover:scale-102">
          <ShoppingBagDisconnectedIllustration className="w-56 h-56 sm:w-64 sm:h-64" />
        </div>

        {/* Heading: “Stay Connected” */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          Stay Connected
        </h1>

        {/* Message: “We’ll be back online soon!” */}
        <p className="text-sm sm:text-base text-gray-600 font-semibold mb-8 max-w-xs">
          We’ll be back online soon!
        </p>

        {/* Green rounded “Try Again” button */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={handleRetry}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm sm:text-base rounded-full shadow-lg shadow-emerald-600/30 transition-all transform active:scale-95 cursor-pointer disabled:opacity-70 focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
          >
            <RefreshCw className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} />
            <span>{busy ? 'Checking Connection...' : 'Try Again'}</span>
          </button>

          {/* Option to browse cached content */}
          {onContinueOffline && (
            <button
              type="button"
              onClick={onContinueOffline}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-900 hover:underline py-1 flex items-center gap-1 cursor-pointer"
            >
              <span>Browse Saved Content Offline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </main>

      {/* Bottom Text: “Shop • Save • Smile” */}
      <footer className="relative z-10 pb-2 sm:pb-4 text-center">
        <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-800/80 uppercase">
          Shop • Save • Smile
        </p>
      </footer>
    </div>
  );
}


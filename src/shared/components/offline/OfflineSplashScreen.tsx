import React from 'react';
import { RotateCw, ArrowRight } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';
import { ShoppingBagOfflineIllustration, DecorativeBackgroundElements } from './illustrations';

interface OfflineSplashScreenProps {
  onRetrySuccess?: () => void;
  onContinueOffline?: () => void;
  className?: string;
}

export default function OfflineSplashScreen({
  onRetrySuccess,
  onContinueOffline,
  className = '',
}: OfflineSplashScreenProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between py-12 px-6 bg-[#FAF7F2] relative overflow-hidden select-none text-center ${className}`}
    >
      {/* Cream background with soft orange and green decorative shapes */}
      <DecorativeBackgroundElements />

      {/* Top spacing / subtle indicator */}
      <div className="relative z-10 w-full max-w-sm flex justify-center pt-2">
        <span className="text-[11px] font-bold text-emerald-800/70 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/50 uppercase tracking-wider">
          ViBa Mart Offline Mode
        </span>
      </div>

      {/* Center: Centered ViBa Mart logo above friendly shopping bag illustration with disconnected Wi-Fi symbol */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto py-4">
        {/* Centered ViBa Mart logo */}
        <div className="mb-4">
          <Logo showTextOnMobile={true} className="scale-115 sm:scale-125" />
        </div>

        {/* Friendly shopping bag illustration with disconnected Wi-Fi symbol */}
        <ShoppingBagOfflineIllustration className="w-48 h-48 sm:w-56 sm:h-56 mb-4" />

        {/* Heading: “Stay Connected” */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          Stay Connected
        </h1>

        {/* Message: “We’ll be back online soon!” */}
        <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed mb-6">
          We’ll be back online soon!
        </p>

        {/* Green rounded “Try Again” button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-3"
        >
          <RotateCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>

        {/* Optional continue offline button if user wants to browse saved items immediately */}
        {onContinueOffline && (
          <button
            onClick={onContinueOffline}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-emerald-700 transition-colors py-2 px-3 rounded-lg hover:bg-black/5"
          >
            <span>Browse saved items offline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom text: “Shop • Save • Smile” */}
      <div className="relative z-10 pb-4">
        <p className="text-sm sm:text-base font-extrabold text-gray-700 tracking-widest uppercase">
          Shop • Save • Smile
        </p>
      </div>
    </div>
  );
}


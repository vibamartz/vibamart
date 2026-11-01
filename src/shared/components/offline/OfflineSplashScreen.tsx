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
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-between py-6 px-4 sm:py-8 sm:px-6 bg-[#FAF7F2] relative overflow-hidden select-none text-center z-[9999] ${className}`}
    >
      {/* Cream background with soft orange and green decorative shapes */}
      <DecorativeBackgroundElements />

      {/* Top spacer */}
      <div className="relative z-10 shrink-0 h-4 sm:h-6" />

      {/* Center: ViBa Mart logo above friendly shopping bag illustration with disconnected Wi-Fi symbol */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto py-2 px-4">
        {/* Centered ViBa Mart logo */}
        <div className="mb-2 sm:mb-3 shrink-0">
          <Logo showTextOnMobile={true} className="scale-105 sm:scale-120" />
        </div>

        {/* Friendly shopping bag illustration with disconnected Wi-Fi symbol */}
        <ShoppingBagOfflineIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 max-h-[25vh] mb-3 sm:mb-4 shrink-0" />

        {/* Heading: “Stay Connected” */}
        <h1 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1.5 sm:mb-2">
          Stay Connected
        </h1>

        {/* Message: “We’ll be back online soon!” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">
          We’ll be back online soon!
        </p>

        {/* Green rounded “Try Again” button */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3 sm:px-9 sm:py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mb-2.5"
        >
          <RotateCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>

        {/* Optional continue offline button if user wants to browse saved items immediately */}
        {onContinueOffline && (
          <button
            onClick={onContinueOffline}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-emerald-700 transition-colors py-1 px-3 rounded-lg hover:bg-black/5"
          >
            <span>Browse saved items offline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bottom text: “Shop • Save • Smile” */}
      <div className="relative z-10 pb-2 sm:pb-3 shrink-0">
        <p className="text-xs sm:text-sm font-extrabold text-gray-700 tracking-widest uppercase">
          Shop • Save • Smile
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import { RotateCw } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { useNetworkStore } from '../../utilities/networkStatus';
import { WifiDisconnectedIllustration, DecorativeBackgroundElements } from './illustrations';

interface NoInternetScreenProps {
  onRetrySuccess?: () => void;
  className?: string;
}

export default function NoInternetScreen({ onRetrySuccess, className = '' }: NoInternetScreenProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`min-h-[85vh] w-full flex flex-col items-center justify-between py-10 px-6 bg-[#FAF7F2] relative overflow-hidden text-center select-none ${className}`}
    >
      {/* Decorative background shapes */}
      <DecorativeBackgroundElements />

      {/* Top: ViBa Mart Logo */}
      <div className="relative z-10 pt-2 sm:pt-4">
        <Logo showTextOnMobile={true} className="scale-105 sm:scale-115" />
      </div>

      {/* Center: Centered Wi-Fi disconnected illustration & messages */}
      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto my-auto py-8">
        <WifiDisconnectedIllustration className="w-48 h-48 sm:w-56 sm:h-56 mb-6" />

        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
          No Internet Connection
        </h1>

        <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed px-4 mb-8">
          You’re offline. Check your connection and try again.
        </p>

        {/* Green rounded "Try Again" button with refresh icon */}
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-900/20 transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          <RotateCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </button>
      </div>

      {/* Bottom spacer / subtle branding note */}
      <div className="relative z-10 pb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          ViBa Mart Offline Mode
        </span>
      </div>
    </div>
  );
}


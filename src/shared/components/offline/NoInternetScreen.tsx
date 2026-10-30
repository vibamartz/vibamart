import React, { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { WifiDisconnectedIllustration } from './OfflineIllustrations';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useNavigate } from 'react-router-dom';

interface NoInternetScreenProps {
  onRetry?: () => Promise<boolean> | void;
  fullScreen?: boolean;
}

export default function NoInternetScreen({ onRetry, fullScreen = true }: NoInternetScreenProps) {
  const { retryConnection, isRetrying } = useNetworkStatus();
  const [localRetrying, setLocalRetrying] = useState(false);
  const navigate = useNavigate();

  const handleRetry = async () => {
    setLocalRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        const restored = await retryConnection();
        if (restored) {
          // If connection was restored, we can navigate to home or reload current view
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
      className={`relative w-full ${
        fullScreen ? 'min-h-screen' : 'min-h-[550px]'
      } bg-[#FAF7F2] text-gray-900 flex flex-col justify-between items-center px-4 py-8 sm:py-12 overflow-hidden select-none font-sans`}
      style={{
        backgroundColor: '#FAF7F2',
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(22, 163, 74, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(234, 88, 12, 0.06) 0%, transparent 40%)'
      }}
    >
      {/* Decorative Green & Orange Background Shapes */}
      <div className="absolute top-[-40px] left-[-40px] w-48 h-48 rounded-full bg-emerald-200/35 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-30px] right-[-30px] w-56 h-56 rounded-full bg-orange-200/35 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-4 w-20 h-20 rounded-full bg-yellow-200/30 blur-2xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-6 w-16 h-16 rounded-full bg-emerald-200/25 blur-2xl pointer-events-none" />

      {/* Floating Decorative Dots / Accents */}
      <div className="absolute top-20 left-12 w-3 h-3 rounded-full bg-emerald-500/30 animate-pulse pointer-events-none" />
      <div className="absolute top-36 right-16 w-2.5 h-2.5 rounded-full bg-orange-500/40 pointer-events-none" />
      <div className="absolute bottom-28 left-20 w-3 h-3 rounded-full bg-orange-400/30 pointer-events-none" />
      <div className="absolute bottom-36 right-14 w-2 h-2 rounded-full bg-emerald-600/30 animate-ping pointer-events-none" />

      {/* Top Header: ViBa Mart Logo */}
      <header className="relative z-10 w-full max-w-md flex flex-col items-center justify-center pt-2 sm:pt-4">
        <div 
          onClick={() => navigate('/')} 
          className="cursor-pointer transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Logo showTextOnMobile={true} className="scale-105 sm:scale-110" />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-md my-auto flex flex-col items-center text-center px-4 py-6">
        {/* Centered Wi-Fi disconnected illustration */}
        <div className="mb-6 transform transition-transform hover:scale-102">
          <WifiDisconnectedIllustration className="w-52 h-52 sm:w-60 sm:h-60" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-3">
          No Internet Connection
        </h1>

        {/* Message */}
        <p className="text-sm sm:text-base text-gray-600 font-medium max-w-xs sm:max-w-sm mb-8 leading-relaxed">
          You’re offline. Check your connection and try again.
        </p>

        {/* Green rounded “Try Again” button with a refresh icon */}
        <button
          type="button"
          onClick={handleRetry}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70 text-white font-bold text-sm sm:text-base rounded-full shadow-lg shadow-emerald-600/25 transition-all transform active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
        >
          <RefreshCw className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} />
          <span>{busy ? 'Checking Connection...' : 'Try Again'}</span>
        </button>
      </main>

      {/* Footer Branding Note */}
      <footer className="relative z-10 pt-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>ViBa Mart</span>
          <span className="text-gray-300">•</span>
          <span>Offline Protection</span>
        </div>
      </footer>
    </div>
  );
}


import React, { useState } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import NoInternetScreen from './NoInternetScreen';
import HomeOfflineSection from './HomeOfflineSection';
import CartOfflineBanner from './CartOfflineBanner';
import OfflineSplashScreen from './OfflineSplashScreen';
import { WifiOff, Wifi, Eye, RefreshCw, Smartphone, Monitor, ShoppingBag, ShoppingCart, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfflinePreviewPage() {
  const { isOnline, simulatedOffline, setSimulatedOffline } = useNetworkStatus();
  const [activeTab, setActiveTab] = useState<'screen1' | 'screen2' | 'screen3' | 'screen4'>('screen1');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');
  const [showSplashPreview, setShowSplashPreview] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans pb-16">
      {/* Top Banner Control Panel */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
              <h1 className="text-lg font-black text-gray-900">ViBa Mart • Offline Screens Preview</h1>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              Review and test all four offline screens with functional retry and device previews.
            </p>
          </div>

          {/* Offline Toggle & Simulation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSimulatedOffline(!simulatedOffline)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                simulatedOffline
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {simulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{simulatedOffline ? 'Simulating Offline' : 'Simulate Offline'}</span>
            </button>

            {/* Viewport switch */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  deviceMode === 'mobile' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
                }`}
                title="Mobile Frame"
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  deviceMode === 'desktop' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
            </div>

            <button
              onClick={() => navigate('/')}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold cursor-pointer"
            >
              Go to Store
            </button>
          </div>
        </div>

        {/* Tab selection */}
        <div className="max-w-6xl mx-auto mt-3 flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
          <button
            onClick={() => { setActiveTab('screen1'); setShowSplashPreview(false); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'screen1'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>1. No Internet Connection Screen</span>
          </button>

          <button
            onClick={() => { setActiveTab('screen2'); setShowSplashPreview(false); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'screen2'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>2. Home Screen (Offline)</span>
          </button>

          <button
            onClick={() => { setActiveTab('screen3'); setShowSplashPreview(false); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'screen3'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>3. Cart Screen (Offline)</span>
          </button>

          <button
            onClick={() => { setActiveTab('screen4'); setShowSplashPreview(false); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'screen4'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>4. Offline Splash Screen</span>
          </button>
        </div>
      </div>

      {/* Main Preview Stage */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col items-center">
        {/* Tab Description Card */}
        <div className="w-full max-w-3xl mb-4 bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs text-xs sm:text-sm text-gray-600">
          {activeTab === 'screen1' && (
            <div>
              <strong className="text-gray-900 block text-sm">Screen 1: No Internet Connection Screen</strong>
              Cream background with green and orange decorative elements, ViBa Mart logo at top, centered Wi-Fi disconnected illustration, “No Internet Connection” heading, “You’re offline. Check your connection and try again.” message, and green rounded “Try Again” button with refresh icon.
            </div>
          )}
          {activeTab === 'screen2' && (
            <div>
              <strong className="text-gray-900 block text-sm">Screen 2: Home Screen (Offline)</strong>
              Keeps the ViBa Mart logo, search bar, cached categories, and bottom navigation. Displays a friendly shopping storefront illustration, “You’re Offline” heading, “No internet connection. Some features may be limited, but you can still browse your saved items and cart.” message, and green outlined “Try Again” button.
            </div>
          )}
          {activeTab === 'screen3' && (
            <div>
              <strong className="text-gray-900 block text-sm">Screen 3: Cart Screen (Offline)</strong>
              Preserves the existing cart layout and saved cart items. Displays a shopping cart illustration with a disconnected Wi-Fi icon, “You’re Offline” heading, “Your cart is saved. Some features may be limited until you’re back online.” message, green “Continue Shopping” button, and confirmation: “Your cart items are safely saved on your device.”
            </div>
          )}
          {activeTab === 'screen4' && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <strong className="text-gray-900 block text-sm">Screen 4: Offline Splash Screen</strong>
                Cream background with soft orange and green decorative shapes, ViBa Mart logo centered above friendly shopping bag illustration with disconnected Wi-Fi symbol, “Stay Connected” heading, “We’ll be back online soon!” message, green rounded “Try Again” button, and “Shop • Save • Smile” bottom text.
              </div>
              <button
                onClick={() => setShowSplashPreview(!showSplashPreview)}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {showSplashPreview ? 'Close Fullscreen' : 'View Fullscreen'}
              </button>
            </div>
          )}
        </div>

        {/* Viewport Frame */}
        <div
          className={`w-full transition-all duration-300 ${
            deviceMode === 'mobile'
              ? 'max-w-[420px] rounded-[36px] border-[10px] border-gray-800 shadow-2xl bg-white overflow-hidden min-h-[720px]'
              : 'max-w-5xl rounded-2xl border border-gray-200 shadow-lg bg-white overflow-hidden min-h-[600px]'
          }`}
        >
          {/* Active Screen Rendering */}
          {activeTab === 'screen1' && (
            <NoInternetScreen fullScreen={false} />
          )}

          {activeTab === 'screen2' && (
            <div className="bg-white min-h-[600px] flex flex-col">
              {/* Mock Header for Context */}
              <div className="bg-gradient-to-r from-emerald-100/60 to-yellow-100/60 p-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-black text-gray-800 italic">ViBa Mart</span>
                <span className="text-[10px] font-bold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  Cached Categories Active
                </span>
              </div>
              <HomeOfflineSection />
            </div>
          )}

          {activeTab === 'screen3' && (
            <div className="p-4 bg-gray-50 min-h-[600px]">
              <CartOfflineBanner />
              {/* Preserved Cart Layout Mock Items */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-xs font-black uppercase text-gray-800">Saved Items on Device</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Local Device Storage
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
                    🛍️
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-900">Saved Product in Device Cart</p>
                    <p className="text-[11px] text-gray-500">Ready for checkout when reconnected</p>
                    <p className="text-xs font-black text-emerald-700 mt-0.5">₹499</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'screen4' && (
            <div className="relative min-h-[700px] bg-[#FAF7F2]">
              <OfflineSplashScreen
                onRetrySuccess={() => {}}
                onContinueOffline={() => navigate('/')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Splash Preview overlay when toggled */}
      {showSplashPreview && (
        <OfflineSplashScreen
          onRetrySuccess={() => setShowSplashPreview(false)}
          onContinueOffline={() => setShowSplashPreview(false)}
        />
      )}
    </div>
  );
}


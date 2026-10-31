import React, { useState } from 'react';
import { Search, ShoppingCart, Heart, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Logo from '../../../desktop/components/Logo';
import StorefrontIllustration from './StorefrontIllustration';
import { useNetworkStore } from './useNetworkStore';
import { useCartStore, useAuthStore } from '../../../backend/store';
import toast from 'react-hot-toast';

interface OfflineHomeScreenProps {
  onRetry?: () => void;
  className?: string;
  showEmbeddedTopNav?: boolean;
}

export default function OfflineHomeScreen({
  onRetry,
  className = '',
  showEmbeddedTopNav = true,
}: OfflineHomeScreenProps) {
  const navigate = useNavigate();
  const { checkConnectivity, isChecking } = useNetworkStore();
  const { items } = useCartStore();
  const { user } = useAuthStore();
  const [offlineSearchQuery, setOfflineSearchQuery] = useState('');

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = user?.wishlist?.length || 0;

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (offlineSearchQuery.trim()) {
      toast('You are offline. Search will run with full results once connection returns.', {
        icon: 'ℹ️',
      });
    }
  };

  return (
    <div
      className={`min-h-[80vh] flex flex-col items-center justify-between bg-white text-gray-800 select-none px-4 py-6 sm:py-10 ${className}`}
    >
      {/* 1. Header with ViBa Mart logo and Search Bar */}
      {showEmbeddedTopNav && (
        <header className="w-full max-w-xl flex flex-col gap-4 mb-6">
          {/* Logo Bar */}
          <div className="flex items-center justify-between w-full">
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <Logo showTextOnMobile={true} className="scale-100" />
            </div>

            {/* Quick Saved Items & Cart icons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/wishlist')}
                className="relative p-2.5 text-gray-600 hover:text-rose-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Saved Items"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="relative p-2.5 text-gray-600 hover:text-emerald-700 rounded-full hover:bg-emerald-50 transition-colors"
                title="Saved Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Search className="w-4 h-4 text-emerald-600" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={offlineSearchQuery}
              onChange={(e) => setOfflineSearchQuery(e.target.value)}
              className="w-full bg-gray-50 hover:bg-white focus:bg-white h-12 rounded-2xl pl-11 pr-4 text-sm font-semibold text-gray-900 placeholder-gray-400 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            />
          </form>
        </header>
      )}

      {/* 2. Main Friendly Storefront Offline Content */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto px-2">
        {/* Friendly Shopping Storefront Illustration */}
        <div className="mb-4 sm:mb-6">
          <StorefrontIllustration size={190} />
        </div>

        {/* Heading */}
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          You’re Offline
        </h1>

        {/* Message */}
        <p className="text-sm sm:text-base font-medium text-gray-600 max-w-sm leading-relaxed mb-6">
          No internet connection. Some features may be limited, but you can still browse your saved items and cart.
        </p>

        {/* Green Outlined "Try Again" Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={handleRetry}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-transparent border-2 border-primary text-primary hover:bg-emerald-50 active:bg-emerald-100 font-bold text-sm sm:text-base rounded-full transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mb-6 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
        </motion.button>

        {/* Saved Cart & Items Quick Actions */}
        <div className="w-full grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/80 border border-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold transition-all"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <span>Saved Cart ({cartCount})</span>
          </button>
          <button
            onClick={() => navigate('/wishlist')}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-100 text-amber-900 text-xs sm:text-sm font-bold transition-all"
          >
            <Heart className="w-4 h-4 text-amber-600" />
            <span>Saved Items</span>
          </button>
        </div>
      </main>

      {/* Decorative Bottom Note */}
      <footer className="pt-6 text-center text-xs font-semibold text-gray-400">
        Saved items and cart remain secure on your device.
      </footer>
    </div>
  );
}


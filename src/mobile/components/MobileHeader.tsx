import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Search, Bell, ShoppingCart, MapPin, ChevronDown, Sparkles 
} from 'lucide-react';
import { useAuthStore, useCartStore } from '../../backend/store';
import { useLocationStore, formatHeaderAddress } from '../../shared/utilities/useLocationStore';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import LocationPickerModal from '../../desktop/components/LocationPickerModal';
import Logo from '../../desktop/components/Logo';
import { motion, AnimatePresence } from 'motion/react';

interface MobileHeaderProps {
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
}

export default function MobileHeader({ onOpenSearch, onOpenNotifications }: MobileHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const { selectedAddress } = useLocationStore();

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  const isHomePage = location.pathname === '/' || location.pathname === '/mobile-home' || location.pathname === '/mobile';
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  // Fetch unread notifications for logged-in user
  useEffect(() => {
    if (!user) {
      setUnreadNotifCount(0);
      return;
    }
    const q = query(
      collection(db, 'user_notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifCount(snapshot.size);
    }, () => {
      setUnreadNotifCount(0);
    });
    return () => unsubscribe();
  }, [user]);

  if (isHomePage) {
    return null;
  }

  const handleLocationSelect = () => {
    setIsLocationModalOpen(false);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/products')) return 'Categories & Products';
    if (path.startsWith('/product/')) return 'Product Details';
    if (path === '/cart') return 'My Cart';
    if (path === '/checkout') return 'Checkout';
    if (path === '/order-success') return 'Order Confirmed';
    if (path === '/profile') return 'My Account';
    if (path === '/wishlist') return 'My Wishlist';
    if (path.startsWith('/track-order') || path === '/orders') return 'My Orders';
    if (path.startsWith('/returns') || path.startsWith('/track-request')) return 'Requests & Returns';
    if (path === '/notifications') return 'Notifications';
    if (path === '/offers') return 'Deals & Offers';
    if (path === '/rewards') return 'ViBa Rewards & Points';
    if (path === '/login') return 'Account Login';
    return 'ViBa Mart';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-yellow-100 shadow-sm transition-all" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex items-center justify-between px-3.5 py-2.5 max-w-[768px] mx-auto w-full min-w-0">
        
        {/* Left Side: Back button on inner pages OR Logo on home */}
        <div className="flex items-center gap-2 min-w-0">
          {!isHomePage ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              aria-label="Go Back"
              className="p-2 touch-target text-gray-700 hover:text-emerald-700 bg-gray-100/80 rounded-full transition-all shrink-0"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </motion.button>
          ) : (
            <div 
              onClick={() => navigate('/')}
              className="cursor-pointer shrink-0"
            >
              <Logo className="h-7 w-auto" />
            </div>
          )}

          {/* Page Title or Location display */}
          {!isHomePage ? (
            <h1 className="text-sm font-extrabold text-gray-900 truncate">
              {getPageTitle()}
            </h1>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center gap-1 bg-yellow-50/90 border border-yellow-200/70 px-2.5 py-1 rounded-full text-left max-w-[180px] min-w-0"
            >
              <MapPin className="w-3.5 h-3.5 text-yellow-600 shrink-0 fill-yellow-100" />
              <span className="text-[10px] font-bold text-gray-800 truncate whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                {formatHeaderAddress(selectedAddress)}
              </span>
              <ChevronDown className="w-3 h-3 text-yellow-500 shrink-0 ml-0.5" />
            </motion.button>
          )}
        </div>

        {/* Right Side Actions: Search, Notifications, Cart */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search Trigger */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onOpenSearch ? onOpenSearch() : navigate('/products?search=open')}
            aria-label="Search"
            className="p-2 touch-target text-gray-700 hover:text-emerald-600 rounded-full hover:bg-gray-100 transition-all"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </motion.button>

          {/* Notifications Bell */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onOpenNotifications ? onOpenNotifications() : navigate('/notifications')}
            aria-label="Notifications"
            className="relative p-2 touch-target text-gray-700 hover:text-emerald-600 rounded-full hover:bg-gray-100 transition-all"
          >
            <Bell className="w-5 h-5 stroke-[2.2]" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </motion.button>

          {/* Cart Icon */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/cart')}
            aria-label="View Cart"
            className="relative p-2 touch-target text-emerald-700 hover:text-emerald-800 bg-emerald-50 rounded-full border border-emerald-200/60 transition-all"
          >
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-yellow-500 text-gray-950 text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </motion.button>
        </div>

      </div>

      {/* Location Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={handleLocationSelect}
      />
    </header>
  );
}

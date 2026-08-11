import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, Flame, User, ShoppingCart } from 'lucide-react';
import { useCartStore, useAuthStore } from '../../backend/store';
import { motion } from 'motion/react';

export default function MobileBottomNav() {
  const location = useLocation();
  const { items } = useCartStore();
  const { user } = useAuthStore();

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: Home,
      exact: true
    },
    {
      id: 'categories',
      label: 'Categories',
      path: '/categories',
      icon: LayoutGrid,
      exact: false
    },
    {
      id: 'account',
      label: 'Account',
      path: user ? '/profile' : '/login',
      icon: User,
      exact: false
    },
    {
      id: 'cart',
      label: 'Cart',
      path: '/cart',
      icon: ShoppingCart,
      badge: cartCount > 0 ? (cartCount > 99 ? '99+' : cartCount.toString()) : null,
      exact: false
    }
  ];

  const isTabActive = (item: typeof navItems[0]) => {
    if (item.id === 'home') {
      return location.pathname === '/' || location.pathname === '/mobile-home' || location.pathname === '/mobile';
    }
    if (item.id === 'categories') {
      return location.pathname === '/categories';
    }
    if (item.id === 'account') {
      return location.pathname === '/profile' || location.pathname === '/login' || location.pathname === '/orders' || location.pathname === '/addresses' || location.pathname === '/requests';
    }
    if (item.id === 'cart') {
      return location.pathname === '/cart';
    }
    return location.pathname === item.path;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <nav className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const active = isTabActive(item);
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.path}
              className="relative flex flex-col items-center justify-center py-1 px-2 min-w-[56px] min-h-[48px] touch-target group transition-all duration-200"
            >
              <div className="relative flex items-center justify-center mb-0.5">
                {active ? (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/15 to-orange-500/15 rounded-xl -m-1"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                ) : null}

                {/* Icon styling: ViBa Green + Orange for active */}
                <div className="relative z-10 flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-all duration-200 ${
                      active
                        ? 'text-emerald-600 stroke-[2.4px] scale-110 drop-shadow-[0_2px_4px_rgba(21,128,61,0.2)]'
                        : 'text-gray-400 stroke-[1.8px] group-hover:text-gray-600'
                    }`}
                  />
                  {active && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-ping" />
                  )}
                </div>

                {/* Badge for Cart or item count */}
                {item.badge && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20"
                  >
                    {item.badge}
                  </motion.span>
                )}
              </div>

              {/* Label styling: Blue for active, Dark-gray for inactive */}
              <span
                className={`text-[10px] tracking-tight leading-none transition-all duration-200 ${
                  active
                    ? 'text-blue-600 font-extrabold scale-105'
                    : 'text-gray-500 font-medium group-hover:text-gray-700'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

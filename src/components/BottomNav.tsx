import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid, Bell, User, ShoppingCart } from 'lucide-react';
import { useAuthStore, useCartStore } from '../store';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  const { items } = useCartStore();

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Categories', icon: Grid, path: '/products' },
    { name: 'Notifications', icon: Bell, path: '/profile?tab=waitlist' },
    { name: 'Account', icon: User, path: user ? '/profile' : '/login' },
    { name: 'Cart', icon: ShoppingCart, path: '/cart', badge: cartCount },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] pb-safe">
      <div className="flex justify-around items-center h-[56px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path.split('?')[0]) && item.path !== '/');
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full touch-target gap-1"
            >
              <div className="relative">
                <item.icon
                  className={`w-[22px] h-[22px] transition-colors ${
                    isActive ? 'text-primary fill-primary/10' : 'text-gray-500'
                  }`}
                />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2 bg-secondary text-primary text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center border-2 border-white">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[10px] font-medium mt-0.5 ${
                  isActive ? 'text-primary font-bold' : 'text-gray-500'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

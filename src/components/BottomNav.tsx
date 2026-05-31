import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid, Bell, Heart, User } from 'lucide-react';
import { useAuthStore, useCartStore } from '../store';

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();

  const navItems = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Categories', icon: Grid, path: '/products' },
    { name: 'Notifications', icon: Bell, path: '/profile?tab=waitlist' },
    { name: 'Wishlist', icon: Heart, path: '/wishlist' },
    { name: 'Account', icon: User, path: user ? '/profile' : '/login' },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[100] pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path.split('?')[0]) && item.path !== '/');
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full touch-target gap-1"
            >
              <item.icon
                className={`w-6 h-6 transition-colors ${
                  isActive ? 'text-primary fill-primary/10' : 'text-gray-500'
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
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

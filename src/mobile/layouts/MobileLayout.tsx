import React from 'react';
import { Outlet } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav';

export default function MobileLayout() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#FFF3EB] selection:bg-primary selection:text-white">
      <MobileHeader />
      <main className="flex-1 max-w-md mx-auto w-full pb-16">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

import React from 'react';
import { Outlet } from 'react-router-dom';
import MobileHeader from '../components/MobileHeader';
import MobileBottomNav from '../components/MobileBottomNav';

export default function MobileLayout() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-white selection:bg-primary selection:text-white overflow-x-hidden w-full">
      <MobileHeader />
      <main className="flex-1 w-full max-w-[768px] mx-auto min-w-0 pb-20 sm:pb-24">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  );
}

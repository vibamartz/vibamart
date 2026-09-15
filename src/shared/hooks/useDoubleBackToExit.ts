import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

export function useDoubleBackToExit() {
  const location = useLocation();
  const lastBackTimeRef = useRef<number>(0);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isHome = 
    location.pathname === '/' || 
    location.pathname === '/for-you' || 
    location.pathname === '/mobile' || 
    location.pathname === '/mobile-home' ||
    location.pathname === '/home-mobile';

  useEffect(() => {
    if (!isHome) {
      lastBackTimeRef.current = 0;
      return;
    }

    // Push dummy history state on Home so popping it triggers popstate while staying on Home
    try {
      if (!window.history.state || !window.history.state.isHomeGuard) {
        window.history.pushState({ isHomeGuard: true }, '', window.location.href);
      }
    } catch (_) {}

    const handlePopState = (e: PopStateEvent) => {
      const now = Date.now();
      if (now - lastBackTimeRef.current < 1500) {
        // Double-press within 1.5 seconds -> exit app
        lastBackTimeRef.current = 0;
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }

        const win = window as any;
        if (win.Capacitor?.App?.exitApp) {
          win.Capacitor.App.exitApp();
        } else if (win.navigator?.app?.exitApp) {
          win.navigator.app.exitApp();
        } else {
          // Standard browser behavior fallback: attempt window.close()
          window.close();
        }
      } else {
        // First press on Home -> prevent immediate exit, show toast, set 1.5s window
        lastBackTimeRef.current = now;
        
        // Re-push history guard state to keep user on Home page for next Back press
        try {
          window.history.pushState({ isHomeGuard: true }, '', window.location.href);
        } catch (_) {}

        toast('Press back again to exit', {
          id: 'double-back-exit-toast',
          duration: 1500,
          position: 'bottom-center',
          style: {
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '9999px',
            padding: '10px 22px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
            zIndex: 99999,
          },
          icon: '👋',
        });

        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }

        toastTimeoutRef.current = setTimeout(() => {
          lastBackTimeRef.current = 0;
        }, 1500);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isHome, location.pathname]);
}

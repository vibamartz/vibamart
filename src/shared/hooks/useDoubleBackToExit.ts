import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Displays the bottom "Press Back to Exit" notification with the ViBa Mart VB logo
 */
function showPressBackNotification(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const existingToast = document.getElementById('viba-double-back-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toastEl = document.createElement('div');
  toastEl.id = 'viba-double-back-toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');

  toastEl.style.cssText = `
    position: fixed;
    bottom: max(28px, calc(env(safe-area-inset-bottom, 0px) + 24px));
    left: 50%;
    transform: translate(-50%, 8px);
    z-index: 99999;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    background-color: #1a1a1a;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 9999px;
    padding: 10px 22px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 180ms ease-out, transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
  `;

  // Authentic ViBa Mart VB Logo Mark + "Press Back to Exit" message
  toastEl.innerHTML = `
    <span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0;">
      <svg viewBox="0 0 100 100" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vbToastV" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#22c55e" />
            <stop offset="100%" stop-color="#15803d" />
          </linearGradient>
          <linearGradient id="vbToastB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#facc15" />
            <stop offset="100%" stop-color="#eab308" />
          </linearGradient>
        </defs>
        <path d="M10 25 L38 85 L48 85 L32 25 Z" fill="url(#vbToastV)" />
        <path d="M45 25 L65 85 H70 L50 25 Z" fill="url(#vbToastV)" opacity="0.9" />
        <path d="M55 25 L75 85 H80 L60 25 Z" fill="url(#vbToastB)" opacity="0.9" />
        <path d="M65 25 L88 25 C95 25 100 30 100 38 C100 45 95 50 88 52 C95 54 100 59 100 68 C100 77 95 85 85 85 H70 L90 25 Z" fill="url(#vbToastB)" />
        <path d="M82 42 H88 C90 42 92 40 92 38 C92 36 90 34 88 34 H84 L82 42 Z" fill="white" opacity="0.15" />
        <path d="M78 75 H85 C88 75 90 73 90 68 C90 63 88 61 85 61 H82 L78 75 Z" fill="white" opacity="0.15" />
      </svg>
    </span>
    <span>Press Back to Exit</span>
  `;

  document.body.appendChild(toastEl);

  // Trigger smooth entrance animation
  requestAnimationFrame(() => {
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translate(-50%, 0)';
  });

  return () => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translate(-50%, 8px)';
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 200);
  };
}

export function useDoubleBackToExit() {
  const location = useLocation();
  const lastBackTimeRef = useRef<number>(0);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dismissToastRef = useRef<(() => void) | null>(null);

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
          toastTimeoutRef.current = null;
        }
        if (dismissToastRef.current) {
          dismissToastRef.current();
          dismissToastRef.current = null;
        }

        const win = window as any;
        if (win.Capacitor?.App?.exitApp) {
          win.Capacitor.App.exitApp();
        } else if (win.navigator?.app?.exitApp) {
          win.navigator.app.exitApp();
        } else {
          // Standard browser behavior fallback: attempt window.close()
          window.close();
          setTimeout(() => {
            if (!document.hidden) {
              window.history.back();
            }
          }, 100);
        }
      } else {
        // First press on Home -> prevent immediate exit, show toast at bottom, set 1.5s window
        lastBackTimeRef.current = now;
        
        // Re-push history guard state to keep user on Home page for next Back press
        try {
          window.history.pushState({ isHomeGuard: true }, '', window.location.href);
        } catch (_) {}

        if (dismissToastRef.current) {
          dismissToastRef.current();
        }
        dismissToastRef.current = showPressBackNotification();

        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }

        toastTimeoutRef.current = setTimeout(() => {
          lastBackTimeRef.current = 0;
          if (dismissToastRef.current) {
            dismissToastRef.current();
            dismissToastRef.current = null;
          }
        }, 1500);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (dismissToastRef.current) {
        dismissToastRef.current();
        dismissToastRef.current = null;
      }
    };
  }, [isHome, location.pathname]);
}

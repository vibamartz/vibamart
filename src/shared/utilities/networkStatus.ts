import { create } from 'zustand';
import toast from 'react-hot-toast';

interface NetworkState {
  isOnline: boolean;
  isChecking: boolean;
  setOnline: (status: boolean) => void;
  checkConnectivity: () => Promise<boolean>;
}

// Check initial status safely
const getInitialOnlineStatus = (): boolean => {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true;
};

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: getInitialOnlineStatus(),
  isChecking: false,

  setOnline: (status: boolean) => {
    set({ isOnline: status });
  },

  checkConnectivity: async (): Promise<boolean> => {
    set({ isChecking: true });

    // 1. Basic navigator check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isOnline: false, isChecking: false });
      toast.error("You're still offline. Check your connection and try again.");
      return false;
    }

    // 2. Network ping probe to verify real connectivity
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      // Probe lightweight local static resource or ping
      const probeUrl = `/favicon.svg?_t=${Date.now()}`;
      const response = await fetch(probeUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isReallyOnline = response.ok || response.status === 304 || response.type === 'opaque';
      set({ isOnline: isReallyOnline, isChecking: false });

      if (isReallyOnline) {
        toast.success('Connection restored! You are back online.');
      } else {
        toast.error("You're still offline. Check your connection and try again.");
      }

      return isReallyOnline;
    } catch {
      // In case probe failed or timed out
      // As a fallback check navigator.onLine
      const fallbackOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      set({ isOnline: fallbackOnline, isChecking: false });

      if (fallbackOnline) {
        toast.success('Connection restored! You are back online.');
      } else {
        toast.error("You're still offline. Check your connection and try again.");
      }

      return fallbackOnline;
    }
  },
}));

// Setup global window event listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useNetworkStore.getState().setOnline(true);
    toast.success('Connection restored! You are back online.');
  });

  window.addEventListener('offline', () => {
    useNetworkStore.getState().setOnline(false);
    toast.error('No internet connection. Switched to offline mode.');
  });
}


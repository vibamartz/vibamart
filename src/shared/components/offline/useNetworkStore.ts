import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: number;
  setOnline: (status: boolean) => void;
  checkConnectivity: () => Promise<boolean>;
  initListeners: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isChecking: false,
  lastChecked: Date.now(),

  setOnline: (status: boolean) => {
    set({ isOnline: status, lastChecked: Date.now() });
  },

  checkConnectivity: async () => {
    set({ isChecking: true });

    // Check if offline query param simulation is requested (?offline=true)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('offline') === 'true') {
        await new Promise((resolve) => setTimeout(resolve, 600));
        set({ isOnline: false, isChecking: false, lastChecked: Date.now() });
        return false;
      }
    }

    // Fast check with navigator.onLine first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ isOnline: false, isChecking: false, lastChecked: Date.now() });
      return false;
    }

    // Active network probe
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const probeUrl = `/favicon.svg?ping=${Date.now()}`;
      const response = await fetch(probeUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const isConnected = response.ok || response.status < 500;
      set({ isOnline: isConnected, isChecking: false, lastChecked: Date.now() });
      return isConnected;
    } catch {
      // If probe fails or times out
      const fallbackOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      set({ isOnline: fallbackOnline, isChecking: false, lastChecked: Date.now() });
      return fallbackOnline;
    }
  },

  initListeners: () => {
    if (typeof window === 'undefined') return () => {};

    // Initial check from search params
    const params = new URLSearchParams(window.location.search);
    if (params.get('offline') === 'true') {
      set({ isOnline: false });
    }

    const handleOnline = () => {
      // Re-verify connectivity
      get().checkConnectivity();
    };

    const handleOffline = () => {
      set({ isOnline: false, lastChecked: Date.now() });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
}));


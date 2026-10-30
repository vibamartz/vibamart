import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

// Shared state so all components stay in sync
let globalIsOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let globalSimulatedOffline = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

/**
 * Checks connectivity by testing navigator.onLine and probing with a lightweight network fetch.
 */
export async function checkOnlineStatus(): Promise<boolean> {
  if (globalSimulatedOffline) {
    return false;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    globalIsOnline = false;
    notifyListeners();
    return false;
  }

  try {
    // Fast cache-busted probe to check real internet reachability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(`/favicon.ico?_viba_ping=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const online = response.ok || response.status < 500;
    globalIsOnline = online;
    notifyListeners();
    return online;
  } catch (err) {
    // If probe fails (e.g., DNS error, aborted, offline), verify navigator
    const online = typeof navigator !== 'undefined' ? navigator.onLine : false;
    globalIsOnline = online;
    notifyListeners();
    return online;
  }
}

export function setSimulatedOffline(val: boolean) {
  globalSimulatedOffline = val;
  if (val) {
    globalIsOnline = false;
  } else {
    globalIsOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
  notifyListeners();
  window.dispatchEvent(new CustomEvent('viba_network_status_change', { detail: { isOnline: globalIsOnline } }));
}

export function isSimulatedOffline(): boolean {
  return globalSimulatedOffline;
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (globalSimulatedOffline) return false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('offline') === 'true') {
        return false;
      }
    }
    return globalIsOnline;
  });

  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const updateStatus = () => {
      if (globalSimulatedOffline) {
        setIsOnline(false);
        return;
      }
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      if (params && params.get('offline') === 'true') {
        setIsOnline(false);
        return;
      }
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    };

    listeners.add(updateStatus);

    const handleWindowOnline = async () => {
      if (globalSimulatedOffline) return;
      const trulyOnline = await checkOnlineStatus();
      if (trulyOnline) {
        setIsOnline(true);
        toast.success("You're back online!", {
          id: 'viba-network-online',
          icon: '🟢',
          duration: 3000
        });
      }
    };

    const handleWindowOffline = () => {
      globalIsOnline = false;
      setIsOnline(false);
      toast.error("You're currently offline", {
        id: 'viba-network-offline',
        icon: '⚠️',
        duration: 3500
      });
    };

    window.addEventListener('online', handleWindowOnline);
    window.addEventListener('offline', handleWindowOffline);

    return () => {
      listeners.delete(updateStatus);
      window.removeEventListener('online', handleWindowOnline);
      window.removeEventListener('offline', handleWindowOffline);
    };
  }, []);

  const retryConnection = useCallback(async (): Promise<boolean> => {
    setIsRetrying(true);
    // Add a natural slight delay so user perceives the verification action
    await new Promise(r => setTimeout(r, 600));

    const online = await checkOnlineStatus();
    setIsRetrying(false);

    if (online) {
      setIsOnline(true);
      toast.success("Back online! Content refreshed.", {
        id: 'viba-retry-success',
        icon: '✅'
      });
      return true;
    } else {
      setIsOnline(false);
      toast.error("Still offline. Please check your connection and try again.", {
        id: 'viba-retry-fail',
        icon: '📡'
      });
      return false;
    }
  }, []);

  return {
    isOnline,
    isRetrying,
    retryConnection,
    simulatedOffline: globalSimulatedOffline,
    setSimulatedOffline
  };
}


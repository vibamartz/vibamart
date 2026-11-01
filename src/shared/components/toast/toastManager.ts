import React from 'react';
import { ToastItem, ToastOptions, ToastType } from './types';

type ToastListener = (toast: ToastItem | null) => void;

class ToastManager {
  private currentToast: ToastItem | null = null;
  private listeners: Set<ToastListener> = new Set();
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFired: { message: string; type: ToastType; time: number } | null = null;
  private static instance: ToastManager;

  private constructor() {}

  public static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.currentToast);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCurrentToast(): ToastItem | null {
    return this.currentToast;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentToast);
    }
  }

  public dismiss(id?: string): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
    if (!id || (this.currentToast && this.currentToast.id === id)) {
      this.currentToast = null;
      this.notify();
    }
  }

  public show(type: ToastType, rawMessage: string | React.ReactNode, options?: ToastOptions): string {
    const message = typeof rawMessage === 'string' ? rawMessage : String(rawMessage ?? '');
    const now = Date.now();

    // Prevent immediate identical double-triggers (e.g. rapid double click) within 500ms
    if (
      this.lastFired &&
      this.lastFired.message === message &&
      this.lastFired.type === type &&
      now - this.lastFired.time < 500
    ) {
      // Just refresh the existing dismiss timer
      if (this.dismissTimer) clearTimeout(this.dismissTimer);
      const duration = options?.duration ?? 3500;
      this.dismissTimer = setTimeout(() => {
        this.dismiss();
      }, duration);
      return this.currentToast ? this.currentToast.id : 'duplicate';
    }

    this.lastFired = { message, type, time: now };

    // Clear any existing dismissal timer
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    const id = options?.id || `toast-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = options?.duration ?? 3500;

    // Strictly ONE toast notification visible at any time:
    // Immediately replace any existing toast with the latest notification
    this.currentToast = {
      id,
      type,
      title: options?.title,
      message,
      duration,
      createdAt: now,
    };

    this.notify();

    // Auto dismiss after duration (3–4 seconds)
    if (duration > 0 && duration !== Infinity) {
      this.dismissTimer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }
}

const manager = ToastManager.getInstance();

export interface ToastCallable {
  (message: string | React.ReactNode, options?: ToastOptions): string;
  success: (message: string | React.ReactNode, options?: ToastOptions) => string;
  error: (message: string | React.ReactNode, options?: ToastOptions) => string;
  warning: (message: string | React.ReactNode, options?: ToastOptions) => string;
  info: (message: string | React.ReactNode, options?: ToastOptions) => string;
  loading: (message: string | React.ReactNode, options?: ToastOptions) => string;
  dismiss: (id?: string) => void;
  remove: (id?: string) => void;
  custom: (jsx: any, options?: ToastOptions) => string;
  promise: <T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    },
    options?: ToastOptions
  ) => Promise<T>;
}

// Function with properties
const toastFn = ((message: string | React.ReactNode, options?: ToastOptions): string => {
  return manager.show('warning', message, options);
}) as ToastCallable;

toastFn.success = (message: string | React.ReactNode, options?: ToastOptions) => {
  return manager.show('success', message, options);
};

toastFn.error = (message: string | React.ReactNode, options?: ToastOptions) => {
  return manager.show('error', message, options);
};

toastFn.warning = (message: string | React.ReactNode, options?: ToastOptions) => {
  return manager.show('warning', message, options);
};

// Map info to warning as there are exactly 3 types
toastFn.info = (message: string | React.ReactNode, options?: ToastOptions) => {
  return manager.show('warning', message, options);
};

// Map loading to warning (pending operation)
toastFn.loading = (message: string | React.ReactNode, options?: ToastOptions) => {
  return manager.show('warning', message, {
    ...options,
    title: options?.title || 'Processing...',
    duration: options?.duration ?? 8000,
  });
};

toastFn.dismiss = (id?: string) => {
  manager.dismiss(id);
};

toastFn.remove = (id?: string) => {
  manager.dismiss(id);
};

toastFn.custom = (jsx: any, options?: ToastOptions) => {
  const content = typeof jsx === 'string' ? jsx : 'Notification';
  return manager.show('warning', content, options);
};

toastFn.promise = async <T,>(
  promise: Promise<T>,
  msgs: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: any) => string);
  },
  options?: ToastOptions
): Promise<T> => {
  const id = toastFn.loading(msgs.loading, options);
  try {
    const result = await promise;
    const successMsg = typeof msgs.success === 'function' ? msgs.success(result) : msgs.success;
    toastFn.success(successMsg, { ...options, id });
    return result;
  } catch (err: any) {
    const errorMsg = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error;
    toastFn.error(errorMsg, { ...options, id });
    throw err;
  }
};

export const showToast = (config: {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}): string => {
  return manager.show(config.type, config.message, {
    title: config.title,
    duration: config.duration,
  });
};

export { manager as toastManager, toastFn as toast };


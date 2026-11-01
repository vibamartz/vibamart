import React from 'react';

export type ToastType = 'warning' | 'error' | 'success';

export interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number;
  icon?: React.ReactNode;
  className?: string;
  position?: any;
  style?: any;
  [key: string]: any;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
  createdAt: number;
}

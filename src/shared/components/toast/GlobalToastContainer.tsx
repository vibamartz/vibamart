import React, { useEffect, useState, useRef } from 'react';
import { toastManager } from './toastManager';
import { ToastItem } from './types';
import { GlobalToast } from './GlobalToast';

let activeContainerId: string | null = null;

export const GlobalToastContainer: React.FC = () => {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const instanceId = useRef(Math.random().toString(36).substring(2, 9));
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guarantee only one primary container ever registers across the app
  if (!activeContainerId) {
    activeContainerId = instanceId.current;
  }
  const isPrimary = activeContainerId === instanceId.current;

  useEffect(() => {
    if (!isPrimary) return;

    const unsubscribe = toastManager.subscribe((nextToast) => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }

      if (nextToast) {
        // If a new toast arrives, immediately replace with no delay
        setIsExiting(false);
        setActiveToast(nextToast);
      } else {
        // Smooth fade-out before clearing DOM
        setIsExiting(true);
        exitTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);
          setIsExiting(false);
        }, 180);
      }
    });

    return () => {
      if (activeContainerId === instanceId.current) {
        activeContainerId = null;
      }
      unsubscribe();
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [isPrimary]);

  if (!isPrimary || !activeToast) {
    return null;
  }

  const handleClose = (id: string) => {
    toastManager.dismiss(id);
  };

  return (
    <div
      aria-label="Notification Center"
      className="fixed z-[99999] pointer-events-none transition-all duration-200 ease-out 
        top-[max(16px,env(safe-area-inset-top))] left-4 right-4 flex justify-center
        sm:top-6 sm:right-6 sm:left-auto sm:justify-end"
    >
      <GlobalToast
        key={activeToast.id}
        toast={activeToast}
        onClose={handleClose}
        isExiting={isExiting}
      />
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../backend/store';
import { PushService } from '../../backend/services/pushService';

export default function GlobalPushNotificationListener() {
  const { user } = useAuthStore();
  const [permissionState, setPermissionState] = useState<string>(() => PushService.getPermission());
  const [showPromptBar, setShowPromptBar] = useState(false);

  // Initialize Push System on Startup & attach FCM Foreground message listener
  useEffect(() => {
    const uid = user?.uid || 'guest';
    PushService.initializePushSystem(uid);

    // Attach FCM Foreground listener to display native OS notification
    let unsubFcm: (() => void) | null = null;
    PushService.onForegroundMessage((payload) => {
      console.log('[ViBa Mart Listener] Received foreground FCM message:', payload);
      const title = payload.notification?.title || payload.data?.title || 'ViBa Mart Alert';
      const message = payload.notification?.body || payload.data?.message || payload.data?.body || '';
      const image = payload.notification?.image || payload.data?.image || undefined;
      const destinationSlug = payload.data?.destinationSlug || payload.data?.url || '/';

      PushService.showLocalPush(title, {
        body: message,
        icon: '/icon-192.png',
        image: image,
        destinationSlug: destinationSlug,
        tag: payload.data?.notificationId || `fcm_${Date.now()}`,
        data: payload.data,
      });
    }).then(unsub => {
      unsubFcm = unsub;
    });

    // Check permission state
    const perm = PushService.getPermission();
    setPermissionState(perm);
    if (perm === 'default') {
      const dismissed = sessionStorage.getItem('viba_push_prompt_dismissed');
      if (!dismissed) {
        setShowPromptBar(true);
      }
    }

    return () => {
      if (unsubFcm) unsubFcm();
    };
  }, [user]);

  // Request Native Notification Permission
  const handleEnableNotifications = async () => {
    const res = await PushService.requestPermission();
    setPermissionState(res);
    setShowPromptBar(false);
    if (res === 'granted') {
      const uid = user?.uid || 'guest';
      await PushService.registerDevice(uid, null, true);
    } else {
      sessionStorage.setItem('viba_push_prompt_dismissed', 'true');
    }
  };

  return (
    <>
      {/* Floating Quick Permission Enable Bar for Mobile */}
      <AnimatePresence>
        {showPromptBar && permissionState === 'default' && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 left-4 right-4 z-[9000] max-w-md mx-auto pointer-events-auto"
          >
            <div className="bg-white border border-gray-100 p-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">Enable Push Notifications</p>
                  <p className="text-[11px] text-gray-500 truncate">Get instant order updates & flash deals</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleEnableNotifications}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Enable
                </button>
                <button
                  onClick={() => {
                    setShowPromptBar(false);
                    sessionStorage.setItem('viba_push_prompt_dismissed', 'true');
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

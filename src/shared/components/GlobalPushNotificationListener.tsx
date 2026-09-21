import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { useAuthStore } from '../../backend/store';
import { CustomerNotification } from '../../shared/types/notifications';
import { PushService } from '../../backend/services/pushService';
import { NotificationEngine } from '../../backend/services/notificationEngine';

export default function GlobalPushNotificationListener() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeBannerNotif, setActiveBannerNotif] = useState<CustomerNotification | null>(null);
  const [permissionState, setPermissionState] = useState<string>(() => PushService.getPermission());
  const [showPromptBar, setShowPromptBar] = useState(false);
  const seenNotifIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Initialize Push System on Startup
  useEffect(() => {
    const uid = user?.uid || 'guest';
    PushService.initializePushSystem(uid);

    // Check permission state
    const perm = PushService.getPermission();
    setPermissionState(perm);
    if (perm === 'default') {
      const dismissed = sessionStorage.getItem('viba_push_prompt_dismissed');
      if (!dismissed) {
        setShowPromptBar(true);
      }
    }
  }, [user]);

  // Listen for live push notifications targeting user or 'all'
  useEffect(() => {
    const targetUids = user?.uid ? [user.uid, 'all'] : ['all'];
    const q = query(
      collection(db, 'user_notifications'),
      where('userId', 'in', targetUids),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (isInitialLoad.current) {
        // Seed initial existing IDs so we don't trigger popups for old historic notifications
        snap.docs.forEach(d => seenNotifIds.current.add(d.id));
        isInitialLoad.current = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = { id: change.doc.id, ...change.doc.data() } as CustomerNotification;
          
          if (!seenNotifIds.current.has(notif.id)) {
            seenNotifIds.current.add(notif.id);

            // Check if created recently (within last 3 minutes)
            const notifTime = new Date(notif.createdAt).getTime();
            const now = Date.now();
            const isFresh = now - notifTime < 180000;

            if (isFresh) {
              // Show Floating In-App Banner Popup
              setActiveBannerNotif(notif);

              // Trigger vibration pattern if supported on mobile
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try { navigator.vibrate([100, 50, 100]); } catch (e) {}
              }

              // Trigger OS Browser Push Notification
              PushService.showLocalPush(notif.title, {
                body: notif.message,
                image: notif.image,
                destinationSlug: notif.destinationSlug || '/',
                tag: notif.id,
              });

              // Track Delivery Event
              if (user?.uid) {
                NotificationEngine.trackEvent(user.uid, 'notification_delivered', {
                  notificationId: notif.id,
                  campaignId: notif.campaignId,
                  templateId: notif.templateId,
                });
              }
            }
          }
        }
      });
    }, (err) => {
      console.warn('Notification listener error:', err);
    });

    return () => unsub();
  }, [user]);

  // Auto-dismiss popup banner after 8 seconds
  useEffect(() => {
    if (!activeBannerNotif) return;
    const timer = setTimeout(() => {
      setActiveBannerNotif(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeBannerNotif]);

  // Request Native Notification Permission
  const handleEnableNotifications = async () => {
    const res = await PushService.requestPermission();
    setPermissionState(res);
    setShowPromptBar(false);
    if (res === 'granted') {
      const uid = user?.uid || 'guest';
      await PushService.registerDevice(uid);
    } else {
      sessionStorage.setItem('viba_push_prompt_dismissed', 'true');
    }
  };

  const handleBannerClick = async (notif: CustomerNotification) => {
    setActiveBannerNotif(null);

    try {
      await updateDoc(doc(db, 'user_notifications', notif.id), {
        read: true,
        openedAt: new Date().toISOString(),
        clickedAt: new Date().toISOString(),
      });
    } catch (e) {}

    if (user?.uid) {
      NotificationEngine.trackEvent(user.uid, 'notification_click', {
        notificationId: notif.id,
        campaignId: notif.campaignId,
        templateId: notif.templateId,
      });
    }

    if (notif.destinationSlug) {
      navigate(notif.destinationSlug);
    } else if (notif.orderId) {
      navigate(`/track-order/${notif.orderId}`);
    } else if (notif.productId) {
      navigate(`/products/${notif.productId}`);
    } else {
      navigate('/notifications');
    }
  };

  return (
    <>
      {/* 1. Floating In-App Push Notification Popup Banner */}
      <AnimatePresence>
        {activeBannerNotif && (
          <motion.div
            key={`push-popup-${activeBannerNotif.id}`}
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto pointer-events-auto"
          >
            <div 
              onClick={() => handleBannerClick(activeBannerNotif)}
              className="bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-gray-800/80 flex items-start gap-3.5 cursor-pointer hover:bg-black transition-all group"
            >
              {activeBannerNotif.image ? (
                <img 
                  src={activeBannerNotif.image} 
                  alt="Notification" 
                  className="w-12 h-12 rounded-xl object-cover border border-gray-700 shrink-0" 
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                  <Bell className="w-5 h-5 text-white animate-bounce" />
                </div>
              )}

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {activeBannerNotif.category || 'ViBa Alert'}
                  </span>
                  <span className="text-[10px] text-gray-400">Just now</span>
                </div>
                <h4 className="text-sm font-bold text-white truncate leading-tight group-hover:text-primary transition-colors">
                  {activeBannerNotif.title}
                </h4>
                <p className="text-xs text-gray-300 line-clamp-2 mt-0.5 leading-relaxed">
                  {activeBannerNotif.message}
                </p>
                
                {activeBannerNotif.ctaText && (
                  <div className="mt-2.5 flex items-center gap-1 text-xs font-bold text-primary">
                    <span>{activeBannerNotif.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveBannerNotif(null);
                }}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Floating Quick Permission Enable Bar for Mobile */}
      <AnimatePresence>
        {showPromptBar && permissionState === 'default' && !activeBannerNotif && (
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

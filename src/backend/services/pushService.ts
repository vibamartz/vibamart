import { db, getFcmMessaging } from '../firebase/firebase';
import { collection, doc, setDoc, getDocs, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { NotificationDevice } from '../../shared/types/notifications';

const DEVICE_STORAGE_KEY = 'viba_fcm_token';
const LEGACY_STORAGE_KEY = 'viba_push_device_id';

export class PushService {
  /**
   * Check if web notifications are supported in the current environment
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasSW = 'serviceWorker' in navigator;
    const hasNotification = 'Notification' in window;
    const hasPushManager = 'PushManager' in window;
    return hasSW && (hasNotification || hasPushManager);
  }

  /**
   * Get current browser notification permission
   */
  public static getPermission(): NotificationPermission {
    if (!this.isSupported() || typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  }

  /**
   * Request notification permission from the user (with mobile Safari/Chrome compatibility fallback)
   */
  public static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
        const permission = await Notification.requestPermission();
        if (permission) return permission;
      }
    } catch (e) {
      // Fallback for older mobile Safari/WebKit
      return new Promise((resolve) => {
        try {
          Notification.requestPermission((perm) => resolve(perm));
        } catch (err) {
          resolve('denied');
        }
      });
    }
    return 'denied';
  }

  /**
   * Register Service Worker for FCM Web Push Notifications with Firebase Config parameters
   */
  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        let swUrl = '/firebase-messaging-sw.js';
        
        // Dynamically append Firebase Config to SW URL if process.env.FIREBASE_CONFIG is present
        try {
          // @ts-ignore
          const cfg: any = process.env.FIREBASE_CONFIG || {};
          if (cfg && typeof cfg === 'object' && cfg.apiKey && cfg.projectId) {
            const params = new URLSearchParams({
              apiKey: String(cfg.apiKey || ''),
              authDomain: String(cfg.authDomain || ''),
              projectId: String(cfg.projectId || ''),
              storageBucket: String(cfg.storageBucket || ''),
              messagingSenderId: String(cfg.messagingSenderId || ''),
              appId: String(cfg.appId || ''),
            });
            swUrl += `?${params.toString()}`;
          }
        } catch (e) {
          // Fallback to plain URL
        }

        const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        console.log('FCM Push Service Worker registered successfully:', registration.scope);
        
        if (navigator.serviceWorker.ready) {
          await navigator.serviceWorker.ready;
        }

        return registration;
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    }
    return null;
  }

  /**
   * Fetch real FCM Web Push Registration Token from Firebase Messaging
   */
  public static async getFcmToken(swRegistration?: ServiceWorkerRegistration | null): Promise<string | null> {
    if (!this.isSupported() || this.getPermission() !== 'granted') return null;

    try {
      const messaging = await getFcmMessaging();
      if (!messaging) return null;

      let reg = swRegistration || (await this.registerServiceWorker());
      if (reg && navigator.serviceWorker && navigator.serviceWorker.ready) {
        try {
          reg = await navigator.serviceWorker.ready;
        } catch (rErr) {}
      }

      if (!reg) return null;

      // VAPID key (Web Push Certificate Key)
      // @ts-ignore
      const vapidKey = process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || 'BI5XgN7vW8KlbVFVtIB_Wq4ncDE0aqbbWMGllCIKRIbeO2fCoNQP6DnCAJ6ZuFGO9sHulaJrwGP5C_VvSJ9xDgY';

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      });

      if (token) {
        console.log('Successfully acquired FCM Web Push Token for device');
        localStorage.setItem(DEVICE_STORAGE_KEY, token);
        return token;
      }
    } catch (err) {
      console.warn('FCM getToken failed on device:', err);
    }
    return null;
  }

  /**
   * Initialize full push system on startup
   */
  public static async initializePushSystem(userId?: string): Promise<void> {
    const reg = await this.registerServiceWorker();
    if (userId) {
      await this.registerDevice(userId, reg);
    }
  }

  /**
   * Register device token to Firestore
   */
  public static async registerDevice(userId: string, swRegistration?: ServiceWorkerRegistration | null): Promise<string | null> {
    if (!userId || !this.isSupported()) return null;
    try {
      const permission = await this.getPermission();
      if (permission !== 'granted') {
        const req = await this.requestPermission();
        if (req !== 'granted') return null;
      }

      const token = await this.getFcmToken(swRegistration);
      if (!token) return null;

      const docId = `${userId}_${token.slice(-12)}`;
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
      let platform = 'web';
      if (/android/i.test(userAgent)) platform = 'android';
      else if (/iphone|ipad|ipod/i.test(userAgent)) platform = 'ios';
      else if (/mac/i.test(userAgent)) platform = 'macos';
      else if (/win/i.test(userAgent)) platform = 'windows';

      const deviceData: NotificationDevice = {
        id: docId,
        userId,
        token,
        platform: platform as any,
        userAgent,
        isEnabled: true,
        permissionState: 'granted',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      await setDoc(doc(db, 'notification_devices', docId), deviceData, { merge: true });
      console.log('Device registered successfully for push notifications');
      return token;
    } catch (err) {
      console.warn('Failed to register device for push:', err);
      return null;
    }
  }

  /**
   * Listen to foreground FCM notifications
   */
  public static async onForegroundMessage(callback: (payload: MessagePayload) => void): Promise<(() => void) | null> {
    try {
      const messaging = await getFcmMessaging();
      if (messaging) {
        return onMessage(messaging, (payload) => {
          console.log('[ViBa Mart Client] FCM Foreground message received:', payload);
          callback(payload);
        });
      }
    } catch (err) {
      console.warn('FCM onMessage listener error:', err);
    }
    return null;
  }

  /**
   * Handle user logout - disable/clean up device token association for user
   */
  public static async handleLogout(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const token = localStorage.getItem(DEVICE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (token) {
        const docId = `${userId}_${token.slice(-12)}`;
        await updateDoc(doc(db, 'notification_devices', docId), {
          isEnabled: false,
          permissionState: 'denied',
          lastActive: new Date().toISOString(),
        }).catch(() => {});
      }

      // Query any user devices and mark disabled
      const q = query(collection(db, 'notification_devices'), where('userId', '==', userId));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        await updateDoc(docSnap.ref, { isEnabled: false });
      }

      localStorage.removeItem(DEVICE_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      console.warn('Logout FCM cleanup failed:', err);
    }
  }

  /**
   * Disable/Enable device notifications
   */
  public static async setDeviceEnabled(userId: string, enabled: boolean): Promise<void> {
    const deviceToken = localStorage.getItem(DEVICE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!deviceToken) return;

    try {
      const docId = `${userId}_${deviceToken.slice(-12)}`;
      await updateDoc(doc(db, 'notification_devices', docId), {
        isEnabled: enabled,
        lastActive: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to update device state:', err);
    }
  }

  /**
   * Clean up expired or duplicate devices for a user
   */
  public static async cleanupInactiveDevices(userId: string): Promise<void> {
    try {
      const q = query(collection(db, 'notification_devices'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const now = Date.now();
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as NotificationDevice;
        const lastActiveTime = new Date(data.lastActive || data.createdAt).getTime();
        if (now - lastActiveTime > THIRTY_DAYS_MS || data.permissionState === 'denied') {
          await deleteDoc(docSnap.ref);
        }
      }
    } catch (e) {
      console.warn('Failed cleaning inactive devices:', e);
    }
  }

  /**
   * Show a local in-browser notification when permission is granted
   */
  public static showLocalPush(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      image?: string;
      tag?: string;
      destinationSlug?: string;
      data?: any;
    }
  ): void {
    if (!this.isSupported() || Notification.permission !== 'granted') return;

    try {
      const notif = new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag || 'viba-mart-alert',
        badge: '/favicon.ico',
        data: {
          url: options?.destinationSlug || '/',
          ...(options?.data || {}),
        },
      });

      notif.onclick = (e) => {
        e.preventDefault();
        window.focus();
        if (options?.destinationSlug) {
          window.location.href = options.destinationSlug;
        }
        notif.close();
      };
    } catch (err) {
      console.warn('Web notification display failed:', err);
    }
  }
}

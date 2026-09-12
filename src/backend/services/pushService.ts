import { db } from '../firebase/firebase';
import { collection, doc, setDoc, getDocs, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { NotificationDevice } from '../../shared/types/notifications';

const DEVICE_STORAGE_KEY = 'viba_push_device_id';

export class PushService {
  /**
   * Check if web notifications are supported in the current environment
   */
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser notification permission
   */
  public static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  /**
   * Request notification permission from the user
   */
  public static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Register or update the current device in Firestore
   */
  public static async registerDevice(userId: string): Promise<NotificationDevice | null> {
    if (!this.isSupported() || !userId) return null;

    try {
      const permission = this.getPermission();
      let deviceToken = localStorage.getItem(DEVICE_STORAGE_KEY);
      
      if (!deviceToken) {
        // Generate a stable unique client device token
        deviceToken = `viba_web_${userId.slice(0, 6)}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(DEVICE_STORAGE_KEY, deviceToken);
      }

      const platform: 'web' | 'android' | 'ios' = /android/i.test(navigator.userAgent)
        ? 'android'
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'ios'
        : 'web';

      const deviceData: NotificationDevice = {
        userId,
        token: deviceToken,
        platform,
        userAgent: navigator.userAgent.slice(0, 200),
        deviceModel: navigator.platform || 'Browser',
        isEnabled: permission === 'granted',
        permissionState: permission,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };

      const docId = `${userId}_${deviceToken.slice(-12)}`;
      await setDoc(doc(db, 'notification_devices', docId), deviceData, { merge: true });

      return deviceData;
    } catch (err) {
      console.error('Failed to register push device:', err);
      return null;
    }
  }

  /**
   * Disable/Enable device notifications
   */
  public static async setDeviceEnabled(userId: string, enabled: boolean): Promise<void> {
    const deviceToken = localStorage.getItem(DEVICE_STORAGE_KEY);
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

import { collection, query, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import admin from 'firebase-admin';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface CleanupResult {
  deletedCount: number;
  preservedUnreadCount: number;
  activeReadCount: number;
  errors: string[];
}

function getBackendDb(): any {
  if (typeof window === 'undefined' && admin.apps.length > 0) {
    try {
      return admin.firestore();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Automatically and permanently deletes admin notifications that have been read for >= 24 hours.
 * Strictly preserves unread notifications indefinitely until they are read.
 * Enforced directly in the database.
 */
export async function cleanExpiredAdminNotifications(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deletedCount: 0,
    preservedUnreadCount: 0,
    activeReadCount: 0,
    errors: []
  };

  try {
    const adminDb = getBackendDb();
    const now = Date.now();

    if (adminDb) {
      const snapshot = await adminDb.collection('notifications').get();
      for (const notifDoc of snapshot.docs) {
        const data = notifDoc.data();
        const notifId = notifDoc.id;

        if (!data.read) {
          result.preservedUnreadCount++;
          continue;
        }

        let readTime: number | null = null;
        if (data.readAt) {
          const parsed = new Date(data.readAt).getTime();
          if (!isNaN(parsed)) readTime = parsed;
        }

        if (!readTime) {
          if (data.createdAt) {
            const createdTime = new Date(data.createdAt).getTime();
            if (!isNaN(createdTime) && (now - createdTime >= TWENTY_FOUR_HOURS_MS)) {
              readTime = createdTime;
            }
          }
        }

        if (readTime && (now - readTime >= TWENTY_FOUR_HOURS_MS)) {
          try {
            await adminDb.collection('notifications').doc(notifId).delete();
            result.deletedCount++;
          } catch (delErr: any) {
            result.errors.push(`Failed to delete expired notification ${notifId}: ${delErr.message}`);
          }
        } else {
          result.activeReadCount++;
        }
      }
      return result;
    }

    const notificationsCol = collection(db, 'notifications');
    const snapshot = await getDocs(notificationsCol);

    for (const notifDoc of snapshot.docs) {
      const data = notifDoc.data();
      const notifId = notifDoc.id;

      // Unread notifications must ALWAYS be preserved
      if (!data.read) {
        result.preservedUnreadCount++;
        continue;
      }

      // Notification is read: determine read timestamp
      let readTime: number | null = null;
      if (data.readAt) {
        const parsed = new Date(data.readAt).getTime();
        if (!isNaN(parsed)) readTime = parsed;
      }

      // If read was marked true without readAt, fallback to createdAt or stamp current time
      if (!readTime) {
        if (data.createdAt) {
          const createdTime = new Date(data.createdAt).getTime();
          if (!isNaN(createdTime) && (now - createdTime >= TWENTY_FOUR_HOURS_MS)) {
            readTime = createdTime;
          }
        }
      }

      if (readTime && (now - readTime >= TWENTY_FOUR_HOURS_MS)) {
        try {
          await deleteDoc(doc(db, 'notifications', notifId));
          result.deletedCount++;
        } catch (delErr: any) {
          result.errors.push(`Failed to delete expired notification ${notifId}: ${delErr.message}`);
        }
      } else {
        result.activeReadCount++;
      }
    }
  } catch (err: any) {
    result.errors.push(`Failed querying notifications: ${err.message}`);
  }

  return result;
}

/**
 * Permanently deletes all existing admin notifications from Firestore database.
 */
export async function purgeAllAdminNotifications(): Promise<{ deletedCount: number }> {
  const adminDb = getBackendDb();
  let deletedCount = 0;

  if (adminDb) {
    const snapshot = await adminDb.collection('notifications').get();
    for (const notifDoc of snapshot.docs) {
      await adminDb.collection('notifications').doc(notifDoc.id).delete();
      deletedCount++;
    }
    return { deletedCount };
  }

  const notificationsCol = collection(db, 'notifications');
  const snapshot = await getDocs(notificationsCol);

  for (const notifDoc of snapshot.docs) {
    await deleteDoc(doc(db, 'notifications', notifDoc.id));
    deletedCount++;
  }

  return { deletedCount };
}

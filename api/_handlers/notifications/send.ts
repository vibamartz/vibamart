import admin from "firebase-admin";
import { setCorsHeaders, initializeFirebaseAdmin } from "../../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    userId,
    target = 'user',
    segmentUserIds = [],
    category = 'offers',
    title,
    message,
    image,
    destinationSlug = '/',
    ctaText = 'View Details',
    priority = 'high',
    campaignId,
    templateId,
    productId,
    categoryId,
    orderId,
    couponCode,
    bypassFrequencyLimits = false,
    bypassQuietHours = false,
  } = req.body;

  if (!title || !message) {
    return res.status(400).json({ success: false, error: 'Title and message are required' });
  }

  try {
    const db = admin.firestore();
    const messaging = admin.messaging();

    let targetUserIds: string[] = [];

    if (target === 'all' || userId === 'all') {
      const usersSnap = await db.collection('users').select().limit(500).get();
      targetUserIds = usersSnap.docs.map((doc: any) => doc.id);
      if (!targetUserIds.includes('all')) {
        targetUserIds.push('all');
      }
    } else if (target === 'segment') {
      targetUserIds = Array.isArray(segmentUserIds) ? segmentUserIds : [];
    } else {
      if (userId) targetUserIds = [userId];
    }

    if (targetUserIds.length === 0) {
      targetUserIds = ['all'];
    }

    let dispatchedCount = 0;
    const nowIso = new Date().toISOString();

    // 1. Create In-App Notification Records
    for (const uid of targetUserIds) {
      const notifRef = db.collection('user_notifications').doc();
      const notifData = {
        id: notifRef.id,
        userId: uid,
        category,
        title,
        message,
        image: image || '',
        destinationSlug,
        ctaText,
        priority,
        read: false,
        createdAt: nowIso,
        deliveredAt: nowIso,
        campaignId: campaignId || null,
        templateId: templateId || null,
        productId: productId || null,
        categoryId: categoryId || null,
        orderId: orderId || null,
        couponCode: couponCode || null,
      };

      await notifRef.set(notifData);
      dispatchedCount++;

      // Log notification audit entry
      await db.collection('notificationLogs').add({
        notificationId: notifRef.id,
        userId: uid,
        category,
        campaignId: campaignId || null,
        templateId: templateId || null,
        title,
        message,
        destinationSlug,
        sentAt: nowIso,
        deliveredAt: nowIso,
        status: 'delivered',
        provider: 'fcm_web_push',
      });
    }

    // 2. Dispatch FCM Push Notifications to Device Tokens (Desktop & Mobile)
    try {
      const deviceSnaps = await db.collection('notification_devices').get();
      
      const allMatchingDocs = deviceSnaps.docs
        .map((d: any) => ({ docId: d.id, ...d.data() }))
        .filter((item: any) => {
          // Token validity
          if (!item.token || typeof item.token !== 'string' || item.token.trim() === '' || item.token.startsWith('viba_web_')) {
            return false;
          }
          // Enabled state
          if (item.isEnabled === false || item.isActive === false || item.permissionState === 'denied') {
            return false;
          }
          // Target filter
          if (target === 'segment' && segmentUserIds.length > 0) {
            return segmentUserIds.includes(item.userId);
          }
          if (target === 'user' && userId && userId !== 'all') {
            return item.userId === userId;
          }
          // For target === 'all' or userId === 'all', send to all active devices (including guest / mobile devices)
          return true;
        });

      // Deduplicate by device token to ensure no duplicate notifications are received by the same device
      const uniqueDeviceDocs: Array<{ docId: string; token: string; userId?: string; platform?: string }> = [];
      const seenTokens = new Set<string>();

      for (const item of allMatchingDocs) {
        if (!seenTokens.has(item.token)) {
          seenTokens.add(item.token);
          uniqueDeviceDocs.push({
            docId: item.docId,
            token: item.token,
            userId: item.userId,
            platform: item.platform,
          });
        }
      }

      if (uniqueDeviceDocs.length > 0) {
        const fcmRes = await sendFcmMulticastWithCleanup(db, messaging, uniqueDeviceDocs, {
          title,
          message,
          image,
          destinationSlug,
          category,
          notificationId: `fcm_${Date.now()}`,
        });
        console.log(`[FCM Broadcast] target='${target}': ${fcmRes.successCount} succeeded, ${fcmRes.failureCount} failed out of ${uniqueDeviceDocs.length} devices.`);
      }
    } catch (fcmErr) {
      console.warn(`FCM multicast warning for target='${target}':`, fcmErr);
    }

    return res.status(200).json({
      success: true,
      message: `Push notification dispatched successfully to ${dispatchedCount} recipient(s).`,
      dispatchedCount,
    });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dispatch push notification',
    });
  }
}

export async function sendFcmMulticastWithCleanup(
  db: admin.firestore.Firestore,
  messaging: admin.messaging.Messaging,
  deviceDocs: Array<{ docId: string; token: string; userId?: string; platform?: string }>,
  payload: { title: string; message: string; image?: string; destinationSlug: string; category: string; notificationId: string }
) {
  if (deviceDocs.length === 0) return { successCount: 0, failureCount: 0 };

  const tokenList = deviceDocs.map(d => d.token);
  try {
    const batchResponse = await messaging.sendEachForMulticast({
      tokens: tokenList,
      notification: {
        title: payload.title,
        body: payload.message,
        imageUrl: payload.image || undefined,
      },
      data: {
        destinationSlug: String(payload.destinationSlug || '/'),
        url: String(payload.destinationSlug || '/'),
        category: String(payload.category || 'offers'),
        notificationId: String(payload.notificationId),
        title: String(payload.title),
        message: String(payload.message),
        body: String(payload.message),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        image: String(payload.image || ''),
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          title: payload.title,
          body: payload.message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          image: payload.image || undefined,
          tag: payload.notificationId,
          renotify: true,
          requireInteraction: true,
          data: {
            url: payload.destinationSlug || '/',
            destinationSlug: payload.destinationSlug || '/',
            notificationId: payload.notificationId,
            category: payload.category,
          },
        },
        fcmOptions: {
          link: payload.destinationSlug || '/',
        },
      },
      android: {
        priority: 'high',
        notification: {
          title: payload.title,
          body: payload.message,
          icon: 'icon',
          imageUrl: payload.image || undefined,
          clickAction: payload.destinationSlug || '/',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.message,
            },
            badge: 1,
            sound: 'default',
          },
        },
        fcmOptions: {
          imageUrl: payload.image || undefined,
        },
      },
    });

    let successCount = batchResponse.successCount;
    let failureCount = batchResponse.failureCount;

    if (batchResponse.responses && batchResponse.responses.length > 0) {
      for (let i = 0; i < batchResponse.responses.length; i++) {
        const resp = batchResponse.responses[i];
        if (!resp.success) {
          const item = deviceDocs[i];
          const errCode = resp.error?.code || 'unknown';
          const errMsg = resp.error?.message || String(resp.error);

          console.warn(`[FCM Delivery Failure] Platform: ${item.platform || 'web'} | User: ${item.userId || 'unknown'} | Token: ${item.token.slice(0, 15)}... | Error: ${errCode} - ${errMsg}`);

          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered' ||
            errMsg.includes('not-registered') ||
            errMsg.includes('invalid')
          ) {
            console.log(`[FCM Cleanup] Removing stale FCM token document: ${item.docId}`);
            await db.collection('notification_devices').doc(item.docId).delete().catch(() => {});
          }
        }
      }
    }

    return { successCount, failureCount };
  } catch (err: any) {
    console.error('[FCM Multicast Execution Error]', err);
    return { successCount: 0, failureCount: deviceDocs.length };
  }
}

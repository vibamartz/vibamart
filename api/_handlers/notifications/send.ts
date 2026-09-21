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

    if (target === 'all') {
      const usersSnap = await db.collection('users').select().limit(500).get();
      targetUserIds = usersSnap.docs.map((doc: any) => doc.id);
      targetUserIds.push('all');
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

    // 2. Dispatch FCM Push Notifications to Device Tokens
    try {
      let deviceQuery: any = db.collection('notification_devices').where('isEnabled', '==', true);
      if (target !== 'all' && userId) {
        if (target === 'segment' && segmentUserIds.length > 0) {
          deviceQuery = deviceQuery.where('userId', 'in', segmentUserIds.slice(0, 30));
        } else {
          deviceQuery = deviceQuery.where('userId', '==', userId);
        }
      }

      const deviceSnaps = await deviceQuery.get();
      const deviceDocs = deviceSnaps.docs
        .map((d: any) => ({ docId: d.id, userId: d.data()?.userId, token: d.data()?.token }))
        .filter((item: any) => item.token && typeof item.token === 'string');

      if (deviceDocs.length > 0) {
        const fcmRes = await sendFcmMulticastWithCleanup(db, messaging, deviceDocs, {
          title,
          message,
          image,
          destinationSlug,
          category,
          notificationId: `fcm_${Date.now()}`,
        });
        console.log(`FCM Multicast result for target='${target}': ${fcmRes.successCount} succeeded, ${fcmRes.failureCount} failed.`);
      }
    } catch (fcmErr) {
      console.warn(`FCM multicast warn for target='${target}':`, fcmErr);
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
  deviceDocs: Array<{ docId: string; token: string; userId?: string }>,
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
        destinationSlug: payload.destinationSlug || '/',
        category: payload.category || 'offers',
        notificationId: payload.notificationId,
        title: payload.title,
        message: payload.message,
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          title: payload.title,
          body: payload.message,
          icon: payload.image || '/favicon.ico',
          badge: '/favicon.ico',
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

          console.error(`[FCM Delivery Failure] User: ${item.userId || 'unknown'} | Token: ${item.token.slice(0, 15)}... | Error: ${errCode} - ${errMsg}`);

          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered' ||
            errMsg.includes('not-registered') ||
            errMsg.includes('invalid')
          ) {
            console.log(`[FCM Cleanup] Removing invalid FCM token document: ${item.docId}`);
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

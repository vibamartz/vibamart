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

      // Try sending FCM push notification if device tokens exist for this user
      if (uid !== 'all') {
        try {
          const deviceSnaps = await db.collection('notification_devices')
            .where('userId', '==', uid)
            .where('isEnabled', '==', true)
            .get();

          const tokens = deviceSnaps.docs
            .map((d: any) => d.data()?.token)
            .filter((t: string) => t && !t.startsWith('viba_web_'));

          if (tokens.length > 0) {
            await messaging.sendEachForMulticast({
              tokens,
              notification: {
                title,
                body: message,
                imageUrl: image || undefined,
              },
              data: {
                destinationSlug,
                category,
                notificationId: notifRef.id,
              },
            });
          }
        } catch (fcmErr) {
          console.warn(`FCM multicast warn for user ${uid}:`, fcmErr);
        }
      }
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

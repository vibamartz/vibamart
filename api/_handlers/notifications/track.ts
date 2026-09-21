import admin from "firebase-admin";
import { setCorsHeaders, initializeFirebaseAdmin } from "../../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    userId,
    eventType, // 'notification_delivered' | 'notification_open' | 'notification_click' | 'purchase'
    notificationId,
    campaignId,
    productId,
    orderId,
    conversionRevenue = 0,
  } = req.body;

  if (!userId || !eventType) {
    return res.status(400).json({ success: false, error: 'userId and eventType are required' });
  }

  try {
    const db = admin.firestore();
    const nowIso = new Date().toISOString();

    const eventRecord = {
      userId,
      eventType,
      notificationId: notificationId || null,
      campaignId: campaignId || null,
      productId: productId || null,
      orderId: orderId || null,
      conversionRevenue,
      timestamp: nowIso,
    };

    await db.collection('notification_events').add(eventRecord);

    // Update notification record timestamps if applicable
    if (notificationId) {
      const notifRef = db.collection('user_notifications').doc(notificationId);
      const updateData: any = {};
      if (eventType === 'notification_open') updateData.openedAt = nowIso;
      if (eventType === 'notification_click') {
        updateData.clickedAt = nowIso;
        updateData.read = true;
      }
      if (eventType === 'purchase') updateData.convertedAt = nowIso;

      if (Object.keys(updateData).length > 0) {
        await notifRef.update(updateData).catch(() => {});
      }
    }

    // Update campaign metrics if applicable
    if (campaignId) {
      const campRef = db.collection('notification_campaigns').doc(campaignId);
      const campDoc = await campRef.get();

      if (campDoc.exists) {
        const campData = campDoc.data() || {};
        const fieldUpdates: any = { updatedAt: nowIso };

        if (eventType === 'notification_open') {
          fieldUpdates.openCount = (campData.openCount || 0) + 1;
        } else if (eventType === 'notification_click') {
          fieldUpdates.clickCount = (campData.clickCount || 0) + 1;
        } else if (eventType === 'purchase') {
          fieldUpdates.conversionCount = (campData.conversionCount || 0) + 1;
          fieldUpdates.attributedRevenue = (campData.attributedRevenue || 0) + (Number(conversionRevenue) || 0);
        }

        await campRef.update(fieldUpdates).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Notification engagement event tracked successfully',
    });
  } catch (error: any) {
    console.error('Tracking API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}

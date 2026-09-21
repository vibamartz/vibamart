import admin from "firebase-admin";
import { setCorsHeaders, initializeFirebaseAdmin } from "../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, token, platform, userAgent, deviceModel } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ success: false, error: 'Missing userId or device token' });
  }

  try {
    const db = admin.firestore();
    const docId = `${userId}_${token.slice(-12)}`;

    const deviceRecord = {
      userId,
      token,
      platform: platform || 'web',
      userAgent: userAgent || 'Browser',
      deviceModel: deviceModel || 'Web Browser',
      isEnabled: true,
      permissionState: 'granted',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    await db.collection('notification_devices').doc(docId).set(deviceRecord, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Push notification device token registered successfully',
      device: deviceRecord,
    });
  } catch (error: any) {
    console.error('Push token registration error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to register push device token',
    });
  }
}

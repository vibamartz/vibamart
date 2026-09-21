import admin from "firebase-admin";
import { setCorsHeaders, initializeFirebaseAdmin } from "../../_utils";

initializeFirebaseAdmin();

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = admin.firestore();

  try {
    if (req.method === 'GET') {
      const snap = await db.collection('notification_campaigns').orderBy('createdAt', 'desc').get();
      const campaigns = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, campaigns });
    }

    if (req.method === 'POST') {
      const campaignData = req.body;
      if (!campaignData.name || !campaignData.category) {
        return res.status(400).json({ success: false, error: 'Name and category are required' });
      }

      const campaignRef = campaignData.id
        ? db.collection('notification_campaigns').doc(campaignData.id)
        : db.collection('notification_campaigns').doc();

      const newCampaign = {
        id: campaignRef.id,
        name: campaignData.name,
        category: campaignData.category,
        targetSegmentId: campaignData.targetSegmentId || 'all',
        title: campaignData.title || '',
        message: campaignData.message || '',
        image: campaignData.image || '',
        destinationSlug: campaignData.destinationSlug || '/',
        ctaText: campaignData.ctaText || 'View Details',
        status: campaignData.status || 'active',
        priority: campaignData.priority || 'medium',
        isAbTest: Boolean(campaignData.isAbTest),
        variantA: campaignData.variantA || null,
        variantB: campaignData.variantB || null,
        abSplitRatio: campaignData.abSplitRatio || 50,
        mlOptimization: campaignData.mlOptimization ?? true,
        propensityThreshold: campaignData.propensityThreshold || 0.3,
        frequencyCapPerUser: campaignData.frequencyCapPerUser || 2,
        startDate: campaignData.startDate || new Date().toISOString(),
        sentCount: campaignData.sentCount || 0,
        deliveredCount: campaignData.deliveredCount || 0,
        openCount: campaignData.openCount || 0,
        clickCount: campaignData.clickCount || 0,
        conversionCount: campaignData.conversionCount || 0,
        attributedRevenue: campaignData.attributedRevenue || 0,
        createdAt: campaignData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await campaignRef.set(newCampaign, { merge: true });
      return res.status(200).json({ success: true, campaign: newCampaign });
    }

    if (req.method === 'PUT') {
      const { id, status, ...updates } = req.body;
      if (!id) return res.status(400).json({ success: false, error: 'Campaign ID required' });

      const campaignRef = db.collection('notification_campaigns').doc(id);
      const patch = { ...updates, updatedAt: new Date().toISOString() };
      if (status) patch.status = status;

      await campaignRef.update(patch);
      return res.status(200).json({ success: true, message: 'Campaign updated successfully' });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query.id ? req.query : req.body;
      if (!id) return res.status(400).json({ success: false, error: 'Campaign ID required' });

      await db.collection('notification_campaigns').doc(id).delete();
      return res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Campaign management API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}

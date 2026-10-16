import { Request, Response } from 'express';
import { cleanExpiredAdminNotifications, purgeAllAdminNotifications } from '../../../src/backend/services/adminNotificationCleanupService';

export async function adminNotificationsCleanupHandler(req: Request, res: Response) {
  try {
    const result = await cleanExpiredAdminNotifications();
    return res.json({
      success: true,
      message: `Cleaned ${result.deletedCount} notification(s) older than 24h since read. Preserved ${result.preservedUnreadCount} unread.`,
      result
    });
  } catch (error: any) {
    console.error('[Admin Notifications Cleanup Handler] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to clean admin notifications'
    });
  }
}

export async function adminNotificationsPurgeHandler(req: Request, res: Response) {
  try {
    const result = await purgeAllAdminNotifications();
    return res.json({
      success: true,
      message: `Permanently deleted all ${result.deletedCount} admin notification(s).`,
      result
    });
  } catch (error: any) {
    console.error('[Admin Notifications Purge Handler] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to purge admin notifications'
    });
  }
}

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum AdminAction {
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  USER_ROLE_UPDATE = 'USER_ROLE_UPDATE',
  USER_CREATE = 'USER_CREATE',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  EXPORT_REPORT = 'EXPORT_REPORT'
}

export async function logAdminAction(
  action: AdminAction,
  description: string,
  targetId?: string,
  targetCollection?: string
) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'adminLogs'), {
      adminId: user.uid,
      adminEmail: user.email,
      action,
      description,
      timestamp: serverTimestamp(),
      targetId: targetId || null,
      targetCollection: targetCollection || null
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

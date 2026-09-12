import { db } from '../firebase/firebase';
import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, where, orderBy, limit, updateDoc } from 'firebase/firestore';
import { 
  CustomerNotification, 
  NotificationCategory, 
  NotificationEventType, 
  NotificationEventRecord, 
  NotificationLog, 
  CustomerNotificationPreferences,
  NotificationPriority
} from '../../shared/types/notifications';
import { PushService } from './pushService';
import { EngagementMLEngine } from './mlEngine';
import { Order, Product } from '../../shared/types';

// In-memory debounce buffer to prevent duplicate event spamming
const recentEventsBuffer = new Set<string>();

/**
 * Strips all undefined fields recursively so Firestore never throws
 * "Unsupported field value: undefined" errors.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = sanitizeFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export class NotificationEngine {
  /**
   * Track customer engagement event
   */
  public static async trackEvent(
    userId: string,
    eventType: NotificationEventType,
    data: {
      productId?: string;
      categoryId?: string;
      orderId?: string;
      campaignId?: string;
      templateId?: string;
      notificationId?: string;
      variant?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (!userId) return;

    // Deduplication key for high frequency client events within 5 seconds
    const dedupeKey = `${userId}_${eventType}_${data.productId || data.orderId || data.notificationId || ''}_${Math.floor(Date.now() / 5000)}`;
    if (recentEventsBuffer.has(dedupeKey)) return;
    recentEventsBuffer.add(dedupeKey);
    setTimeout(() => recentEventsBuffer.delete(dedupeKey), 6000);

    try {
      const record: NotificationEventRecord = {
        userId,
        eventType,
        productId: data.productId,
        categoryId: data.categoryId,
        orderId: data.orderId,
        campaignId: data.campaignId,
        templateId: data.templateId,
        notificationId: data.notificationId,
        variant: data.variant,
        metadata: data.metadata || {},
        timestamp: new Date().toISOString(),
      };

      await addDoc(collection(db, 'notification_events'), sanitizeFirestoreData(record));
    } catch (err) {
      console.warn('Failed tracking notification event:', err);
    }
  }

  /**
   * Get user preferences or fallback to default all enabled
   */
  public static async getUserPreferences(userId: string): Promise<CustomerNotificationPreferences> {
    const defaultPrefs: CustomerNotificationPreferences = {
      userId,
      offers: true,
      newProducts: true,
      priceDrops: true,
      wishlist: true,
      cart: true,
      coupons: true,
      flashSales: true,
      personalizedOffers: true,
      updatedAt: new Date().toISOString(),
    };

    if (!userId || userId === 'all' || userId === 'guest') return defaultPrefs;

    try {
      const prefDoc = await getDoc(doc(db, 'user_notification_preferences', userId));
      if (prefDoc.exists()) {
        return { ...defaultPrefs, ...(prefDoc.data() as CustomerNotificationPreferences) };
      }
    } catch (e) {
      console.warn('Could not fetch user preferences, using defaults:', e);
    }

    return defaultPrefs;
  }

  /**
   * Check if user has opted into a specific notification category
   */
  public static isCategoryAllowed(category: NotificationCategory, prefs: CustomerNotificationPreferences): boolean {
    if (category === 'orders' || category === 'system') return true; // Transactional cannot be disabled
    if (category === 'offers') return prefs.offers;
    if (category === 'new_products') return prefs.newProducts;
    if (category === 'price_drops') return prefs.priceDrops;
    if (category === 'wishlist') return prefs.wishlist;
    if (category === 'cart') return prefs.cart;
    if (category === 'coupons') return prefs.coupons;
    if (category === 'flash_sales') return prefs.flashSales;
    if (category === 'personalized') return prefs.personalizedOffers;
    return true;
  }

  /**
   * Main Decision Engine & Dispatch Orchestrator
   */
  public static async dispatchNotification(params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    message: string;
    image?: string;
    destinationSlug?: string;
    ctaText?: string;
    priority?: NotificationPriority;
    campaignId?: string;
    templateId?: string;
    productId?: string;
    categoryId?: string;
    orderId?: string;
    couponCode?: string;
    experimentVariant?: 'A' | 'B' | 'control';
    bypassFrequencyLimits?: boolean;
    bypassQuietHours?: boolean;
  }): Promise<{ success: boolean; notificationId?: string; reason?: string }> {
    const isTransactional = params.category === 'orders' || params.category === 'system';

    // Step 1: Preferences Check
    if (!isTransactional && params.userId !== 'all') {
      const prefs = await this.getUserPreferences(params.userId);
      if (!this.isCategoryAllowed(params.category, prefs)) {
        return { success: false, reason: `Customer has opted out of ${params.category} notifications.` };
      }
    }

    // Step 2: Frequency & Quiet Hours Check (for non-transactional)
    if (!isTransactional && !params.bypassFrequencyLimits && params.userId !== 'all') {
      const now = new Date();
      const currentHour = now.getHours();
      // Quiet hours 10 PM to 8 AM
      if (!params.bypassQuietHours && (currentHour >= 22 || currentHour < 8)) {
        return { success: false, reason: 'Suppressed due to quiet hours policy.' };
      }

      // Check recent user notifications for spam prevention
      try {
        const qRecent = query(
          collection(db, 'user_notifications'),
          where('userId', '==', params.userId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const snap = await getDocs(qRecent);
        const recentNotifs = snap.docs.map(d => d.data());
        const limitCheck = EngagementMLEngine.checkFrequencyLimits(
          params.userId,
          params.category,
          isTransactional,
          recentNotifs
        );
        if (!limitCheck.allowed) {
          return { success: false, reason: limitCheck.reason };
        }
      } catch (err) {
        // Continue if index query failed
      }
    }

    // Step 3: Create & Store Notification Record
    try {
      const notifData: Omit<CustomerNotification, 'id'> = {
        userId: params.userId,
        category: params.category,
        title: params.title,
        message: params.message,
        image: params.image || '',
        destinationSlug: params.destinationSlug || '/',
        ctaText: params.ctaText || 'View Details',
        priority: params.priority || (isTransactional ? 'high' : 'medium'),
        read: false,
        createdAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        campaignId: params.campaignId,
        templateId: params.templateId,
        productId: params.productId,
        categoryId: params.categoryId,
        orderId: params.orderId,
        couponCode: params.couponCode,
        experimentVariant: params.experimentVariant,
      };

      const docRef = await addDoc(collection(db, 'user_notifications'), sanitizeFirestoreData(notifData));
      const notificationId = docRef.id;

      // Step 4: Dispatch Web Push if supported and current user matches
      PushService.showLocalPush(params.title, {
        body: params.message,
        image: params.image,
        destinationSlug: params.destinationSlug,
        tag: `viba_${params.category}_${notificationId.slice(-6)}`,
      });

      // Step 5: Log to notification audit logs
      const logRecord: NotificationLog = {
        id: `log_${notificationId}`,
        notificationId,
        userId: params.userId,
        category: params.category,
        campaignId: params.campaignId,
        templateId: params.templateId,
        title: params.title,
        message: params.message,
        destinationSlug: params.destinationSlug,
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        status: 'delivered',
        provider: 'web_push',
        experimentVariant: params.experimentVariant,
      };

      await addDoc(collection(db, 'notificationLogs'), sanitizeFirestoreData(logRecord));

      return { success: true, notificationId };
    } catch (err: any) {
      console.error('Failed to dispatch notification:', err);
      return { success: false, reason: err.message || 'Dispatch failed' };
    }
  }

  // --- Transactional Order Lifecycle Dispatchers ---

  public static async notifyOrderConfirmed(order: Order, customerName?: string): Promise<void> {
    const name = customerName || order.contactName || 'Customer';
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Order Confirmed! (#${cleanId})`,
      message: `Thank you, ${name}! Your order #${cleanId} of ₹${(order.total || 0).toLocaleString()} has been placed and is being prepared.`,
      destinationSlug: `/track-order/${order.customOrderId || order.id}`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyOrderPacked(order: Order): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Order Packed! (#${cleanId})`,
      message: `Your items for order #${cleanId} have been packed with care and will be handed to our delivery partner shortly.`,
      destinationSlug: `/track-order/${order.customOrderId || order.id}`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyOrderShipped(order: Order, carrier?: string, trackingId?: string): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    const carrierText = carrier ? ` via ${carrier}` : '';
    const trackingText = trackingId ? ` (Tracking: ${trackingId})` : '';
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Order Shipped! 🚚 (#${cleanId})`,
      message: `Your order #${cleanId} has shipped${carrierText}${trackingText}. Track real-time progress now.`,
      destinationSlug: `/track-order/${order.customOrderId || order.id}`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyOutForDelivery(order: Order): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Out for Delivery! 📦 (#${cleanId})`,
      message: `Your ViBa Mart order #${cleanId} is out for delivery today. Please ensure someone is available at the address.`,
      destinationSlug: `/track-order/${order.customOrderId || order.id}`,
      orderId: order.id,
      priority: 'critical',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyOrderDelivered(order: Order): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Delivered! 🎉 (#${cleanId})`,
      message: `Your package for order #${cleanId} has been safely delivered. We hope you love your purchase!`,
      destinationSlug: `/track-order/${order.customOrderId || order.id}`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyOrderCancelled(order: Order, reason?: string): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Order Cancelled (#${cleanId})`,
      message: `Order #${cleanId} has been cancelled${reason ? `: ${reason}` : '.'} Any refundable amount will be processed as per policy.`,
      destinationSlug: `/orders`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  public static async notifyRefundProcessed(order: Order, amount?: number): Promise<void> {
    const cleanId = (order.customOrderId || order.id).slice(-6).toUpperCase();
    const amtStr = amount ? `₹${amount.toLocaleString()}` : `the full order amount`;
    await this.dispatchNotification({
      userId: order.customerId,
      category: 'orders',
      title: `Refund Processed (#${cleanId})`,
      message: `Refund of ${amtStr} for order #${cleanId} has been successfully processed to your source account.`,
      destinationSlug: `/orders`,
      orderId: order.id,
      priority: 'high',
      bypassFrequencyLimits: true,
      bypassQuietHours: true,
    });
  }

  // --- Product & Marketing Alerts ---

  public static async notifyPriceDrop(product: Product, previousPrice: number, newPrice: number, userIds: string[]): Promise<void> {
    const discount = Math.round(((previousPrice - newPrice) / previousPrice) * 100);
    if (discount <= 0) return;

    for (const uid of userIds) {
      await this.dispatchNotification({
        userId: uid,
        category: 'price_drops',
        title: `Price Drop Alert: ${product.name}`,
        message: `Great news! "${product.name}" just dropped ${discount}% from ₹${previousPrice} to ₹${newPrice}. Grab it before stock runs out!`,
        image: product.images?.[0] || '',
        destinationSlug: product.slug ? `/products/${product.slug}` : `/products/${product.id}`,
        productId: product.id,
      });
    }
  }

  public static async notifyBackInStock(product: Product, userIds: string[]): Promise<void> {
    for (const uid of userIds) {
      await this.dispatchNotification({
        userId: uid,
        category: 'wishlist',
        title: `Back in Stock! "${product.name}"`,
        message: `An item you showed interest in is now back in stock with fresh inventory. Order yours before it sells out!`,
        image: product.images?.[0] || '',
        destinationSlug: product.slug ? `/products/${product.slug}` : `/products/${product.id}`,
        productId: product.id,
      });
    }
  }

  public static async notifyAbandonedCart(userId: string, firstItem: Product, itemCount: number): Promise<void> {
    const extraText = itemCount > 1 ? ` and ${itemCount - 1} other item${itemCount > 2 ? 's' : ''}` : '';
    await this.dispatchNotification({
      userId,
      category: 'cart',
      title: `You left items in your cart! 🛒`,
      message: `"${firstItem.name}"${extraText} is waiting for you in your ViBa Mart cart. Complete checkout now to guarantee availability.`,
      image: firstItem.images?.[0] || '',
      destinationSlug: `/cart`,
    });
  }

  /**
   * Broadcast Push Notification to All Users, Segment, or Specific User
   */
  public static async broadcastPushNotification(params: {
    target: 'all' | 'segment' | 'user';
    segmentUserIds?: string[];
    targetUserId?: string;
    category: NotificationCategory;
    title: string;
    message: string;
    image?: string;
    destinationSlug?: string;
    ctaText?: string;
    priority?: NotificationPriority;
    campaignId?: string;
    couponCode?: string;
    bypassLimits?: boolean;
  }): Promise<{ success: boolean; sentCount: number; message: string }> {
    let sentCount = 0;

    if (params.target === 'all') {
      const res = await this.dispatchNotification({
        userId: 'all',
        category: params.category,
        title: params.title,
        message: params.message,
        image: params.image,
        destinationSlug: params.destinationSlug || '/',
        ctaText: params.ctaText || 'View Details',
        priority: params.priority || 'high',
        campaignId: params.campaignId,
        couponCode: params.couponCode,
        bypassFrequencyLimits: true,
        bypassQuietHours: params.bypassLimits ?? true,
      });
      if (res.success) {
        return { success: true, sentCount: 1, message: 'Broadcast notification pushed to all active users successfully!' };
      } else {
        return { success: false, sentCount: 0, message: res.reason || 'Failed to dispatch broadcast' };
      }
    }

    if (params.target === 'segment' && params.segmentUserIds && params.segmentUserIds.length > 0) {
      for (const uid of params.segmentUserIds) {
        const res = await this.dispatchNotification({
          userId: uid,
          category: params.category,
          title: params.title,
          message: params.message,
          image: params.image,
          destinationSlug: params.destinationSlug || '/',
          ctaText: params.ctaText || 'View Details',
          priority: params.priority || 'high',
          campaignId: params.campaignId,
          couponCode: params.couponCode,
          bypassFrequencyLimits: params.bypassLimits ?? false,
          bypassQuietHours: params.bypassLimits ?? false,
        });
        if (res.success) sentCount++;
      }
      return { 
        success: sentCount > 0, 
        sentCount, 
        message: `Pushed notification to ${sentCount} user(s) in selected segment.` 
      };
    }

    if (params.target === 'user' && params.targetUserId) {
      const res = await this.dispatchNotification({
        userId: params.targetUserId,
        category: params.category,
        title: params.title,
        message: params.message,
        image: params.image,
        destinationSlug: params.destinationSlug || '/',
        ctaText: params.ctaText || 'View Details',
        priority: params.priority || 'high',
        campaignId: params.campaignId,
        couponCode: params.couponCode,
        bypassFrequencyLimits: true,
        bypassQuietHours: true,
      });
      if (res.success) {
        return { success: true, sentCount: 1, message: 'Notification pushed to user successfully!' };
      } else {
        return { success: false, sentCount: 0, message: res.reason || 'Failed to dispatch to user' };
      }
    }

    return { success: false, sentCount: 0, message: 'No valid target specified' };
  }
}

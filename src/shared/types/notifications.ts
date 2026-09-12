export type NotificationChannel = 'push' | 'in_app' | 'email' | 'sms';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export type NotificationCategory = 
  | 'orders' 
  | 'offers' 
  | 'new_products' 
  | 'price_drops' 
  | 'wishlist' 
  | 'cart' 
  | 'coupons' 
  | 'flash_sales' 
  | 'personalized' 
  | 'system';

export type NotificationEventType =
  | 'product_view'
  | 'product_search'
  | 'category_view'
  | 'product_click'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'wishlist_add'
  | 'wishlist_remove'
  | 'checkout_started'
  | 'purchase'
  | 'payment_success'
  | 'payment_failed'
  | 'order_confirmed'
  | 'order_packed'
  | 'order_shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund'
  | 'coupon_view'
  | 'coupon_purchase'
  | 'notification_delivered'
  | 'notification_open'
  | 'notification_click'
  | 'notification_dismiss'
  | 'notification_ignore';

export interface CustomerNotification {
  id: string;
  userId: string; // 'all' or specific user UID
  category: NotificationCategory;
  title: string;
  message: string;
  image?: string;
  destinationSlug?: string; // e.g. /products/slug or /track-order/id or /rewards
  ctaText?: string;
  priority?: NotificationPriority;
  read: boolean;
  createdAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  convertedAt?: string;
  campaignId?: string;
  templateId?: string;
  productId?: string;
  categoryId?: string;
  orderId?: string;
  couponCode?: string;
  experimentVariant?: 'A' | 'B' | 'control';
  metadata?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  titleTemplate: string; // e.g. "Hey {{customer_name}}, {{product_name}} is {{discount_percent}}% OFF!"
  messageTemplate: string;
  image?: string;
  destinationSlugTemplate?: string;
  ctaText?: string;
  priority: NotificationPriority;
  isActive: boolean;
  channel: NotificationChannel[];
  variables: string[]; // ['customer_name', 'product_name', 'discount_percent', 'order_id', 'offer_expiry', 'cta_url']
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCampaign {
  id: string;
  name: string;
  category: NotificationCategory;
  targetSegmentId: string;
  templateId?: string;
  title?: string;
  message?: string;
  image?: string;
  destinationSlug?: string;
  ctaText?: string;
  productId?: string;
  categoryId?: string;
  couponCode?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  priority: NotificationPriority;
  isAbTest: boolean;
  variantA?: {
    title: string;
    message: string;
    image?: string;
    ctaText?: string;
  };
  variantB?: {
    title: string;
    message: string;
    image?: string;
    ctaText?: string;
  };
  abSplitRatio?: number; // e.g. 50 (50/50 split)
  mlOptimization: boolean; // Use ML send-time and propensity filters
  propensityThreshold?: number; // 0.0 - 1.0
  frequencyCapPerUser?: number; // max per user for this campaign
  startDate?: string;
  endDate?: string;
  targetCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  openCount?: number;
  clickCount?: number;
  conversionCount?: number;
  attributedRevenue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  type: 'rule_based' | 'ml_driven';
  rules?: {
    minOrders?: number;
    maxOrders?: number;
    minSpend?: number;
    maxSpend?: number;
    daysInactive?: number;
    hasAbandonedCart?: boolean;
    hasWishlist?: boolean;
    preferredCategories?: string[];
    priceSensitivity?: 'low' | 'medium' | 'high';
    churnRisk?: 'low' | 'medium' | 'high';
  };
  estimatedCustomerCount?: number;
  lastCalculatedAt?: string;
  isSystemDefault?: boolean;
}

export interface CustomerNotificationPreferences {
  userId: string;
  offers: boolean;
  newProducts: boolean;
  priceDrops: boolean;
  wishlist: boolean;
  cart: boolean;
  coupons: boolean;
  flashSales: boolean;
  personalizedOffers: boolean;
  updatedAt: string;
}

export interface NotificationDevice {
  id?: string;
  userId: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  userAgent?: string;
  deviceModel?: string;
  isEnabled: boolean;
  permissionState: 'granted' | 'denied' | 'default';
  createdAt: string;
  lastActive: string;
}

export interface NotificationEventRecord {
  id?: string;
  userId: string;
  eventType: NotificationEventType;
  productId?: string;
  categoryId?: string;
  orderId?: string;
  campaignId?: string;
  templateId?: string;
  notificationId?: string;
  variant?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface NotificationLog {
  id: string;
  notificationId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  category: NotificationCategory;
  campaignId?: string;
  campaignName?: string;
  templateId?: string;
  title: string;
  message: string;
  destinationSlug?: string;
  sentAt: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  convertedAt?: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'converted' | 'failed' | 'suppressed';
  suppressionReason?: string;
  provider: string; // 'web_push' | 'in_app' | 'fcm' | 'mock_gateway'
  device?: string;
  experimentVariant?: 'A' | 'B' | 'control';
  conversionRevenue?: number;
}

export interface ABTestExperiment {
  id: string;
  campaignId: string;
  name: string;
  status: 'running' | 'paused' | 'completed';
  sampleSize: number;
  confidenceScore: number; // e.g. 0.95 (95%)
  winnerVariant?: 'A' | 'B' | 'none';
  variants: {
    variantId: 'A' | 'B';
    title: string;
    message: string;
    sent: number;
    delivered: number;
    opens: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    conversionRate: number;
  }[];
  createdAt: string;
  completedAt?: string;
}

export interface MLModelStatus {
  modelName: string;
  category: 'recommendation' | 'propensity' | 'churn' | 'ctr' | 'send_time' | 'bandit' | 'nlp_gen';
  version: string;
  status: 'active' | 'training' | 'standby';
  accuracyMetric: string;
  accuracyValue: number;
  samplesProcessed: number;
  lastTrainedAt: string;
  features: string[];
}

export interface NotificationSystemSettings {
  id?: string;
  enableMLAutomation: boolean;
  enableQuietHours: boolean;
  quietHoursStart: number; // 22 (10 PM)
  quietHoursEnd: number; // 8 (8 AM)
  defaultMarketingFrequencyCapPerDay: number; // 2
  defaultMarketingFrequencyCapPerWeek: number; // 7
  minCooldownHoursBetweenMarketing: number; // 6
  cartAbandonmentDelayHours: number; // 2
  priceDropThresholdPercent: number; // 5
  vapidPublicKey?: string;
  fcmEnabled: boolean;
  geminiPersonalizationEnabled: boolean;
  updatedAt: string;
}

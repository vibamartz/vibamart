export type Role = "customer" | "vendor" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  photoURL?: string;
  phone?: string;
  address?: Address;
  addresses?: Address[];
  createdAt: string;
  wishlist?: string[];
  permissions?: string[];
  cart?: CartItem[];
  isVerified?: boolean;
  accountStatus?: 'active' | 'suspended';
}

export interface Address {
  id?: string;
  fullName: string;
  phone: string;
  house: string;
  street: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  zip: string;
  label?: string;
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  description: string;
  fullDescription?: string;
  price: number; // MRP or Original Price
  discountPrice?: number; // Actual Selling Price
  mrp?: number;
  discountPercentage?: number;
  gst?: number;
  categoryId: string;
  categories?: string[];
  subCategoryId?: string;
  nestedSubCategoryId?: string;
  vendorId: string;
  images: string[]; // Up to 6 images
  primaryImage?: string;
  sku?: string;
  tags?: string[]; // Keywords / search tags
  stock: number;
  status: 'active' | 'inactive' | 'draft' | 'out_of_stock';
  rating: number;
  numReviews: number;
  variants?: ProductVariant[];
  features?: string[];
  color?: string; // Common color if no variants or default
  size?: string; // Common size if no variants or default
  specifications?: { key: string; value: string }[];
  taxInclusive?: boolean;
  serviceablePincodes?: string[]; // List of pincodes where product is available. Empty means nationwide.
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  name?: string;
  color?: string;
  size?: string;
  material?: string;
  price?: number;
  extraPrice?: number;
  stock: number;
  sku?: string;
  image?: string;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  icon?: string;
  iconImage?: string;
  color?: string;
  order?: number;
  seoSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
  isVisible?: boolean;
  subcategories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
  image?: string;
  subcategories?: SubCategory[]; // Recursive subcategories
}

export interface WaitlistItem {
  id: string;
  userId: string;
  productId: string;
  email: string;
  createdAt: string;
  status: 'pending' | 'notified';
}

export interface Order {
  id: string;
  customOrderId?: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod: "cod" | "razorpay" | "upi" | "wallet";
  address: Address;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
  trackingId?: string;
  carrier?: string;
  estimatedDelivery?: string;
  statusHistory?: StatusUpdate[];
  deliveryEmailSent?: boolean;
  cancellationReason?: string;
}

export interface StatusUpdate {
  status: OrderStatus;
  timestamp: string;
  message?: string;
  location?: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  productId?: string;
  productIds?: string[];
  userId: string;
  reason: string;
  comments?: string;
  images?: string[];
  refundAmount?: number;
  status: 'requested' | 'under_review' | 'approved' | 'rejected' | 'received_back' | 'refund_processed' | 'pending' | 'pickup_scheduled' | 'collected' | 'returned' | 'refunded';
  trackingId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled" | "returned" | "refunded";

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  product: Product; // Normalized for UI
}

export interface Coupon {
  code: string;
  type: "percent" | "flat";
  value: number;
  minAmount: number;
  expiry: string;
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  subtitle?: string;
  link?: string;
  active: boolean;
  order: number;
  platform?: 'mobile' | 'desktop';
  startDate?: string;
  endDate?: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: string;
  images?: string[];
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'sale' | 'info' | 'critical';
  active: boolean;
  createdAt: string;
}

export interface StoreSettings {
  minKeywords: number;
  enableVoiceSearch: boolean;
  enableVisualSearch: boolean;
  enableBrandFilter: boolean;
  enableRatingFilter: boolean;
  enableDiscountFilter: boolean;
  enableAvailabilityFilter: boolean;
  enableBanner: boolean;
  returnWindowDays?: number;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  type: 'text' | 'voice' | 'visual';
  timestamp: string;
  userId?: string;
}

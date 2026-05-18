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
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
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
  subCategoryId?: string;
  vendorId: string;
  images: string[];
  primaryImage?: string;
  sku?: string;
  tags?: string[];
  stock: number;
  status: 'active' | 'draft' | 'out_of_stock';
  rating: number;
  numReviews: number;
  variants?: ProductVariant[];
  features?: string[];
  color?: string; // Common color if no variants or default
  size?: string; // Common size if no variants or default
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
  subcategories?: SubCategory[];
}

export interface SubCategory {
  id: string;
  name: string;
  image?: string;
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
  images?: string[];
  refundAmount?: number;
  status: 'requested' | 'pending' | 'approved' | 'rejected' | 'pickup_scheduled' | 'collected' | 'returned' | 'refunded';
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

export type OrderStatus = "pending" | "accepted" | "processing" | "shipped" | "pickup_ready" | "fulfilled" | "delivered" | "cancelled" | "rejected" | "returned";

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

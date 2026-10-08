export type Role = "customer" | "vendor" | "admin" | "super_admin";

export function isAdminUser(user: { role?: Role; email?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'super_admin' || user.email === 'vk311779@gmail.com';
}

export function isSuperAdminUser(user: { role?: Role; email?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'super_admin' || user.email === 'vk311779@gmail.com';
}

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
  label?: string; // 'Home' | 'Work' | 'Other'
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

export interface LocationAvailabilityRule {
  id: string;
  type: 'state' | 'city' | 'district_all' | 'district_pincodes' | 'pincode';
  state: string;
  district?: string;
  city?: string;
  pincodes?: string[]; // Array of pincodes if type is 'district_pincodes' or 'pincode'
  enabled: boolean; // toggle rule active/inactive
  createdAt?: string;
}

export interface Product {
  id: string;
  slug?: string;
  name: string;
  brand?: string;
  description: string;
  fullDescription?: string;
  price: number; // MRP or Original Price
  discountPrice?: number; // Actual Selling Price
  mrp?: number;
  discountPercentage?: number;
  gst?: number;
  enableGst?: boolean;
  categoryId: string;
  categories?: string[];
  subCategoryId?: string;
  nestedSubCategoryId?: string;
  vendorId: string;
  images: string[]; // Up to 10 images
  primaryImage?: string;
  sku?: string;
  productCode?: string; // Auto-generated 12-digit numeric product code (Format: 8900 0996 XXXX)
  tags?: string[]; // Keywords / search tags
  stock: number;
  inStock?: boolean;
  status: 'active' | 'inactive' | 'draft' | 'out_of_stock';
  rating: number;
  numReviews: number;
  familyId?: string; // Product family group ID for linked products (e.g. "FORMAL_SHIRT_001", "IPHONE_15_SERIES")
  familyAttributeName?: string; // Variant attribute connecting the family (e.g. "Color", "Storage", "Size", "Capacity", "RAM", "Pack Size", etc.)
  familyAttributeValue?: string; // Specific attribute value for this product in the family (e.g. "Maroon", "128GB", "XL")
  familyAttributeOrder?: number; // Sorting/display order in the family matrix
  familyColorName?: string; // Optional custom color name for family matrix (e.g. "Maroon") - legacy backward compatibility
  familyThumbnail?: string; // Optional custom thumbnail URL for family matrix
  familyColorHex?: string; // Optional color hex for family color swatch
  familyColorOrder?: number; // Sorting/display order in the family matrix (e.g. 1, 2, 3) - legacy backward compatibility
  variants?: ProductVariant[];
  variantAttributesList?: VariantAttribute[]; // Dynamic Universal Attribute Definitions (Unlimited attributes & values)
  features?: string[];
  color?: string; // Common color if no variants or default
  size?: string; // Common size if no variants or default
  sizes?: string[]; // Available sizes for this product
  sizeChart?: string; // Size Chart image URL or matrix
  variantAttributes?: string[]; // Enabled variant attribute types e.g. ['color', 'size', 'ram', 'storage', 'shade', 'material', 'volume', 'model']
  specifications?: { key: string; value: string }[];
  variantSpecifications?: Record<string, { key: string; value: string }[]>; // Universal: keyed by attribute value (e.g. '128GB', 'M', '1kg'), combinationKey, or variantId
  specificationsByVariant?: Record<string, { key: string; value: string }[]>; // Alias for variantSpecifications
  sizeSpecifications?: Record<string, { key: string; value: string }[]>; // Size-specific specifications (e.g. { 'M': [{ key: 'Chest', value: '40' }] })
  specificationsBySize?: Record<string, { key: string; value: string }[]>; // Alias for sizeSpecifications
  taxInclusive?: boolean;
  serviceablePincodes?: string[]; // List of pincodes where product is available. Empty means nationwide.
  availabilityRules?: LocationAvailabilityRule[]; // Configured location availability rules (State, City, District, PIN Codes)
  deliveryDays?: number;
  expectedDelivery?: string;
  estimatedDelivery?: string;
  isCodAllowed?: boolean; // Admin toggle for COD availability (default true)
  isStockVisible?: boolean; // Admin toggle for stock visibility (default true)
  isFreeDelivery?: boolean; // Admin toggle for free delivery eligibility on this product (default true)
  isVisible?: boolean; // Admin toggle for customer storefront visibility (default true)
  enableCustomerSupport?: boolean;
  customerSupportText?: string;
  enableReturnPeriod?: boolean;
  returnPeriodDays?: number;
  returnPeriodText?: string;
  enableDoorstepCancellation?: boolean;
  isReturnable?: boolean;
  enableReturns?: boolean;
  returnPolicy?: string;
  noReturnsText?: string;
  enableWarranty?: boolean;
  warrantyPeriod?: string;
  enableBrandSupport?: boolean;
  brandSupportText?: string;
  isDeal259?: boolean; // Tagged as assigned to Deal 259
  deal259Price?: number; // Custom Deal 259 price
  deal259SubDealId?: string; // ID of Sub-Deal under Deal 259
  deal259Order?: number; // Sorting/Display order position in Deal 259
  deal259Status?: 'active' | 'disabled'; // Status specifically for Deal 259
  showInGeneralStore?: boolean; // Admin explicit toggle to also display this product on standard non-Deal259 store pages
  createdAt: string;
}

export interface FamilyProductVariant {
  productId: string;
  productSlug?: string;
  productCode?: string;
  attributeName?: string; // e.g. "Color", "Storage", "Size", "RAM", "Capacity", "Pack Size", "Material", "Style", "Model", etc.
  attributeValue: string; // e.g. "Maroon", "128GB", "XL", "Pack of 2"
  color: string; // Backward-compatible alias for attributeValue
  thumbnail?: string;
  hex?: string;
  displayOrder: number;
  price?: number;
  mrp?: number;
  inStock: boolean;
  stock?: number;
  productName: string;
  isCurrentProduct?: boolean;
}

export type FamilyColorVariant = FamilyProductVariant; // Backward-compatible alias

export interface ProductFamilyMatrix {
  familyId: string;
  attributeName?: string;
  variants: FamilyProductVariant[];
  colorVariants?: FamilyColorVariant[]; // Backward-compatible alias
}

export interface VariantAttributeValue {
  id: string;
  name: string; // e.g. "Midnight Blue", "128GB", "XL"
  value?: string; // Optional raw value
  hex?: string; // Optional hex code for colors
  image?: string; // Optional image / swatch preview
  disabled?: boolean;
  linkedProductId?: string; // Optional Linked Product ID for linked product navigation
  linkedProductName?: string; // Optional display name for the linked product
}

export interface VariantAttribute {
  id: string; // e.g. "attr_color", "attr_size", or unique string
  name: string; // e.g. "Color", "Size", "RAM", "Storage", "Capacity", "Pack Size", "Material", "Style", "Model"
  type?: 'color' | 'text' | 'button' | 'select' | 'image' | 'dropdown' | 'swatch';
  displayType?: 'image' | 'button' | 'dropdown' | 'text' | 'swatch';
  values: VariantAttributeValue[];
  disabled?: boolean;
  required?: boolean;
  sortOrder?: number;
}

export interface CategoryVariantTemplate {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  attributes: {
    name: string;
    displayType: 'image' | 'button' | 'dropdown' | 'text' | 'swatch';
    suggestedValues?: string[];
  }[];
}

export interface ProductVariant {
  id: string;
  productId?: string;
  name?: string; // Combination display title e.g. "Midnight Blue / 128GB / 8GB"
  attributes?: Record<string, string>; // Canonical attribute map: { [attributeName: string]: valueName }
  attributeValues?: Record<string, string>; // Map of attributeId -> valueId or valueName
  combinationKey?: string; // Deterministic normalized key e.g. "color:black|ram:8gb|storage:256gb"
  sku?: string;
  barcode?: string;
  price?: number; // Selling price
  mrp?: number; // Maximum retail price
  discountPrice?: number; // Selling price (alias for price)
  discountPercentage?: number;
  extraPrice?: number; // Legacy extra price offset
  stock: number;
  lowStockThreshold?: number;
  inStock?: boolean;
  status?: 'active' | 'disabled' | 'out_of_stock' | 'archived';
  disabled?: boolean;
  isArchived?: boolean;
  image?: string;
  images?: string[];
  weight?: number | string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  } | string;
  linkedProductId?: string; // Optional Linked Product ID for the specific variant
  linkedProductName?: string; // Optional display name for the linked product
  // Legacy product attributes (for backward compatibility)
  color?: string;
  colorHex?: string;
  colorName?: string;
  size?: string;
  shoeSize?: string;
  storage?: string;
  ram?: string;
  shade?: string;
  volume?: string;
  material?: string;
  model?: string;
}

export interface Deal259SubDeal {
  id: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  price?: number; // e.g. 259
  icon?: string;
  active: boolean;
  order: number;
}

export interface Deal259PageConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  bannerImage?: string;
  badgeText?: string;
  countdownEnd?: string;
  subDeals?: Deal259SubDeal[];
  categories?: string[];
  updatedAt?: string;
}

export interface Category {
  id: string;
  slug?: string;
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
  slug?: string;
  name: string;
  image?: string;
  icon?: string;
  description?: string;
  badgeText?: string;
  order?: number;
  isActive?: boolean;
  isVisible?: boolean;
  subcategories?: SubCategory[]; // Recursive subcategories
}

export interface VisualNestedSubcategory {
  id: string;
  name: string;
  slug?: string;
  seoSlug?: string;
  description?: string;
  image: string;
  categoryId: string; // Dynamic Parent Category ID
  categoryName?: string;
  subCategoryId: string; // Dynamic Parent SubCategory ID
  subCategoryName?: string;
  order: number;
  isActive: boolean;
  isVisible?: boolean;
  badgeText?: string; // e.g. "Trending", "Hot", "New", "Top Pick"
  seoTitle?: string;
  seoDescription?: string;
  createdAt?: string;
  updatedAt?: string;
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
  paymentReference?: string;
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
  invoiceNumber?: string;
  invoiceDate?: string;
  deliveryDate?: string;
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
  customOrderId?: string;
  contactEmail?: string;
  type?: 'return' | 'cancellation' | 'refund';
  productId?: string;
  productIds?: string[];
  userId: string;
  reason: string;
  comments?: string;
  images?: string[];
  refundAmount?: number;
  status: 'requested' | 'under_review' | 'approved' | 'rejected' | 'received_back' | 'refund_processed' | 'pending' | 'pickup_scheduled' | 'collected' | 'returned' | 'refunded' | 'product_received' | 'quality_check' | 'refund_initiated' | 'refund_completed' | 'Pending' | 'Approved' | 'Rejected' | 'Processed';
  trackingId?: string;
  createdAt: string;
  updatedAt?: string;
  requestReason?: string;
  adminNotes?: string;
  refundMethod?: string;
  refundTransactionId?: string;
  estimatedCompletionDate?: string;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  selectedVariant?: string;
  selectedAttributes?: Record<string, string>;
  sku?: string;
  name: string;
  price: number;
  mrp?: number;
  quantity: number;
  image: string;
  gst?: number;
  enableGst?: boolean;
}

export type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancel_requested" | "cancel_rejected" | "cancelled" | "returned" | "refunded";

export interface CartItem {
  productId: string;
  variantId?: string;
  selectedAttributes?: Record<string, string>;
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
  slug?: string;
  categoryId?: string;
  productIds?: string[];
  active?: boolean;
  order: number;
  platform?: 'mobile' | 'desktop' | 'all';
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
  enableManualCancellation?: boolean;

  // Delivery & Service Details Settings
  enableCustomerSupport?: boolean;
  customerSupportText?: string;
  enableReturnPeriod?: boolean;
  returnPeriodDays?: number;
  returnPeriodText?: string;
  enableDoorstepCancellation?: boolean;
  enableReturns?: boolean;
  returnsText?: string;
  noReturnsText?: string;
  enableCod?: boolean;
  enableFreeDelivery?: boolean;
  enableWarranty?: boolean;
  warrantyPeriod?: string;
  enableBrandSupport?: boolean;
  brandSupportText?: string;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  type: 'text' | 'voice' | 'visual';
  timestamp: string;
  userId?: string;
}

export interface FeatureConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  availability: 'all' | 'desktop' | 'mobile';
  category: 'loyalty' | 'shopping' | 'marketing' | 'search' | 'customer';
  icon?: string;
  permissions?: string[];
  backendConfig?: Record<string, any>;
  updatedAt?: string;
}

export interface RewardTransaction {
  id: string;
  userId: string;
  title: string;
  type: 'earned' | 'spent';
  points: number;
  date: string;
  description?: string;
}

export interface BrandCoupon {
  id: string;
  slug?: string;
  brandName: string;
  brandLogo: string;
  brandWebsiteUrl?: string;
  title: string;
  code: string;
  discountType: 'percent' | 'flat' | 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
  productImage: string;
  catalogImages?: string[];
  buyNowPrice: number;
  pointsRequired?: number;
  validFrom: string;
  expiryDate: string;
  expiryDays?: number;
  totalQuantity: number;
  remainingQuantity: number;
  active: boolean;
  featured?: boolean;
  category?: string;
  subcategory?: string;
  terms?: string;
  description?: string;
  icon?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  // Dynamic fields
  minPurchase?: number;
  usageLimit?: number;
  eligibilityTier?: 'all' | 'Silver' | 'Gold' | 'Platinum';
  imageUrl?: string;
  productIds?: string[];
  disabledProductIds?: string[];
}

export interface RewardOffer extends BrandCoupon {}
export interface RewardVoucher extends BrandCoupon {}

export interface RewardOrder {
  id: string; // e.g. RWD-ORD-1724419200000
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  couponId: string;
  brandName: string;
  brandLogo?: string;
  productTitle: string;
  productImage?: string;
  couponTitle: string;
  discountType: 'percent' | 'flat' | 'percentage' | 'fixed';
  discountValue: number;
  amountPaid: number;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'cod' | 'wallet' | 'points' | 'razorpay';
  paymentReference?: string;
  paymentProofUrl?: string;
  paymentStatus: 'pending' | 'submitted' | 'confirmed' | 'rejected';
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  couponStatus: 'locked' | 'unlocked' | 'used' | 'expired';
  unlockedCode?: string;
  unlockDate?: string;
  validFrom: string;
  expiryDate: string;
  brandWebsiteUrl?: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface RewardsSectionConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  badgeText: string;
  headerIcon: string;
  headerIconUrl?: string;
  bannerImage?: string;
  cardImage?: string;
  cardText: string;
  buttonText: string;
  targetLink: string;
  nonRefundableNotice?: string;
  pointsPerRupee: number;
  welcomeBonusPoints: number;
  minRedeemPoints: number;
  earningRules: string;
  redemptionRules: string;
  termsAndConditions: string;
  updatedAt?: string;
}

export interface UserRewards {
  userId: string;
  pointsBalance: number;
  totalEarned: number;
  totalSpent: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  claimedVouchers?: string[];
  transactions?: RewardTransaction[];
}

export interface CashbackConfig {
  enabled: boolean;
  firstOrderAmount: number; // ₹30 - ₹100
  secondOrderAmount: number; // ₹30 - ₹100
  thirdOrderAmount: number; // ₹30 - ₹100
  minOrderValue?: number;
  returnPeriodDays: number;
  title: string;
  subtitle: string;
  termsAndConditions: string;
  updatedAt?: string;
}

export interface CustomerPayoutInfo {
  payoutType: 'upi' | 'bank';
  upiId?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  updatedAt?: string;
}

export interface CashbackRecord {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  orderId: string;
  customOrderId?: string;
  orderDate: string;
  orderTotal: number;
  monthKey: string; // "YYYY-MM"
  monthName: string; // "October 2026"
  position: 1 | 2 | 3;
  amount: number;
  status: 'pending' | 'eligible' | 'paid' | 'failed';
  orderStatus: OrderStatus;
  returnPeriodEnd: string;
  payoutInfo?: CustomerPayoutInfo;
  payoutDate?: string;
  payoutReference?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export * from './notifications';


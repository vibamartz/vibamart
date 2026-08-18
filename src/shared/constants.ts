import { Category, RewardsSectionConfig, RewardOffer } from './types';

export const DEFAULT_REWARDS_CONFIG: RewardsSectionConfig = {
  enabled: true,
  title: 'Shop, Earn Points & Unlock Exclusive Discounts',
  subtitle: 'Earn 1 point for every ₹10 spent. Redeem your accumulated points for instant cash vouchers, discount coupons, and VIP tier benefits across all categories.',
  badgeText: 'ViBa Club Rewards',
  headerIcon: 'Gift',
  headerIconUrl: '',
  cardImage: '',
  cardText: 'Earn 1 point per ₹10 spent. Redeem points for instant discounts & vouchers!',
  buttonText: 'Redeem Voucher',
  targetLink: '/rewards',
  pointsPerRupee: 0.1,
  welcomeBonusPoints: 250,
  minRedeemPoints: 100,
  earningRules: 'Earn 1 point for every ₹10 spent on completed store orders. Points credited upon delivery.',
  redemptionRules: 'Vouchers can be claimed using your active points balance. Minimum purchase thresholds apply per voucher code.',
  termsAndConditions: 'Reward points and claimed voucher codes are non-transferable and subject to specified expiry periods. Store management reserves all rights.',
};

export const DEFAULT_VOUCHERS: RewardOffer[] = [
  {
    id: 'vouch-100',
    title: '₹100 Instant Discount',
    description: 'Valid on orders over ₹499 across all categories.',
    pointsRequired: 100,
    discountValue: 100,
    discountType: 'fixed',
    code: 'REWARD100',
    expiryDays: 30,
    category: 'All Products',
    icon: 'Gift',
    minPurchase: 499,
    usageLimit: 1,
    eligibilityTier: 'all',
    active: true,
    order: 1
  },
  {
    id: 'vouch-250',
    title: '₹250 Super Saver',
    description: 'Valid on orders over ₹1,299 in Electronics & Fashion.',
    pointsRequired: 250,
    discountValue: 250,
    discountType: 'fixed',
    code: 'REWARD250',
    expiryDays: 30,
    category: 'Electronics & Fashion',
    icon: 'Sparkles',
    minPurchase: 1299,
    usageLimit: 1,
    eligibilityTier: 'Silver',
    active: true,
    order: 2
  },
  {
    id: 'vouch-500',
    title: '₹500 VIP Voucher',
    description: 'Valid on orders over ₹2,499. Exclusive for loyal members.',
    pointsRequired: 500,
    discountValue: 500,
    discountType: 'fixed',
    code: 'REWARD500VIP',
    expiryDays: 45,
    category: 'Storewide',
    icon: 'Award',
    minPurchase: 2499,
    usageLimit: 1,
    eligibilityTier: 'Gold',
    active: true,
    order: 3
  },
  {
    id: 'vouch-15pct',
    title: '15% Off Mega Coupon',
    description: 'Max discount ₹300. Valid on any purchase.',
    pointsRequired: 300,
    discountValue: 15,
    discountType: 'percentage',
    code: 'REWARD15PCT',
    expiryDays: 30,
    category: 'Storewide',
    icon: 'Tag',
    minPurchase: 0,
    usageLimit: 1,
    eligibilityTier: 'all',
    active: true,
    order: 4
  }
];


export const CATEGORIES: Category[] = [
  {
    id: 'all-deals',
    name: 'All Deals',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop',
    iconImage: '🔥',
    color: '#ef4444',
    order: -1,
    subcategories: []
  },
  { 
    id: '1', 
    name: 'Mobiles', 
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', 
    icon: 'smartphone',
    subcategories: [
      { id: '1-1', name: 'Smartphones', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200&h=200&fit=crop' },
      { id: '1-2', name: 'Accessories', image: 'https://images.unsplash.com/photo-1546868881-d8ec61af6f8c?w=200&h=200&fit=crop' },
      { id: '1-3', name: 'Tablets', image: 'https://images.unsplash.com/photo-1544244015-0cd4b3ff3f9d?w=200&h=200&fit=crop' }
    ]
  },
  { 
    id: '2', 
    name: 'Fashion', 
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop', 
    icon: 'shirt',
    subcategories: [
      { id: '2-1', name: 'Men', image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=200&h=200&fit=crop' },
      { id: '2-2', name: 'Women', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&h=200&fit=crop' },
      { id: '2-3', name: 'Kids', image: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e6?w=200&h=200&fit=crop' },
      { id: '2-4', name: 'Footwear', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop' }
    ]
  },
  { 
    id: '3', 
    name: 'Electronics', 
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop', 
    icon: 'laptop',
    subcategories: [
      { id: '3-1', name: 'Laptops', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop' },
      { id: '3-2', name: 'Audio', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop' },
      { id: '3-3', name: 'Cameras', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop' },
      { id: '3-4', name: 'Gaming', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop' }
    ]
  },
  { 
    id: '4', 
    name: 'Home', 
    image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=400&fit=crop', 
    icon: 'home',
    subcategories: [
      { id: '4-1', name: 'Furniture', image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=200&h=200&fit=crop' },
      { id: '4-2', name: 'Decor', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&h=200&fit=crop' },
      { id: '4-3', name: 'Kitchen', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=200&h=200&fit=crop' }
    ]
  },
  { 
    id: '5', 
    name: 'Beauty', 
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop', 
    icon: 'sparkles',
    subcategories: [
      { id: '5-1', name: 'Skincare', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop' },
      { id: '5-2', name: 'Makeup', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&h=200&fit=crop' },
      { id: '5-3', name: 'Haircare', image: 'https://images.unsplash.com/photo-1527799822367-a2da39db36f3?w=200&h=200&fit=crop' }
    ]
  },
  { 
    id: '6', 
    name: 'Appliances', 
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop', 
    icon: 'tv',
    subcategories: [
      { id: '6-1', name: 'Televisions', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=200&h=200&fit=crop' },
      { id: '6-2', name: 'Refrigerators', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop' },
      { id: '6-3', name: 'Washing Machines', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop' }
    ]
  },
  {
    id: '7',
    name: 'Toys',
    image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&h=400&fit=crop',
    icon: 'sparkles',
    subcategories: []
  },
  {
    id: '8',
    name: 'Food & Health',
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=400&fit=crop',
    icon: 'sparkles',
    subcategories: []
  },
];

export const AVAILABLE_PERMISSIONS = [
  'can_edit_products',
  'can_delete_products',
  'can_view_orders',
  'can_edit_orders',
  'can_manage_users',
  'can_view_analytics',
  'can_manage_banners',
  'can_manage_features'
];

export const DEFAULT_FEATURES = [
  {
    id: 'rewards',
    name: 'Rewards & Loyalty Points',
    description: 'Enable customer points balance, tier rewards, and discount voucher redemptions.',
    enabled: true,
    availability: 'all',
    category: 'loyalty',
    icon: 'Gift',
    backendConfig: { pointsPerRupee: 0.1, minRedeemPoints: 100 }
  },
  {
    id: 'wishlist',
    name: 'Wishlist & Favorites',
    description: 'Allow customers to save products to wishlist for future purchase.',
    enabled: true,
    availability: 'all',
    category: 'shopping',
    icon: 'Heart',
    backendConfig: { maxItems: 100 }
  },
  {
    id: 'reviews',
    name: 'Product Reviews & Ratings',
    description: 'Customer rating submissions and photo reviews with admin moderation.',
    enabled: true,
    availability: 'all',
    category: 'customer',
    icon: 'Star',
    backendConfig: { autoApprove: false }
  },
  {
    id: 'offers',
    name: 'Offers & Promotional Deals',
    description: 'Dedicated promotional section and offer page banners.',
    enabled: true,
    availability: 'all',
    category: 'marketing',
    icon: 'Tag',
    backendConfig: { highlightDeals: true }
  },
  {
    id: 'coupons',
    name: 'Discount Coupons & Promo Codes',
    description: 'Cart coupon validation for flat or percentage discounts.',
    enabled: true,
    availability: 'all',
    category: 'marketing',
    icon: 'Ticket',
    backendConfig: { allowStacking: false }
  },
  {
    id: 'notifications',
    name: 'Push & App Notifications',
    description: 'In-app alert notifications for order status changes and special sales.',
    enabled: true,
    availability: 'all',
    category: 'customer',
    icon: 'Bell',
    backendConfig: { soundEnabled: true }
  },
  {
    id: 'recentlyViewed',
    name: 'Recently Viewed Products',
    description: 'Track and display user browsing history across devices.',
    enabled: true,
    availability: 'all',
    category: 'shopping',
    icon: 'History',
    backendConfig: { limit: 10 }
  },
  {
    id: 'recommendations',
    name: 'AI Product Recommendations',
    description: 'Personalized product suggestions based on purchase history.',
    enabled: true,
    availability: 'all',
    category: 'shopping',
    icon: 'Sparkles',
    backendConfig: { algorithm: 'collaborative' }
  },
  {
    id: 'voiceSearch',
    name: 'Voice Search',
    description: 'Hands-free voice recognition search in product listings.',
    enabled: true,
    availability: 'all',
    category: 'search',
    icon: 'Mic',
    backendConfig: { language: 'en-US' }
  },
  {
    id: 'cameraSearch',
    name: 'Visual & Camera Search',
    description: 'Upload product images to search similar products.',
    enabled: true,
    availability: 'all',
    category: 'search',
    icon: 'Camera',
    backendConfig: {}
  },
  {
    id: 'pincodeChecker',
    name: 'Pincode Serviceability Checker',
    description: 'Check item delivery eligibility before adding to cart.',
    enabled: true,
    availability: 'all',
    category: 'shopping',
    icon: 'MapPin',
    backendConfig: { defaultPincode: '560064' }
  }
];



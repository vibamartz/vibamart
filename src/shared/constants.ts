import { Category, RewardsSectionConfig, BrandCoupon } from './types';

export const DEFAULT_REWARDS_CONFIG: RewardsSectionConfig = {
  enabled: true,
  title: 'Exclusive Brand Rewards & Instant Discount Vouchers',
  subtitle: 'Claim premium brand coupons, cash discounts, and partner vouchers across Top Brands. Verified after payment confirmation.',
  badgeText: 'ViBa Official Brand Coupons',
  headerIcon: 'Gift',
  headerIconUrl: '',
  bannerImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop',
  cardImage: '',
  cardText: 'Unlock up to 50% Off top partner brands. Code unlocked instantly after admin payment confirmation!',
  buttonText: 'Buy Reward Coupon',
  targetLink: '/rewards',
  nonRefundableNotice: '⚠️ NON REFUNDABLE',
  pointsPerRupee: 0.1,
  welcomeBonusPoints: 250,
  minRedeemPoints: 100,
  earningRules: 'Earn 1 point for every ₹10 spent on completed store orders. Points credited upon order delivery.',
  redemptionRules: 'Buy brand coupons directly or redeem points balance. Coupon codes remain locked (XXX-XXX-XXX-XXX) until payment is confirmed by Admin.',
  termsAndConditions: 'All brand coupon purchases are strictly NON-REFUNDABLE. Coupon codes are valid until specified expiry date.',
};

export const DEFAULT_BRAND_COUPONS: BrandCoupon[] = [
  {
    id: 'vouch-nike-01',
    brandName: 'Nike',
    brandLogo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&h=150&fit=crop',
    brandWebsiteUrl: 'https://www.nike.com',
    title: 'Flat ₹500 Off Nike Footwear & Apparel',
    description: 'Get ₹500 discount on Nike official store orders above ₹2,499. Includes sneakers & sportswear.',
    code: 'NIKE-SUMMER-500',
    discountType: 'flat',
    discountValue: 500,
    minOrderValue: 2499,
    maxDiscount: 500,
    productImage: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop',
    catalogImages: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=600&fit=crop'
    ],
    buyNowPrice: 49,
    pointsRequired: 100,
    validFrom: '2026-08-01T00:00:00.000Z',
    expiryDate: '2026-12-31T23:59:59.000Z',
    totalQuantity: 100,
    remainingQuantity: 84,
    active: true,
    featured: true,
    category: 'Fashion & Apparel',
    subcategory: 'Footwear',
    order: 1,
    terms: 'Valid once per user. Applicable on non-discounted catalog items at official Nike stores.',
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    id: 'vouch-apple-02',
    brandName: 'Apple Partner',
    brandLogo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=150&h=150&fit=crop',
    brandWebsiteUrl: 'https://www.apple.com/in',
    title: '10% Instant Cash Discount on Apple Accessories',
    description: 'Save 10% up to ₹2,000 on official Apple Accessories, AirPods & cases.',
    code: 'APPLE-ACC-10PCT',
    discountType: 'percent',
    discountValue: 10,
    minOrderValue: 4999,
    maxDiscount: 2000,
    productImage: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&h=600&fit=crop',
    catalogImages: [
      'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop'
    ],
    buyNowPrice: 99,
    pointsRequired: 250,
    validFrom: '2026-08-10T00:00:00.000Z',
    expiryDate: '2026-11-30T23:59:59.000Z',
    totalQuantity: 50,
    remainingQuantity: 29,
    active: true,
    featured: true,
    category: 'Electronics',
    subcategory: 'Audio & Mobile Accessories',
    order: 2,
    terms: 'Cannot be combined with student trade-in promotions. Valid online & participating premium resellers.',
    createdAt: '2026-08-10T00:00:00.000Z'
  },
  {
    id: 'vouch-puma-03',
    brandName: 'Puma',
    brandLogo: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=150&h=150&fit=crop',
    brandWebsiteUrl: 'https://in.puma.com',
    title: 'Flat ₹300 Off Puma Running Shoes',
    description: 'Special discount coupon on Puma Nitro & Running shoe lineup.',
    code: 'PUMA-RUN-300',
    discountType: 'flat',
    discountValue: 300,
    minOrderValue: 1499,
    maxDiscount: 300,
    productImage: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=600&fit=crop',
    catalogImages: [
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&h=600&fit=crop'
    ],
    buyNowPrice: 29,
    pointsRequired: 75,
    validFrom: '2026-08-15T00:00:00.000Z',
    expiryDate: '2026-10-15T23:59:59.000Z',
    totalQuantity: 150,
    remainingQuantity: 112,
    active: true,
    featured: false,
    category: 'Sports & Outdoors',
    subcategory: 'Running Gear',
    order: 3,
    terms: 'Valid on Puma India website and app orders.',
    createdAt: '2026-08-15T00:00:00.000Z'
  },
  {
    id: 'vouch-sephora-04',
    brandName: 'Sephora',
    brandLogo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=150&h=150&fit=crop',
    brandWebsiteUrl: 'https://www.sephora.in',
    title: '15% Off Luxury Beauty & Skincare',
    description: 'Enjoy 15% discount on all premium fragrances, cosmetics & skincare products.',
    code: 'SEPHORA-GLOW-15',
    discountType: 'percent',
    discountValue: 15,
    minOrderValue: 1999,
    maxDiscount: 1000,
    productImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop',
    catalogImages: [
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=600&fit=crop'
    ],
    buyNowPrice: 69,
    pointsRequired: 150,
    validFrom: '2026-08-01T00:00:00.000Z',
    expiryDate: '2026-09-30T23:59:59.000Z',
    totalQuantity: 80,
    remainingQuantity: 43,
    active: true,
    featured: true,
    category: 'Beauty & Personal Care',
    subcategory: 'Skincare',
    order: 4,
    terms: 'Valid on purchases above ₹1,999. Max discount ₹1,000.',
    createdAt: '2026-08-01T00:00:00.000Z'
  }
];

export const DEFAULT_VOUCHERS: BrandCoupon[] = DEFAULT_BRAND_COUPONS;



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
  'can_manage_roles',
  'can_view_analytics',
  'can_manage_banners',
  'can_manage_features',
  'can_full_admin_access'
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



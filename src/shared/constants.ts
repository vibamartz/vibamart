import { Category, RewardsSectionConfig, BrandCoupon, CashbackConfig } from './types';

export const DEFAULT_CASHBACK_CONFIG: CashbackConfig = {
  enabled: true,
  firstOrderAmount: 50,
  secondOrderAmount: 75,
  thirdOrderAmount: 100,
  title: 'Earn Cashback on Your First 3 Orders Every Month',
  subtitle: 'Complete your first 3 eligible orders each calendar month to unlock guaranteed cashback transferred directly to your UPI or Bank account.',
  returnPeriodDays: 7,
  termsAndConditions: `1. Monthly Cashback Rewards:\n1st Eligible Order: ₹30 - ₹100 Cashback\n• 2nd Eligible Order: ₹30 - ₹100 Cashback\n• 3rd Eligible Order: ₹30 - ₹100 Cashback\n2. Monthly Progress (0 → 1 → 2 → 3): Monthly progress starts again from 0 at the beginning of each new calendar month and is tracked as 0 → 1 → 2 → 3.\n3. Pending Period: Cashback remains pending until the applicable product return/cancellation period has ended.\n4. Order Eligibility: Cancelled, returned, or otherwise ineligible orders do not receive finalized cashback according to the existing eligibility rules.\n5. Direct Payouts: Eligible cashback can be transferred directly to the customer's UPI ID or bank account.\n6. Lifetime History: Cashback history remains available to the customer, and previous months' cashback history is not deleted when the new month begins.\n7. Program Conditions: All cashback eligibility and payout conditions are controlled by the existing cashback system.`,
};


export const DEFAULT_REWARDS_CONFIG: RewardsSectionConfig = {
  enabled: true,
  title: 'Exclusive Brand Rewards & Instant Discount Vouchers',
  subtitle: 'Claim premium brand coupons, cash discounts, and partner vouchers across Top Brands. Verified after payment confirmation.',
  badgeText: 'ViBa Official Brand Coupons',
  headerIcon: 'Gift',
  headerIconUrl: '',
  bannerImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop',
  cardImage: '',
  cardText: 'Unlock up to 50% Off top partner brands. Code unlocked instantly after payment confirmation!',
  buttonText: 'Buy Reward Coupon',
  targetLink: '/rewards',
  nonRefundableNotice: '⚠️ NON REFUNDABLE',
  pointsPerRupee: 0.1,
  welcomeBonusPoints: 250,
  minRedeemPoints: 100,
  earningRules: 'Earn 1 point for every ₹10 spent on completed store orders. Points credited upon order delivery.',
  redemptionRules: 'Buy brand coupons directly or redeem points balance. Coupon codes remain locked (XXX-XXX-XXX-XXX) until payment is confirmed.',
  termsAndConditions: 'All brand coupon purchases are strictly NON-REFUNDABLE. Coupon codes are valid until specified expiry date.',
};

export const DEFAULT_BRAND_COUPONS: BrandCoupon[] = [
  {
    id: 'vouch-nike-01',
    slug: 'flat-500-off-nike-footwear-apparel',
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
    slug: '10-percent-instant-cash-discount-apple-accessories',
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
    slug: 'flat-300-off-puma-running-shoes',
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
    slug: '15-percent-off-luxury-beauty-skincare',
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
    slug: 'all-deals',
    seoSlug: 'all-deals',
    name: 'All Deals',
    image: undefined,
    icon: 'flame',
    iconImage: '🔥',
    color: '#ef4444',
    order: -1,
    subcategories: []
  },
  { 
    id: '1', 
    slug: 'mobiles',
    seoSlug: 'mobiles',
    name: 'Mobiles', 
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop', 
    icon: 'smartphone',
    subcategories: [
      { 
        id: '1-1', 
        slug: 'smartphones', 
        name: 'Smartphones', 
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200&h=200&fit=crop',
        subcategories: [
          { id: '1-1-1', slug: 'android-phones', name: 'Android Phones', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200&h=200&fit=crop' },
          { id: '1-1-2', slug: 'iphones', name: 'iPhones & iOS', image: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=200&h=200&fit=crop' },
          { id: '1-1-3', slug: '5g-smartphones', name: '5G Phones', image: 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=200&h=200&fit=crop' },
          { id: '1-1-4', slug: 'foldable-phones', name: 'Foldable Phones', image: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '1-2', 
        slug: 'accessories', 
        name: 'Accessories', 
        image: 'https://images.unsplash.com/photo-1546868881-d8ec61af6f8c?w=200&h=200&fit=crop',
        subcategories: [
          { id: '1-2-1', slug: 'cases-covers', name: 'Cases & Covers', image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=200&h=200&fit=crop' },
          { id: '1-2-2', slug: 'chargers-cables', name: 'Chargers & Cables', image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=200&h=200&fit=crop' },
          { id: '1-2-3', slug: 'screen-protectors', name: 'Screen Protectors', image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=200&h=200&fit=crop' },
          { id: '1-2-4', slug: 'power-banks', name: 'Power Banks', image: 'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '1-3', 
        slug: 'tablets', 
        name: 'Tablets', 
        image: 'https://images.unsplash.com/photo-1544244015-0cd4b3ff3f9d?w=200&h=200&fit=crop',
        subcategories: [
          { id: '1-3-1', slug: 'ipads', name: 'iPads', image: 'https://images.unsplash.com/photo-1544244015-0cd4b3ff3f9d?w=200&h=200&fit=crop' },
          { id: '1-3-2', slug: 'android-tablets', name: 'Android Tablets', image: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=200&h=200&fit=crop' },
          { id: '1-3-3', slug: 'drawing-tablets', name: 'Drawing Tablets', image: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  { 
    id: '2', 
    slug: 'fashion', 
    seoSlug: 'fashion',
    name: 'Fashion', 
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&h=400&fit=crop', 
    icon: 'shirt',
    subcategories: [
      { 
        id: '2-1', 
        slug: 'men', 
        name: 'Men', 
        image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=200&h=200&fit=crop',
        subcategories: [
          { id: '2-1-1', slug: 't-shirts-polos', name: 'T-Shirts & Polos', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&h=200&fit=crop' },
          { id: '2-1-2', slug: 'casual-shirts', name: 'Casual Shirts', image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=200&h=200&fit=crop' },
          { id: '2-1-3', slug: 'jeans-trousers', name: 'Jeans & Trousers', image: 'https://images.unsplash.com/photo-1542272604-780c96856592?w=200&h=200&fit=crop' },
          { id: '2-1-4', slug: 'ethnic-wear', name: 'Ethnic Wear', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '2-2', 
        slug: 'women', 
        name: 'Women', 
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&h=200&fit=crop',
        subcategories: [
          { id: '2-2-1', slug: 'dresses-gowns', name: 'Dresses & Gowns', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=200&h=200&fit=crop' },
          { id: '2-2-2', slug: 'kurtas-sarees', name: 'Kurtas & Sarees', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&h=200&fit=crop' },
          { id: '2-2-3', slug: 'tops-tees', name: 'Tops & Tees', image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=200&h=200&fit=crop' },
          { id: '2-2-4', slug: 'women-jeans', name: 'Jeans & Jeggings', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '2-3', 
        slug: 'kids', 
        name: 'Kids', 
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69af63e6?w=200&h=200&fit=crop',
        subcategories: [
          { id: '2-3-1', slug: 'boys-clothing', name: 'Boys Clothing', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=200&h=200&fit=crop' },
          { id: '2-3-2', slug: 'girls-clothing', name: 'Girls Clothing', image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=200&h=200&fit=crop' },
          { id: '2-3-3', slug: 'baby-essentials', name: 'Baby Essentials', image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '2-4', 
        slug: 'footwear', 
        name: 'Footwear', 
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop',
        subcategories: [
          { id: '2-4-1', slug: 'sneakers', name: 'Sneakers', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop' },
          { id: '2-4-2', slug: 'formal-shoes', name: 'Formal Shoes', image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=200&h=200&fit=crop' },
          { id: '2-4-3', slug: 'sports-running', name: 'Sports & Running', image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=200&h=200&fit=crop' },
          { id: '2-4-4', slug: 'sandals-slippers', name: 'Sandals & Slippers', image: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  { 
    id: '3', 
    slug: 'electronics', 
    seoSlug: 'electronics',
    name: 'Electronics', 
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop', 
    icon: 'laptop',
    subcategories: [
      { 
        id: '3-1', 
        slug: 'laptops', 
        name: 'Laptops', 
        image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop',
        subcategories: [
          { id: '3-1-1', slug: 'gaming-laptops', name: 'Gaming Laptops', image: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=200&h=200&fit=crop' },
          { id: '3-1-2', slug: 'thin-light-laptops', name: 'Thin & Light', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=200&h=200&fit=crop' },
          { id: '3-1-3', slug: 'macbooks', name: 'MacBooks', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=200&h=200&fit=crop' },
          { id: '3-1-4', slug: '2-in-1-touch', name: '2-in-1 Touch Laptops', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '3-2', 
        slug: 'audio', 
        name: 'Audio', 
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop',
        subcategories: [
          { id: '3-2-1', slug: 'tws-earbuds', name: 'True Wireless Earbuds', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=200&h=200&fit=crop' },
          { id: '3-2-2', slug: 'headphones', name: 'Over-Ear Headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&h=200&fit=crop' },
          { id: '3-2-3', slug: 'bluetooth-speakers', name: 'Bluetooth Speakers', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=200&h=200&fit=crop' },
          { id: '3-2-4', slug: 'soundbars', name: 'Soundbars', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '3-3', 
        slug: 'cameras', 
        name: 'Cameras', 
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop',
        subcategories: [
          { id: '3-3-1', slug: 'dslr-mirrorless', name: 'DSLR & Mirrorless', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=200&h=200&fit=crop' },
          { id: '3-3-2', slug: 'action-cameras', name: 'Action Cameras', image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&h=200&fit=crop' },
          { id: '3-3-3', slug: 'camera-lenses', name: 'Lenses & Filters', image: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '3-4', 
        slug: 'gaming', 
        name: 'Gaming', 
        image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop',
        subcategories: [
          { id: '3-4-1', slug: 'consoles', name: 'Gaming Consoles', image: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=200&h=200&fit=crop' },
          { id: '3-4-2', slug: 'gaming-accessories', name: 'Gaming Mice & Keyboards', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=200&h=200&fit=crop' },
          { id: '3-4-3', slug: 'gaming-headsets', name: 'Gaming Headsets', image: 'https://images.unsplash.com/photo-1599669454699-248893623440?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  { 
    id: '4', 
    slug: 'home', 
    seoSlug: 'home',
    name: 'Home', 
    image: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=400&h=400&fit=crop', 
    icon: 'home',
    subcategories: [
      { 
        id: '4-1', 
        slug: 'furniture', 
        name: 'Furniture', 
        image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=200&h=200&fit=crop',
        subcategories: [
          { id: '4-1-1', slug: 'living-room-sofas', name: 'Living Room Sofas', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop' },
          { id: '4-1-2', slug: 'bedroom-beds', name: 'Beds & Mattresses', image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=200&h=200&fit=crop' },
          { id: '4-1-3', slug: 'office-study', name: 'Study & Office Desks', image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '4-2', 
        slug: 'decor', 
        name: 'Decor', 
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&h=200&fit=crop',
        subcategories: [
          { id: '4-2-1', slug: 'wall-art', name: 'Wall Art & Clocks', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&h=200&fit=crop' },
          { id: '4-2-2', slug: 'lighting-lamps', name: 'Lighting & Lamps', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200&h=200&fit=crop' },
          { id: '4-2-3', slug: 'vases-planters', name: 'Vases & Planters', image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '4-3', 
        slug: 'kitchen', 
        name: 'Kitchen', 
        image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=200&h=200&fit=crop',
        subcategories: [
          { id: '4-3-1', slug: 'cookware-sets', name: 'Cookware Sets', image: 'https://images.unsplash.com/photo-1584990347449-399435b6f00a?w=200&h=200&fit=crop' },
          { id: '4-3-2', slug: 'dinnerware-crockery', name: 'Dinnerware & Crockery', image: 'https://images.unsplash.com/photo-1614088685112-0a760b71a3c8?w=200&h=200&fit=crop' },
          { id: '4-3-3', slug: 'kitchen-storage', name: 'Storage & Containers', image: 'https://images.unsplash.com/photo-1584990347449-399435b6f00a?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  { 
    id: '5', 
    slug: 'beauty', 
    seoSlug: 'beauty',
    name: 'Beauty', 
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop', 
    icon: 'lipstick',
    subcategories: [
      { 
        id: '5-1', 
        slug: 'skincare', 
        name: 'Skincare', 
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop',
        subcategories: [
          { id: '5-1-1', slug: 'face-serums', name: 'Face Serums & Oils', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&h=200&fit=crop' },
          { id: '5-1-2', slug: 'sunscreens-lotions', name: 'Sunscreens & Lotions', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop' },
          { id: '5-1-3', slug: 'cleansers-facewash', name: 'Cleansers & Face Wash', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '5-2', 
        slug: 'makeup', 
        name: 'Makeup', 
        image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop',
        subcategories: [
          { id: '5-2-1', slug: 'lipsticks-lipgloss', name: 'Lipsticks & Gloss', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=200&h=200&fit=crop' },
          { id: '5-2-2', slug: 'foundations-compacts', name: 'Foundations & Compacts', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=400&fit=crop' },
          { id: '5-2-3', slug: 'eye-makeup', name: 'Eye Liners & Shadows', image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '5-3', 
        slug: 'haircare', 
        name: 'Haircare', 
        image: 'https://images.unsplash.com/photo-1527799822367-a2da39db36f3?w=200&h=200&fit=crop',
        subcategories: [
          { id: '5-3-1', slug: 'shampoos-conditioners', name: 'Shampoos & Conditioners', image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=200&h=200&fit=crop' },
          { id: '5-3-2', slug: 'hair-oils-serums', name: 'Hair Oils & Serums', image: 'https://images.unsplash.com/photo-1608248597359-25f0a8c2780e?w=200&h=200&fit=crop' },
          { id: '5-3-3', slug: 'hair-styling', name: 'Styling & Dryers', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  { 
    id: '6', 
    slug: 'appliances', 
    seoSlug: 'appliances',
    name: 'Appliances', 
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop', 
    icon: 'tv',
    subcategories: [
      { 
        id: '6-1', 
        slug: 'televisions', 
        name: 'Televisions', 
        image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=200&h=200&fit=crop',
        subcategories: [
          { id: '6-1-1', slug: 'smart-4k-tvs', name: 'Smart 4K UHD TVs', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=200&h=200&fit=crop' },
          { id: '6-1-2', slug: 'oled-qled-tvs', name: 'OLED & QLED TVs', image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=200&h=200&fit=crop' },
          { id: '6-1-3', slug: 'projectors', name: 'Home Projectors', image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=200&h=200&fit=crop' }
        ]
      },
      { 
        id: '6-2', 
        slug: 'refrigerators', 
        name: 'Refrigerators', 
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop',
        subcategories: [
          { id: '6-2-1', slug: 'double-door-fridges', name: 'Double Door Refrigerators', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop' },
          { id: '6-2-2', slug: 'side-by-side-fridges', name: 'Side-by-Side Refrigerators', image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=200&h=200&fit=crop' },
          { id: '6-2-3', slug: 'single-door-fridges', name: 'Single Door Refrigerators', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=400&fit=crop' }
        ]
      },
      { 
        id: '6-3', 
        slug: 'washing-machines', 
        name: 'Washing Machines', 
        image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop',
        subcategories: [
          { id: '6-3-1', slug: 'front-load-washers', name: 'Front Load Washers', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop' },
          { id: '6-3-2', slug: 'top-load-washers', name: 'Top Load Washers', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop' },
          { id: '6-3-3', slug: 'semi-automatic', name: 'Semi-Automatic Washers', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop' }
        ]
      }
    ]
  },
  {
    id: '7',
    slug: 'toys',
    seoSlug: 'toys',
    name: 'Toys',
    image: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=400&h=400&fit=crop',
    icon: 'gamepad',
    subcategories: []
  },
  {
    id: '8',
    slug: 'food-health',
    seoSlug: 'food-health',
    name: 'Food & Health',
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=400&fit=crop',
    icon: 'apple',
    subcategories: []
  },
  {
    id: '9',
    slug: 'furniture',
    seoSlug: 'furniture',
    name: 'Furniture',
    image: undefined,
    icon: 'armchair',
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



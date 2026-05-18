import { Category } from './types';

export const CATEGORIES: Category[] = [
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
      { id: '6-2', name: 'Refrigerators', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=200&h=200&fit=crop' },
      { id: '6-3', name: 'Washing Machines', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=200&h=200&fit=crop' }
    ]
  },
];

export const AVAILABLE_PERMISSIONS = [
  'can_edit_products',
  'can_delete_products',
  'can_view_orders',
  'can_edit_orders',
  'can_manage_users',
  'can_view_analytics',
  'can_manage_banners'
];

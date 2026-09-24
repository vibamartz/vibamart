import { db } from '../../backend/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Product, Deal259PageConfig, Deal259SubDeal } from '../types';

export const DEFAULT_DEAL259_SUBDEALS: Deal259SubDeal[] = [
  {
    id: 'flat259',
    title: 'Flat ₹259 Store',
    subtitle: 'All items exactly at ₹259',
    badgeText: 'FLAT ₹259',
    price: 259,
    icon: '⚡',
    active: true,
    order: 1
  },
  {
    id: 'under259',
    title: 'Under ₹259 Pick',
    subtitle: 'Budget deals under ₹259',
    badgeText: 'UNDER ₹259',
    price: 259,
    icon: '🔥',
    active: true,
    order: 2
  },
  {
    id: 'combos259',
    title: 'Super Combos @ ₹259',
    subtitle: 'Bundle value deals',
    badgeText: 'MEGA SAVER',
    price: 259,
    icon: '🎁',
    active: true,
    order: 3
  }
];

export const DEFAULT_DEAL259_CONFIG: Deal259PageConfig = {
  enabled: true,
  title: 'Deal 259 Super Store',
  subtitle: 'Exclusive deals, mega savings, and unbeatable prices starting at ₹259!',
  bannerImage: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop',
  badgeText: 'OFFICIAL DEAL 259',
  subDeals: DEFAULT_DEAL259_SUBDEALS,
  updatedAt: new Date().toISOString()
};

/**
  * Filters and sorts products that are specifically assigned to Deal 259.
  * Ensures that NON-Deal 259 products are strictly excluded from Deal 259 page.
  */
export function getDeal259Products(products: Product[]): Product[] {
  if (!products || !Array.isArray(products)) return [];
  return products
    .filter(p => p.isDeal259 === true && p.deal259Status !== 'disabled')
    .sort((a, b) => (a.deal259Order || 999) - (b.deal259Order || 999));
}

/**
 * Fetches Deal 259 settings from Firestore.
 */
export async function fetchDeal259Config(): Promise<Deal259PageConfig> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'deal259'));
    if (snap.exists()) {
      const data = snap.data() as Deal259PageConfig;
      return {
        ...DEFAULT_DEAL259_CONFIG,
        ...data,
        subDeals: data.subDeals && data.subDeals.length > 0 ? data.subDeals : DEFAULT_DEAL259_SUBDEALS
      };
    }
  } catch (err) {
    console.error('Error fetching Deal 259 config:', err);
  }
  return DEFAULT_DEAL259_CONFIG;
}

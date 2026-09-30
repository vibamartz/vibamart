import { db } from '../../backend/firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Product, BrandCoupon } from '../types';

/**
 * Fetches all product IDs that are explicitly assigned to any Reward Product / Coupon Card.
 */
export async function getRewardProductIds(): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, 'reward_offers'));
    const rewardIds = new Set<string>();
    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as BrandCoupon;
      if (Array.isArray(data.productIds)) {
        data.productIds.forEach(id => {
          if (id) rewardIds.add(id);
        });
      }
    });
    return rewardIds;
  } catch (e) {
    console.error("Error fetching reward product IDs:", e);
    return new Set<string>();
  }
}

/**
 * Helper to filter out reward products from general product arrays
 * (Home, Categories, Subcategories, Search, Recommendations, etc.)
 */
export function filterOutRewardProducts(products: Product[], rewardProductIds?: Set<string>): Product[] {
  if (!products || !Array.isArray(products)) return [];
  return products.filter(p => {
    if (rewardProductIds && rewardProductIds.has(p.id)) return false;
    if ((p as any).isRewardProduct) return false;
    // Deal 259 products must NOT appear on general store pages unless explicitly enabled by Admin via showInGeneralStore
    if (p.isDeal259 && !p.showInGeneralStore) return false;
    return true;
  });
}

/**
 * Fetches product IDs associated with expired, inactive, or exhausted reward offers.
 */
export async function getExpiredRewardProductIds(): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, 'reward_offers'));
    const expiredIds = new Set<string>();
    const now = Date.now();
    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as BrandCoupon;
      const isExpired = data.active === false || (data.expiryDate && new Date(data.expiryDate).getTime() < now) || data.remainingQuantity === 0;
      if (isExpired && Array.isArray(data.productIds)) {
        data.productIds.forEach(id => {
          if (id) expiredIds.add(id);
        });
      }
    });
    return expiredIds;
  } catch (e) {
    console.error("Error fetching expired reward product IDs:", e);
    return new Set<string>();
  }
}

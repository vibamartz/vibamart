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
 * Helper to filter products for general product arrays
 * (Home, Categories, Subcategories, Search, Recommendations, etc.)
 * Respects existing admin visibility controls and product status,
 * ensuring products assigned to special sections (Deal 259, Rewards, Deals, Offers, etc.)
 * remain visible across the main ViBa Mart catalog.
 */
export function filterOutRewardProducts(products: Product[], _rewardProductIds?: Set<string>): Product[] {
  if (!products || !Array.isArray(products)) return [];
  return products.filter(p => {
    if (p.isVisible === false) return false;
    if (p.status === 'inactive') return false;
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

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
export function filterOutRewardProducts(products: Product[], rewardProductIds: Set<string>): Product[] {
  if (!rewardProductIds || rewardProductIds.size === 0) return products;
  return products.filter(p => !rewardProductIds.has(p.id) && !(p as any).isRewardProduct);
}

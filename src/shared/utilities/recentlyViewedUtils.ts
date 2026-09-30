import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../types';
import { getRewardProductIds, filterOutRewardProducts } from './rewardUtils';
import { getProductSlug } from './slug';

const STORAGE_KEY = 'viba_recently_viewed';

export function getRecentlyViewedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id => id && typeof id === 'string');
  } catch {
    return [];
  }
}

export function addRecentlyViewedId(productId: string): void {
  if (!productId || typeof productId !== 'string' || typeof window === 'undefined') return;
  try {
    const existing = getRecentlyViewedIds();
    const updated = Array.from(new Set([productId, ...existing.filter(id => id !== productId)])).slice(0, 12);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('viba_recently_viewed_updated'));
  } catch (err) {
    console.error("Error saving recently viewed product:", err);
  }
}

export async function fetchRecentlyViewedProducts(excludeProductId?: string, maxItems: number = 6): Promise<Product[]> {
  try {
    const savedIds = getRecentlyViewedIds();
    const targetIds = savedIds.filter(id => id).slice(0, 12);
    if (targetIds.length === 0) return [];

    const snap = await getDocs(collection(db, 'products'));
    const rewardIds = await getRewardProductIds();
    const allProds = filterOutRewardProducts(
      snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)),
      rewardIds
    );

    const matched = allProds.filter(p => {
      if (p.status === 'inactive') return false;
      const pid = p.id;
      const pDocId = (p as any).id;
      const code = (p as any).productCode;
      const slug = getProductSlug(p);
      if (excludeProductId) {
        if (
          pid === excludeProductId ||
          pDocId === excludeProductId ||
          (code && code === excludeProductId) ||
          (slug && slug === excludeProductId)
        ) {
          return false;
        }
      }
      return targetIds.includes(pid) || targetIds.includes(pDocId) || (code && targetIds.includes(code)) || (slug && targetIds.includes(slug));
    });

    matched.sort((a, b) => {
      const getMinIdx = (p: Product) => {
        const indices = [
          targetIds.indexOf(p.id),
          targetIds.indexOf((p as any).id),
          targetIds.indexOf((p as any).productCode),
          targetIds.indexOf(getProductSlug(p))
        ].filter(idx => idx !== -1);
        return indices.length > 0 ? Math.min(...indices) : 999;
      };
      return getMinIdx(a) - getMinIdx(b);
    });

    return matched.slice(0, maxItems);
  } catch (err) {
    console.error("Error fetching recently viewed products:", err);
    return [];
  }
}

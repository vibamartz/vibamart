import { Product } from '../../shared/types';
import admin from 'firebase-admin';
import { db } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';

export class SearchCache {
  private static instance: SearchCache;
  private productsCache: Product[] | null = null;
  private categoryNamesMap: Record<string, string> = {};
  private lastFetchTime: number = 0;
  private ttlMs: number = 5 * 60 * 1000; // 5 minutes cache
  private isFetching: Promise<Product[]> | null = null;

  private constructor() {}

  public static getInstance(): SearchCache {
    if (!SearchCache.instance) {
      SearchCache.instance = new SearchCache();
    }
    return SearchCache.instance;
  }

  /**
   * Invalidates the in-memory cache, forcing next search to reload products.
   */
  public invalidate(): void {
    this.productsCache = null;
    this.lastFetchTime = 0;
  }

  /**
   * Retrieves products from cache, or loads from Firestore if expired/empty.
   */
  public async getProducts(): Promise<Product[]> {
    const now = Date.now();
    if (this.productsCache && (now - this.lastFetchTime < this.ttlMs)) {
      return this.productsCache;
    }

    if (this.isFetching) {
      return this.isFetching;
    }

    this.isFetching = this.loadProductsFromFirestore();
    try {
      const prods = await this.isFetching;
      this.productsCache = prods;
      this.lastFetchTime = Date.now();
      return prods;
    } finally {
      this.isFetching = null;
    }
  }

  /**
   * Returns category ID to category Name mapping.
   */
  public async getCategoryNamesMap(): Promise<Record<string, string>> {
    if (Object.keys(this.categoryNamesMap).length > 0 && (Date.now() - this.lastFetchTime < this.ttlMs)) {
      return this.categoryNamesMap;
    }

    try {
      if (admin.apps.length > 0) {
        const snap = await admin.firestore().collection('categories').get();
        const map: Record<string, string> = {};
        snap.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data && data.name) {
            map[doc.id] = data.name;
            if (data.subcategories && Array.isArray(data.subcategories)) {
              data.subcategories.forEach((sub: any) => {
                if (sub.id && sub.name) {
                  map[sub.id] = sub.name;
                  if (sub.subcategories && Array.isArray(sub.subcategories)) {
                    sub.subcategories.forEach((n: any) => {
                      if (n.id && n.name) map[n.id] = n.name;
                    });
                  }
                }
              });
            }
          }
        });
        this.categoryNamesMap = map;
        return map;
      } else {
        const snap = await getDocs(collection(db, 'categories'));
        const map: Record<string, string> = {};
        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data && data.name) {
            map[doc.id] = data.name;
            if (data.subcategories && Array.isArray(data.subcategories)) {
              data.subcategories.forEach((sub: any) => {
                if (sub.id && sub.name) {
                  map[sub.id] = sub.name;
                  if (sub.subcategories && Array.isArray(sub.subcategories)) {
                    sub.subcategories.forEach((n: any) => {
                      if (n.id && n.name) map[n.id] = n.name;
                    });
                  }
                }
              });
            }
          }
        });
        this.categoryNamesMap = map;
        return map;
      }
    } catch (err) {
      console.warn('Failed to load category names map for search:', err);
      return this.categoryNamesMap;
    }
  }

  /**
   * Loads products using admin SDK (if on server) or client SDK fallback.
   */
  private async loadProductsFromFirestore(): Promise<Product[]> {
    try {
      if (admin.apps.length > 0) {
        const snap = await admin.firestore().collection('products').get();
        return snap.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        } as Product));
      } else {
        const snap = await getDocs(collection(db, 'products'));
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Product));
      }
    } catch (err) {
      console.error('Failed to load products from Firestore:', err);
      return this.productsCache || [];
    }
  }
}

export const searchCache = SearchCache.getInstance();

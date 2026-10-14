import admin from 'firebase-admin';
import { ViBaSearchEngine } from './searchEngine';
import { SearchParams, SearchResult, SuggestionResult } from './searchTypes';
import { Product } from '../../shared/types';
import { searchCache } from './searchCache';

export class SearchService {
  private engine: ViBaSearchEngine;
  private isInitialized = false;
  private isInitializing = false;
  private lastIndexedTimestamp = 0;
  private categoryNameMap: Record<string, string> = {};
  private subCategoryNameMap: Record<string, string> = {};
  private nestedSubCategoryNameMap: Record<string, string> = {};
  private unsubscribeFirestore: (() => void) | null = null;

  constructor() {
    this.engine = new ViBaSearchEngine();
  }

  public getEngine(): ViBaSearchEngine {
    return this.engine;
  }

  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      indexedCount: this.engine.getCount(),
      lastIndexedTimestamp: this.lastIndexedTimestamp,
      cache: searchCache.getStats()
    };
  }

  /**
   * Initializes the search index from Firestore and attaches real-time change listener.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;

    try {
      await this.loadCategoryMaps();
      await this.indexAllProducts();
      this.attachRealtimeListener();
      this.isInitialized = true;
      console.log(`[SearchService] Successfully initialized with ${this.engine.getCount()} indexed products.`);
    } catch (err) {
      console.error('[SearchService] Failed to initialize search index:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Cache category, subcategory, and nested subcategory names for search tokenization.
   */
  private async loadCategoryMaps(): Promise<void> {
    try {
      if (!admin.apps.length) return;
      const db = admin.firestore();
      const catSnapshot = await db.collection('categories').get();

      catSnapshot.docs.forEach(docSnap => {
        const cat = docSnap.data();
        const catId = docSnap.id;
        const catName = cat.name || '';
        this.categoryNameMap[catId] = catName;

        if (Array.isArray(cat.subcategories)) {
          cat.subcategories.forEach((sub: any) => {
            if (sub && sub.id) {
              this.subCategoryNameMap[sub.id] = sub.name || '';
              if (Array.isArray(sub.subcategories)) {
                sub.subcategories.forEach((nested: any) => {
                  if (nested && nested.id) {
                    this.nestedSubCategoryNameMap[nested.id] = nested.name || '';
                  }
                });
              }
            }
          });
        }
      });
    } catch (err) {
      console.warn('[SearchService] Could not load category names from Firestore:', err);
    }
  }

  /**
   * Indexes all products currently in Firestore.
   */
  public async indexAllProducts(): Promise<number> {
    try {
      if (!admin.apps.length) {
        console.warn('[SearchService] Firebase Admin not initialized, skipping Firestore product indexing.');
        return 0;
      }

      const db = admin.firestore();

      // Load reward offers to identify exclusive reward items
      try {
        const rewardSnap = await db.collection('reward_offers').get();
        const rewardIds = new Set<string>();
        rewardSnap.docs.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.productIds)) {
            data.productIds.forEach((id: string) => {
              if (id) rewardIds.add(id);
            });
          }
        });
        this.engine.setRewardProductIds(rewardIds);
      } catch (err) {
        console.warn('[SearchService] Error loading reward product IDs:', err);
      }

      const productsSnap = await db.collection('products').get();
      const products: Product[] = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));

      this.engine.indexProducts(
        products,
        this.categoryNameMap,
        this.subCategoryNameMap,
        this.nestedSubCategoryNameMap
      );

      this.lastIndexedTimestamp = Date.now();
      searchCache.invalidate();
      return products.length;
    } catch (err) {
      console.error('[SearchService] Error indexing all products:', err);
      return 0;
    }
  }

  /**
   * Listens for real-time changes in Firestore products collection to update index incrementally.
   */
  private attachRealtimeListener(): void {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }

    try {
      if (!admin.apps.length) return;
      const db = admin.firestore();

      this.unsubscribeFirestore = db.collection('products').onSnapshot(
        snapshot => {
          let hasChanges = false;
          snapshot.docChanges().forEach(change => {
            const product = { id: change.doc.id, ...change.doc.data() } as Product;
            const catName = this.categoryNameMap[product.categoryId] || '';
            const subName = product.subCategoryId ? (this.subCategoryNameMap[product.subCategoryId] || '') : '';
            const nestedName = product.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';

            if (change.type === 'added' || change.type === 'modified') {
              this.engine.upsertProduct(product, catName, subName, nestedName);
              hasChanges = true;
            } else if (change.type === 'removed') {
              this.engine.removeProduct(product.id);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            searchCache.invalidate();
          }
        },
        error => {
          console.error('[SearchService] Firestore realtime indexing listener error:', error);
        }
      );
    } catch (err) {
      console.warn('[SearchService] Could not attach Firestore realtime listener:', err);
    }
  }

  /**
   * Search query execution with lazy bootstrap and LRU query cache.
   */
  public async search(params: SearchParams): Promise<SearchResult> {
    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    }

    // Check query cache
    const cacheKey = searchCache.generateKey(params);
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const freshResult = this.engine.search(params);
    searchCache.set(cacheKey, freshResult);
    return freshResult;
  }

  /**
   * Autocomplete suggestion execution with lazy bootstrap guarantee.
   */
  public async suggest(query: string, limit = 8): Promise<SuggestionResult> {
    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    }
    return this.engine.suggest(query, limit);
  }
}

export const searchService = new SearchService();

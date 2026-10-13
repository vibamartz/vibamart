import admin from 'firebase-admin';
import { Product, Category } from '../../shared/types';
import { ViBaSearchEngine } from './searchEngine';
import { SearchParams, SearchResult, SuggestionResult } from './searchTypes';
import { initializeFirebaseAdmin } from '../../../api/_utils';
import { SearchLRUCache, createSearchCacheKey } from './searchCache';
import { searchCurationManager } from './searchCuration';
import { registerCustomSynonymGroups } from './searchSynonyms';

export class SearchService {
  private static instance: SearchService;
  private engine: ViBaSearchEngine;
  private searchCache: SearchLRUCache<SearchResult> = new SearchLRUCache(400, 120000); // 2 min TTL
  private suggestionCache: SearchLRUCache<SuggestionResult> = new SearchLRUCache(400, 300000); // 5 min TTL
  private initialized: boolean = false;
  private isIndexing: boolean = false;
  private lastIndexedAt: string | null = null;
  private unsubscribeProducts: (() => void) | null = null;
  private categoryNamesMap: Map<string, { cat?: string; sub?: string; nested?: string }> = new Map();

  private constructor() {
    this.engine = new ViBaSearchEngine();
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Initializes the search service, indexes products from Firestore, and sets up real-time listener.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      initializeFirebaseAdmin();
      await this.loadCategoriesAndBuildHierarchyMap();
      await this.syncRewardProducts();
      await this.indexAllProducts();
      await this.syncCurationRules();
      this.setupRealtimeListener();
      this.initialized = true;
      console.log(`[SEARCH ENGINE] Initialized successfully with ${this.engine.getIndexSize()} products.`);
    } catch (err) {
      console.error('[SEARCH ENGINE] Initialization error:', err);
    }
  }

  /**
   * Syncs custom curation rules (product pinning, boosting, custom synonyms) into engine.
   */
  public async syncCurationRules(): Promise<void> {
    try {
      const config = await searchCurationManager.loadConfig();
      this.engine.setPinnedRules(config.pinnedRules);
      this.engine.setBoostedRules(config.boostedRules);
      if (config.customSynonyms && config.customSynonyms.length > 0) {
        registerCustomSynonymGroups(config.customSynonyms);
      }
      this.clearCache();
    } catch (err) {
      console.warn('[SEARCH ENGINE] Curation sync error:', err);
    }
  }

  /**
   * Clears in-memory search and suggestion caches.
   */
  public clearCache(): void {
    this.searchCache.clear();
    this.suggestionCache.clear();
  }

  /**
   * Loads category taxonomy to enrich product documents with category/subcategory names.
   */
  private async loadCategoriesAndBuildHierarchyMap() {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('categories').get();
      this.categoryNamesMap.clear();

      const categories: Category[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      for (const cat of categories) {
        if (!cat) continue;
        if (cat.subcategories) {
          for (const sub of cat.subcategories) {
            if (!sub) continue;
            if (sub.subcategories) {
              for (const nested of sub.subcategories) {
                if (!nested) continue;
                this.categoryNamesMap.set(nested.id, {
                  cat: cat.name,
                  sub: sub.name,
                  nested: nested.name
                });
              }
            }
            this.categoryNamesMap.set(sub.id, {
              cat: cat.name,
              sub: sub.name
            });
          }
        }
        this.categoryNamesMap.set(cat.id, {
          cat: cat.name
        });
      }
    } catch (err) {
      console.warn('[SEARCH ENGINE] Could not load categories for enrichment:', err);
    }
  }

  /**
   * Loads reward products to exclude from regular search results.
   */
  private async syncRewardProducts() {
    try {
      const db = admin.firestore();
      const snap = await db.collection('reward_products').get();
      const ids = snap.docs.map(d => d.id);
      this.engine.setRewardProductIds(ids);
    } catch {
      // Ignore if collection not present
    }
  }

  /**
   * Performs full catalog indexing into the search engine.
   */
  public async indexAllProducts(): Promise<number> {
    if (this.isIndexing) return this.engine.getIndexSize();
    this.isIndexing = true;

    try {
      const db = admin.firestore();
      console.log('[SEARCH ENGINE] Fetching all products from Firestore for indexing...');
      const snapshot = await db.collection('products').get();
      const products: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

      const productCatMap = new Map<string, { cat?: string; sub?: string; nested?: string }>();
      for (const p of products) {
        const catInfo = p.nestedSubCategoryId
          ? this.categoryNamesMap.get(p.nestedSubCategoryId)
          : (p.subCategoryId ? this.categoryNamesMap.get(p.subCategoryId) : this.categoryNamesMap.get(p.categoryId));
        if (catInfo) {
          productCatMap.set(p.id, catInfo);
        }
      }

      this.engine.indexProducts(products, productCatMap);
      this.searchCache.clear();
      this.suggestionCache.clear();
      this.lastIndexedAt = new Date().toISOString();
      console.log(`[SEARCH ENGINE] Successfully indexed ${products.length} products.`);
      return products.length;
    } catch (err) {
      console.error('[SEARCH ENGINE] Indexing failed:', err);
      return 0;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Sets up real-time listener to keep search index 100% in sync with Firestore mutations.
   */
  private setupRealtimeListener() {
    if (this.unsubscribeProducts) {
      this.unsubscribeProducts();
      this.unsubscribeProducts = null;
    }

    try {
      const db = admin.firestore();
      this.unsubscribeProducts = db.collection('products').onSnapshot((snapshot) => {
        let hasChanges = false;
        snapshot.docChanges().forEach((change) => {
          hasChanges = true;
          const data = { id: change.doc.id, ...change.doc.data() } as Product;
          if (change.type === 'added' || change.type === 'modified') {
            const catInfo = data.nestedSubCategoryId
              ? this.categoryNamesMap.get(data.nestedSubCategoryId)
              : (data.subCategoryId ? this.categoryNamesMap.get(data.subCategoryId) : this.categoryNamesMap.get(data.categoryId));
            this.engine.upsertProduct(data, catInfo);
          } else if (change.type === 'removed') {
            this.engine.removeProduct(change.doc.id);
          }
        });

        if (hasChanges) {
          this.searchCache.clear();
          this.suggestionCache.clear();
        }
      }, (err) => {
        console.error('[SEARCH ENGINE] Real-time listener error:', err);
      });
    } catch (err) {
      console.warn('[SEARCH ENGINE] Failed to attach real-time listener:', err);
    }
  }

  /**
   * Public Search API with LRU caching
   */
  public async search(params: SearchParams): Promise<SearchResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cacheKey = createSearchCacheKey(params);
    const cached = this.searchCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        executionTimeMs: 0.1 // Sub-millisecond cache hit
      };
    }

    const result = this.engine.search(params);
    this.searchCache.set(cacheKey, result);
    return result;
  }

  /**
   * Public Suggestion / Autocomplete API with caching
   */
  public async suggest(query: string, limit: number = 8): Promise<SuggestionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const trimmed = query.trim().toLowerCase();
    const cacheKey = `suggest:${trimmed}:${limit}`;
    const cached = this.suggestionCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        executionTimeMs: 0.1
      };
    }

    const result = this.engine.suggest(query, limit);
    this.suggestionCache.set(cacheKey, result);
    return result;
  }

  /**
   * Returns engine status and metrics
   */
  public getStatus() {
    return {
      initialized: this.initialized,
      isIndexing: this.isIndexing,
      totalIndexed: this.engine.getIndexSize(),
      lastIndexedAt: this.lastIndexedAt,
      memoryUsageMb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    };
  }

  public getEngine(): ViBaSearchEngine {
    return this.engine;
  }
}

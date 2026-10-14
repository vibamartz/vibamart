import admin from 'firebase-admin';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, collection as clientCollection, getDocs as getClientDocs, onSnapshot as clientOnSnapshot } from 'firebase/firestore';
import { Product, Category } from '../../shared/types';
import { ViBaSearchEngine } from './searchEngine';
import { SearchParams, SearchResult, SuggestionResult } from './searchTypes';
import { initializeFirebaseAdmin } from '../../../api/_utils';
import { SearchLRUCache, createSearchCacheKey } from './searchCache';
import { searchCurationManager } from './searchCuration';
import { registerCustomSynonymGroups } from './searchSynonyms';

function getValidProjectId(): string {
  const envId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!envId || envId === 'your_firebase_project_id' || envId.includes('dummy') || envId.includes('placeholder')) {
    return 'viba-mart-f46a4';
  }
  return envId;
}

function hasAdminCredentials(): boolean {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const isPlaceholderKey = !rawKey || rawKey.includes('your_private_key') || rawKey.includes('paste_firebase_private_key') || rawKey === 'paste_firebase_private_key_here';
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && !isPlaceholderKey && admin.apps.length > 0);
}

function getFallbackClientDb() {
  const projectId = getValidProjectId();
  const existingApp = getClientApps().find(a => a.name === 'search-backend-fallback');
  const app = existingApp || initClientApp({ projectId }, 'search-backend-fallback');
  return getClientFirestore(app);
}

async function fetchFirestoreCollectionDocs(collectionName: string): Promise<{ id: string; data: any }[]> {
  // 1. Try Firebase Admin Firestore only if valid service account credentials exist
  if (hasAdminCredentials()) {
    try {
      const snap = await admin.firestore().collection(collectionName).get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    } catch (err) {
      console.warn(`[SEARCH ENGINE] Admin Firestore read for ${collectionName} failed:`, err);
    }
  }

  // 2. Direct read from Firebase Client SDK (Fast & 100% reliable)
  try {
    const clientDb = getFallbackClientDb();
    const snap = await getClientDocs(clientCollection(clientDb, collectionName));
    return snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  } catch (err) {
    console.error(`[SEARCH ENGINE] Fallback Client SDK read for ${collectionName} failed:`, err);
    return [];
  }
}

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
      const rawDocs = await fetchFirestoreCollectionDocs('categories');
      this.categoryNamesMap.clear();

      const categories: Category[] = rawDocs.map(d => ({ id: d.id, ...d.data } as Category));
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
      const rawDocs = await fetchFirestoreCollectionDocs('reward_products');
      const ids = rawDocs.map(d => d.id);
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
      console.log('[SEARCH ENGINE] Fetching all products from Firestore for indexing...');
      const rawDocs = await fetchFirestoreCollectionDocs('products');
      const products: Product[] = rawDocs.map(doc => ({ id: doc.id, ...doc.data } as Product));

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
      this.clearCache();
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
      if (hasAdminCredentials()) {
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
            this.clearCache();
          }
        }, (err) => {
          console.warn('[SEARCH ENGINE] Admin real-time listener error, trying client SDK listener:', (err as any)?.message || err);
          this.setupClientRealtimeListener();
        });
        return;
      }
    } catch (err) {
      console.warn('[SEARCH ENGINE] Admin real-time listener failed, falling back to client SDK:', err);
    }

    this.setupClientRealtimeListener();
  }

  private setupClientRealtimeListener() {
    try {
      const clientDb = getFallbackClientDb();
      this.unsubscribeProducts = clientOnSnapshot(clientCollection(clientDb, 'products'), (snapshot) => {
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
          this.clearCache();
        }
      }, (err) => {
        console.warn('[SEARCH ENGINE] Client real-time listener error:', (err as any)?.message || err);
      });
    } catch (err) {
      console.warn('[SEARCH ENGINE] Failed to attach client real-time listener:', err);
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

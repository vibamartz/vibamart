import admin from 'firebase-admin';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, collection as clientCollection, getDocs as getClientDocs, onSnapshot as clientOnSnapshot } from 'firebase/firestore';
import { ViBaSearchEngine } from './searchEngine';
import { SearchParams, SearchResult, SuggestionResult } from './searchTypes';
import { Product } from '../../shared/types';
import { searchCache } from './searchCache';
import { parseQueryIntent, getSemanticSearchStatus } from './semanticSearch';
import { meiliSearchService } from './meiliSearchService';

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
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const isPlaceholderProj = !projectId || projectId === 'your_firebase_project_id';
  return Boolean(!isPlaceholderProj && process.env.FIREBASE_CLIENT_EMAIL && !isPlaceholderKey && admin.apps.length > 0);
}

function getFallbackClientDb() {
  const projectId = getValidProjectId();
  const existingApp = getClientApps().find(a => a.name === 'search-backend-fallback');
  const app = existingApp || initClientApp({ projectId }, 'search-backend-fallback');
  return getClientFirestore(app);
}

async function fetchFirestoreCollectionDocs(collectionName: string): Promise<{ id: string; data: any }[]> {
  if (hasAdminCredentials()) {
    try {
      const snap = await admin.firestore().collection(collectionName).get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    } catch (err) {
      console.warn(`[SearchService] Admin Firestore read for ${collectionName} failed:`, err);
    }
  }

  try {
    const clientDb = getFallbackClientDb();
    const snap = await getClientDocs(clientCollection(clientDb, collectionName));
    return snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  } catch (err) {
    console.error(`[SearchService] Fallback Client SDK read for ${collectionName} failed:`, err);
    return [];
  }
}

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
      cache: searchCache.getStats(),
      ai: getSemanticSearchStatus(),
      meilisearch: meiliSearchService.getStatus()
    };
  }

  /**
   * Initializes the search index from Firestore and attaches real-time change listener.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;

    try {
      await meiliSearchService.initialize().catch(err => {
        console.warn('[SearchService] MeiliSearch initial connect warning:', err.message);
      });
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
      const catDocs = await fetchFirestoreCollectionDocs('categories');
      catDocs.forEach(docSnap => {
        const cat = docSnap.data;
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
      // Load reward offers to identify exclusive reward items
      try {
        const rewardDocs = await fetchFirestoreCollectionDocs('reward_offers');
        const rewardIds = new Set<string>();
        rewardDocs.forEach(doc => {
          const data = doc.data;
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

      const productDocs = await fetchFirestoreCollectionDocs('products');
      const products: Product[] = productDocs.map(doc => ({
        id: doc.id,
        ...doc.data
      } as Product));

      this.engine.indexProducts(
        products,
        this.categoryNameMap,
        this.subCategoryNameMap,
        this.nestedSubCategoryNameMap
      );

      // Synchronize indexed documents to MeiliSearch
      const allIndexedDocs = this.engine.getAllDocs();
      await meiliSearchService.syncAll(allIndexedDocs).catch(err => {
        console.warn('[SearchService] MeiliSearch batch sync warning:', err.message);
      });

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

    const handleSnapshot = (snapshot: any) => {
      let hasChanges = false;
      snapshot.docChanges().forEach((change: any) => {
        const product = { id: change.doc.id, ...change.doc.data() } as Product;
        const catName = this.categoryNameMap[product.categoryId] || '';
        const subName = product.subCategoryId ? (this.subCategoryNameMap[product.subCategoryId] || '') : '';
        const nestedName = product.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';

        if (change.type === 'added' || change.type === 'modified') {
          const doc = this.engine.upsertProduct(product, catName, subName, nestedName);
          if (doc) {
            meiliSearchService.upsertProduct(doc).catch(() => {});
          }
          hasChanges = true;
        } else if (change.type === 'removed') {
          this.engine.removeProduct(product.id);
          meiliSearchService.removeProduct(product.id).catch(() => {});
          hasChanges = true;
        }
      });

      if (hasChanges) {
        searchCache.invalidate();
      }
    };

    if (hasAdminCredentials()) {
      try {
        const db = admin.firestore();
        this.unsubscribeFirestore = db.collection('products').onSnapshot(
          snapshot => handleSnapshot(snapshot),
          error => {
            console.warn('[SearchService] Admin realtime listener error, falling back to Client SDK:', error);
            this.attachClientRealtimeListener(handleSnapshot);
          }
        );
        return;
      } catch (err) {
        console.warn('[SearchService] Could not attach Admin realtime listener, using fallback:', err);
      }
    }

    this.attachClientRealtimeListener(handleSnapshot);
  }

  private attachClientRealtimeListener(handleSnapshot: (snapshot: any) => void): void {
    try {
      const clientDb = getFallbackClientDb();
      this.unsubscribeFirestore = clientOnSnapshot(
        clientCollection(clientDb, 'products'),
        snapshot => handleSnapshot(snapshot),
        error => {
          console.warn('[SearchService] Client SDK realtime listener error:', error);
        }
      );
    } catch (err) {
      console.warn('[SearchService] Failed to attach Client SDK realtime listener:', err);
    }
  }

  /**
   * Search query execution with lazy bootstrap, MeiliSearch retrieval, and resilient fallback.
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

    const rawQuery = (params.q || '').trim();
    let searchParams = { ...params };
    let semanticIntent: any = undefined;

    // Asynchronously resolve natural language / AI intent if query contains conversational markers
    if (rawQuery.length > 0 && (params.useAI || /\b(?:under|below|above|between|for\s+(?:men|women|kids)|cheap|cheapest|budget|expensive|best|latest|in\s*stock)\b/i.test(rawQuery))) {
      try {
        const intent = await parseQueryIntent(rawQuery, true);
        if (intent && intent.isNaturalLanguage) {
          semanticIntent = intent;
          searchParams.semanticIntent = intent;
          // Populate extracted constraints when not explicitly set by the caller
          if (searchParams.maxPrice === undefined && intent.detectedFilters.maxPrice !== undefined) {
            searchParams.maxPrice = intent.detectedFilters.maxPrice;
          }
          if (searchParams.minPrice === undefined && intent.detectedFilters.minPrice !== undefined) {
            searchParams.minPrice = intent.detectedFilters.minPrice;
          }
          if (!searchParams.color && intent.detectedFilters.color) {
            searchParams.color = intent.detectedFilters.color;
          }
          if (!searchParams.sortBy && intent.detectedFilters.sortBy) {
            searchParams.sortBy = intent.detectedFilters.sortBy;
          }
          if (searchParams.inStock === undefined && intent.detectedFilters.inStock !== undefined) {
            searchParams.inStock = intent.detectedFilters.inStock;
          }
          if (!searchParams.gender && intent.detectedFilters.gender) {
            searchParams.gender = intent.detectedFilters.gender;
          }
        }
      } catch (err) {
        // Safe fallback
      }
    }

    // 1. Try MeiliSearch Retrieval if connected
    if (meiliSearchService.isConnected()) {
      try {
        const meiliResult = await meiliSearchService.search(searchParams, semanticIntent);
        if (meiliResult) {
          meiliResult.query = rawQuery;
          if (semanticIntent) {
            meiliResult.semanticIntent = semanticIntent;
          }
          if (rawQuery !== searchParams.q) {
            meiliResult.originalQuery = rawQuery;
          }
          searchCache.set(cacheKey, meiliResult);
          return meiliResult;
        }
      } catch (err) {
        console.warn('[SearchService] MeiliSearch query execution warning:', err);
      }
    }

    // 2. Resilient In-Memory Search Engine
    const freshResult = this.engine.search(searchParams);
    if (semanticIntent) {
      freshResult.semanticIntent = semanticIntent;
    }
    if (rawQuery !== searchParams.q) {
      freshResult.originalQuery = rawQuery;
    }
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

  /**
   * Dynamic popular searches generated from actual catalog data and search telemetry.
   */
  public async getPopular(limit = 8): Promise<SuggestionResult> {
    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    }
    return this.engine.getPopularSearches(limit);
  }

  /**
   * Upsert product incrementally into in-memory and Meilisearch indexes
   */
  public upsertProduct(product: Product): void {
    const catName = this.categoryNameMap[product.categoryId] || '';
    const subName = product.subCategoryId ? (this.subCategoryNameMap[product.subCategoryId] || '') : '';
    const nestedName = product.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';
    const doc = this.engine.upsertProduct(product, catName, subName, nestedName);
    if (doc) {
      meiliSearchService.upsertProduct(doc).catch(() => {});
    }
    searchCache.invalidate();
  }

  /**
   * Remove product incrementally from in-memory and Meilisearch indexes
   */
  public removeProduct(productId: string): void {
    this.engine.removeProduct(productId);
    meiliSearchService.removeProduct(productId).catch(() => {});
    searchCache.invalidate();
  }
}

export const searchService = new SearchService();

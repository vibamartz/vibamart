import admin from 'firebase-admin';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, collection as clientCollection, getDocs as getClientDocs, onSnapshot as clientOnSnapshot } from 'firebase/firestore';
import { ViBaSearchEngine } from './searchEngine';
import { SearchParams, SearchResult, SuggestionResult } from './searchTypes';
import { Product, Category, VisualNestedSubcategory } from '../../shared/types';
import { searchCache } from './searchCache';
import { parseQueryIntent, getSemanticSearchStatus } from './semanticSearch';
import { generateProductKeywords, productNeedsKeywordUpgrade, upgradeExistingProductKeywords } from '../../shared/utilities/productKeywordGenerator';

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
  private cachedCategories: Category[] = [];
  private cachedVisualItems: VisualNestedSubcategory[] = [];
  private unsubscribeProducts: (() => void) | null = null;
  private unsubscribeCategories: (() => void) | null = null;
  private unsubscribeVisual: (() => void) | null = null;

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
      hierarchyNodeCount: this.engine.getHierarchyEngine().getNodeCount(),
      lastIndexedTimestamp: this.lastIndexedTimestamp,
      cache: searchCache.getStats(),
      ai: getSemanticSearchStatus()
    };
  }

  /**
   * Initializes the search index from Firestore and attaches real-time change listener.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) return;
    this.isInitializing = true;

    try {
      await this.loadCategoryHierarchy();
      await this.indexAllProducts();
      this.attachRealtimeListeners();
      this.isInitialized = true;
      console.log(`[SearchService] Successfully initialized with ${this.engine.getCount()} indexed products across ${this.engine.getHierarchyEngine().getNodeCount()} hierarchy levels.`);
    } catch (err) {
      console.error('[SearchService] Failed to initialize search index:', err);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Dynamically loads all categories, subcategories, nested subcategories,
   * and visual nested subcategories from Firestore.
   */
  public async loadCategoryHierarchy(): Promise<void> {
    try {
      const [catDocs, visualDocs] = await Promise.all([
        fetchFirestoreCollectionDocs('categories'),
        fetchFirestoreCollectionDocs('visual_nested_subcategories')
      ]);

      this.cachedCategories = catDocs.map(doc => ({ id: doc.id, ...doc.data } as Category));
      this.cachedVisualItems = visualDocs.map(doc => ({ id: doc.id, ...doc.data } as VisualNestedSubcategory));

      this.categoryNameMap = {};
      this.subCategoryNameMap = {};
      this.nestedSubCategoryNameMap = {};

      this.cachedCategories.forEach(cat => {
        if (!cat || !cat.id) return;
        this.categoryNameMap[cat.id] = cat.name || '';
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

      this.engine.setHierarchy(this.cachedCategories, this.cachedVisualItems);
      searchCache.invalidate();
    } catch (err) {
      console.warn('[SearchService] Could not load category hierarchy from Firestore:', err);
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
        this.cachedCategories.length > 0 ? this.cachedCategories : this.categoryNameMap,
        this.cachedVisualItems.length > 0 ? this.cachedVisualItems : this.subCategoryNameMap,
        this.nestedSubCategoryNameMap,
        this.cachedVisualItems
      );

      this.lastIndexedTimestamp = Date.now();
      searchCache.invalidate();

      // Automatically audit and upgrade search keywords for any existing catalog products with missing or < 6 keywords
      this.upgradeAllProductKeywords().catch(err => {
        console.warn('[SearchService] Background keyword upgrade warning:', err.message || err);
      });

      return products.length;
    } catch (err) {
      console.error('[SearchService] Error indexing all products:', err);
      return 0;
    }
  }

  /**
   * Audits and upgrades search keywords for all catalog products having missing or < 6 keywords.
   * Preserves useful existing keywords, appends relevant missing keywords, and updates ONLY tags field.
   */
  public async upgradeAllProductKeywords(): Promise<{ totalChecked: number; upgradedCount: number }> {
    try {
      const productDocs = await fetchFirestoreCollectionDocs('products');
      let upgradedCount = 0;
      const adminCredentials = hasAdminCredentials();

      for (const docItem of productDocs) {
        const prod = { id: docItem.id, ...docItem.data } as Product;
        if (!productNeedsKeywordUpgrade(prod, 6)) {
          continue;
        }

        const catName = this.categoryNameMap[prod.categoryId] || '';
        const subName = prod.subCategoryId ? (this.subCategoryNameMap[prod.subCategoryId] || '') : '';
        const nestedName = prod.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[prod.nestedSubCategoryId] || '') : '';

        const generatedTags = await generateProductKeywords(prod, {
          categoryName: catName,
          subCategoryName: subName,
          nestedSubCategoryName: nestedName,
          minCount: 6
        });

        if (generatedTags.length >= 6) {
          try {
            if (adminCredentials) {
              await admin.firestore().collection('products').doc(prod.id).update({
                tags: generatedTags,
                updatedAt: new Date().toISOString()
              });
            } else {
              const clientDb = getFallbackClientDb();
              const { doc: firestoreDoc, updateDoc: clientUpdateDoc } = await import('firebase/firestore');
              await clientUpdateDoc(firestoreDoc(clientDb, 'products', prod.id), {
                tags: generatedTags,
                updatedAt: new Date().toISOString()
              });
            }
            prod.tags = generatedTags;
            this.engine.upsertProduct(prod, catName, subName, nestedName);
            upgradedCount++;
          } catch (updateErr) {
            console.warn(`[SearchService] Failed to persist upgraded keywords for product ${prod.id}:`, updateErr);
          }
        }
      }

      if (upgradedCount > 0) {
        searchCache.invalidate();
        console.log(`[SearchService] Successfully upgraded search keywords for ${upgradedCount} catalog products.`);
      }

      return { totalChecked: productDocs.length, upgradedCount };
    } catch (err) {
      console.error('[SearchService] Error upgrading product keywords:', err);
      return { totalChecked: 0, upgradedCount: 0 };
    }
  }

  /**
   * Listens for real-time changes in Firestore products, categories, and visual_nested_subcategories
   * to keep index and hierarchy synchronized automatically.
   */
  private attachRealtimeListeners(): void {
    if (this.unsubscribeProducts) {
      this.unsubscribeProducts();
      this.unsubscribeProducts = null;
    }
    if (this.unsubscribeCategories) {
      this.unsubscribeCategories();
      this.unsubscribeCategories = null;
    }
    if (this.unsubscribeVisual) {
      this.unsubscribeVisual();
      this.unsubscribeVisual = null;
    }

    const handleProductSnapshot = (snapshot: any) => {
      let hasChanges = false;
      snapshot.docChanges().forEach((change: any) => {
        const product = { id: change.doc.id, ...change.doc.data() } as Product;
        const catName = this.categoryNameMap[product.categoryId] || '';
        const subName = product.subCategoryId ? (this.subCategoryNameMap[product.subCategoryId] || '') : '';
        const nestedName = product.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';

        if (change.type === 'added' || change.type === 'modified') {
          // If product needs keyword upgrade, automatically generate keywords
          if (productNeedsKeywordUpgrade(product, 6)) {
            generateProductKeywords(product, {
              categoryName: catName,
              subCategoryName: subName,
              nestedSubCategoryName: nestedName,
              minCount: 6
            }).then(newTags => {
              if (newTags.length >= 6 && productNeedsKeywordUpgrade(product, 6)) {
                if (hasAdminCredentials()) {
                  admin.firestore().collection('products').doc(product.id).update({
                    tags: newTags,
                    updatedAt: new Date().toISOString()
                  }).catch(() => {});
                }
                product.tags = newTags;
                this.engine.upsertProduct(product, catName, subName, nestedName);
              }
            }).catch(() => {});
          }

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
    };

    const handleHierarchySnapshot = async () => {
      try {
        await this.loadCategoryHierarchy();
      } catch (err) {
        console.warn('[SearchService] Error synchronizing hierarchy change:', err);
      }
    };

    if (hasAdminCredentials()) {
      try {
        const db = admin.firestore();
        this.unsubscribeProducts = db.collection('products').onSnapshot(
          snapshot => handleProductSnapshot(snapshot),
          error => {
            console.warn('[SearchService] Admin products listener error, falling back to Client SDK:', error);
            this.attachClientRealtimeListeners(handleProductSnapshot, handleHierarchySnapshot);
          }
        );

        this.unsubscribeCategories = db.collection('categories').onSnapshot(() => handleHierarchySnapshot(), () => {});
        this.unsubscribeVisual = db.collection('visual_nested_subcategories').onSnapshot(() => handleHierarchySnapshot(), () => {});
        return;
      } catch (err) {
        console.warn('[SearchService] Could not attach Admin realtime listeners, using fallback:', err);
      }
    }

    this.attachClientRealtimeListeners(handleProductSnapshot, handleHierarchySnapshot);
  }

  private attachClientRealtimeListeners(
    handleProductSnapshot: (snapshot: any) => void,
    handleHierarchySnapshot: () => void
  ): void {
    try {
      const clientDb = getFallbackClientDb();
      this.unsubscribeProducts = clientOnSnapshot(
        clientCollection(clientDb, 'products'),
        snapshot => handleProductSnapshot(snapshot),
        error => console.warn('[SearchService] Client SDK products listener error:', error)
      );

      this.unsubscribeCategories = clientOnSnapshot(
        clientCollection(clientDb, 'categories'),
        () => handleHierarchySnapshot(),
        () => {}
      );

      this.unsubscribeVisual = clientOnSnapshot(
        clientCollection(clientDb, 'visual_nested_subcategories'),
        () => handleHierarchySnapshot(),
        () => {}
      );
    } catch (err) {
      console.warn('[SearchService] Failed to attach Client SDK realtime listeners:', err);
    }
  }

  /**
   * Search query execution with lazy bootstrap and resilient fallback.
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

    // Resilient In-Memory Search Engine
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
   * Upsert product incrementally into in-memory search index
   */
  public upsertProduct(product: Product): void {
    const catName = this.categoryNameMap[product.categoryId] || '';
    const subName = product.subCategoryId ? (this.subCategoryNameMap[product.subCategoryId] || '') : '';
    const nestedName = product.nestedSubCategoryId ? (this.nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';
    this.engine.upsertProduct(product, catName, subName, nestedName);
    searchCache.invalidate();
  }

  /**
   * Remove product incrementally from in-memory search index
   */
  public removeProduct(productId: string): void {
    this.engine.removeProduct(productId);
    searchCache.invalidate();
  }
}

export const searchService = new SearchService();

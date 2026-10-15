import { Meilisearch, Index } from 'meilisearch';
import type { SearchResponse } from 'meilisearch';
import { IndexedProductDoc } from './searchEngine';
import { SearchParams, SearchResult, SearchFacets, SearchFacetValue } from './searchTypes';
import { Product } from '../../shared/types';

export interface MeiliSearchStatus {
  isEnabled: boolean;
  isAvailable: boolean;
  host: string;
  indexName: string;
  lastSyncTimestamp: number;
  syncedCount: number;
  error?: string;
}

export class MeiliSearchService {
  private client: Meilisearch | null = null;
  private index: Index<IndexedProductDoc> | null = null;
  private host: string;
  private apiKey: string;
  private indexName: string;
  private isAvailable: boolean = false;
  private isInitializing: boolean = false;
  private lastSyncTimestamp: number = 0;
  private syncedCount: number = 0;
  private lastError?: string;

  constructor() {
    this.host = process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700';
    this.apiKey = process.env.MEILISEARCH_API_KEY || process.env.MEILISEARCH_MASTER_KEY || '';
    this.indexName = process.env.MEILISEARCH_INDEX || 'viba_products';
  }

  /**
   * Returns current telemetry and connectivity status of the Meilisearch service.
   */
  public getStatus(): MeiliSearchStatus {
    return {
      isEnabled: true,
      isAvailable: this.isAvailable,
      host: this.host,
      indexName: this.indexName,
      lastSyncTimestamp: this.lastSyncTimestamp,
      syncedCount: this.syncedCount,
      error: this.lastError
    };
  }

  /**
   * Check if Meilisearch instance is currently online and reachable.
   */
  public isConnected(): boolean {
    return this.isAvailable;
  }

  /**
   * Initializes connection to Meilisearch, configures index settings, and prepares schema.
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitializing) return this.isAvailable;
    this.isInitializing = true;

    try {
      this.client = new Meilisearch({
        host: this.host,
        apiKey: this.apiKey,
        timeout: 1000
      });

      // Probe health with 800ms timeout
      const isHealthy = await Promise.race([
        this.client.isHealthy().catch(() => false),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 800))
      ]);

      if (!isHealthy) {
        this.isAvailable = false;
        this.lastError = `Meilisearch host unreachable at ${this.host} (resilient in-memory fallback active)`;
        this.isInitializing = false;
        return false;
      }

      this.index = this.client.index<IndexedProductDoc>(this.indexName);

      // Ensure index settings are optimized for ViBa Mart catalog
      await this.configureIndexSettings();

      this.isAvailable = true;
      this.lastError = undefined;
      console.log(`[MeiliSearchService] Successfully connected to Meilisearch at ${this.host}, index: ${this.indexName}`);
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      this.isAvailable = false;
      this.lastError = err.message || 'Meilisearch initialization failed';
      this.isInitializing = false;
      return false;
    }
  }

  /**
   * Configure ranking rules, searchable attributes, filterable attributes, and sortable attributes.
   */
  private async configureIndexSettings(): Promise<void> {
    if (!this.index) return;

    try {
      await this.index.updateSettings({
        searchableAttributes: [
          'productCode',
          'cleanProductCode',
          'sku',
          'name',
          'brand',
          'tags',
          'categoryName',
          'subCategoryName',
          'nestedSubCategoryName',
          'specifications',
          'variantAttributes',
          'description'
        ],
        filterableAttributes: [
          'id',
          'categoryId',
          'categoryName',
          'subCategoryId',
          'subCategoryName',
          'nestedSubCategoryId',
          'nestedSubCategoryName',
          'visualNestedSubcategoryIds',
          'brand',
          'effectivePrice',
          'price',
          'discountPercentage',
          'rating',
          'numReviews',
          'inStock',
          'stock',
          'colors',
          'sizes',
          'status',
          'isVisible',
          'isReward'
        ],
        sortableAttributes: [
          'effectivePrice',
          'rating',
          'numReviews',
          'discountPercentage',
          'createdAt'
        ],
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness'
        ],
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: {
            oneTypo: 4,
            twoTypos: 8
          }
        }
      });
    } catch (err) {
      console.warn('[MeiliSearchService] Failed to update index settings:', err);
    }
  }

  /**
   * Synchronizes all indexed product documents to Meilisearch in batches.
   */
  public async syncAll(docs: IndexedProductDoc[]): Promise<number> {
    if (!this.isAvailable || !this.index) {
      const reconnected = await this.initialize();
      if (!reconnected || !this.index) return 0;
    }

    try {
      const batchSize = 100;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        await this.index.addDocuments(batch, { primaryKey: 'id' });
      }

      this.lastSyncTimestamp = Date.now();
      this.syncedCount = docs.length;
      return docs.length;
    } catch (err: any) {
      console.warn('[MeiliSearchService] Batch document sync error:', err.message);
      this.lastError = err.message;
      return 0;
    }
  }

  /**
   * Synchronizes a single product creation or update into Meilisearch.
   */
  public async upsertProduct(doc: IndexedProductDoc): Promise<boolean> {
    if (!this.isAvailable || !this.index) return false;

    try {
      await this.index.addDocuments([doc], { primaryKey: 'id' });
      return true;
    } catch (err: any) {
      console.warn(`[MeiliSearchService] Failed to upsert product ${doc.id}:`, err.message);
      return false;
    }
  }

  /**
   * Synchronizes a product deletion from Meilisearch.
   */
  public async removeProduct(productId: string): Promise<boolean> {
    if (!this.isAvailable || !this.index) return false;

    try {
      await this.index.deleteDocument(productId);
      return true;
    } catch (err: any) {
      console.warn(`[MeiliSearchService] Failed to remove product ${productId}:`, err.message);
      return false;
    }
  }

  /**
   * Executes full product search on Meilisearch with filter expressions, facets, sorting, and pagination.
   */
  public async search(params: SearchParams, semanticIntent?: any): Promise<SearchResult | null> {
    if (!this.isAvailable || !this.index) {
      return null; // Signals caller to use in-memory search engine
    }

    const startTime = performance.now();
    const rawQuery = (params.q || '').trim();
    const query = semanticIntent?.isNaturalLanguage && semanticIntent.cleanKeyword
      ? semanticIntent.cleanKeyword
      : rawQuery;

    try {
      // Build Meilisearch filter expressions
      const filterExpressions: string[] = [];

      // Publication & eligibility
      if (!params.includeDrafts) {
        filterExpressions.push('isVisible = true');
        filterExpressions.push('status = "active"');
      }

      // Category filters
      if (params.category && params.category !== 'all-deals' && params.category !== 'categories') {
        const cat = params.category.replace(/["\\]/g, '');
        filterExpressions.push(`(categoryId = "${cat}" OR categoryName = "${cat}")`);
      }

      if (params.subCategory && params.subCategory !== 'all') {
        const sub = params.subCategory.replace(/["\\]/g, '');
        filterExpressions.push(`(subCategoryId = "${sub}" OR subCategoryName = "${sub}")`);
      }

      if (params.nestedSubCategory && params.nestedSubCategory !== 'all') {
        const nested = params.nestedSubCategory.replace(/["\\]/g, '');
        filterExpressions.push(`(nestedSubCategoryId = "${nested}" OR nestedSubCategoryName = "${nested}")`);
      }

      if (params.visualSubCategory) {
        const visual = params.visualSubCategory.replace(/["\\]/g, '');
        filterExpressions.push(`visualNestedSubcategoryIds = "${visual}"`);
      }

      // Brand filter
      if (params.brand) {
        const brands = Array.isArray(params.brand) ? params.brand : [params.brand];
        const brandClauses = brands.map(b => `brand = "${b.replace(/["\\]/g, '')}"`).join(' OR ');
        filterExpressions.push(`(${brandClauses})`);
      }

      // Price filter (combines explicit params with extracted AI budget)
      const effectiveMinPrice = params.minPrice !== undefined ? params.minPrice : semanticIntent?.detectedFilters?.minPrice;
      const effectiveMaxPrice = params.maxPrice !== undefined ? params.maxPrice : semanticIntent?.detectedFilters?.maxPrice;

      if (effectiveMinPrice !== undefined) {
        filterExpressions.push(`effectivePrice >= ${effectiveMinPrice}`);
      }
      if (effectiveMaxPrice !== undefined) {
        filterExpressions.push(`effectivePrice <= ${effectiveMaxPrice}`);
      }

      // Rating filter
      const effectiveMinRating = params.minRating !== undefined ? params.minRating : semanticIntent?.detectedFilters?.minRating;
      if (effectiveMinRating !== undefined) {
        filterExpressions.push(`rating >= ${effectiveMinRating}`);
      }

      // Discount filter
      const effectiveMinDiscount = params.minDiscount !== undefined ? params.minDiscount : semanticIntent?.detectedFilters?.minDiscount;
      if (effectiveMinDiscount !== undefined) {
        filterExpressions.push(`discountPercentage >= ${effectiveMinDiscount}`);
      }

      // Stock filter
      const effectiveInStock = params.inStock ?? semanticIntent?.detectedFilters?.inStock;
      if (effectiveInStock) {
        filterExpressions.push('inStock = true');
        filterExpressions.push('stock > 0');
      }

      // Color filter
      const effectiveColors = params.color
        ? (Array.isArray(params.color) ? params.color : [params.color])
        : (semanticIntent?.detectedFilters?.color ? [semanticIntent.detectedFilters.color] : undefined);
      if (effectiveColors && effectiveColors.length > 0) {
        const colorClauses = effectiveColors.map(c => `colors = "${String(c).replace(/["\\]/g, '')}"`).join(' OR ');
        filterExpressions.push(`(${colorClauses})`);
      }

      // Size filter
      const effectiveSizes = params.size
        ? (Array.isArray(params.size) ? params.size : [params.size])
        : (semanticIntent?.detectedFilters?.size ? [semanticIntent.detectedFilters.size] : undefined);
      if (effectiveSizes && effectiveSizes.length > 0) {
        const sizeClauses = effectiveSizes.map(s => `sizes = "${String(s).replace(/["\\]/g, '')}"`).join(' OR ');
        filterExpressions.push(`(${sizeClauses})`);
      }

      // Sorting
      const sortBy = params.sortBy || semanticIntent?.detectedFilters?.sortBy || (query ? 'relevance' : 'popularity');
      const sortRules: string[] = [];
      if (sortBy === 'price-asc') sortRules.push('effectivePrice:asc');
      else if (sortBy === 'price-desc') sortRules.push('effectivePrice:desc');
      else if (sortBy === 'newest') sortRules.push('createdAt:desc');
      else if (sortBy === 'rating') sortRules.push('rating:desc', 'numReviews:desc');
      else if (sortBy === 'popularity') sortRules.push('numReviews:desc', 'rating:desc');

      // Pagination
      const page = Math.max(1, Number(params.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(params.limit) || 24));
      const offset = (page - 1) * limit;

      const searchResponse: SearchResponse<IndexedProductDoc> = await this.index.search(query, {
        filter: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
        sort: sortRules.length > 0 ? sortRules : undefined,
        limit,
        offset,
        facets: ['brand', 'categoryName', 'colors', 'inStock'],
        attributesToHighlight: ['name', 'description']
      });

      const total = searchResponse.estimatedTotalHits || searchResponse.hits.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const products: Product[] = searchResponse.hits.map(hit => hit.raw || hit as any);

      const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      // Map Meilisearch facet distribution into standardized SearchFacets
      const facetDist = searchResponse.facetDistribution || {};
      const facets: SearchFacets = {
        categories: Object.entries(facetDist.categoryName || {}).map(([value, count]) => ({
          value,
          label: value,
          count: Number(count)
        })),
        subCategories: [],
        nestedSubCategories: [],
        brands: Object.entries(facetDist.brand || {}).map(([value, count]) => ({
          value,
          label: value,
          count: Number(count)
        })),
        colors: Object.entries(facetDist.colors || {}).map(([value, count]) => ({
          value,
          label: value,
          count: Number(count)
        })),
        sizes: [],
        priceRange: { min: 0, max: 200000 },
        ratings: [
          { stars: 4, count: 0 },
          { stars: 3, count: 0 },
          { stars: 2, count: 0 }
        ],
        stockStatus: {
          inStock: Number(facetDist.inStock?.true || 0),
          outOfStock: Number(facetDist.inStock?.false || 0)
        }
      };

      return {
        products,
        total,
        page,
        limit,
        totalPages,
        facets,
        executionTimeMs,
        query: rawQuery,
        exactMatch: false,
        semanticIntent
      };
    } catch (err: any) {
      console.warn('[MeiliSearchService] Search query failed, falling back to local engine:', err.message);
      return null;
    }
  }
}

export const meiliSearchService = new MeiliSearchService();

import { SearchParams, SearchResult } from './searchTypes';

interface CacheEntry {
  result: SearchResult;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private ttlMs: number;
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(maxEntries = 500, ttlMs = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * Generates a stable deterministic cache key from SearchParams
   */
  public generateKey(params: SearchParams): string {
    const parts = [
      params.q?.trim().toLowerCase() || '',
      Array.isArray(params.category) ? params.category.slice().sort().join(',') : (params.category || ''),
      Array.isArray(params.subCategory) ? params.subCategory.slice().sort().join(',') : (params.subCategory || ''),
      Array.isArray(params.nestedSubCategory) ? params.nestedSubCategory.slice().sort().join(',') : (params.nestedSubCategory || ''),
      Array.isArray(params.visualSubCategory) ? params.visualSubCategory.slice().sort().join(',') : (params.visualSubCategory || ''),
      Array.isArray(params.brand) ? params.brand.sort().join(',') : (params.brand || ''),
      params.minPrice ?? '',
      params.maxPrice ?? '',
      params.minRating ?? '',
      params.minDiscount ?? '',
      params.inStock ? '1' : '0',
      params.gender || '',
      params.noAutoCorrect ? '1' : '0',
      params.useAI ? '1' : '0',
      params.baselineOnly ? '1' : '0',
      params.sessionId || '',
      Array.isArray(params.color) ? params.color.sort().join(',') : (params.color || ''),
      Array.isArray(params.size) ? params.size.sort().join(',') : (params.size || ''),
      params.sortBy || 'relevance',
      params.page || 1,
      params.limit || 24
    ];
    return parts.join('|');
  }

  /**
   * Retrieves a cached SearchResult if present and not expired
   */
  public get(key: string): SearchResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Refresh hit & LRU ordering
    entry.hits++;
    this.hitCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return {
      ...entry.result,
      executionTimeMs: 0.1 // Cached instantaneous response
    };
  }

  /**
   * Stores a SearchResult in cache with LRU eviction
   */
  public set(key: string, result: SearchResult): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest item (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictionCount++;
      }
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * Invalidates entire cache or keys matching specific filters
   */
  public invalidate(): void {
    this.cache.clear();
  }

  /**
   * Get cache telemetry stats
   */
  public getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? Math.round((this.hitCount / totalRequests) * 1000) / 10 : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxEntries,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate,
      evictions: this.evictionCount
    };
  }
}

export const searchCache = new SearchCache();

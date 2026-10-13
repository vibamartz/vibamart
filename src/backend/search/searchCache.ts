/**
 * In-memory LRU Cache with TTL expiry for search queries and autocomplete suggestions.
 * Protects server resources and achieves sub-millisecond response times for popular queries.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SearchLRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(maxEntries: number = 500, defaultTtlMs: number = 120000) { // 2 minutes default TTL
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest item (first key in map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, { value, expiresAt });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

/**
 * Normalizes query parameters into a deterministic cache key.
 */
export function createSearchCacheKey(params: Record<string, any>): string {
  const paramMap = new Map<string, any>();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      paramMap.set(k.toLowerCase(), v);
    }
  }

  const sortedKeys = Array.from(paramMap.keys()).sort();

  return sortedKeys
    .map(k => {
      const v = paramMap.get(k);
      const valStr = Array.isArray(v) ? v.slice().sort().join(',') : String(v).trim().toLowerCase();
      return `${k}=${valStr}`;
    })
    .join('&');
}

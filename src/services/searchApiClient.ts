import { SearchParams, SearchResult, SuggestionResult } from '../backend/search/searchTypes';

interface ClientCacheEntry<T> {
  data: T;
  timestamp: number;
}

const suggestionClientCache = new Map<string, ClientCacheEntry<SuggestionResult>>();
const searchClientCache = new Map<string, ClientCacheEntry<SearchResult>>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute client-side cache

let currentSuggestionSeq = 0;

/**
 * High-speed autocomplete suggestions client with stale-response protection and client-side caching.
 */
export async function fetchSearchSuggestions(
  query: string,
  limit: number = 8,
  signal?: AbortSignal
): Promise<SuggestionResult | null> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) {
    return {
      query,
      suggestions: [],
      suggestedCategories: [],
      suggestedBrands: [],
      executionTimeMs: 0
    };
  }

  const cacheKey = `${trimmed}_${limit}`;
  const cached = suggestionClientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const seq = ++currentSuggestionSeq;

  try {
    const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=${limit}`, {
      signal
    });

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();

    // Stale response protection: ignore if newer request has already been issued
    if (seq !== currentSuggestionSeq) {
      return null;
    }

    if (json.success) {
      suggestionClientCache.set(cacheKey, { data: json, timestamp: Date.now() });
      return json as SuggestionResult;
    }
    return null;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.warn('[SEARCH CLIENT] Autocomplete failed:', err);
    return null;
  }
}

/**
 * Unified full-text product search client.
 */
export async function fetchSearchResults(
  params: SearchParams,
  signal?: AbortSignal
): Promise<SearchResult | null> {
  const queryParts: string[] = [];

  if (params.q) queryParts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
  if (params.subCategory) queryParts.push(`subCategory=${encodeURIComponent(params.subCategory)}`);
  if (params.nestedSubCategory) queryParts.push(`nestedSubCategory=${encodeURIComponent(params.nestedSubCategory)}`);
  if (params.visualSubCategory) queryParts.push(`visualSubCategory=${encodeURIComponent(params.visualSubCategory)}`);

  if (params.brand) {
    const bStr = Array.isArray(params.brand) ? params.brand.join(',') : params.brand;
    queryParts.push(`brand=${encodeURIComponent(bStr)}`);
  }

  if (params.minPrice !== undefined) queryParts.push(`minPrice=${params.minPrice}`);
  if (params.maxPrice !== undefined) queryParts.push(`maxPrice=${params.maxPrice}`);
  if (params.minRating !== undefined) queryParts.push(`minRating=${params.minRating}`);
  if (params.minDiscount !== undefined) queryParts.push(`minDiscount=${params.minDiscount}`);
  if (params.inStock) queryParts.push(`inStock=true`);
  if (params.color) {
    const cStr = Array.isArray(params.color) ? params.color.join(',') : params.color;
    queryParts.push(`color=${encodeURIComponent(cStr)}`);
  }
  if (params.size) {
    const sStr = Array.isArray(params.size) ? params.size.join(',') : params.size;
    queryParts.push(`size=${encodeURIComponent(sStr)}`);
  }
  if (params.sortBy) queryParts.push(`sortBy=${encodeURIComponent(params.sortBy)}`);
  if (params.page) queryParts.push(`page=${params.page}`);
  if (params.limit) queryParts.push(`limit=${params.limit}`);

  const queryString = queryParts.join('&');
  const cacheKey = queryString || 'default';

  const cached = searchClientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const res = await fetch(`/api/search?${queryString}`, { signal });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();

    if (json.success) {
      searchClientCache.set(cacheKey, { data: json, timestamp: Date.now() });
      return json as SearchResult;
    }
    return null;
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    console.warn('[SEARCH CLIENT] Search request failed:', err);
    return null;
  }
}

/**
 * Logs telemetry click events without blocking navigation.
 */
export function logSearchClick(
  query: string,
  productId?: string,
  type: 'search' | 'product_click' | 'suggestion_click' = 'product_click',
  platform: 'desktop' | 'mobile' = 'desktop'
) {
  if (!query) return;
  fetch('/api/search/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, productId, type, platform }),
    keepalive: true
  }).catch(() => {});
}

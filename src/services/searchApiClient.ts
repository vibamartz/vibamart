import axios from 'axios';
import { SearchParams, SearchResult, SuggestionResult } from '../backend/search/searchTypes';

class SearchApiClient {
  private activeSuggestionAbortController: AbortController | null = null;

  /**
   * Execute full product search with filters, facets, and pagination.
   */
  public async search(params: SearchParams): Promise<SearchResult> {
    try {
      const queryParams: Record<string, any> = {};

      if (params.q) queryParams.q = params.q;
      if (params.category) queryParams.category = params.category;
      if (params.subCategory) queryParams.subCategory = params.subCategory;
      if (params.nestedSubCategory) queryParams.nestedSubCategory = params.nestedSubCategory;
      if (params.visualSubCategory) queryParams.visualSubCategory = params.visualSubCategory;

      if (params.brand) {
        queryParams.brand = Array.isArray(params.brand) ? params.brand.join(',') : params.brand;
      }
      if (params.minPrice !== undefined) queryParams.minPrice = params.minPrice;
      if (params.maxPrice !== undefined) queryParams.maxPrice = params.maxPrice;
      if (params.minRating !== undefined) queryParams.minRating = params.minRating;
      if (params.minDiscount !== undefined) queryParams.minDiscount = params.minDiscount;
      if (params.inStock) queryParams.inStock = 'true';

      if (params.color) {
        queryParams.color = Array.isArray(params.color) ? params.color.join(',') : params.color;
      }
      if (params.size) {
        queryParams.size = Array.isArray(params.size) ? params.size.join(',') : params.size;
      }

      if (params.sortBy) queryParams.sortBy = params.sortBy;
      if (params.page !== undefined) queryParams.page = params.page;
      if (params.limit !== undefined) queryParams.limit = params.limit;
      if (params.noAutoCorrect) queryParams.noAutoCorrect = 'true';

      const response = await axios.get('/api/search', {
        params: queryParams,
        timeout: 10000
      });

      if (response.data && response.data.success) {
        return response.data as SearchResult;
      }

      throw new Error(response.data?.error || 'Invalid search response structure');
    } catch (error: any) {
      console.error('[SearchApiClient] Search request error:', error);
      throw error;
    }
  }

  /**
   * Fetch live autocomplete suggestions with automatic stale-request cancellation.
   */
  public async suggest(query: string, limit = 8): Promise<SuggestionResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { query: '', suggestions: [], executionTimeMs: 0 };
    }

    // Cancel in-flight suggestion requests
    if (this.activeSuggestionAbortController) {
      this.activeSuggestionAbortController.abort();
    }
    this.activeSuggestionAbortController = new AbortController();

    try {
      const response = await axios.get('/api/search/suggestions', {
        params: { q: trimmed, limit },
        signal: this.activeSuggestionAbortController.signal,
        timeout: 4000
      });

      if (response.data && response.data.success) {
        return response.data as SuggestionResult;
      }

      return { query: trimmed, suggestions: [], executionTimeMs: 0 };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return { query: trimmed, suggestions: [], executionTimeMs: 0 };
      }
      console.warn('[SearchApiClient] Autocomplete suggestions fetch warning:', error);
      return { query: trimmed, suggestions: [], executionTimeMs: 0 };
    }
  }

  /**
   * Fetch dynamic popular and trending searches from catalog data and search telemetry.
   */
  public async getPopular(limit = 8): Promise<SuggestionResult> {
    try {
      const response = await axios.get('/api/search/popular', {
        params: { limit },
        timeout: 4000
      });
      if (response.data && response.data.success) {
        return response.data as SuggestionResult;
      }
      return { query: '', suggestions: [], executionTimeMs: 0 };
    } catch (err) {
      console.warn('[SearchApiClient] Popular searches fetch warning:', err);
      return { query: '', suggestions: [], executionTimeMs: 0 };
    }
  }

  /**
   * Log search interaction telemetry.
   */
  public async logAnalytics(data: {
    query: string;
    resultCount?: number;
    executionTimeMs?: number;
    type?: string;
    productId?: string;
    platform?: 'desktop' | 'mobile';
  }): Promise<void> {
    try {
      await axios.post('/api/search/analytics', data, { timeout: 2000 });
    } catch {
      // Best-effort telemetry
    }
  }

  /**
   * Fetch search index health and status.
   */
  public async getStatus(): Promise<any> {
    const res = await axios.get('/api/search/status');
    return res.data?.status;
  }

  /**
   * Trigger full catalog reindex.
   */
  public async triggerReindex(): Promise<any> {
    const res = await axios.post('/api/search/reindex');
    return res.data;
  }

  /**
   * Fetch current search curation config.
   */
  public async getCurationConfig(): Promise<any> {
    const res = await axios.get('/api/search/admin/curation');
    return res.data?.config;
  }

  /**
   * Save search curation config.
   */
  public async saveCurationConfig(config: any): Promise<any> {
    const res = await axios.post('/api/search/admin/curation', config);
    return res.data?.config;
  }

  /**
   * Fetch search analytics metrics and telemetry summary.
   */
  public async getAnalyticsSummary(): Promise<any> {
    const res = await axios.get('/api/search/admin/analytics');
    return res.data;
  }

  /**
   * Parse natural language query intent using AI / Semantic engine.
   */
  public async parseAIIntent(query: string): Promise<any> {
    const res = await axios.post('/api/search/ai/intent', { query });
    return res.data?.intent;
  }

  /**
   * Fetch AI search engine configuration and model status.
   */
  public async getAIStatus(): Promise<any> {
    const res = await axios.get('/api/search/ai/status');
    return res.data?.status;
  }
}

export const searchApiClient = new SearchApiClient();



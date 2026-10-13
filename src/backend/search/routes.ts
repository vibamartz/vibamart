import { Router, Request, Response } from 'express';
import { SearchService } from './searchService';
import { SearchParams } from './searchTypes';
import { recordSearchAnalytics } from './searchAnalytics';
import { searchRateLimiter, suggestionRateLimiter, createSearchRateLimitMiddleware } from './searchRateLimiter';
import { searchCurationManager } from './searchCuration';
import admin from 'firebase-admin';

export const searchRouter = Router();
const searchService = SearchService.getInstance();

/**
 * GET /api/search
 * Executes structured, full-text product search with server-side filters and facet computation.
 */
searchRouter.get('/', createSearchRateLimitMiddleware(searchRateLimiter), async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const subCategory = typeof req.query.subCategory === 'string' ? req.query.subCategory : undefined;
    const nestedSubCategory = typeof req.query.nestedSubCategory === 'string' ? req.query.nestedSubCategory : undefined;
    const visualSubCategory = typeof req.query.visualSubCategory === 'string' ? req.query.visualSubCategory : undefined;

    let brand: string[] | string | undefined = undefined;
    if (typeof req.query.brand === 'string') {
      brand = req.query.brand.includes(',') ? req.query.brand.split(',').map(b => b.trim()) : req.query.brand;
    } else if (Array.isArray(req.query.brand)) {
      brand = req.query.brand as string[];
    }

    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;
    const minRating = req.query.minRating !== undefined ? Number(req.query.minRating) : undefined;
    const minDiscount = req.query.minDiscount !== undefined ? Number(req.query.minDiscount) : undefined;
    const inStock = req.query.inStock === 'true' || req.query.inStock === '1';

    let color: string[] | string | undefined = undefined;
    if (typeof req.query.color === 'string') {
      color = req.query.color.includes(',') ? req.query.color.split(',').map(c => c.trim()) : req.query.color;
    }

    let size: string[] | string | undefined = undefined;
    if (typeof req.query.size === 'string') {
      size = req.query.size.includes(',') ? req.query.size.split(',').map(s => s.trim()) : req.query.size;
    }

    const sortBy = (typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined) as any;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 24;

    const params: SearchParams = {
      q,
      category,
      subCategory,
      nestedSubCategory,
      visualSubCategory,
      brand,
      minPrice,
      maxPrice,
      minRating,
      minDiscount,
      inStock,
      color,
      size,
      sortBy,
      page,
      limit
    };

    const results = await searchService.search(params);

    // Asynchronously log search analytics for text queries
    if (q) {
      recordSearchAnalytics({
        query: q,
        resultCount: results.total,
        isZeroResult: results.total === 0,
        executionTimeMs: results.executionTimeMs,
        type: 'search'
      }).catch(() => {});
    }

    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('Search endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Search Error'
    });
  }
});

/**
 * POST /api/search/analytics
 * Logs telemetry events like suggestion clicks or product clicks.
 */
searchRouter.post('/analytics', async (req: Request, res: Response) => {
  try {
    const { query, resultCount = 1, executionTimeMs = 0, type = 'product_click', productId, platform } = req.body;
    if (query) {
      await recordSearchAnalytics({
        query,
        resultCount: Number(resultCount) || 0,
        isZeroResult: Number(resultCount) === 0,
        executionTimeMs: Number(executionTimeMs) || 0,
        type,
        productId,
        platform
      });
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // Always 200 for analytics
  }
});

/**
 * GET /api/search/suggestions
 * Returns live autocomplete suggestions for products, categories, and brands.
 */
searchRouter.get('/suggestions', createSearchRateLimitMiddleware(suggestionRateLimiter), async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 8;

    const suggestions = await searchService.suggest(q, limit);
    res.json({
      success: true,
      ...suggestions
    });
  } catch (error: any) {
    console.error('Suggestions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suggestions'
    });
  }
});

/**
 * GET /api/search/status
 * Returns index telemetry, product count, and memory statistics.
 */
searchRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: searchService.getStatus()
  });
});

/**
 * POST /api/search/reindex
 * Manually forces full catalog re-indexing.
 */
searchRouter.post('/reindex', async (req: Request, res: Response) => {
  try {
    const indexedCount = await searchService.indexAllProducts();
    res.json({
      success: true,
      message: `Reindexed ${indexedCount} products.`,
      status: searchService.getStatus()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Re-indexing failed'
    });
  }
});

/**
 * GET /api/search/admin/curation
 * Fetches pinned products, boosted products, and custom synonym groups.
 */
searchRouter.get('/admin/curation', (req: Request, res: Response) => {
  res.json({
    success: true,
    config: searchCurationManager.getConfig()
  });
});

/**
 * POST /api/search/admin/curation
 * Updates pinning rules, boosting rules, and custom synonyms.
 */
searchRouter.post('/admin/curation', async (req: Request, res: Response) => {
  try {
    const { pinnedRules, boostedRules, customSynonyms } = req.body;
    const updated = await searchCurationManager.saveConfig({
      pinnedRules,
      boostedRules,
      customSynonyms
    });
    await searchService.syncCurationRules();
    res.json({
      success: true,
      config: updated
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update curation config'
    });
  }
});

/**
 * GET /api/search/admin/analytics
 * Retrieves top zero-result queries and popular searches from Firestore analytics.
 */
searchRouter.get('/admin/analytics', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('searchAnalytics')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    const zeroResultMap = new Map<string, { query: string; count: number; lastSearched: string; platform?: string }>();
    const topQueriesMap = new Map<string, { query: string; count: number; lastSearched: string }>();

    let totalLatency = 0;
    let latencyCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const q = (data.query || '').trim().toLowerCase();
      if (!q) return;

      if (data.executionTimeMs) {
        totalLatency += Number(data.executionTimeMs);
        latencyCount++;
      }

      if (data.isZeroResult) {
        const existing = zeroResultMap.get(q) || { query: data.query, count: 0, lastSearched: data.timestamp, platform: data.platform };
        existing.count++;
        zeroResultMap.set(q, existing);
      } else {
        const existing = topQueriesMap.get(q) || { query: data.query, count: 0, lastSearched: data.timestamp };
        existing.count++;
        topQueriesMap.set(q, existing);
      }
    });

    const zeroResultQueries = Array.from(zeroResultMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
    const topQueries = Array.from(topQueriesMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);
    const avgLatencyMs = latencyCount > 0 ? Math.round((totalLatency / latencyCount) * 10) / 10 : 1.2;

    res.json({
      success: true,
      analytics: {
        zeroResultQueries,
        topQueries,
        avgLatencyMs,
        totalEventsAnalyzed: snapshot.size
      }
    });
  } catch (err: any) {
    res.json({
      success: true,
      analytics: {
        zeroResultQueries: [],
        topQueries: [],
        avgLatencyMs: 1.0,
        totalEventsAnalyzed: 0
      }
    });
  }
});

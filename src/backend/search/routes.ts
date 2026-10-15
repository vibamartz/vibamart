import { Router, Request, Response } from 'express';
import { searchService } from './searchService';
import { SearchParams } from './searchTypes';
import { searchCurationManager } from './searchCuration';
import { recordSearchAnalytics, getAnalyticsSummary } from './searchAnalytics';
import { parseQueryIntent, getSemanticSearchStatus } from './semanticSearch';
import { sanitizeSearchParams, sanitizeSearchString } from './searchSanitization';
import { searchRateLimiter, adminSearchRateLimiter, reindexRateLimiter } from './searchRateLimit';
import { requireSearchAdmin } from './searchAuth';

export const searchRouter = Router();

/**
 * GET /api/search
 * Core product search endpoint with multi-term matching, typo tolerance, filters, facets, and pagination.
 * Hardened with searchRateLimiter and input sanitization.
 */
searchRouter.get('/', searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const params: SearchParams = sanitizeSearchParams(req.query);
    const results = await searchService.search(params);

    // Asynchronously log search analytics if text query
    if (params.q && params.q.trim()) {
      recordSearchAnalytics({
        query: params.q.trim(),
        resultCount: results.total,
        isZeroResult: results.total === 0,
        executionTimeMs: results.executionTimeMs,
        type: 'search',
        platform: 'desktop'
      }).catch(() => {});
    }

    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('[SearchRouter] Search endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Search Error'
    });
  }
});

/**
 * GET /api/search/suggestions
 * Live autocomplete suggestions for header / mobile search inputs.
 * Hardened with searchRateLimiter and query sanitization.
 */
searchRouter.get(['/suggestions', '/suggest'], searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const q = sanitizeSearchString(typeof req.query.q === 'string' ? req.query.q : '');
    const rawLimit = Number(req.query.limit);
    const limit = (!isNaN(rawLimit) && rawLimit >= 1) ? Math.min(20, Math.floor(rawLimit)) : 8;

    const suggestions = await searchService.suggest(q, limit);
    res.json({
      success: true,
      ...suggestions
    });
  } catch (error: any) {
    console.error('[SearchRouter] Suggestions endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suggestions'
    });
  }
});

/**
 * GET /api/search/popular
 * Dynamic popular and trending searches generated from actual catalog data and search analytics.
 */
searchRouter.get('/popular', searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = (!isNaN(rawLimit) && rawLimit >= 1) ? Math.min(20, Math.floor(rawLimit)) : 8;
    const popular = await searchService.getPopular(limit);
    res.json({
      success: true,
      ...popular
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch popular searches'
    });
  }
});

/**
 * GET /api/search/status
 * Returns index telemetry and status.
 */
searchRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: searchService.getStatus()
  });
});

/**
 * POST /api/search/reindex
 * Forces catalog re-indexing.
 * Protected by reindexRateLimiter and requireSearchAdmin authentication.
 */
searchRouter.post('/reindex', reindexRateLimiter, requireSearchAdmin, async (req: Request, res: Response) => {
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
 * POST /api/search/analytics
 * Logs telemetry events like suggestion clicks.
 */
searchRouter.post('/analytics', searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const { query, resultCount = 1, executionTimeMs = 0, type = 'product_click', productId, platform = 'desktop' } = req.body || {};
    const sanitizedQuery = sanitizeSearchString(String(query || ''));

    const rawType = String(type || 'product_click');
    const safeType: 'search' | 'product_click' | 'suggestion_click' =
      rawType === 'search' || rawType === 'suggestion_click' ? rawType : 'product_click';
    const rawPlatform = String(platform || 'desktop');
    const safePlatform: 'mobile' | 'desktop' = rawPlatform === 'mobile' ? 'mobile' : 'desktop';

    if (sanitizedQuery) {
      await recordSearchAnalytics({
        query: sanitizedQuery,
        resultCount: Math.max(0, Number(resultCount) || 0),
        isZeroResult: Number(resultCount) === 0,
        executionTimeMs: Math.max(0, Number(executionTimeMs) || 0),
        type: safeType,
        productId: productId ? sanitizeSearchString(String(productId)) : undefined,
        platform: safePlatform
      });
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true }); // Always 200 for analytics
  }
});

/**
 * GET /api/search/admin/curation
 * Fetches current curation rules (pinned products, brand boosts, custom synonyms).
 * Protected by adminSearchRateLimiter and requireSearchAdmin authentication.
 */
searchRouter.get('/admin/curation', adminSearchRateLimiter, requireSearchAdmin, async (_req: Request, res: Response) => {
  try {
    const config = await searchCurationManager.loadConfig();
    res.json({
      success: true,
      config
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to load curation rules'
    });
  }
});

/**
 * POST /api/search/admin/curation
 * Saves new curation rules.
 * Protected by adminSearchRateLimiter and requireSearchAdmin authentication.
 */
searchRouter.post('/admin/curation', adminSearchRateLimiter, requireSearchAdmin, async (req: Request, res: Response) => {
  try {
    const { pinnedRules, boostedRules, customSynonyms } = req.body || {};
    const updated = await searchCurationManager.saveConfig({
      pinnedRules: Array.isArray(pinnedRules) ? pinnedRules : [],
      boostedRules: Array.isArray(boostedRules) ? boostedRules : [],
      customSynonyms: Array.isArray(customSynonyms) ? customSynonyms : []
    });
    res.json({
      success: true,
      config: updated
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save curation rules'
    });
  }
});

/**
 * GET /api/search/admin/analytics
 * Returns search performance metrics, zero-result queries, top searches, and latency telemetry.
 * Protected by adminSearchRateLimiter and requireSearchAdmin authentication.
 */
searchRouter.get('/admin/analytics', adminSearchRateLimiter, requireSearchAdmin, async (_req: Request, res: Response) => {
  try {
    const summary = await getAnalyticsSummary();
    const status = searchService.getStatus();
    res.json({
      success: true,
      summary,
      status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch search analytics'
    });
  }
});

/**
 * POST /api/search/ai/intent
 * Parses a natural language search query into clean keywords, filters, and semantic tags.
 * Protected by searchRateLimiter and query sanitization.
 */
searchRouter.post('/ai/intent', searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const { query } = req.body || {};
    const sanitizedQuery = sanitizeSearchString(String(query || ''));
    const intent = await parseQueryIntent(sanitizedQuery);
    res.json({
      success: true,
      intent
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse query intent'
    });
  }
});

/**
 * GET /api/search/ai/status
 * Returns current status of AI semantic search engine and API configuration.
 */
searchRouter.get('/ai/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: getSemanticSearchStatus()
  });
});

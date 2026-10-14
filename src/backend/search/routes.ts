import { Router, Request, Response } from 'express';
import { searchService } from './searchService';
import { SearchParams } from './searchTypes';
import { searchCurationManager } from './searchCuration';
import { recordSearchAnalytics, getAnalyticsSummary } from './searchAnalytics';
import admin from 'firebase-admin';

export const searchRouter = Router();

/**
 * GET /api/search
 * Core product search endpoint with multi-term matching, typo tolerance, filters, facets, and pagination.
 */
searchRouter.get('/', async (req: Request, res: Response) => {
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

    // Asynchronously log search analytics if text query
    if (q && q.trim()) {
      recordSearchAnalytics({
        query: q.trim(),
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
 */
searchRouter.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 8;

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
 * POST /api/search/analytics
 * Logs telemetry events like suggestion clicks.
 */
searchRouter.post('/analytics', async (req: Request, res: Response) => {
  try {
    const { query, resultCount = 1, executionTimeMs = 0, type = 'product_click', productId, platform = 'desktop' } = req.body;
    if (query) {
      await recordSearchAnalytics({
        query: String(query).trim(),
        resultCount: Number(resultCount) || 0,
        isZeroResult: Number(resultCount) === 0,
        executionTimeMs: Number(executionTimeMs) || 0,
        type: type || 'product_click',
        productId: productId || undefined,
        platform: platform || 'desktop'
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
 */
searchRouter.get('/admin/curation', async (_req: Request, res: Response) => {
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
 */
searchRouter.post('/admin/curation', async (req: Request, res: Response) => {
  try {
    const { pinnedRules, boostedRules, customSynonyms } = req.body;
    const updated = await searchCurationManager.saveConfig({
      pinnedRules,
      boostedRules,
      customSynonyms
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
 */
searchRouter.get('/admin/analytics', async (_req: Request, res: Response) => {
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


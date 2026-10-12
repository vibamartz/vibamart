import { Request, Response } from 'express';
import { ViBaSearchEngine } from '../../../src/backend/search/searchEngine';
import { searchCache } from '../../../src/backend/search/searchCache';
import { synonymService } from '../../../src/backend/search/synonymService';
import { searchAnalyticsService } from '../../../src/backend/search/searchAnalyticsService';
import { SearchRequest, SearchFilters, SearchSortOption, AutocompleteItem, AutocompleteResponse } from '../../../src/backend/search/types';
import { getProductSlug, getCategorySlug } from '../../../src/shared/utilities/slug';
import { formatProductCode } from '../../../src/shared/utilities/productCode';

/**
 * Core Search Endpoint Handler
 * GET /api/search?q=...&category=...&brand=...&sort=...&page=...&limit=...
 */
export async function searchHandler(req: Request, res: Response) {
  const startTime = performance.now();
  try {
    const rawQuery = String(req.query.q || req.query.query || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
    const sortBy = (String(req.query.sort || req.query.sortBy || 'relevance')) as SearchSortOption;

    // Parse filters
    const filters: SearchFilters = {};
    if (req.query.category) filters.categoryId = String(req.query.category);
    if (req.query.subCategory) filters.subCategoryId = String(req.query.subCategory);
    if (req.query.nestedSubCategory) filters.nestedSubCategoryId = String(req.query.nestedSubCategory);
    if (req.query.visual) filters.visualNestedSubcategoryId = String(req.query.visual);
    if (req.query.brand) filters.brand = String(req.query.brand);

    if (req.query.minPrice) filters.minPrice = parseFloat(String(req.query.minPrice));
    if (req.query.maxPrice) filters.maxPrice = parseFloat(String(req.query.maxPrice));
    if (req.query.minRating) filters.minRating = parseFloat(String(req.query.minRating));
    if (req.query.minDiscount) filters.minDiscount = parseFloat(String(req.query.minDiscount));
    if (req.query.inStock === 'true' || req.query.onlyInStock === 'true') filters.inStockOnly = true;
    if (req.query.isDeal259 === 'true') filters.isDeal259 = true;

    // Load products and category names from in-memory cache
    const [products, categoryNamesMap] = await Promise.all([
      searchCache.getProducts(),
      searchCache.getCategoryNamesMap(),
    ]);

    const searchRequest: SearchRequest = {
      query: rawQuery,
      filters,
      sortBy,
      page,
      limit,
      enableFuzzy: req.query.fuzzy !== 'false',
      enableSynonyms: req.query.synonyms !== 'false',
    };

    const response = ViBaSearchEngine.executeSearch(products, searchRequest, categoryNamesMap);

    // Asynchronously log search analytics event
    if (rawQuery.length >= 2) {
      searchAnalyticsService.logSearchEvent({
        query: rawQuery,
        normalizedQuery: response.normalizedQuery,
        hitCount: response.totalHits,
        latencyMs: response.latencyMs,
        zeroResult: response.totalHits === 0,
        timestamp: new Date().toISOString(),
        userId: (req as any).user?.uid || null,
        userAgent: req.headers['user-agent'] || '',
        filtersApplied: filters,
        actionType: 'search',
      }).catch(err => console.warn('Background search analytics log failed:', err));
    }

    res.json({
      success: true,
      ...response
    });
  } catch (err: any) {
    console.error('Search API Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Search execution failed',
      hits: [],
      totalHits: 0,
      latencyMs: Math.round((performance.now() - startTime) * 100) / 100,
    });
  }
}

/**
 * Autocomplete & Fast Suggestions Handler
 * GET /api/search/suggestions?q=...
 */
export async function suggestionsHandler(req: Request, res: Response) {
  const startTime = performance.now();
  try {
    const rawQuery = String(req.query.q || '').trim();
    if (rawQuery.length < 2) {
      return res.json({
        query: rawQuery,
        suggestions: [],
        latencyMs: 0
      } as AutocompleteResponse);
    }

    const [products, categoryNamesMap] = await Promise.all([
      searchCache.getProducts(),
      searchCache.getCategoryNamesMap(),
    ]);

    // Execute fast search with limit of 8 suggestions
    const searchResponse = ViBaSearchEngine.executeSearch(
      products,
      {
        query: rawQuery,
        limit: 8,
        page: 1,
        enableFuzzy: true,
        enableSynonyms: true,
      },
      categoryNamesMap
    );

    const suggestions: AutocompleteItem[] = [];

    // 1. Top Product Suggestions (up to 5)
    for (const hit of searchResponse.hits.slice(0, 5)) {
      const p = hit.product;
      suggestions.push({
        id: p.id,
        type: 'product',
        title: p.name,
        subtitle: p.brand ? `${p.brand} • ₹${(p.discountPrice || p.price).toLocaleString()}` : `₹${(p.discountPrice || p.price).toLocaleString()}`,
        image: p.primaryImage || p.images?.[0] || '',
        price: p.price,
        discountPrice: p.discountPrice,
        slug: getProductSlug(p),
        productCode: p.productCode ? formatProductCode(p.productCode) : undefined,
        targetUrl: `/products/${getProductSlug(p)}`,
      });
    }

    // 2. Matching Category Suggestions (up to 2)
    const lowerQ = rawQuery.toLowerCase();
    for (const [catId, catName] of Object.entries(categoryNamesMap)) {
      if (suggestions.filter(s => s.type === 'category').length >= 2) break;
      if (catName.toLowerCase().includes(lowerQ)) {
        suggestions.push({
          id: catId,
          type: 'category',
          title: catName,
          subtitle: 'Category',
          targetUrl: `/categories/${catId}`,
        });
      }
    }

    // 3. Matching Brand Suggestions (up to 2)
    const matchedBrands = new Set<string>();
    for (const hit of searchResponse.hits) {
      if (hit.product.brand && hit.product.brand.toLowerCase().includes(lowerQ)) {
        matchedBrands.add(hit.product.brand);
      }
    }
    for (const b of Array.from(matchedBrands).slice(0, 2)) {
      suggestions.push({
        id: `brand_${b}`,
        type: 'brand',
        title: b,
        subtitle: 'Brand',
        targetUrl: `/products?brand=${encodeURIComponent(b)}`,
      });
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

    res.json({
      query: rawQuery,
      suggestions,
      spellingCorrection: searchResponse.didYouMean,
      latencyMs
    } as AutocompleteResponse);
  } catch (err: any) {
    console.error('Suggestions API Error:', err);
    res.status(500).json({
      query: String(req.query.q || ''),
      suggestions: [],
      latencyMs: Math.round((performance.now() - startTime) * 100) / 100
    });
  }
}

/**
 * Synonyms Management Handler (Admin)
 * GET, POST, DELETE /api/search/synonyms
 */
export async function synonymsHandler(req: Request, res: Response) {
  try {
    if (req.method === 'GET') {
      const force = req.query.refresh === 'true';
      const synonyms = await synonymService.getSynonyms(force);
      return res.json({ success: true, synonyms });
    }

    if (req.method === 'POST') {
      const { term, synonyms, isBidirectional, isActive, id } = req.body;
      if (!term || !synonyms || !Array.isArray(synonyms) || synonyms.length === 0) {
        return res.status(400).json({ success: false, error: 'Term and synonyms array are required.' });
      }

      const saved = await synonymService.saveSynonym({
        id,
        term,
        synonyms,
        isBidirectional: isBidirectional !== false,
        isActive: isActive !== false,
      });

      return res.json({ success: true, synonym: saved });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || req.body?.id || '');
      if (!id) {
        return res.status(400).json({ success: false, error: 'Synonym ID is required.' });
      }

      const deleted = await synonymService.deleteSynonym(id);
      return res.json({ success: deleted });
    }

    res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Synonyms API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Synonyms operation failed' });
  }
}

/**
 * Search Analytics Metrics Handler (Admin)
 * GET /api/search/analytics
 */
export async function searchAnalyticsHandler(req: Request, res: Response) {
  try {
    const metrics = await searchAnalyticsService.getSearchMetrics();
    res.json({ success: true, ...metrics });
  } catch (err: any) {
    console.error('Search Analytics API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to fetch search metrics' });
  }
}

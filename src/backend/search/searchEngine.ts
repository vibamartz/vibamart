import MiniSearch from 'minisearch';
import { Product } from '../../shared/types';
import { SearchParams, SearchResult, SearchFacets, SearchFacetValue, SuggestionResult, SuggestionItem, RecoveryRecommendation } from './searchTypes';
import { expandQueryWithSynonyms, getSynonymsForTerm } from './searchSynonyms';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { AiIntentParser } from './aiIntentParser';
import { SemanticRanker } from './semanticRanker';
import { ZeroResultRecovery } from './zeroResultRecovery';
import { PinnedRule, BoostedRule } from './searchCuration';

export interface IndexedProductDoc {
  id: string;
  name: string;
  brand: string;
  productCode: string;
  cleanProductCode: string;
  sku: string;
  categoryName: string;
  subCategoryName: string;
  nestedSubCategoryName: string;
  tags: string;
  specifications: string;
  variantAttributes: string;
  description: string;
  // Metadata for filtering & facets
  categoryId: string;
  subCategoryId?: string;
  nestedSubCategoryId?: string;
  visualNestedSubcategoryIds?: string[];
  effectivePrice: number;
  price: number;
  discountPrice?: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  inStock: boolean;
  colors: string[];
  sizes: string[];
  createdAt: string;
  status: string;
  isVisible: boolean;
  isReward: boolean;
  raw: Product;
}

/**
 * Standard English stemmer (Porter algorithm lightweight variant) & normalizer
 */
export function stemToken(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4 && !w.endsWith('shoes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  return w;
}

export class ViBaSearchEngine {
  private miniSearch: MiniSearch<IndexedProductDoc>;
  private indexedDocs: Map<string, IndexedProductDoc> = new Map();
  private vocabulary: Set<string> = new Set();
  private rewardProductIds: Set<string> = new Set();
  private aiIntentParser = new AiIntentParser();
  private semanticRanker = new SemanticRanker();
  private zeroResultRecovery = new ZeroResultRecovery();
  private pinnedRules: PinnedRule[] = [];
  private boostedRules: BoostedRule[] = [];

  constructor() {
    this.miniSearch = new MiniSearch<IndexedProductDoc>({
      fields: [
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
      storeFields: ['id'],
      tokenize: (text) => {
        if (!text) return [];
        return text
          .toLowerCase()
          .replace(/[^\w\s-]/g, ' ')
          .split(/[\s-]+/)
          .filter(t => t.length > 0);
      },
      processTerm: (term) => stemToken(term),
      searchOptions: {
        boost: {
          productCode: 35,
          cleanProductCode: 35,
          sku: 25,
          name: 12,
          brand: 8,
          tags: 6,
          categoryName: 5,
          subCategoryName: 4,
          nestedSubCategoryName: 3,
          specifications: 3,
          variantAttributes: 3,
          description: 1
        },
        prefix: true,
        fuzzy: (term) => (term.length >= 5 ? 2 : term.length >= 3 ? 1 : 0),
        combineWith: 'OR'
      }
    });
  }

  /**
   * Set reward product IDs to strictly exclude from standard catalog searches.
   */
  public setRewardProductIds(ids: string[] | Set<string>) {
    this.rewardProductIds = ids instanceof Set ? ids : new Set(ids);
  }

  public setPinnedRules(rules: PinnedRule[]) {
    this.pinnedRules = rules;
  }

  public setBoostedRules(rules: BoostedRule[]) {
    this.boostedRules = rules;
  }

  public getPinnedProductIds(query: string): string[] {
    const qLower = query.trim().toLowerCase();
    const rule = this.pinnedRules.find(r => r.query.trim().toLowerCase() === qLower);
    return rule ? rule.productIds : [];
  }

  public getBoostForProduct(query: string, productId: string): number {
    const qLower = query.trim().toLowerCase();
    const rule = this.boostedRules.find(
      r => r.query.trim().toLowerCase() === qLower && r.productId === productId
    );
    return rule ? rule.boost : 0;
  }

  /**
   * Transforms a domain Product into an IndexedProductDoc.
   */
  public createIndexDoc(product: Product, categoryNames?: { cat?: string; sub?: string; nested?: string }): IndexedProductDoc {
    const effectivePrice = product.discountPrice || product.price || 0;
    const mrp = product.price || effectivePrice;
    const discountPercentage = mrp > effectivePrice && mrp > 0
      ? Math.round(((mrp - effectivePrice) / mrp) * 100)
      : (product.discountPercentage || 0);

    const colors: Set<string> = new Set();
    const sizes: Set<string> = new Set();
    const specsList: string[] = [];

    if (product.color) colors.add(product.color.toLowerCase().trim());
    if (product.size) sizes.add(product.size.toLowerCase().trim());
    if (Array.isArray(product.sizes)) {
      product.sizes.forEach(s => sizes.add(s.toLowerCase().trim()));
    }

    if (Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v.color) colors.add(v.color.toLowerCase().trim());
        if (v.size) sizes.add(v.size.toLowerCase().trim());
        if (v.name) specsList.push(v.name);
      });
    }

    if (Array.isArray(product.specifications)) {
      product.specifications.forEach(s => {
        if (s.key && s.value) specsList.push(`${s.key}: ${s.value}`);
      });
    }

    const visualNestedIds = [
      product.visualNestedSubcategoryId,
      ...(product.visualNestedSubcategoryIds || [])
    ].filter(Boolean) as string[];

    const rawCode = product.productCode || '';
    const cleanCode = rawCode ? cleanProductCode(rawCode) : '';

    return {
      id: product.id,
      name: product.name || '',
      brand: product.brand || '',
      productCode: rawCode,
      cleanProductCode: cleanCode,
      sku: product.sku || '',
      categoryName: categoryNames?.cat || product.categoryId || '',
      subCategoryName: categoryNames?.sub || product.subCategoryId || '',
      nestedSubCategoryName: categoryNames?.nested || product.nestedSubCategoryId || '',
      tags: (product.tags || []).join(' '),
      specifications: specsList.join(' '),
      variantAttributes: (product.variantAttributes || []).join(' '),
      description: [product.description, product.fullDescription].filter(Boolean).join(' '),
      categoryId: product.categoryId || '',
      subCategoryId: product.subCategoryId,
      nestedSubCategoryId: product.nestedSubCategoryId,
      visualNestedSubcategoryIds: visualNestedIds,
      effectivePrice,
      price: product.price,
      discountPrice: product.discountPrice,
      discountPercentage,
      rating: Number(product.rating) || 0,
      stock: Number(product.stock) || 0,
      inStock: (Number(product.stock) || 0) > 0,
      colors: Array.from(colors),
      sizes: Array.from(sizes),
      createdAt: product.createdAt || new Date().toISOString(),
      status: product.status || 'active',
      isVisible: product.isVisible !== false,
      isReward: this.rewardProductIds.has(product.id),
      raw: product
    };
  }

  /**
   * Bulk indexes an array of products.
   */
  public indexProducts(products: Product[], categoryMap?: Map<string, { cat?: string; sub?: string; nested?: string }>) {
    this.miniSearch.removeAll();
    this.indexedDocs.clear();
    this.vocabulary.clear();

    const docs: IndexedProductDoc[] = [];

    for (const p of products) {
      const names = categoryMap?.get(p.id);
      const doc = this.createIndexDoc(p, names);
      docs.push(doc);
      this.indexedDocs.set(doc.id, doc);

      // Collect vocabulary tokens for typo suggestions
      [doc.name, doc.brand, doc.tags].join(' ').toLowerCase().split(/\s+/).forEach(t => {
        const cleaned = t.replace(/[^\w]/g, '');
        if (cleaned.length >= 3) this.vocabulary.add(cleaned);
      });
    }

    if (docs.length > 0) {
      this.miniSearch.addAll(docs);
      const brands = Array.from(new Set(docs.map(d => d.brand).filter(Boolean)));
      this.aiIntentParser.setCatalogMetadata(brands);
      this.semanticRanker.buildIndex(docs);
    }
  }

  /**
   * Adds or updates a single product in the search index.
   */
  public upsertProduct(product: Product, categoryNames?: { cat?: string; sub?: string; nested?: string }) {
    if (this.indexedDocs.has(product.id)) {
      try {
        this.miniSearch.discard(product.id);
      } catch {
        // Safe discard
      }
    }

    const doc = this.createIndexDoc(product, categoryNames);
    this.indexedDocs.set(doc.id, doc);
    this.miniSearch.add(doc);
  }

  /**
   * Removes a product from the search index.
   */
  public removeProduct(productId: string) {
    if (this.indexedDocs.has(productId)) {
      try {
        this.miniSearch.discard(productId);
      } catch {
        // Safe discard
      }
      this.indexedDocs.delete(productId);
    }
  }

  /**
   * Filter candidate documents against explicit and AI-extracted constraints.
   */
  private filterCandidateDocs(
    candidateScores: Map<string, number>,
    filters: SearchParams
  ): IndexedProductDoc[] {
    const matchingDocs: IndexedProductDoc[] = [];

    for (const id of candidateScores.keys()) {
      const doc = this.indexedDocs.get(id);
      if (!doc) continue;

      // Exclude ineligible products
      if (doc.status === 'inactive' || doc.status === 'draft') continue;
      if (!doc.isVisible) continue;
      if (doc.isReward) continue;

      // Filter: Category
      if (filters.category && filters.category !== 'all-deals') {
        const cat = filters.category.toLowerCase();
        if (doc.categoryId.toLowerCase() !== cat && doc.categoryName.toLowerCase() !== cat) {
          continue;
        }
      }

      // Filter: SubCategory
      if (filters.subCategory && filters.subCategory !== 'all') {
        const sub = filters.subCategory.toLowerCase();
        if (doc.subCategoryId?.toLowerCase() !== sub && doc.subCategoryName.toLowerCase() !== sub) {
          continue;
        }
      }

      // Filter: Nested SubCategory
      if (filters.nestedSubCategory) {
        const nested = filters.nestedSubCategory.toLowerCase();
        if (doc.nestedSubCategoryId?.toLowerCase() !== nested && doc.nestedSubCategoryName.toLowerCase() !== nested) {
          continue;
        }
      }

      // Filter: Visual Nested SubCategory
      if (filters.visualSubCategory) {
        const vis = filters.visualSubCategory;
        if (!doc.visualNestedSubcategoryIds?.includes(vis)) {
          continue;
        }
      }

      // Filter: Brand(s)
      if (filters.brand) {
        const brands = Array.isArray(filters.brand)
          ? filters.brand.map(b => b.toLowerCase())
          : [filters.brand.toLowerCase()];
        if (brands.length > 0 && !brands.includes(doc.brand.toLowerCase())) {
          continue;
        }
      }

      // Filter: Price Range
      if (filters.minPrice !== undefined && doc.effectivePrice < filters.minPrice) continue;
      if (filters.maxPrice !== undefined && doc.effectivePrice > filters.maxPrice) continue;

      // Filter: Rating
      if (filters.minRating !== undefined && doc.rating < filters.minRating) continue;

      // Filter: Discount
      if (filters.minDiscount !== undefined && doc.discountPercentage < filters.minDiscount) continue;

      // Filter: In Stock
      if (filters.inStock && !doc.inStock) continue;

      // Filter: Color
      if (filters.color) {
        const colors = Array.isArray(filters.color)
          ? filters.color.map(c => c.toLowerCase())
          : [filters.color.toLowerCase()];
        const hasColor = doc.colors.some(c => colors.includes(c));
        if (!hasColor) continue;
      }

      // Filter: Size
      if (filters.size) {
        const sizes = Array.isArray(filters.size)
          ? filters.size.map(s => s.toLowerCase())
          : [filters.size.toLowerCase()];
        const hasSize = doc.sizes.some(s => sizes.includes(s));
        if (!hasSize) continue;
      }

      matchingDocs.push(doc);
    }

    return matchingDocs;
  }

  /**
   * Main Search Execution Pipeline (Phase 3 Intelligent Search)
   */
  public search(params: SearchParams): SearchResult {
    const startTime = performance.now();
    const queryStr = (params.q || '').trim();
    const cleanQ = cleanProductCode(queryStr);

    let candidateScores = new Map<string, number>();
    let exactIdentifierMatch = false;

    // AI Natural Language Query Parsing
    const aiIntent = this.aiIntentParser.parse(queryStr);

    // Merge explicit params with AI-extracted intent constraints
    const effectiveFilters: SearchParams = {
      ...params,
      minPrice: params.minPrice !== undefined ? params.minPrice : aiIntent.extractedFilters.minPrice,
      maxPrice: params.maxPrice !== undefined ? params.maxPrice : aiIntent.extractedFilters.maxPrice,
      minRating: params.minRating !== undefined ? params.minRating : aiIntent.extractedFilters.minRating,
      minDiscount: params.minDiscount !== undefined ? params.minDiscount : aiIntent.extractedFilters.minDiscount,
      brand: params.brand,
      color: params.color ?? aiIntent.extractedFilters.color,
      size: params.size ?? aiIntent.extractedFilters.size,
      sortBy: params.sortBy ?? aiIntent.extractedFilters.sortBy ?? (queryStr ? 'relevance' : 'newest')
    };

    // 1. Text Search Retrieval & Scoring
    if (queryStr) {
      // Direct exact match check for 12-digit Product Code or SKU or ID
      for (const [id, doc] of this.indexedDocs.entries()) {
        const isExactCode = (doc.cleanProductCode && doc.cleanProductCode === cleanQ) ||
          (doc.productCode && doc.productCode.toLowerCase() === queryStr.toLowerCase());
        const isExactSku = doc.sku && doc.sku.toLowerCase() === queryStr.toLowerCase();
        const isExactId = id === queryStr;

        if (isExactCode || isExactSku || isExactId) {
          candidateScores.set(id, 10000);
          exactIdentifierMatch = true;
        }
      }

      if (!exactIdentifierMatch) {
        // Collect search terms (use cleaned residual intent query to avoid numeric constraint tokens matching SKUs)
        const queriesToSearch = new Set<string>();
        if (aiIntent.residualQuery && aiIntent.residualQuery.length >= 2) {
          queriesToSearch.add(aiIntent.residualQuery);
        } else {
          queriesToSearch.add(queryStr);
        }

        for (const qTerm of queriesToSearch) {
          const rawTokens = qTerm.toLowerCase().split(/\s+/).filter(Boolean);
          const expandedTokens = expandQueryWithSynonyms(rawTokens);
          const expandedSearchTerm = expandedTokens.join(' ');

          const miniResults = this.miniSearch.search(expandedSearchTerm, {
            combineWith: 'OR',
            prefix: true,
            fuzzy: (term) => (term.length >= 5 ? 2 : term.length >= 3 ? 1 : 0)
          });

          for (const res of miniResults) {
            candidateScores.set(res.id, Math.max(candidateScores.get(res.id) || 0, res.score));
          }
        }

        // If zero candidates, attempt automated spelling correction fallback
        if (candidateScores.size === 0) {
          const targetCorrectionQuery = aiIntent.residualQuery || queryStr;
          const corrected = this.calculateDidYouMean(targetCorrectionQuery);
          if (corrected && corrected !== targetCorrectionQuery) {
            const retryResults = this.miniSearch.search(corrected, {
              combineWith: 'OR',
              prefix: true,
              fuzzy: (term) => (term.length >= 5 ? 2 : term.length >= 3 ? 1 : 0)
            });
            for (const res of retryResults) {
              candidateScores.set(res.id, res.score * 0.85);
            }
          }
        }

        // Substring / Exact title phrase bonus
        const qLower = (aiIntent.residualQuery || queryStr).toLowerCase();
        for (const [id, doc] of this.indexedDocs.entries()) {
          const nameLower = doc.name.toLowerCase();
          const brandLower = doc.brand.toLowerCase();

          if (nameLower === qLower) {
            candidateScores.set(id, (candidateScores.get(id) || 0) + 150);
          } else if (nameLower.startsWith(qLower)) {
            candidateScores.set(id, (candidateScores.get(id) || 0) + 80);
          } else if (nameLower.includes(qLower)) {
            candidateScores.set(id, (candidateScores.get(id) || 0) + 40);
          }

          if (brandLower === qLower) {
            candidateScores.set(id, (candidateScores.get(id) || 0) + 60);
          }
        }

        // Phase 3 Semantic Vector Cosine Similarity & Hybrid Scoring
        if (candidateScores.size > 0) {
          let maxBM25 = 1;
          for (const s of candidateScores.values()) {
            if (s > maxBM25) maxBM25 = s;
          }

          const semanticTarget = aiIntent.residualQuery || queryStr;
          for (const [id, bm25] of candidateScores.entries()) {
            const doc = this.indexedDocs.get(id);
            if (!doc) continue;
            const semanticCosine = this.semanticRanker.computeSimilarity(semanticTarget, id);
            const blended = this.semanticRanker.blendScores(bm25, maxBM25, semanticCosine, doc, false);
            candidateScores.set(id, blended);
          }
        }

        // Apply custom product boost rules
        for (const id of candidateScores.keys()) {
          const boost = this.getBoostForProduct(queryStr, id);
          if (boost !== 0) {
            candidateScores.set(id, (candidateScores.get(id) || 0) + boost);
          }
        }
      }
    } else {
      // No query string: all indexed products are candidates
      for (const id of this.indexedDocs.keys()) {
        candidateScores.set(id, 1);
      }
    }

    // 2. Business Rules & Filter Application
    let matchingDocs = this.filterCandidateDocs(candidateScores, effectiveFilters);

    // 3. Zero-Result Recovery & Conversational Guidance
    let recoveryRecommendations: RecoveryRecommendation[] | undefined = undefined;
    let isAiRelaxed = false;
    let aiExplanation: string | undefined = undefined;

    if (queryStr && matchingDocs.length === 0) {
      const plan = this.zeroResultRecovery.generateRecoveryPlan(effectiveFilters, aiIntent, this.indexedDocs);
      if (plan) {
        recoveryRecommendations = plan.recommendations;
        if (plan.explanation) {
          const relaxedMatches = this.filterCandidateDocs(candidateScores, plan.relaxedParams);
          if (relaxedMatches.length > 0) {
            matchingDocs = relaxedMatches;
            isAiRelaxed = true;
            aiExplanation = plan.explanation;
          }
        }
      }
    }

    // 4. Compute Accurate Facet Counts on Matching Documents
    const facets = this.computeFacets(matchingDocs);

    // 5. Sorting
    const sortBy = effectiveFilters.sortBy || (queryStr ? 'relevance' : 'newest');

    matchingDocs.sort((a, b) => {
      if (exactIdentifierMatch) {
        const aScore = candidateScores.get(a.id) || 0;
        const bScore = candidateScores.get(b.id) || 0;
        if (aScore !== bScore) return bScore - aScore;
      }

      switch (sortBy) {
        case 'price-asc':
          return a.effectivePrice - b.effectivePrice;
        case 'price-desc':
          return b.effectivePrice - a.effectivePrice;
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'rating':
          return b.rating - a.rating;
        case 'discount':
          return b.discountPercentage - a.discountPercentage;
        case 'relevance':
        default: {
          const scoreA = candidateScores.get(a.id) || 0;
          const scoreB = candidateScores.get(b.id) || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return b.rating - a.rating;
        }
      }
    });

    // Apply custom pinning rules (force pinned products to top of results)
    const pinnedIds = queryStr ? this.getPinnedProductIds(queryStr) : [];
    if (pinnedIds.length > 0) {
      const pinRank = new Map(pinnedIds.map((id, idx) => [id, idx]));
      matchingDocs.sort((a, b) => {
        const hasA = pinRank.has(a.id);
        const hasB = pinRank.has(b.id);
        if (hasA && hasB) return pinRank.get(a.id)! - pinRank.get(b.id)!;
        if (hasA) return -1;
        if (hasB) return 1;
        return 0;
      });
    }

    // 6. Server-Side Pagination
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 24));
    const total = matchingDocs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedDocs = matchingDocs.slice(offset, offset + limit);

    // 7. Spelling Suggestion / Did You Mean (if query yielded few or zero results)
    let didYouMean: string | undefined = undefined;
    if (queryStr && total === 0) {
      didYouMean = this.calculateDidYouMean(aiIntent.residualQuery || queryStr);
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      items: paginatedDocs.map(d => d.raw),
      total,
      page,
      limit,
      totalPages,
      facets,
      query: queryStr,
      didYouMean,
      exactIdentifierMatch,
      executionTimeMs,
      aiParsedIntent: aiIntent.detectedEntities.length > 0 ? aiIntent : undefined,
      recoveryRecommendations,
      isAiRelaxed,
      aiExplanation
    };
  }

  /**
   * Fast Autocomplete & Suggestions Engine
   */
  public suggest(query: string, maxItems: number = 8): SuggestionResult {
    const startTime = performance.now();
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        query,
        suggestions: [],
        suggestedCategories: [],
        suggestedBrands: [],
        executionTimeMs: 0
      };
    }

    const cleanQ = cleanProductCode(q);
    const suggestions: SuggestionItem[] = [];
    const matchedCategories = new Map<string, { id: string; name: string }>();
    const matchedBrands = new Set<string>();

    // 1. Check exact identifiers first
    for (const doc of this.indexedDocs.values()) {
      if (doc.status === 'inactive' || !doc.isVisible || doc.isReward) continue;

      if ((cleanQ && doc.cleanProductCode === cleanQ) || (doc.sku && doc.sku.toLowerCase() === q)) {
        suggestions.push({
          id: doc.id,
          name: doc.name,
          slug: doc.raw.slug,
          type: 'product',
          brand: doc.brand,
          categoryName: doc.categoryName,
          image: doc.raw.primaryImage || doc.raw.images?.[0],
          price: doc.price,
          discountPrice: doc.discountPrice,
          score: 1000
        });
      }
    }

    // 2. Query MiniSearch with prefix
    const miniResults = this.miniSearch.search(q, {
      prefix: true,
      fuzzy: (term) => (term.length >= 5 ? 1 : 0),
      combineWith: 'OR'
    }).slice(0, maxItems * 2);

    for (const res of miniResults) {
      const doc = this.indexedDocs.get(res.id);
      if (!doc || doc.status === 'inactive' || !doc.isVisible || doc.isReward) continue;

      // Collect brand suggestions
      if (doc.brand && doc.brand.toLowerCase().includes(q)) {
        matchedBrands.add(doc.brand);
      }

      // Collect category suggestions
      if (doc.categoryName && doc.categoryName.toLowerCase().includes(q)) {
        matchedCategories.set(doc.categoryId, { id: doc.categoryId, name: doc.categoryName });
      }

      if (suggestions.length < maxItems && !suggestions.some(s => s.id === doc.id)) {
        suggestions.push({
          id: doc.id,
          name: doc.name,
          slug: doc.raw.slug,
          type: 'product',
          brand: doc.brand,
          categoryName: doc.categoryName,
          image: doc.raw.primaryImage || doc.raw.images?.[0],
          price: doc.price,
          discountPrice: doc.discountPrice,
          score: res.score
        });
      }
    }

    // 3. AI Intent Query Suggestions
    if (suggestions.length < maxItems && q.length >= 3 && !cleanQ) {
      const intentPrompts = [`${q} under ₹2,000`, `best ${q}`];
      for (const prompt of intentPrompts) {
        if (suggestions.length < maxItems && !suggestions.some(s => s.name === prompt)) {
          suggestions.push({
            id: `ai-suggest-${prompt.replace(/[^\w]/g, '-')}`,
            name: prompt,
            type: 'query',
            score: 10
          });
        }
      }
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      query,
      suggestions: suggestions.slice(0, maxItems),
      suggestedCategories: Array.from(matchedCategories.values()).slice(0, 4),
      suggestedBrands: Array.from(matchedBrands).slice(0, 4),
      executionTimeMs
    };
  }

  /**
   * Facet Aggregation
   */
  private computeFacets(docs: IndexedProductDoc[]): SearchFacets {
    const catMap = new Map<string, { name: string; count: number }>();
    const subMap = new Map<string, { name: string; count: number }>();
    const nestedMap = new Map<string, { name: string; count: number }>();
    const brandMap = new Map<string, number>();
    const colorMap = new Map<string, number>();
    const sizeMap = new Map<string, number>();

    let minPrice = Infinity;
    let maxPrice = 0;

    const ratingCounts: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 };
    const discountCounts = {
      above50: 0,
      above30: 0,
      above20: 0,
      above10: 0
    };

    for (const d of docs) {
      // Price range
      if (d.effectivePrice < minPrice) minPrice = d.effectivePrice;
      if (d.effectivePrice > maxPrice) maxPrice = d.effectivePrice;

      // Category
      if (d.categoryId) {
        const existing = catMap.get(d.categoryId) || { name: d.categoryName || d.categoryId, count: 0 };
        existing.count += 1;
        catMap.set(d.categoryId, existing);
      }

      // SubCategory
      if (d.subCategoryId) {
        const existing = subMap.get(d.subCategoryId) || { name: d.subCategoryName || d.subCategoryId, count: 0 };
        existing.count += 1;
        subMap.set(d.subCategoryId, existing);
      }

      // Nested SubCategory
      if (d.nestedSubCategoryId) {
        const existing = nestedMap.get(d.nestedSubCategoryId) || { name: d.nestedSubCategoryName || d.nestedSubCategoryId, count: 0 };
        existing.count += 1;
        nestedMap.set(d.nestedSubCategoryId, existing);
      }

      // Brand
      if (d.brand) {
        brandMap.set(d.brand, (brandMap.get(d.brand) || 0) + 1);
      }

      // Colors
      for (const c of d.colors) {
        colorMap.set(c, (colorMap.get(c) || 0) + 1);
      }

      // Sizes
      for (const s of d.sizes) {
        sizeMap.set(s, (sizeMap.get(s) || 0) + 1);
      }

      // Ratings
      if (d.rating >= 4) ratingCounts[4] += 1;
      if (d.rating >= 3) ratingCounts[3] += 1;
      if (d.rating >= 2) ratingCounts[2] += 1;
      if (d.rating >= 1) ratingCounts[1] += 1;

      // Discounts
      if (d.discountPercentage >= 50) discountCounts.above50 += 1;
      if (d.discountPercentage >= 30) discountCounts.above30 += 1;
      if (d.discountPercentage >= 20) discountCounts.above20 += 1;
      if (d.discountPercentage >= 10) discountCounts.above10 += 1;
    }

    const categories: SearchFacetValue[] = Array.from(catMap.entries()).map(([id, val]) => ({
      id,
      name: val.name,
      count: val.count
    })).sort((a, b) => b.count - a.count);

    const subcategories: SearchFacetValue[] = Array.from(subMap.entries()).map(([id, val]) => ({
      id,
      name: val.name,
      count: val.count
    })).sort((a, b) => b.count - a.count);

    const nestedSubcategories: SearchFacetValue[] = Array.from(nestedMap.entries()).map(([id, val]) => ({
      id,
      name: val.name,
      count: val.count
    })).sort((a, b) => b.count - a.count);

    const brands: SearchFacetValue[] = Array.from(brandMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const colors: SearchFacetValue[] = Array.from(colorMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count
    })).sort((a, b) => b.count - a.count);

    const sizes: SearchFacetValue[] = Array.from(sizeMap.entries()).map(([name, count]) => ({
      id: name,
      name,
      count
    })).sort((a, b) => b.count - a.count);

    return {
      categories,
      subcategories,
      nestedSubcategories,
      brands,
      colors,
      sizes,
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice
      },
      ratingDistribution: [
        { rating: 4, count: ratingCounts[4] },
        { rating: 3, count: ratingCounts[3] },
        { rating: 2, count: ratingCounts[2] },
        { rating: 1, count: ratingCounts[1] }
      ],
      discountDistribution: [
        { discountRange: '50% or more', minDiscount: 50, count: discountCounts.above50 },
        { discountRange: '30% or more', minDiscount: 30, count: discountCounts.above30 },
        { discountRange: '20% or more', minDiscount: 20, count: discountCounts.above20 },
        { discountRange: '10% or more', minDiscount: 10, count: discountCounts.above10 }
      ]
    };
  }

  /**
   * Calculates Levenshtein distance for spelling suggestions
   */
  private calculateDidYouMean(query: string): string | undefined {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const correctedTokens: string[] = [];
    let hasCorrection = false;

    for (const token of tokens) {
      if (this.vocabulary.has(token) || token.length < 4) {
        correctedTokens.push(token);
        continue;
      }

      let bestCandidate = token;
      let minDistance = 3; // Max threshold

      for (const vocab of this.vocabulary) {
        if (Math.abs(vocab.length - token.length) > 2) continue;
        const dist = levenshteinDistance(token, vocab);
        if (dist < minDistance) {
          minDistance = dist;
          bestCandidate = vocab;
        }
      }

      if (bestCandidate !== token) {
        hasCorrection = true;
        correctedTokens.push(bestCandidate);
      } else {
        correctedTokens.push(token);
      }
    }

    return hasCorrection ? correctedTokens.join(' ') : undefined;
  }

  public getIndexSize(): number {
    return this.indexedDocs.size;
  }
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

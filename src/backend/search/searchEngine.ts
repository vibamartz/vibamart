import MiniSearch from 'minisearch';
import { Product } from '../../shared/types';
import { SearchParams, SearchResult, SearchFacets, SearchFacetValue, SuggestionResult, SuggestionItem } from './searchTypes';
import { expandQueryWithSynonyms, stemToken, normalizeQueryString } from './searchSynonyms';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { ZeroResultRecovery } from './zeroResultRecovery';
import { searchCurationManager } from './searchCuration';
import { parseIntentRuleBased } from './semanticSearch';

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
  numReviews: number;
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

export class ViBaSearchEngine {
  private miniSearch: MiniSearch<IndexedProductDoc>;
  private indexedDocs: Map<string, IndexedProductDoc> = new Map();
  private rewardProductIds: Set<string> = new Set();

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
      processTerm: (term: string) => stemToken(term.toLowerCase()),
      searchOptions: {
        boost: {
          productCode: 10,
          cleanProductCode: 10,
          sku: 10,
          name: 6,
          brand: 4,
          tags: 3,
          categoryName: 2,
          subCategoryName: 2,
          nestedSubCategoryName: 2,
          specifications: 1.5,
          variantAttributes: 1.5,
          description: 1
        },
        prefix: true,
        fuzzy: (term: string) => {
          // Disable fuzzy for numeric codes or short terms
          if (/^\d+$/.test(term) || term.length < 4) return false;
          if (term.length >= 7) return 0.25; // allows 2 typos
          return 0.2; // allows 1 typo
        },
        combineWith: 'AND',
        processTerm: (term: string) => stemToken(term.toLowerCase())
      }
    });
  }

  /**
   * Set known exclusive reward product IDs to respect publication rules.
   */
  public setRewardProductIds(rewardIds: Set<string>) {
    this.rewardProductIds = rewardIds;
  }

  /**
   * Transform raw Product into indexed document representation.
   */
  public static toIndexedDoc(
    product: Product,
    categoryName = '',
    subCategoryName = '',
    nestedSubCategoryName = '',
    isReward = false
  ): IndexedProductDoc {
    const rawCode = product.productCode || '';
    const cleanDigits = cleanProductCode(rawCode);
    const effectivePrice = product.discountPrice !== undefined && product.discountPrice > 0
      ? product.discountPrice
      : (product.price || 0);

    const discountPercentage = product.discountPercentage !== undefined
      ? product.discountPercentage
      : (product.price && product.discountPrice && product.price > product.discountPrice
          ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
          : 0);

    const colors: string[] = [];
    if (product.color) colors.push(product.color.toLowerCase().trim());
    if (Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v.color) colors.push(v.color.toLowerCase().trim());
      });
    }

    const sizes: string[] = [];
    if (product.size) sizes.push(product.size.toLowerCase().trim());
    if (Array.isArray(product.sizes)) {
      product.sizes.forEach(s => sizes.push(s.toLowerCase().trim()));
    }
    if (Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v.size) sizes.push(v.size.toLowerCase().trim());
      });
    }

    const specStrings: string[] = [];
    if (Array.isArray(product.specifications)) {
      product.specifications.forEach(s => {
        if (s.key && s.value) specStrings.push(`${s.key} ${s.value}`);
      });
    }

    const visualNestedSubcategoryIds: string[] = [];
    if (product.visualNestedSubcategoryId) visualNestedSubcategoryIds.push(product.visualNestedSubcategoryId);
    if (Array.isArray(product.visualNestedSubcategoryIds)) {
      visualNestedSubcategoryIds.push(...product.visualNestedSubcategoryIds);
    }

    return {
      id: product.id,
      name: product.name || '',
      brand: product.brand || '',
      productCode: rawCode,
      cleanProductCode: cleanDigits,
      sku: product.sku || '',
      categoryName,
      subCategoryName,
      nestedSubCategoryName,
      tags: Array.isArray(product.tags) ? product.tags.join(' ') : '',
      specifications: specStrings.join(' '),
      variantAttributes: Array.isArray(product.variantAttributes) ? product.variantAttributes.join(' ') : '',
      description: (product.description || '') + ' ' + (product.fullDescription || ''),
      categoryId: product.categoryId || '',
      subCategoryId: product.subCategoryId,
      nestedSubCategoryId: product.nestedSubCategoryId,
      visualNestedSubcategoryIds,
      effectivePrice,
      price: product.price || 0,
      discountPrice: product.discountPrice,
      discountPercentage,
      rating: product.rating || 0,
      numReviews: product.numReviews || 0,
      stock: product.stock !== undefined ? product.stock : (product.inStock === false ? 0 : 10),
      inStock: product.inStock !== false && (product.stock === undefined || product.stock > 0),
      colors: Array.from(new Set(colors)),
      sizes: Array.from(new Set(sizes)),
      createdAt: product.createdAt || new Date().toISOString(),
      status: product.status || 'active',
      isVisible: product.isVisible !== false,
      isReward,
      raw: product
    };
  }

  /**
   * Bulk index an array of products.
   */
  public indexProducts(
    products: Product[],
    categoryNameMap: Record<string, string> = {},
    subCategoryNameMap: Record<string, string> = {},
    nestedSubCategoryNameMap: Record<string, string> = {}
  ) {
    this.miniSearch.removeAll();
    this.indexedDocs.clear();

    const docsToIndex: IndexedProductDoc[] = [];

    for (const product of products) {
      if (!product || !product.id) continue;
      const catName = categoryNameMap[product.categoryId] || '';
      const subName = product.subCategoryId ? (subCategoryNameMap[product.subCategoryId] || '') : '';
      const nestedName = product.nestedSubCategoryId ? (nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';
      const isReward = this.rewardProductIds.has(product.id);

      const doc = ViBaSearchEngine.toIndexedDoc(product, catName, subName, nestedName, isReward);
      this.indexedDocs.set(product.id, doc);
      docsToIndex.push(doc);
    }

    if (docsToIndex.length > 0) {
      this.miniSearch.addAll(docsToIndex);
    }
  }

  /**
   * Add or update an individual product incrementally.
   */
  public upsertProduct(
    product: Product,
    catName = '',
    subName = '',
    nestedName = ''
  ) {
    if (!product || !product.id) return;
    const isReward = this.rewardProductIds.has(product.id);
    const doc = ViBaSearchEngine.toIndexedDoc(product, catName, subName, nestedName, isReward);

    if (this.indexedDocs.has(product.id)) {
      try {
        this.miniSearch.discard(product.id);
      } catch {}
    }

    this.indexedDocs.set(product.id, doc);
    this.miniSearch.add(doc);
  }

  /**
   * Remove a product from the index upon deletion.
   */
  public removeProduct(productId: string) {
    if (this.indexedDocs.has(productId)) {
      this.indexedDocs.delete(productId);
      try {
        this.miniSearch.discard(productId);
      } catch {}
    }
  }

  /**
   * Get total indexed product count.
   */
  public getCount(): number {
    return this.indexedDocs.size;
  }

  /**
   * Core Search Method with Lexical BM25 ranking, typo tolerance, filters, facets, and pagination.
   */
  public search(params: SearchParams): SearchResult {
    const startTime = performance.now();
    const rawQuery = (params.q || '').trim();
    const { cleanDigits } = normalizeQueryString(rawQuery);

    let matchedDocIds: Set<string> | null = null;
    let scoreMap: Map<string, number> = new Map();
    let exactMatchFound = false;

    // Natural Language / Semantic Intent Extraction
    let semanticIntent = undefined;
    let queryToSearch = rawQuery;

    if (rawQuery.length > 0) {
      const isConversational = params.useAI || /\b(?:under|below|above|between|for\s+(?:men|women|kids)|cheap|cheapest|budget|expensive|best|latest|in\s*stock)\b/i.test(rawQuery);
      if (isConversational) {
        semanticIntent = parseIntentRuleBased(rawQuery);
        if (semanticIntent.isNaturalLanguage && semanticIntent.cleanKeyword) {
          queryToSearch = semanticIntent.cleanKeyword;
        }
      }
    }

    // Check for exact SKU or 12-digit Product Code match
    if (rawQuery.length > 0) {
      const isExactCode = cleanDigits.length >= 10;
      const lowerQuery = rawQuery.toLowerCase();

      for (const [id, doc] of this.indexedDocs.entries()) {
        const docCleanCode = doc.cleanProductCode;
        if (
          (isExactCode && docCleanCode === cleanDigits) ||
          (doc.productCode && doc.productCode.toLowerCase() === lowerQuery) ||
          (doc.sku && doc.sku.toLowerCase() === lowerQuery) ||
          doc.id === rawQuery
        ) {
          exactMatchFound = true;
          scoreMap.set(id, 10000); // Top score priority
        }
      }

      // Check curation pinned rules
      const pinnedProductIds = searchCurationManager.getPinnedProductIds(rawQuery);
      pinnedProductIds.forEach((pid, idx) => {
        scoreMap.set(pid, 20000 - idx);
      });

      // If not exact unique match or we want full text retrieval
      const synonymTokens = expandQueryWithSynonyms(queryToSearch);
      const searchTerms = Array.from(new Set([queryToSearch, rawQuery, ...synonymTokens]));

      // Execute MiniSearch queries
      try {
        // 1. Primary multi-term query (AND mode)
        const primaryResults = this.miniSearch.search(queryToSearch, {
          combineWith: 'AND',
          prefix: true
        });

        for (const res of primaryResults) {
          const current = scoreMap.get(res.id) || 0;
          scoreMap.set(res.id, Math.max(current, res.score * 2.0));
        }

        // 2. If no direct AND match was found, search for synonym matches
        if (primaryResults.length === 0 && searchTerms.length > 1) {
          for (const syn of searchTerms) {
            if (syn === queryToSearch) continue;
            const synResults = this.miniSearch.search(syn, {
              combineWith: 'AND',
              prefix: true
            });
            for (const res of synResults) {
              const current = scoreMap.get(res.id) || 0;
              scoreMap.set(res.id, Math.max(current, res.score * 0.85));
            }
          }
        }
      } catch (err) {
        console.warn('MiniSearch execution warning:', err);
      }

      matchedDocIds = new Set(scoreMap.keys());
    }

    // Filter candidate documents
    const candidateDocs: { doc: IndexedProductDoc; score: number }[] = [];

    const categoryFilter = params.category ? params.category.toLowerCase().trim() : undefined;
    const subCategoryFilter = params.subCategory ? params.subCategory.toLowerCase().trim() : undefined;
    const nestedSubCategoryFilter = params.nestedSubCategory ? params.nestedSubCategory.toLowerCase().trim() : undefined;
    const visualSubCategoryFilter = params.visualSubCategory ? params.visualSubCategory.toLowerCase().trim() : undefined;

    const brandFilters = params.brand
      ? (Array.isArray(params.brand) ? params.brand : [params.brand]).map(b => b.toLowerCase().trim())
      : undefined;

    const colorFilters = params.color
      ? (Array.isArray(params.color) ? params.color : [params.color]).map(c => c.toLowerCase().trim())
      : undefined;

    const sizeFilters = params.size
      ? (Array.isArray(params.size) ? params.size : [params.size]).map(s => s.toLowerCase().trim())
      : undefined;

    // Iterate through candidates or all docs if query was empty
    const docIterator = matchedDocIds !== null
      ? Array.from(matchedDocIds).map(id => this.indexedDocs.get(id)!).filter(Boolean)
      : Array.from(this.indexedDocs.values());

    for (const doc of docIterator) {
      // 1. Publication & Eligibility Rules
      if (!params.includeDrafts) {
        if (!doc.isVisible) continue;
        if (doc.status === 'inactive' || doc.status === 'draft') continue;
      }

      // 2. Category Hierarchy Filters
      if (categoryFilter && categoryFilter !== 'all-deals' && categoryFilter !== 'categories') {
        const catMatch = doc.categoryId.toLowerCase() === categoryFilter ||
                         doc.categoryName.toLowerCase() === categoryFilter;
        if (!catMatch) continue;
      }

      if (subCategoryFilter && subCategoryFilter !== 'all') {
        const subMatch = (doc.subCategoryId && doc.subCategoryId.toLowerCase() === subCategoryFilter) ||
                         doc.subCategoryName.toLowerCase() === subCategoryFilter;
        if (!subMatch) continue;
      }

      if (nestedSubCategoryFilter && nestedSubCategoryFilter !== 'all') {
        const nestedMatch = (doc.nestedSubCategoryId && doc.nestedSubCategoryId.toLowerCase() === nestedSubCategoryFilter) ||
                            doc.nestedSubCategoryName.toLowerCase() === nestedSubCategoryFilter;
        if (!nestedMatch) continue;
      }

      if (visualSubCategoryFilter) {
        const visualMatch = doc.visualNestedSubcategoryIds?.some(v => v.toLowerCase() === visualSubCategoryFilter);
        if (!visualMatch) continue;
      }

      // 3. Brand Filter
      if (brandFilters && brandFilters.length > 0) {
        const docBrand = doc.brand.toLowerCase().trim();
        if (!brandFilters.includes(docBrand)) continue;
      }

      // 4. Price Filter
      const effectiveMinPrice = params.minPrice !== undefined ? params.minPrice : semanticIntent?.detectedFilters.minPrice;
      const effectiveMaxPrice = params.maxPrice !== undefined ? params.maxPrice : semanticIntent?.detectedFilters.maxPrice;
      if (effectiveMinPrice !== undefined && doc.effectivePrice < effectiveMinPrice) continue;
      if (effectiveMaxPrice !== undefined && doc.effectivePrice > effectiveMaxPrice) continue;

      // 5. Rating Filter
      if (params.minRating !== undefined && doc.rating < params.minRating) continue;

      // 6. Discount Filter
      if (params.minDiscount !== undefined && doc.discountPercentage < params.minDiscount) continue;

      // 7. Stock Filter
      const effectiveInStock = params.inStock ?? semanticIntent?.detectedFilters.inStock;
      if (effectiveInStock && (!doc.inStock || doc.stock <= 0)) continue;

      // 8. Color Filter
      const effectiveColors = colorFilters || (semanticIntent?.detectedFilters.color ? [semanticIntent.detectedFilters.color] : undefined);
      if (effectiveColors && effectiveColors.length > 0) {
        const hasColor = doc.colors.some(c => effectiveColors.some(ec => c.includes(ec) || ec.includes(c)));
        if (!hasColor) continue;
      }

      // 9. Size Filter
      if (sizeFilters && sizeFilters.length > 0) {
        const hasSize = doc.sizes.some(s => sizeFilters.includes(s));
        if (!hasSize) continue;
      }

      let score = scoreMap.get(doc.id) || 1.0;
      if (rawQuery.length > 0) {
        const boost = searchCurationManager.getBoostMultiplier(rawQuery, doc.brand, doc.categoryId);
        score *= boost;
      }

      // Semantic Intent Tag Relevance Boost
      if (semanticIntent && semanticIntent.semanticTags.length > 0) {
        const docText = (doc.name + ' ' + doc.tags + ' ' + doc.description).toLowerCase();
        for (const tag of semanticIntent.semanticTags) {
          if (docText.includes(tag.toLowerCase())) {
            score *= 1.35;
          }
        }
      }

      candidateDocs.push({ doc, score });
    }

    // Zero-Result Recovery: generate suggestions and alternate query if 0 results
    let recovery: any = undefined;
    let correctedQuery: string | undefined = undefined;
    if (candidateDocs.length === 0 && rawQuery.length > 0) {
      recovery = ZeroResultRecovery.recover(rawQuery, Array.from(this.indexedDocs.values()));
      correctedQuery = recovery.suggestedQuery;
    }

    // Compute Facets dynamically across all filtered candidates
    const facets = this.computeFacets(candidateDocs.map(c => c.doc));

    // Sorting
    const sortBy = params.sortBy || semanticIntent?.detectedFilters.sortBy || (rawQuery ? 'relevance' : 'popularity');

    candidateDocs.sort((a, b) => {
      // Always keep exact SKU/Code matches on top
      if (a.score >= 10000 && b.score < 10000) return -1;
      if (b.score >= 10000 && a.score < 10000) return 1;

      switch (sortBy) {
        case 'price-asc':
          return a.doc.effectivePrice - b.doc.effectivePrice;
        case 'price-desc':
          return b.doc.effectivePrice - a.doc.effectivePrice;
        case 'newest':
          return new Date(b.doc.createdAt).getTime() - new Date(a.doc.createdAt).getTime();
        case 'rating':
          return b.doc.rating - a.doc.rating || b.doc.numReviews - a.doc.numReviews;
        case 'popularity':
          return (b.doc.rating * (b.doc.numReviews + 1)) - (a.doc.rating * (a.doc.numReviews + 1));
        case 'relevance':
        default:
          return b.score - a.score;
      }
    });

    // Pagination
    const total = candidateDocs.length;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 24));
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedDocs = candidateDocs.slice(startIndex, startIndex + limit).map(c => c.doc.raw);

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      products: paginatedDocs,
      total,
      page,
      limit,
      totalPages,
      facets,
      executionTimeMs,
      query: rawQuery,
      exactMatch: exactMatchFound,
      correctedQuery,
      semanticIntent,
      recovery
    };
  }

  /**
   * Fast Autocomplete Suggestions for Header / Mobile Search.
   */
  public suggest(rawQuery: string, limit = 8): SuggestionResult {
    const startTime = performance.now();
    const query = (rawQuery || '').trim();
    if (!query) {
      return { query, suggestions: [], executionTimeMs: 0 };
    }

    const { cleanDigits } = normalizeQueryString(query);
    const lowerQuery = query.toLowerCase();
    const suggestions: SuggestionItem[] = [];
    const seenIds = new Set<string>();

    // 1. Exact product code check
    if (cleanDigits.length >= 8) {
      for (const doc of this.indexedDocs.values()) {
        if (!doc.isVisible || doc.status === 'inactive') continue;
        if (doc.cleanProductCode.includes(cleanDigits) || (doc.productCode && doc.productCode.includes(query))) {
          suggestions.push({
            id: doc.id,
            title: doc.name,
            type: 'product',
            subtitle: `Product Code: ${doc.productCode}`,
            imageUrl: doc.raw.primaryImage || doc.raw.images?.[0],
            price: doc.price,
            discountPrice: doc.discountPrice,
            slug: doc.raw.slug || doc.id
          });
          seenIds.add(doc.id);
          if (suggestions.length >= limit) break;
        }
      }
    }

    // 2. MiniSearch prefix suggestion
    try {
      const searchRes = this.miniSearch.search(query, {
        prefix: true,
        fuzzy: query.length >= 5 ? 0.2 : false,
        combineWith: 'AND'
      });

      for (const res of searchRes) {
        if (seenIds.has(res.id)) continue;
        const doc = this.indexedDocs.get(res.id);
        if (!doc || !doc.isVisible || doc.status === 'inactive') continue;

        suggestions.push({
          id: doc.id,
          title: doc.name,
          type: 'product',
          subtitle: doc.brand ? `${doc.brand} • in ${doc.categoryName || 'Products'}` : doc.categoryName,
          imageUrl: doc.raw.primaryImage || doc.raw.images?.[0],
          price: doc.price,
          discountPrice: doc.discountPrice,
          slug: doc.raw.slug || doc.id
        });
        seenIds.add(doc.id);
        if (suggestions.length >= limit) break;
      }
    } catch {}

    // 3. Category & Brand matching suggestions
    const matchedCategories = new Set<string>();
    const matchedBrands = new Set<string>();

    for (const doc of this.indexedDocs.values()) {
      if (!doc.isVisible) continue;
      if (doc.categoryName && doc.categoryName.toLowerCase().includes(lowerQuery)) {
        matchedCategories.add(doc.categoryName);
      }
      if (doc.brand && doc.brand.toLowerCase().includes(lowerQuery)) {
        matchedBrands.add(doc.brand);
      }
    }

    for (const cat of Array.from(matchedCategories).slice(0, 2)) {
      suggestions.push({
        id: `cat_${cat}`,
        title: cat,
        type: 'category',
        subtitle: 'In Categories'
      });
    }

    for (const br of Array.from(matchedBrands).slice(0, 2)) {
      suggestions.push({
        id: `brand_${br}`,
        title: br,
        type: 'brand',
        subtitle: 'Brand'
      });
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      query,
      suggestions: suggestions.slice(0, limit),
      executionTimeMs
    };
  }

  /**
   * Generates accurate faceted count breakdown across matching documents.
   */
  private computeFacets(docs: IndexedProductDoc[]): SearchFacets {
    const categoryCount: Map<string, { label: string; count: number }> = new Map();
    const subCategoryCount: Map<string, { label: string; count: number }> = new Map();
    const nestedSubCategoryCount: Map<string, { label: string; count: number }> = new Map();
    const brandCount: Map<string, { label: string; count: number }> = new Map();
    const colorCount: Map<string, number> = new Map();
    const sizeCount: Map<string, number> = new Map();

    let minPrice = Infinity;
    let maxPrice = 0;
    let inStock = 0;
    let outOfStock = 0;

    const ratingBuckets: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const doc of docs) {
      // Categories
      if (doc.categoryId) {
        const existing = categoryCount.get(doc.categoryId) || { label: doc.categoryName || doc.categoryId, count: 0 };
        existing.count++;
        categoryCount.set(doc.categoryId, existing);
      }

      // Subcategories
      if (doc.subCategoryId) {
        const existing = subCategoryCount.get(doc.subCategoryId) || { label: doc.subCategoryName || doc.subCategoryId, count: 0 };
        existing.count++;
        subCategoryCount.set(doc.subCategoryId, existing);
      }

      // Nested Subcategories
      if (doc.nestedSubCategoryId) {
        const existing = nestedSubCategoryCount.get(doc.nestedSubCategoryId) || { label: doc.nestedSubCategoryName || doc.nestedSubCategoryId, count: 0 };
        existing.count++;
        nestedSubCategoryCount.set(doc.nestedSubCategoryId, existing);
      }

      // Brands
      if (doc.brand) {
        const existing = brandCount.get(doc.brand) || { label: doc.brand, count: 0 };
        existing.count++;
        brandCount.set(doc.brand, existing);
      }

      // Colors
      for (const c of doc.colors) {
        colorCount.set(c, (colorCount.get(c) || 0) + 1);
      }

      // Sizes
      for (const s of doc.sizes) {
        sizeCount.set(s, (sizeCount.get(s) || 0) + 1);
      }

      // Price Range
      if (doc.effectivePrice < minPrice) minPrice = doc.effectivePrice;
      if (doc.effectivePrice > maxPrice) maxPrice = doc.effectivePrice;

      // Stock
      if (doc.inStock && doc.stock > 0) {
        inStock++;
      } else {
        outOfStock++;
      }

      // Ratings
      if (doc.rating >= 4) ratingBuckets[4]++;
      if (doc.rating >= 3) ratingBuckets[3]++;
      if (doc.rating >= 2) ratingBuckets[2]++;
      if (doc.rating >= 1) ratingBuckets[1]++;
    }

    const toFacetValues = (map: Map<string, { label: string; count: number }>): SearchFacetValue[] =>
      Array.from(map.entries())
        .map(([value, data]) => ({ value, label: data.label, count: data.count }))
        .sort((a, b) => b.count - a.count);

    return {
      categories: toFacetValues(categoryCount),
      subCategories: toFacetValues(subCategoryCount),
      nestedSubCategories: toFacetValues(nestedSubCategoryCount),
      brands: toFacetValues(brandCount),
      colors: Array.from(colorCount.entries())
        .map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count }))
        .sort((a, b) => b.count - a.count),
      sizes: Array.from(sizeCount.entries())
        .map(([value, count]) => ({ value, label: value.toUpperCase(), count }))
        .sort((a, b) => b.count - a.count),
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice
      },
      ratings: [
        { stars: 4, count: ratingBuckets[4] },
        { stars: 3, count: ratingBuckets[3] },
        { stars: 2, count: ratingBuckets[2] },
        { stars: 1, count: ratingBuckets[1] }
      ],
      stockStatus: {
        inStock,
        outOfStock
      }
    };
  }
}

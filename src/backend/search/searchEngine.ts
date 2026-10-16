import MiniSearch from 'minisearch';
import { Product } from '../../shared/types';
import { SearchParams, SearchResult, SearchFacets, SearchFacetValue, SuggestionResult, SuggestionItem, SearchLatencyTelemetry } from './searchTypes';
import { expandQueryWithSynonyms, stemToken, normalizeQueryString } from './searchSynonyms';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { ZeroResultRecovery } from './zeroResultRecovery';
import { searchCurationManager } from './searchCuration';
import { parseIntentRuleBased, KNOWN_COLORS } from './semanticSearch';
import { SpellingCorrectionEngine } from './spellingCorrection';
import { getInMemoryAnalytics } from './searchAnalytics';
import {
  rapidFuzzScore,
  ngramSimilarity,
  LocalTfIdfIndex,
  LocalSentenceEmbedding
} from './localScoring';
import { rankingFramework } from './rankingFramework';
import { sessionRankingManager } from './sessionRanking';
import { visualSearchService } from './visualSearch';

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
  searchableText?: string;
  embedding?: Float32Array;
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

/**
 * Intelligent gender matching helper
 */
function checkGenderMatch(doc: IndexedProductDoc, targetGender: string): boolean {
  const g = targetGender.toLowerCase();
  const text = (
    doc.name + ' ' +
    doc.categoryName + ' ' +
    (doc.subCategoryName || '') + ' ' +
    (doc.nestedSubCategoryName || '') + ' ' +
    doc.tags + ' ' +
    doc.description + ' ' +
    doc.specifications
  ).toLowerCase();

  if (g === 'men') {
    const isExplicitMen = /\b(?:men|mens|men's|male|gents)\b/i.test(text);
    const isExplicitWomen = /\b(?:women|womens|women's|female|ladies|kurti|kurtis|saree|lehenga|bra|panties)\b/i.test(text);
    if (isExplicitMen) return true;
    if (isExplicitWomen) return false;
    return true; // Neutral product
  } else if (g === 'women') {
    const isExplicitWomen = /\b(?:women|womens|women's|female|ladies|kurti|kurtis|saree|lehenga|bra|panties)\b/i.test(text);
    const isExplicitMen = /\b(?:men|mens|men's|male|gents)\b/i.test(text);
    if (isExplicitWomen) return true;
    if (isExplicitMen) return false;
    return true; // Neutral product
  } else if (g === 'kids') {
    return /\b(?:kids?|child|children|boys?|girls?|baby|toddler)\b/i.test(text);
  }
  return true;
}

export class ViBaSearchEngine {
  private miniSearch: MiniSearch<IndexedProductDoc>;
  private indexedDocs: Map<string, IndexedProductDoc> = new Map();
  private rewardProductIds: Set<string> = new Set();
  private tfIdfIndex: LocalTfIdfIndex = new LocalTfIdfIndex();

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
    if (!product || !product.id) {
      return {
        id: product?.id || 'corrupted_doc',
        name: String(product?.name || ''),
        brand: String(product?.brand || ''),
        productCode: '',
        cleanProductCode: '',
        sku: '',
        categoryName: '',
        subCategoryName: '',
        nestedSubCategoryName: '',
        tags: '',
        specifications: '',
        variantAttributes: '',
        description: '',
        categoryId: '',
        effectivePrice: 0,
        price: 0,
        discountPercentage: 0,
        rating: 0,
        numReviews: 0,
        stock: 0,
        inStock: false,
        colors: [],
        sizes: [],
        createdAt: new Date().toISOString(),
        status: 'inactive',
        isVisible: false,
        isReward: false,
        raw: product || ({} as any)
      };
    }

    const rawCode = String(product.productCode || '');
    const cleanDigits = cleanProductCode(rawCode);

    const price = Math.max(0, Number(product.price) || 0);
    const discountPrice = product.discountPrice !== undefined && !isNaN(Number(product.discountPrice))
      ? Math.max(0, Number(product.discountPrice))
      : undefined;

    const effectivePrice = discountPrice !== undefined && discountPrice > 0
      ? discountPrice
      : price;

    const discountPercentage = product.discountPercentage !== undefined && !isNaN(Number(product.discountPercentage))
      ? Number(product.discountPercentage)
      : (price > 0 && discountPrice !== undefined && price > discountPrice
          ? Math.round(((price - discountPrice) / price) * 100)
          : 0);

    const colorsSet = new Set<string>();
    if (typeof product.color === 'string' && product.color.trim().length > 0) {
      const c = product.color.toLowerCase().trim();
      colorsSet.add(c);
      for (const kc of KNOWN_COLORS) {
        if (new RegExp(`\\b${kc}\\b`, 'i').test(c)) colorsSet.add(kc);
      }
    }
    if (Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v && typeof v.color === 'string' && v.color.trim().length > 0) {
          const c = v.color.toLowerCase().trim();
          colorsSet.add(c);
          for (const kc of KNOWN_COLORS) {
            if (new RegExp(`\\b${kc}\\b`, 'i').test(c)) colorsSet.add(kc);
          }
        }
      });
    }
    // Also extract known colors from product title and tags
    const titleAndTags = (String(product.name || '') + ' ' + (Array.isArray(product.tags) ? product.tags.join(' ') : '')).toLowerCase();
    for (const kc of KNOWN_COLORS) {
      if (new RegExp(`\\b${kc}\\b`, 'i').test(titleAndTags)) {
        colorsSet.add(kc);
      }
    }
    const colors = Array.from(colorsSet);

    const sizesSet = new Set<string>();
    if (typeof product.size === 'string' && product.size.trim().length > 0) {
      sizesSet.add(product.size.toLowerCase().trim());
    }
    if (Array.isArray(product.sizes)) {
      product.sizes.forEach(s => {
        if (typeof s === 'string' && s.trim().length > 0) sizesSet.add(s.toLowerCase().trim());
      });
    }
    if (Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        if (v && typeof v.size === 'string' && v.size.trim().length > 0) sizesSet.add(v.size.toLowerCase().trim());
      });
    }
    const sizes = Array.from(sizesSet);

    const specStrings: string[] = [];
    if (Array.isArray(product.specifications)) {
      product.specifications.forEach(s => {
        if (s && s.key && s.value) specStrings.push(`${s.key} ${s.value}`);
      });
    }

    const visualNestedSubcategoryIds: string[] = [];
    if (product.visualNestedSubcategoryId) visualNestedSubcategoryIds.push(String(product.visualNestedSubcategoryId));
    if (Array.isArray(product.visualNestedSubcategoryIds)) {
      product.visualNestedSubcategoryIds.forEach(v => {
        if (v) visualNestedSubcategoryIds.push(String(v));
      });
    }

    const rating = Math.max(0, Math.min(5, Number(product.rating) || 0));
    const numReviews = Math.max(0, Number(product.numReviews) || 0);
    const stock = Number(product.stock) >= 0 ? Number(product.stock) : (product.inStock === false ? 0 : 10);
    const inStock = product.inStock !== false && stock > 0;

    const rawTags = Array.isArray(product.tags) ? product.tags.filter(t => typeof t === 'string').join(' ') : '';
    const rawVariantAttrs = Array.isArray(product.variantAttributes) ? product.variantAttributes.filter(v => typeof v === 'string').join(' ') : '';
    const rawDesc = String(product.description || '') + ' ' + String(product.fullDescription || '');

    const searchableText = `${String(product.name || '')} ${String(product.brand || '')} ${categoryName} ${subCategoryName} ${nestedSubCategoryName} ${rawTags} ${specStrings.join(' ')} ${rawVariantAttrs} ${String(product.sku || '')} ${rawDesc}`.trim();
    const embedding = LocalSentenceEmbedding.embed(searchableText);

    return {
      id: String(product.id),
      name: String(product.name || ''),
      brand: String(product.brand || ''),
      productCode: rawCode,
      cleanProductCode: cleanDigits,
      sku: String(product.sku || ''),
      categoryName,
      subCategoryName,
      nestedSubCategoryName,
      tags: rawTags,
      specifications: specStrings.join(' '),
      variantAttributes: rawVariantAttrs,
      description: rawDesc,
      searchableText,
      embedding,
      categoryId: String(product.categoryId || ''),
      subCategoryId: product.subCategoryId ? String(product.subCategoryId) : undefined,
      nestedSubCategoryId: product.nestedSubCategoryId ? String(product.nestedSubCategoryId) : undefined,
      visualNestedSubcategoryIds,
      effectivePrice,
      price,
      discountPrice,
      discountPercentage,
      rating,
      numReviews,
      stock,
      inStock,
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
    this.tfIdfIndex.clear();

    const docsToIndex: IndexedProductDoc[] = [];

    for (const product of products) {
      if (!product || !product.id) continue;
      const catName = categoryNameMap[product.categoryId] || '';
      const subName = product.subCategoryId ? (subCategoryNameMap[product.subCategoryId] || '') : '';
      const nestedName = product.nestedSubCategoryId ? (nestedSubCategoryNameMap[product.nestedSubCategoryId] || '') : '';
      const isReward = this.rewardProductIds.has(product.id);

      const doc = ViBaSearchEngine.toIndexedDoc(product, catName, subName, nestedName, isReward);
      this.indexedDocs.set(product.id, doc);
      if (doc.searchableText) {
        this.tfIdfIndex.addDocument(doc.id, doc.searchableText);
      }
      docsToIndex.push(doc);
    }

    if (docsToIndex.length > 0) {
      this.miniSearch.addAll(docsToIndex);
    }
    visualSearchService.initialize(products);
  }

  /**
   * Add or update an individual product incrementally.
   */
  public upsertProduct(
    product: Product,
    catName = '',
    subName = '',
    nestedName = ''
  ): IndexedProductDoc | null {
    if (!product || !product.id) return null;
    const isReward = this.rewardProductIds.has(product.id);
    const doc = ViBaSearchEngine.toIndexedDoc(product, catName, subName, nestedName, isReward);

    if (doc.searchableText) {
      this.tfIdfIndex.addDocument(doc.id, doc.searchableText);
    }

    if (this.indexedDocs.has(product.id)) {
      try {
        this.miniSearch.discard(product.id);
      } catch {}
    }

    this.indexedDocs.set(product.id, doc);
    this.miniSearch.add(doc);
    visualSearchService.upsertProduct(product);
    return doc;
  }

  /**
   * Remove a product from the index upon deletion.
   */
  public removeProduct(productId: string): boolean {
    if (this.indexedDocs.has(productId)) {
      this.indexedDocs.delete(productId);
      this.tfIdfIndex.removeDocument(productId);
      visualSearchService.removeProduct(productId);
      try {
        this.miniSearch.discard(productId);
      } catch {}
      return true;
    }
    return false;
  }

  /**
   * Get total indexed product count.
   */
  public getCount(): number {
    return this.indexedDocs.size;
  }

  /**
   * Get all currently indexed product documents.
   */
  public getAllDocs(): IndexedProductDoc[] {
    return Array.from(this.indexedDocs.values());
  }

  /**
   * Core Search Method with Lexical BM25 ranking, typo tolerance, filters, facets, and pagination.
   */
  public search(params: SearchParams): SearchResult {
    const startTime = performance.now();
    let candidateRetrievalMs = 0;
    let modelInferenceMs = 0;
    let rerankingMs = 0;

    const rawQuery = (params.q || '').trim();
    const { cleanDigits } = normalizeQueryString(rawQuery);

    let matchedDocIds: Set<string> | null = null;
    let scoreMap: Map<string, number> = new Map();
    let exactMatchFound = false;
    let hasAutoCorrected = false;
    let correctedQuery: string | undefined = undefined;

    const allDocs = Array.from(this.indexedDocs.values());

    // Check for exact SKU or 12-digit Product Code match first
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
    }

    // Automatic Spelling Correction & Typo Tolerance Detection
    let effectiveQuery = rawQuery;
    if (rawQuery.length > 0 && !exactMatchFound && !params.noAutoCorrect) {
      const spellingResult = SpellingCorrectionEngine.correct(rawQuery, allDocs);
      if (spellingResult.hasCorrection) {
        effectiveQuery = spellingResult.correctedQuery;
        hasAutoCorrected = true;
        correctedQuery = spellingResult.correctedQuery;
      }
    }

    // Natural Language / Semantic Intent Extraction on effective query
    const tModelStart = performance.now();
    let semanticIntent = params.semanticIntent;
    let queryToSearch = effectiveQuery;

    if (!semanticIntent && effectiveQuery.length > 0) {
      semanticIntent = parseIntentRuleBased(effectiveQuery);
    }
    if (semanticIntent?.isNaturalLanguage && semanticIntent.cleanKeyword) {
      queryToSearch = semanticIntent.cleanKeyword;
    }

    let queryEmbedding: Float32Array | null = null;
    if (rawQuery.length > 0) {
      queryEmbedding = LocalSentenceEmbedding.embed(queryToSearch || rawQuery);
    }
    modelInferenceMs += performance.now() - tModelStart;

    const tCandStart = performance.now();
    if (rawQuery.length > 0) {
      // Check curation pinned rules
      const pinnedProductIds = searchCurationManager.getPinnedProductIds(rawQuery);
      pinnedProductIds.forEach((pid, idx) => {
        scoreMap.set(pid, 20000 - idx);
      });

      // If not exact unique match or we want full text retrieval
      const synonymTokens = expandQueryWithSynonyms(queryToSearch);
      const searchTerms = Array.from(new Set([queryToSearch, effectiveQuery, rawQuery, ...synonymTokens]));

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

        // 2. If no direct AND match was found, try OR mode on multi-word query
        if (primaryResults.length === 0 && queryToSearch.includes(' ')) {
          const orResults = this.miniSearch.search(queryToSearch, {
            combineWith: 'OR',
            prefix: true
          });
          for (const res of orResults) {
            const current = scoreMap.get(res.id) || 0;
            scoreMap.set(res.id, Math.max(current, res.score * 0.9));
          }
        }

        // 3. Fallback to valid synonyms (skipping pure numbers, single chars, or stop words)
        if (scoreMap.size === 0 && searchTerms.length > 1) {
          for (const syn of searchTerms) {
            if (syn === queryToSearch || syn.length < 3 || /^\d+$/.test(syn)) continue;
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

      // 4. Local AI/ML Multi-Signal Evaluation (RapidFuzz, Character N-Grams, TF-IDF, Semantic Embeddings)
      const queryTokens = normalizeQueryString(queryToSearch).tokens;
      queryEmbedding = LocalSentenceEmbedding.embed(queryToSearch);
      const rankingWeights = searchCurationManager.getRankingWeights();

      for (const [id, doc] of this.indexedDocs.entries()) {
        if (scoreMap.has(id)) continue;
        if (!params.includeDrafts && (!doc.isVisible || doc.status === 'inactive' || doc.status === 'draft')) continue;

        // RapidFuzz fuzzy similarity against product title, brand, SKU, tags
        const titleFuzz = rapidFuzzScore(queryToSearch, doc.name);
        const brandFuzz = doc.brand ? rapidFuzzScore(queryToSearch, doc.brand) : 0;
        const skuFuzz = doc.sku ? rapidFuzzScore(queryToSearch, doc.sku) : 0;
        const maxFuzz = Math.max(titleFuzz, brandFuzz * 0.9, skuFuzz * 0.95);

        // Character N-Grams similarity (Dice coefficient)
        const ngramSim = ngramSimilarity(queryToSearch, doc.name);

        // TF-IDF score
        const tfidfScore = this.tfIdfIndex.score(id, queryTokens);

        // Semantic Embedding Cosine Similarity
        const semanticSim = doc.embedding ? LocalSentenceEmbedding.cosineSimilarity(queryEmbedding, doc.embedding) : 0;

        // If high fuzzy match (>= 0.75), high n-gram overlap, or high TF-IDF, include candidate!
        if (maxFuzz >= 0.75 || ngramSim >= 0.60 || (tfidfScore >= 1.0 && semanticSim >= 0.65)) {
          const compositeLocalScore = (maxFuzz * 8.0 * rankingWeights.fuzzyWeight) +
                                      (ngramSim * 6.0 * rankingWeights.ngramWeight) +
                                      (tfidfScore * 3.0 * rankingWeights.textRelevanceWeight) +
                                      (semanticSim * 4.0 * rankingWeights.semanticWeight);
          scoreMap.set(id, compositeLocalScore);
        }
      }

      matchedDocIds = new Set(scoreMap.keys());
    }
    candidateRetrievalMs = performance.now() - tCandStart;

    const tRerankStart = performance.now();

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
        const cf = categoryFilter.toLowerCase();
        const cfSingular = cf.replace(/s$/, '');
        const catMatch = doc.categoryId.toLowerCase() === cf ||
                         doc.categoryName.toLowerCase() === cf ||
                         doc.categoryName.toLowerCase().includes(cf) ||
                         cf.includes(doc.categoryName.toLowerCase()) ||
                         (doc.subCategoryName && (doc.subCategoryName.toLowerCase() === cf || doc.subCategoryName.toLowerCase().includes(cf))) ||
                         (doc.nestedSubCategoryName && (
                           doc.nestedSubCategoryName.toLowerCase() === cf ||
                           doc.nestedSubCategoryName.toLowerCase().replace(/s$/, '') === cfSingular ||
                           doc.nestedSubCategoryName.toLowerCase().includes(cf) ||
                           cf.includes(doc.nestedSubCategoryName.toLowerCase())
                         ));
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
      const effectiveBrandFilters = brandFilters && brandFilters.length > 0
        ? brandFilters
        : (semanticIntent?.detectedFilters.brand ? [semanticIntent.detectedFilters.brand.toLowerCase().trim()] : undefined);

      if (effectiveBrandFilters && effectiveBrandFilters.length > 0) {
        const docBrand = (doc.brand || '').toLowerCase().trim();
        const docName = (doc.name || '').toLowerCase();
        const docTags = (doc.tags || '').toLowerCase();
        const matchesBrand = effectiveBrandFilters.some(b =>
          docBrand === b || docBrand.includes(b) || docName.includes(b) || docTags.includes(b)
        );
        if (!matchesBrand) continue;
      }

      // 4. Price Filter
      const effectiveMinPrice = params.minPrice !== undefined ? params.minPrice : semanticIntent?.detectedFilters.minPrice;
      const effectiveMaxPrice = params.maxPrice !== undefined ? params.maxPrice : semanticIntent?.detectedFilters.maxPrice;
      if (effectiveMinPrice !== undefined && doc.effectivePrice < effectiveMinPrice) continue;
      if (effectiveMaxPrice !== undefined && doc.effectivePrice > effectiveMaxPrice) continue;

      // 5. Rating Filter
      const effectiveMinRating = params.minRating !== undefined ? params.minRating : semanticIntent?.detectedFilters.minRating;
      if (effectiveMinRating !== undefined && doc.rating < effectiveMinRating) continue;

      // 6. Discount Filter
      const effectiveMinDiscount = params.minDiscount !== undefined ? params.minDiscount : semanticIntent?.detectedFilters.minDiscount;
      if (effectiveMinDiscount !== undefined && doc.discountPercentage < effectiveMinDiscount) continue;

      // 7. Stock Filter
      const effectiveInStock = params.inStock ?? semanticIntent?.detectedFilters.inStock;
      if (effectiveInStock && (!doc.inStock || doc.stock <= 0)) continue;

      // 8. Color Filter
      if (colorFilters && colorFilters.length > 0) {
        const cleanEffectiveColors = colorFilters.map(c => c.toLowerCase().trim()).filter(Boolean);
        if (cleanEffectiveColors.length > 0) {
          const hasColor = doc.colors.some(c => {
            if (!c || !c.trim()) return false;
            const cLower = c.toLowerCase().trim();
            return cleanEffectiveColors.some(ec => cLower === ec || cLower.includes(ec) || (cLower.length >= 3 && ec.includes(cLower)));
          });
          if (!hasColor) continue;
        }
      }

      // 9. Size Filter
      const effectiveSizes = sizeFilters || (semanticIntent?.detectedFilters.size ? [semanticIntent.detectedFilters.size] : undefined);
      if (effectiveSizes && effectiveSizes.length > 0) {
        const cleanEffectiveSizes = effectiveSizes.map(s => s.toLowerCase().trim()).filter(Boolean);
        if (cleanEffectiveSizes.length > 0) {
          const hasSize = doc.sizes.some(s => {
            if (!s || !s.trim()) return false;
            const sLower = s.toLowerCase().trim();
            return cleanEffectiveSizes.some(es => sLower === es || (sLower.length >= 2 && sLower.includes(es)));
          });
          if (!hasSize) continue;
        }
      }

      // 10. Gender Filter
      const effectiveGender = params.gender || semanticIntent?.detectedFilters.gender;
      if (effectiveGender) {
        if (!checkGenderMatch(doc, effectiveGender)) continue;
      }

      // 11. Category Intent Filter (when explicit category param is not provided)
      if (semanticIntent?.detectedFilters.category && !params.category) {
        const cat = semanticIntent.detectedFilters.category.toLowerCase();
        const docCatText = (doc.categoryName + ' ' + (doc.subCategoryName || '') + ' ' + (doc.nestedSubCategoryName || '') + ' ' + doc.name + ' ' + doc.tags).toLowerCase();
        if (cat === 'kurtis') {
          if (!docCatText.includes('kurti') && !docCatText.includes('kurta')) continue;
        } else if (cat === 't-shirts') {
          if (!docCatText.includes('t-shirt') && !docCatText.includes('tshirt') && !docCatText.includes('tee')) continue;
        } else if (cat === 'shirts') {
          if (!docCatText.includes('shirt')) continue;
        } else if (cat === 'shoes') {
          if (!docCatText.includes('shoe') && !docCatText.includes('sneaker') && !docCatText.includes('footwear')) continue;
        } else if (cat === 'mobile phones') {
          if (!docCatText.includes('phone') && !docCatText.includes('mobile') && !docCatText.includes('smartphone') && !docCatText.includes('redmi') && !docCatText.includes('apple') && !docCatText.includes('samsung')) continue;
        } else if (cat === 'perfume') {
          if (!docCatText.includes('perfume') && !docCatText.includes('fragrance') && !docCatText.includes('deo') && !docCatText.includes('cologne')) continue;
        } else if (cat === 'jeans') {
          if (!docCatText.includes('jean') && !docCatText.includes('denim') && !docCatText.includes('trouser') && !docCatText.includes('pant')) continue;
        } else if (cat === 'dresses') {
          if (!docCatText.includes('dress') && !docCatText.includes('frock') && !docCatText.includes('gown')) continue;
        } else if (cat === 'watches') {
          if (!docCatText.includes('watch') && !docCatText.includes('timepiece')) continue;
        } else if (cat === 'audio') {
          if (!docCatText.includes('earbud') && !docCatText.includes('headphone') && !docCatText.includes('earphone') && !docCatText.includes('audio') && !docCatText.includes('airdope')) continue;
        } else if (cat === 'accessories') {
          if (!docCatText.includes('accessor') && !docCatText.includes('bag') && !docCatText.includes('wallet') && !docCatText.includes('belt') && !docCatText.includes('jewel')) continue;
        } else if (cat === 'mouse') {
          if (!docCatText.includes('mouse') && !docCatText.includes('mice')) continue;
        } else if (cat === 'laptops') {
          if (!docCatText.includes('laptop') && !docCatText.includes('notebook') && !docCatText.includes('macbook')) continue;
        } else if (cat === 'keyboards') {
          if (!docCatText.includes('keyboard')) continue;
        }
      }

      let score = scoreMap.get(doc.id) || 1.0;
      if (rawQuery.length > 0) {
        const boost = searchCurationManager.getBoostMultiplier(rawQuery, doc.brand, doc.categoryId);
        score *= boost;

        // Multi-Factor Ranking Engine
        const weights = searchCurationManager.getRankingWeights();
        score *= weights.textRelevanceWeight;

        // Multi-Signal Scoring Integration (RapidFuzz, Character N-Grams, TF-IDF, Semantic Embeddings)
        const qTokens = normalizeQueryString(queryToSearch || rawQuery).tokens;
        const tfidfScore = this.tfIdfIndex.score(doc.id, qTokens);
        const rfScore = rapidFuzzScore(queryToSearch || rawQuery, doc.name);
        const ngramScore = ngramSimilarity(queryToSearch || rawQuery, doc.name);
        const semanticCosine = (doc.embedding && queryEmbedding)
          ? LocalSentenceEmbedding.cosineSimilarity(queryEmbedding, doc.embedding)
          : 0;

        score += (tfidfScore * 1.5 * weights.textRelevanceWeight) +
                 (rfScore * 3.0 * weights.fuzzyWeight) +
                 (ngramScore * 2.5 * weights.ngramWeight) +
                 (semanticCosine * 2.5 * weights.semanticWeight);

        // Evaluate through Extensible Multi-Signal Ranking Framework (24 active signals)
        const rankingBreakdown = rankingFramework.evaluate({
          query: rawQuery,
          cleanQuery: (queryToSearch || rawQuery).toLowerCase().trim(),
          queryTokens: qTokens,
          queryEmbedding: queryEmbedding || undefined,
          semanticIntent,
          doc,
          baseScore: score,
          sessionContext: sessionRankingManager.getSessionContext(params.sessionId)
        });
        score = rankingBreakdown.finalScore;

        // Contextual Session-Aware Affinity (strictly bounded to max +15% boost)
        if (params.sessionId) {
          const sessionMultiplier = sessionRankingManager.computeSessionMultiplier(doc, params.sessionId);
          score *= sessionMultiplier;
        }

        // Title Exactness & Prefix Priority
        const lowerName = doc.name.toLowerCase();
        const lowerQ = (queryToSearch || rawQuery).toLowerCase();
        if (lowerName === lowerQ) {
          score *= 2.0;
        } else if (lowerName.startsWith(lowerQ)) {
          score *= 1.4;
        }

        // Availability Boost (in-stock prioritized over out-of-stock items)
        if (doc.inStock && doc.stock > 0) {
          score *= weights.availabilityWeight;
        } else {
          score *= 0.6;
        }

        // Product Quality Boost (ratings and review density)
        if (doc.rating > 0) {
          const qualityFactor = 1 + ((doc.rating / 5) * 0.2);
          score *= Math.pow(qualityFactor, weights.qualityWeight);
        }

        // Popularity Boost (customer reviews and engagement)
        if (doc.numReviews > 0) {
          const popFactor = 1 + (Math.log10(doc.numReviews + 1) * 0.08);
          score *= Math.pow(popFactor, weights.popularityWeight);
        }
      }

      // Priority boost for true buttoned shirts when searching for shirts
      if (semanticIntent?.detectedFilters.category === 'shirts') {
        const isTrueShirt = /\bshirt\b/i.test(doc.name) && !/\bt-?shirt\b/i.test(doc.name);
        if (isTrueShirt) {
          score *= 2.5;
        }
      }

      // Color intent prioritization (e.g. "red shirt" prioritizes red shirts over unrelated shirts)
      if (semanticIntent?.detectedFilters.color && (!colorFilters || colorFilters.length === 0)) {
        const targetColor = semanticIntent.detectedFilters.color.toLowerCase().trim();
        const hasColor = doc.colors.some(c => {
          if (!c) return false;
          const cLower = c.toLowerCase().trim();
          return cLower === targetColor || cLower.includes(targetColor) || targetColor.includes(cLower);
        }) || doc.name.toLowerCase().includes(targetColor);
        if (hasColor) {
          score *= 4.0; // Strongly prioritize matching color
        } else {
          score *= 0.4; // De-prioritize unrelated colors
        }
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
    if (candidateDocs.length === 0 && rawQuery.length > 0) {
      recovery = ZeroResultRecovery.recover(rawQuery, Array.from(this.indexedDocs.values()));
      if (recovery.suggestedQuery && !params.noAutoCorrect) {
        correctedQuery = recovery.suggestedQuery;
      }
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

    rerankingMs = performance.now() - tRerankStart;
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    const telemetry: SearchLatencyTelemetry = {
      candidateRetrievalMs: Math.round(candidateRetrievalMs * 100) / 100,
      modelInferenceMs: Math.round(modelInferenceMs * 100) / 100,
      rerankingMs: Math.round(rerankingMs * 100) / 100,
      totalExecutionMs: executionTimeMs
    };

    return {
      products: paginatedDocs,
      total,
      page,
      limit,
      totalPages,
      facets,
      executionTimeMs,
      telemetry,
      query: rawQuery,
      exactMatch: exactMatchFound,
      hasAutoCorrected,
      originalQuery: hasAutoCorrected ? rawQuery : undefined,
      correctedQuery,
      semanticIntent,
      recovery
    };
  }

  /**
   * Generates dynamic popular and trending suggestions from actual catalog data and user search analytics.
   */
  public getPopularSearches(limit = 8): SuggestionResult {
    const startTime = performance.now();
    const suggestions: SuggestionItem[] = [];
    const seen = new Set<string>();

    // 1. Dynamic top queries from search analytics
    try {
      const recentEvents = getInMemoryAnalytics();
      const queryFrequency: Record<string, number> = {};
      recentEvents.forEach(e => {
        if (e.resultCount > 0 && e.query) {
          const q = e.query.trim();
          if (q.length >= 2) {
            queryFrequency[q] = (queryFrequency[q] || 0) + 1;
          }
        }
      });
      const topAnalyticQueries = Object.entries(queryFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([q]) => q);

      for (const q of topAnalyticQueries) {
        const lower = q.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          suggestions.push({
            id: `pop_${lower}`,
            title: q,
            type: 'query',
            subtitle: 'Trending Search'
          });
          if (suggestions.length >= limit) break;
        }
      }
    } catch {}

    // 2. Dynamic top categories and brands from actual catalog data
    if (suggestions.length < limit) {
      const catCounts: Record<string, number> = {};
      const brandCounts: Record<string, number> = {};

      for (const doc of this.indexedDocs.values()) {
        if (!doc.isVisible || doc.status === 'inactive' || doc.status === 'draft') continue;
        if (doc.categoryName) {
          catCounts[doc.categoryName] = (catCounts[doc.categoryName] || 0) + 1;
        }
        if (doc.brand) {
          brandCounts[doc.brand] = (brandCounts[doc.brand] || 0) + 1;
        }
      }

      const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
      for (const [catName] of topCats) {
        const lower = catName.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          suggestions.push({
            id: `cat_${catName}`,
            title: catName,
            type: 'category',
            subtitle: 'Popular Category'
          });
          if (suggestions.length >= limit) break;
        }
      }

      if (suggestions.length < limit) {
        const topBrands = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
        for (const [brand] of topBrands) {
          const lower = brand.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            suggestions.push({
              id: `brand_${brand}`,
              title: brand,
              type: 'brand',
              subtitle: 'Featured Brand'
            });
            if (suggestions.length >= limit) break;
          }
        }
      }
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      query: '',
      suggestions: suggestions.slice(0, limit),
      popular: suggestions.slice(0, limit),
      products: [],
      categories: suggestions.filter(s => s.type === 'category'),
      brands: suggestions.filter(s => s.type === 'brand'),
      executionTimeMs
    };
  }

  /**
   * Fast Autocomplete Suggestions for Header / Mobile Search.
   */
  public suggest(rawQuery: string, limit = 8): SuggestionResult {
    const startTime = performance.now();
    const query = (rawQuery || '').trim();
    if (!query) {
      return this.getPopularSearches(limit);
    }

    const { cleanDigits } = normalizeQueryString(query);
    const lowerQuery = query.toLowerCase();
    const suggestions: SuggestionItem[] = [];
    const productItems: SuggestionItem[] = [];
    const categoryItems: SuggestionItem[] = [];
    const brandItems: SuggestionItem[] = [];
    const popularItems: SuggestionItem[] = [];
    const seenIds = new Set<string>();

    // 1. Exact product code check
    if (cleanDigits.length >= 8) {
      for (const doc of this.indexedDocs.values()) {
        if (!doc.isVisible || doc.status === 'inactive') continue;
        if (doc.cleanProductCode.includes(cleanDigits) || (doc.productCode && doc.productCode.includes(query))) {
          const item: SuggestionItem = {
            id: doc.id,
            title: doc.name,
            type: 'product',
            subtitle: `Product Code: ${doc.productCode}`,
            imageUrl: doc.raw.primaryImage || doc.raw.images?.[0],
            price: doc.price,
            discountPrice: doc.discountPrice,
            slug: doc.raw.slug || doc.id
          };
          suggestions.push(item);
          productItems.push(item);
          seenIds.add(doc.id);
          if (suggestions.length >= limit) break;
        }
      }
    }

    // 2. MiniSearch prefix suggestion
    try {
      const searchRes = this.miniSearch.search(query, {
        fields: ['name', 'brand', 'tags', 'categoryName', 'subCategoryName', 'nestedSubCategoryName', 'cleanProductCode', 'sku'],
        prefix: true,
        fuzzy: query.length >= 5 ? 0.2 : false,
        combineWith: 'AND'
      });

      for (const res of searchRes) {
        if (seenIds.has(res.id)) continue;
        const doc = this.indexedDocs.get(res.id);
        if (!doc || !doc.isVisible || doc.status === 'inactive') continue;

        const item: SuggestionItem = {
          id: doc.id,
          title: doc.name,
          type: 'product',
          subtitle: doc.brand ? `${doc.brand} • in ${doc.categoryName || 'Products'}` : doc.categoryName,
          imageUrl: doc.raw.primaryImage || doc.raw.images?.[0],
          price: doc.price,
          discountPrice: doc.discountPrice,
          slug: doc.raw.slug || doc.id
        };
        suggestions.push(item);
        productItems.push(item);
        seenIds.add(doc.id);
        if (suggestions.length >= limit) break;
      }
    } catch {}

    // 2.5 Fallback: If 0 product suggestions found and query has typos, attempt spelling correction
    if (suggestions.length === 0 && query.length >= 3) {
      const spelling = SpellingCorrectionEngine.correct(query, Array.from(this.indexedDocs.values()));
      if (spelling.hasCorrection) {
        try {
          const typoRes = this.miniSearch.search(spelling.correctedQuery, {
            fields: ['name', 'brand', 'tags', 'categoryName', 'subCategoryName', 'nestedSubCategoryName', 'cleanProductCode', 'sku'],
            prefix: true,
            fuzzy: 0.2,
            combineWith: 'AND'
          });
          for (const res of typoRes) {
            if (seenIds.has(res.id)) continue;
            const doc = this.indexedDocs.get(res.id);
            if (!doc || !doc.isVisible || doc.status === 'inactive') continue;

            const item: SuggestionItem = {
              id: doc.id,
              title: doc.name,
              type: 'product',
              subtitle: `Did you mean: ${spelling.correctedQuery}`,
              imageUrl: doc.raw.primaryImage || doc.raw.images?.[0],
              price: doc.price,
              discountPrice: doc.discountPrice,
              slug: doc.raw.slug || doc.id
            };
            suggestions.push(item);
            productItems.push(item);
            seenIds.add(doc.id);
            if (suggestions.length >= limit) break;
          }
        } catch {}
      }
    }

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

    for (const cat of Array.from(matchedCategories).slice(0, 3)) {
      const item: SuggestionItem = {
        id: `cat_${cat}`,
        title: cat,
        type: 'category',
        subtitle: 'In Categories'
      };
      if (suggestions.length < limit) suggestions.push(item);
      categoryItems.push(item);
    }

    for (const br of Array.from(matchedBrands).slice(0, 3)) {
      const item: SuggestionItem = {
        id: `brand_${br}`,
        title: br,
        type: 'brand',
        subtitle: 'Brand'
      };
      if (suggestions.length < limit) suggestions.push(item);
      brandItems.push(item);
    }

    // 3.5 Dynamic phrase and budget-aware suggestions from actual catalog data
    const queryItems = this.generateDynamicPhraseAndBudgetSuggestions(lowerQuery, 4);
    for (const qItem of queryItems) {
      popularItems.push(qItem);
    }

    // 4. Popular query prefix matches
    try {
      const popular = this.getPopularSearches(6);
      for (const pop of popular.suggestions) {
        if (pop.title.toLowerCase().includes(lowerQuery) && !popularItems.some(s => s.title.toLowerCase() === pop.title.toLowerCase())) {
          popularItems.push(pop);
        }
      }
    } catch {}

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    // Compose balanced suggestions list prioritizing query/budget phrases, products, and categories
    const balancedSuggestions: SuggestionItem[] = [];
    const seenSuggestionTitles = new Set<string>();

    const addIfNew = (item: SuggestionItem) => {
      const t = item.title.toLowerCase().trim();
      if (item && !seenSuggestionTitles.has(t) && balancedSuggestions.length < limit) {
        seenSuggestionTitles.add(t);
        balancedSuggestions.push(item);
      }
    };

    // Priority 1: Query & budget suggestions (e.g. Mouse, Mouse under ₹500, Wireless mouse under ₹500)
    queryItems.forEach(addIfNew);
    // Priority 2: Top matching products
    productItems.slice(0, 4).forEach(addIfNew);
    // Priority 3: Categories & Brands
    categoryItems.slice(0, 2).forEach(addIfNew);
    brandItems.slice(0, 2).forEach(addIfNew);
    // Priority 4: Popular queries
    popularItems.forEach(addIfNew);

    return {
      query,
      suggestions: balancedSuggestions,
      products: productItems,
      categories: categoryItems,
      brands: brandItems,
      popular: popularItems,
      queries: queryItems,
      executionTimeMs
    };
  }

  /**
   * Generates dynamic phrase and budget-aware suggestions from actual catalog data.
   * e.g. for "mou" -> "Mouse", "Wireless mouse", "Gaming mouse", "Mouse under ₹500", "Wireless mouse under ₹500"
   */
  public generateDynamicPhraseAndBudgetSuggestions(lowerQuery: string, limit = 5): SuggestionItem[] {
    const results: SuggestionItem[] = [];
    const seenTitles = new Set<string>();

    if (!lowerQuery || lowerQuery.length < 2) return results;

    // 1. Collect candidate product entities & descriptive phrases matching query
    const phraseCandidates = new Map<string, { label: string; docs: IndexedProductDoc[] }>();

    for (const doc of this.indexedDocs.values()) {
      if (!doc.isVisible || doc.status === 'inactive' || doc.status === 'draft') continue;

      const title = doc.name;
      const titleLower = title.toLowerCase();

      // Check category name
      if (doc.categoryName && doc.categoryName.toLowerCase().includes(lowerQuery)) {
        const cat = doc.categoryName.trim();
        const catLower = cat.toLowerCase();
        if (!phraseCandidates.has(catLower)) {
          phraseCandidates.set(catLower, { label: cat, docs: [] });
        }
        phraseCandidates.get(catLower)!.docs.push(doc);
      }

      // Check subcategory name
      if (doc.subCategoryName && doc.subCategoryName.toLowerCase().includes(lowerQuery)) {
        const sub = doc.subCategoryName.trim();
        const subLower = sub.toLowerCase();
        if (!phraseCandidates.has(subLower)) {
          phraseCandidates.set(subLower, { label: sub, docs: [] });
        }
        phraseCandidates.get(subLower)!.docs.push(doc);
      }

      // Check words in title
      const words = titleLower.split(/[\s,()\/]+/).filter(w => w.length >= 3);
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (w.startsWith(lowerQuery) || (lowerQuery.length >= 3 && w.includes(lowerQuery))) {
          // Single word entity (e.g. mouse)
          const singleLabel = w.charAt(0).toUpperCase() + w.slice(1);
          if (!phraseCandidates.has(w)) {
            phraseCandidates.set(w, { label: singleLabel, docs: [] });
          }
          phraseCandidates.get(w)!.docs.push(doc);

          // Compound 2-word phrase if preceded by adjective/type (e.g. wireless mouse, gaming mouse, optical mouse)
          if (i > 0) {
            const prev = words[i - 1];
            if (['wireless', 'gaming', 'optical', 'bluetooth', 'running', 'cotton', 'smart', 'casual', 'formal'].includes(prev)) {
              const compound = `${prev} ${w}`;
              const compoundLabel = `${prev.charAt(0).toUpperCase() + prev.slice(1)} ${w}`;
              if (!phraseCandidates.has(compound)) {
                phraseCandidates.set(compound, { label: compoundLabel, docs: [] });
              }
              phraseCandidates.get(compound)!.docs.push(doc);
            }
          }
        }
      }

      // Check tags
      if (doc.tags) {
        const tagWords = doc.tags.toLowerCase().split(/[\s,]+/).filter(t => t.length >= 3);
        for (const t of tagWords) {
          if (t.startsWith(lowerQuery) || (lowerQuery.length >= 3 && t.includes(lowerQuery))) {
            const tagLabel = t.charAt(0).toUpperCase() + t.slice(1);
            if (!phraseCandidates.has(t)) {
              phraseCandidates.set(t, { label: tagLabel, docs: [] });
            }
            phraseCandidates.get(t)!.docs.push(doc);
          }
        }
      }
    }

    // Standard budget thresholds to evaluate
    const budgetTiers = [300, 400, 500, 800, 1000, 1500, 2000, 3000, 5000, 10000, 15000, 20000];

    // Sort phrases by number of matching products in catalog descending
    const sortedPhrases = Array.from(phraseCandidates.entries())
      .filter(([_, data]) => data.docs.length > 0)
      .sort((a, b) => b[1].docs.length - a[1].docs.length);

    for (const [phraseKey, { label, docs }] of sortedPhrases) {
      if (results.length >= limit) break;

      // Add base phrase suggestion (e.g. "Mouse", "Wireless mouse", "Gaming mouse")
      if (!seenTitles.has(label.toLowerCase())) {
        seenTitles.add(label.toLowerCase());
        results.push({
          id: `query_${phraseKey.replace(/\s+/g, '_')}`,
          title: label,
          type: 'query',
          subtitle: `${docs.length} ${docs.length === 1 ? 'product' : 'products'} available`
        });
      }

      // Generate genuine budget-aware suggestions based on actual product prices
      const prices = docs.map(d => d.effectivePrice).sort((a, b) => a - b);
      const minPrice = prices[0];

      // Find suitable budget tiers where items actually exist
      for (const tier of budgetTiers) {
        if (results.length >= limit) break;
        if (tier >= minPrice) {
          const countUnderBudget = prices.filter(p => p <= tier).length;
          if (countUnderBudget >= 1) {
            const budgetTitle = `${label} under ₹${tier}`;
            if (!seenTitles.has(budgetTitle.toLowerCase())) {
              seenTitles.add(budgetTitle.toLowerCase());
              results.push({
                id: `budget_${phraseKey.replace(/\s+/g, '_')}_${tier}`,
                title: budgetTitle,
                type: 'query',
                subtitle: `${countUnderBudget} ${countUnderBudget === 1 ? 'item' : 'items'} under ₹${tier}`
              });
              break;
            }
          }
        }
      }
    }

    return results;
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

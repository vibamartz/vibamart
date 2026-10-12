import { Product } from '../../shared/types';
import {
  SearchRequest,
  SearchResponse,
  SearchHit,
  ScoreBreakdown,
  SearchFacets,
  FacetBucket,
  SearchFilters
} from './types';
import { synonymService } from './synonymService';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { parseNaturalLanguageQuery } from './naturalLanguageParser';

// Common English & e-commerce stop words to exclude from generic token scoring
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'all', 'any', 'top', 'best', 'online', 'viba', 'mart', 'item', 'items', 'buy'
]);

/**
 * Normalizes text: lowercase, remove diacritics/accents, replace symbols with spaces.
 */
export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basic plural stemming for common product terms (e.g., "shoes" -> "shoe", "watches" -> "watch").
 */
export function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('watches') || w.endsWith('boxes') || w.endsWith('dresses') || w.endsWith('glasses')) {
    return w.slice(0, -2);
  }
  if (w.endsWith('es') && (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('xes') || w.endsWith('zes'))) {
    return w.slice(0, -2);
  }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Tokenizes text into normalized, stemmed keywords.
 */
export function tokenizeQuery(query: string, filterStopWords: boolean = true): string[] {
  const clean = normalizeText(query);
  if (!clean) return [];
  const words = clean.split(/[\s-]+/).filter(Boolean);
  return words
    .filter(w => !filterStopWords || (!STOP_WORDS.has(w) && w.length > 1))
    .map(stemWord);
}

/**
 * Computes Damerau-Levenshtein distance between two strings with transposition support.
 */
export function computeDamerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array(lenB + 1).fill(0)
  );

  for (let i = 0; i <= lenA; i++) dp[i][0] = i;
  for (let j = 0; j <= lenB; j++) dp[0][j] = j;

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[lenA][lenB];
}

/**
 * Core ViBa Mart Search Engine
 */
export class ViBaSearchEngine {
  /**
   * Evaluates whether a product meets storefront eligibility rules.
   */
  public static isProductEligible(
    product: Product,
    rewardProductIds: Set<string> = new Set(),
    isExplicitDeal259Search: boolean = false
  ): boolean {
    if (!product || !product.id) return false;

    // 1. Storefront visibility toggle
    if (product.isVisible === false) return false;

    // 2. Product status (exclude inactive, draft, deleted)
    if (product.status === 'inactive' || product.status === 'draft') return false;

    // 3. Reward products partition (strictly restricted to rewards/loyalty)
    if (rewardProductIds.has(product.id)) return false;

    // 4. Deal 259 partition
    if (product.isDeal259 === true && !isExplicitDeal259Search && product.showInGeneralStore !== true) {
      return false;
    }

    return true;
  }

  /**
   * Applies combined filters (category, subcategory, brand, price, rating, discount, stock).
   */
  public static matchesFilters(product: Product, filters?: SearchFilters): boolean {
    if (!filters) return true;

    // Category Filter
    if (filters.categoryId && filters.categoryId !== 'all' && filters.categoryId !== 'all-deals') {
      const assignedCats = new Set([
        product.categoryId,
        ...(product.categories || [])
      ].filter(Boolean));
      if (!assignedCats.has(filters.categoryId)) return false;
    }
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const assignedCats = new Set([
        product.categoryId,
        ...(product.categories || [])
      ].filter(Boolean));
      const hasMatch = filters.categoryIds.some(cid => assignedCats.has(cid));
      if (!hasMatch) return false;
    }

    // SubCategory Filter
    if (filters.subCategoryId && filters.subCategoryId !== 'all') {
      const assignedSubs = new Set([
        product.subCategoryId,
        ...(product.subCategoryIds || [])
      ].filter(Boolean));
      if (!assignedSubs.has(filters.subCategoryId)) return false;
    }
    if (filters.subCategoryIds && filters.subCategoryIds.length > 0) {
      const assignedSubs = new Set([
        product.subCategoryId,
        ...(product.subCategoryIds || [])
      ].filter(Boolean));
      const hasMatch = filters.subCategoryIds.some(sid => assignedSubs.has(sid));
      if (!hasMatch) return false;
    }

    // Nested SubCategory Filter
    if (filters.nestedSubCategoryId && filters.nestedSubCategoryId !== 'all') {
      const assignedNested = new Set([
        product.nestedSubCategoryId,
        ...(product.nestedSubCategoryIds || [])
      ].filter(Boolean));
      if (!assignedNested.has(filters.nestedSubCategoryId)) return false;
    }
    if (filters.nestedSubCategoryIds && filters.nestedSubCategoryIds.length > 0) {
      const assignedNested = new Set([
        product.nestedSubCategoryId,
        ...(product.nestedSubCategoryIds || [])
      ].filter(Boolean));
      const hasMatch = filters.nestedSubCategoryIds.some(nid => assignedNested.has(nid));
      if (!hasMatch) return false;
    }

    // Visual Nested SubCategory Filter
    if (filters.visualNestedSubcategoryId) {
      const assignedVisual = new Set([
        product.visualNestedSubcategoryId,
        ...(product.visualNestedSubcategoryIds || [])
      ].filter(Boolean));
      if (!assignedVisual.has(filters.visualNestedSubcategoryId)) return false;
    }
    if (filters.visualNestedSubcategoryIds && filters.visualNestedSubcategoryIds.length > 0) {
      const assignedVisual = new Set([
        product.visualNestedSubcategoryId,
        ...(product.visualNestedSubcategoryIds || [])
      ].filter(Boolean));
      const hasMatch = filters.visualNestedSubcategoryIds.some(vid => assignedVisual.has(vid));
      if (!hasMatch) return false;
    }

    // Brand Filter
    if (filters.brand) {
      if (!product.brand || product.brand.toLowerCase() !== filters.brand.toLowerCase()) {
        return false;
      }
    }
    if (filters.brands && filters.brands.length > 0) {
      if (!product.brand) return false;
      const lowerBrands = filters.brands.map(b => b.toLowerCase());
      if (!lowerBrands.includes(product.brand.toLowerCase())) return false;
    }

    // Price Filter (Selling Price)
    const effectivePrice = product.discountPrice || product.price || 0;
    if (filters.minPrice !== undefined && effectivePrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && effectivePrice > filters.maxPrice) return false;

    // Rating Filter
    if (filters.minRating !== undefined && filters.minRating > 0) {
      if ((product.rating || 0) < filters.minRating) return false;
    }

    // Discount Percentage Filter
    if (filters.minDiscount !== undefined && filters.minDiscount > 0) {
      const discountPct = product.price && product.discountPrice
        ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
        : (product.discountPercentage || 0);
      if (discountPct < filters.minDiscount) return false;
    }

    // Stock Filter
    if (filters.inStockOnly) {
      if (product.stock <= 0 || product.status === 'out_of_stock' || product.inStock === false) {
        return false;
      }
    }

    return true;
  }

  /**
   * Computes the 8-tier relevance score for a product against a search query.
   */
  public static scoreProduct(
    product: Product,
    rawQuery: string,
    options: {
      enableFuzzy?: boolean;
      enableSynonyms?: boolean;
      categoryNamesMap?: Record<string, string>;
    } = {}
  ): { score: number; breakdown: ScoreBreakdown; matches: boolean } {
    const { enableFuzzy = true, enableSynonyms = true, categoryNamesMap = {} } = options;
    const cleanQ = normalizeText(rawQuery);
    const cleanDigits = cleanProductCode(rawQuery);

    const breakdown: ScoreBreakdown = {
      identifierScore: 0,
      exactTitleScore: 0,
      phraseScore: 0,
      brandScore: 0,
      categoryScore: 0,
      tokenScore: 0,
      fuzzyScore: 0,
      businessScore: 0,
      totalScore: 0,
      matchedFields: [],
      appliedSynonyms: [],
      fuzzyMatches: []
    };

    // If query is blank, product passes with neutral business score
    if (!cleanQ) {
      const inStock = product.stock > 0 && product.status !== 'out_of_stock';
      breakdown.businessScore = (inStock ? 20 : -100) + Math.min(25, (product.rating || 0) * 5);
      breakdown.totalScore = breakdown.businessScore;
      return { score: breakdown.totalScore, breakdown, matches: true };
    }

    // Pre-extract and normalize product text attributes
    const prodNameClean = normalizeText(product.name);
    const prodBrandClean = normalizeText(product.brand);
    const prodSkuClean = normalizeText(product.sku);
    const prodCodeClean = cleanProductCode(product.productCode);
    const prodIdClean = normalizeText(product.id);
    const prodDescClean = normalizeText(product.description + ' ' + (product.fullDescription || ''));
    const prodTags = (product.tags || []).map(normalizeText);

    // Category names
    const catName = categoryNamesMap[product.categoryId] ? normalizeText(categoryNamesMap[product.categoryId]) : '';
    const subCatName = product.subCategoryId && categoryNamesMap[product.subCategoryId] ? normalizeText(categoryNamesMap[product.subCategoryId]) : '';
    const nestedSubCatName = product.nestedSubCategoryId && categoryNamesMap[product.nestedSubCategoryId] ? normalizeText(categoryNamesMap[product.nestedSubCategoryId]) : '';

    // Specifications
    const specTexts = (product.specifications || []).map(s => `${normalizeText(s.key)} ${normalizeText(s.value)}`);

    // ----------------------------------------------------
    // TIER 1: Exact SKU & Product Code / ID Match (+1000 pts)
    // ----------------------------------------------------
    let isExactIdentifier = false;
    if (cleanDigits.length >= 4 && prodCodeClean && prodCodeClean === cleanDigits) {
      isExactIdentifier = true;
      breakdown.identifierScore += 1000;
      breakdown.matchedFields.push('productCode');
    } else if (cleanQ && (prodSkuClean === cleanQ || prodIdClean === cleanQ)) {
      isExactIdentifier = true;
      breakdown.identifierScore += 1000;
      breakdown.matchedFields.push(prodSkuClean === cleanQ ? 'sku' : 'id');
    } else if (prodCodeClean && cleanQ.includes(prodCodeClean)) {
      isExactIdentifier = true;
      breakdown.identifierScore += 900;
      breakdown.matchedFields.push('productCode_partial');
    }

    // ----------------------------------------------------
    // TIER 2: Exact Product Title Match (+500 pts)
    // ----------------------------------------------------
    if (prodNameClean === cleanQ) {
      breakdown.exactTitleScore += 500;
      breakdown.matchedFields.push('exact_title');
    }

    // ----------------------------------------------------
    // TIER 3: Contiguous Title Phrase Match (+250 to +350 pts)
    // ----------------------------------------------------
    if (cleanQ.length > 2 && prodNameClean.includes(cleanQ)) {
      if (prodNameClean.startsWith(cleanQ)) {
        breakdown.phraseScore += 350; // Prefix match in title
        breakdown.matchedFields.push('title_prefix');
      } else {
        breakdown.phraseScore += 250; // Contiguous substring in title
        breakdown.matchedFields.push('title_phrase');
      }
    }

    // ----------------------------------------------------
    // TIER 4: Brand & Model Match (+150 to +200 pts)
    // ----------------------------------------------------
    if (prodBrandClean && cleanQ.includes(prodBrandClean)) {
      breakdown.brandScore += prodBrandClean === cleanQ ? 200 : 150;
      breakdown.matchedFields.push('brand');
    }

    // ----------------------------------------------------
    // TIER 5: Category & Subcategory Match (+80 to +120 pts)
    // ----------------------------------------------------
    if (catName && (catName === cleanQ || cleanQ.includes(catName))) {
      breakdown.categoryScore += 120;
      breakdown.matchedFields.push('category');
    } else if (subCatName && (subCatName === cleanQ || cleanQ.includes(subCatName))) {
      breakdown.categoryScore += 100;
      breakdown.matchedFields.push('subcategory');
    } else if (nestedSubCatName && (nestedSubCatName === cleanQ || cleanQ.includes(nestedSubCatName))) {
      breakdown.categoryScore += 80;
      breakdown.matchedFields.push('nested_subcategory');
    }

    // ----------------------------------------------------
    // TIER 6: Multi-term Lexical & BM25-Weighted Token Match
    // ----------------------------------------------------
    const queryTokens = tokenizeQuery(rawQuery, true);
    const nonFilteredTokens = tokenizeQuery(rawQuery, false);
    const activeTokens = queryTokens.length > 0 ? queryTokens : nonFilteredTokens;

    // Expand query with synonyms if enabled
    let expandedTokens = activeTokens;
    if (enableSynonyms) {
      const expansion = synonymService.expandQueryTerms(activeTokens);
      expandedTokens = expansion.expandedTerms;
      if (Object.keys(expansion.synonymMap).length > 0) {
        breakdown.appliedSynonyms = Object.entries(expansion.synonymMap).map(([k, v]) => `${k} -> ${v.join(', ')}`);
      }
    }

    const prodWordsSet = new Set(tokenizeQuery(product.name, false));
    const tagWordsSet = new Set(prodTags.flatMap(t => tokenizeQuery(t, false)));
    const brandWordsSet = new Set(tokenizeQuery(product.brand || '', false));
    const specWordsSet = new Set(specTexts.flatMap(s => tokenizeQuery(s, false)));
    const descWordsSet = new Set(tokenizeQuery(product.description || '', false));

    let matchedTokenCount = 0;

    for (const token of activeTokens) {
      let tokenMatched = false;

      // Direct name token match (weight 10x)
      if (prodWordsSet.has(token) || prodNameClean.includes(token)) {
        breakdown.tokenScore += 10;
        tokenMatched = true;
      }
      // Tags token match (weight 5x)
      if (tagWordsSet.has(token)) {
        breakdown.tokenScore += 5;
        tokenMatched = true;
      }
      // Brand token match (weight 4x)
      if (brandWordsSet.has(token) || prodBrandClean.includes(token)) {
        breakdown.tokenScore += 4;
        tokenMatched = true;
      }
      // Specs token match (weight 3x)
      if (specWordsSet.has(token)) {
        breakdown.tokenScore += 3;
        tokenMatched = true;
      }
      // Description token match (weight 1x)
      if (descWordsSet.has(token) || prodDescClean.includes(token)) {
        breakdown.tokenScore += 1;
        tokenMatched = true;
      }

      if (tokenMatched) {
        matchedTokenCount++;
      }
    }

    // Also check synonym matches for tokens that did not match directly
    if (enableSynonyms && expandedTokens.length > activeTokens.length) {
      for (const syn of expandedTokens) {
        if (!activeTokens.includes(syn)) {
          if (prodWordsSet.has(syn) || prodNameClean.includes(syn)) {
            breakdown.tokenScore += 7; // Synonym in name
            breakdown.matchedFields.push(`synonym:${syn}`);
            matchedTokenCount++;
          } else if (tagWordsSet.has(syn) || brandWordsSet.has(syn)) {
            breakdown.tokenScore += 4;
            matchedTokenCount++;
          }
        }
      }
    }

    // ----------------------------------------------------
    // TIER 7: Typo Tolerance & Fuzzy Distance (+30 to +70 pts)
    // ----------------------------------------------------
    if (enableFuzzy && matchedTokenCount === 0 && !isExactIdentifier) {
      for (const qToken of activeTokens) {
        if (qToken.length >= 4) {
          const maxAllowedDistance = qToken.length <= 6 ? 1 : 2;

          for (const targetWord of prodWordsSet) {
            if (Math.abs(targetWord.length - qToken.length) <= maxAllowedDistance) {
              const dist = computeDamerauLevenshtein(qToken, targetWord);
              if (dist <= maxAllowedDistance) {
                const fuzzyPoints = dist === 1 ? 60 : 35;
                breakdown.fuzzyScore += fuzzyPoints;
                breakdown.matchedFields.push(`fuzzy:${qToken}->${targetWord}`);
                breakdown.fuzzyMatches?.push({ queryTerm: qToken, matchedTerm: targetWord, distance: dist });
                matchedTokenCount++;
                break;
              }
            }
          }
        }
      }
    }

    // ----------------------------------------------------
    // TIER 8: Business Signals (Boost / Penalty)
    // ----------------------------------------------------
    const inStock = product.stock > 0 && product.status !== 'out_of_stock' && product.inStock !== false;
    breakdown.businessScore += inStock ? 20 : -100;
    const ratingBoost = Math.min(25, (product.rating || 0) * 5);
    breakdown.businessScore += ratingBoost;

    // Total Score Calculation
    breakdown.totalScore =
      breakdown.identifierScore +
      breakdown.exactTitleScore +
      breakdown.phraseScore +
      breakdown.brandScore +
      breakdown.categoryScore +
      breakdown.tokenScore +
      breakdown.fuzzyScore +
      breakdown.businessScore;

    // Acceptance condition: Must have matched an identifier, a phrase/title, a category, or at least 1 token/fuzzy match
    const isMatchingProduct =
      isExactIdentifier ||
      breakdown.exactTitleScore > 0 ||
      breakdown.phraseScore > 0 ||
      breakdown.brandScore > 0 ||
      breakdown.categoryScore > 0 ||
      matchedTokenCount > 0;

    return {
      score: breakdown.totalScore,
      breakdown,
      matches: isMatchingProduct
    };
  }

  /**
   * Generates dynamic facet counts from filtered candidates.
   */
  public static computeFacets(products: Product[], categoryNamesMap: Record<string, string> = {}): SearchFacets {
    const catMap = new Map<string, number>();
    const subCatMap = new Map<string, number>();
    const brandMap = new Map<string, number>();
    const ratingBuckets = { '4+': 0, '3+': 0, '2+': 0 };
    const discountBuckets = { '50%+': 0, '30%+': 0, '20%+': 0, '10%+': 0 };
    let inStockCount = 0;
    let outOfStockCount = 0;

    let minPrice = Infinity;
    let maxPrice = 0;

    for (const p of products) {
      // Category
      if (p.categoryId) {
        catMap.set(p.categoryId, (catMap.get(p.categoryId) || 0) + 1);
      }
      // SubCategory
      if (p.subCategoryId) {
        subCatMap.set(p.subCategoryId, (subCatMap.get(p.subCategoryId) || 0) + 1);
      }
      // Brand
      if (p.brand) {
        brandMap.set(p.brand, (brandMap.get(p.brand) || 0) + 1);
      }

      // Price
      const price = p.discountPrice || p.price || 0;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;

      // Rating
      const r = p.rating || 0;
      if (r >= 4) ratingBuckets['4+']++;
      if (r >= 3) ratingBuckets['3+']++;
      if (r >= 2) ratingBuckets['2+']++;

      // Discount
      const disc = p.price && p.discountPrice
        ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
        : (p.discountPercentage || 0);
      if (disc >= 50) discountBuckets['50%+']++;
      if (disc >= 30) discountBuckets['30%+']++;
      if (disc >= 20) discountBuckets['20%+']++;
      if (disc >= 10) discountBuckets['10%+']++;

      // Stock
      if (p.stock > 0 && p.status !== 'out_of_stock' && p.inStock !== false) {
        inStockCount++;
      } else {
        outOfStockCount++;
      }
    }

    if (minPrice === Infinity) minPrice = 0;

    const categories: FacetBucket[] = Array.from(catMap.entries())
      .map(([key, count]) => ({
        key,
        label: categoryNamesMap[key] || key,
        count
      }))
      .sort((a, b) => b.count - a.count);

    const subCategories: FacetBucket[] = Array.from(subCatMap.entries())
      .map(([key, count]) => ({
        key,
        label: categoryNamesMap[key] || key,
        count
      }))
      .sort((a, b) => b.count - a.count);

    const brands: FacetBucket[] = Array.from(brandMap.entries())
      .map(([key, count]) => ({
        key,
        label: key,
        count
      }))
      .sort((a, b) => b.count - a.count);

    const ratings: FacetBucket[] = Object.entries(ratingBuckets).map(([key, count]) => ({
      key,
      label: `${key} Stars`,
      count
    }));

    const discountTiers: FacetBucket[] = Object.entries(discountBuckets).map(([key, count]) => ({
      key,
      label: key,
      count
    }));

    return {
      categories,
      subCategories,
      brands,
      priceRanges: {
        min: minPrice,
        max: maxPrice,
        buckets: [
          { key: '0-500', label: 'Under ₹500', count: products.filter(p => (p.discountPrice || p.price || 0) <= 500).length },
          { key: '500-1000', label: '₹500 - ₹1,000', count: products.filter(p => { const pr = p.discountPrice || p.price || 0; return pr > 500 && pr <= 1000; }).length },
          { key: '1000-2500', label: '₹1,000 - ₹2,500', count: products.filter(p => { const pr = p.discountPrice || p.price || 0; return pr > 1000 && pr <= 2500; }).length },
          { key: '2500-5000', label: '₹2,500 - ₹5,000', count: products.filter(p => { const pr = p.discountPrice || p.price || 0; return pr > 2500 && pr <= 5000; }).length },
          { key: '5000+', label: 'Above ₹5,000', count: products.filter(p => (p.discountPrice || p.price || 0) > 5000).length },
        ]
      },
      ratings,
      discountTiers,
      availability: {
        inStock: inStockCount,
        outOfStock: outOfStockCount
      }
    };
  }

  /**
   * Executes a full search against a candidate product array.
   */
  public static executeSearch(
    products: Product[],
    request: SearchRequest,
    categoryNamesMap: Record<string, string> = {}
  ): SearchResponse {
    const startTime = performance.now();
    const {
      query: rawQuery,
      filters,
      sortBy = 'relevance',
      page = 1,
      limit = 24,
      enableFuzzy = true,
      enableSynonyms = true,
      rewardProductIds = []
    } = request;

    const rewardSet = new Set(rewardProductIds);
    const isExplicitDeal259 = filters?.isDeal259 === true;

    // Natural Language Query Understanding (extracts price, rating, discount, stock)
    const nlParsed = parseNaturalLanguageQuery(rawQuery);
    const effectiveFilters: SearchFilters = {
      ...(nlParsed.isNaturalLanguage ? nlParsed.filters : {}),
      ...(filters || {})
    };
    const scoringQuery = nlParsed.isNaturalLanguage ? nlParsed.cleanQuery : rawQuery;

    // 1. Eligibility Filtering (Exclude inactive, draft, hidden, reward, deal259-only)
    const eligibleProducts = products.filter(p =>
      this.isProductEligible(p, rewardSet, isExplicitDeal259)
    );

    // 2. Applied Filters Filtering (Category, Brand, Price, Rating, etc.)
    const filteredProducts = eligibleProducts.filter(p =>
      this.matchesFilters(p, effectiveFilters)
    );

    // 3. Compute Facet Counts from the filtered set
    const facets = this.computeFacets(filteredProducts, categoryNamesMap);

    // 4. Score and Rank
    const hits: SearchHit[] = [];

    for (const product of filteredProducts) {
      const evaluation = this.scoreProduct(product, scoringQuery, {
        enableFuzzy,
        enableSynonyms,
        categoryNamesMap
      });

      if (evaluation.matches) {
        hits.push({
          product,
          score: evaluation.score,
          scoreBreakdown: evaluation.breakdown
        });
      }
    }

    // 5. Sorting
    hits.sort((a, b) => {
      if (sortBy === 'price-asc') {
        const prA = a.product.discountPrice || a.product.price || 0;
        const prB = b.product.discountPrice || b.product.price || 0;
        return prA - prB;
      }
      if (sortBy === 'price-desc') {
        const prA = a.product.discountPrice || a.product.price || 0;
        const prB = b.product.discountPrice || b.product.price || 0;
        return prB - prA;
      }
      if (sortBy === 'rating') {
        return (b.product.rating || 0) - (a.product.rating || 0);
      }
      if (sortBy === 'newest') {
        const tA = new Date(a.product.createdAt || 0).getTime();
        const tB = new Date(b.product.createdAt || 0).getTime();
        return tB - tA;
      }
      // Default: 'relevance'
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Tie breaker 1: rating
      if ((b.product.rating || 0) !== (a.product.rating || 0)) {
        return (b.product.rating || 0) - (a.product.rating || 0);
      }
      // Tie breaker 2: newest
      return new Date(b.product.createdAt || 0).getTime() - new Date(a.product.createdAt || 0).getTime();
    });

    // 6. Pagination
    const totalHits = hits.length;
    const totalPages = Math.max(1, Math.ceil(totalHits / limit));
    const validPage = Math.max(1, Math.min(page, totalPages));
    const offset = (validPage - 1) * limit;
    const paginatedHits = hits.slice(offset, offset + limit);

    // 7. Did You Mean spelling candidate (if fuzzy matches were made)
    let didYouMean: string | undefined = undefined;
    if (hits.length > 0 && hits[0].scoreBreakdown.fuzzyMatches && hits[0].scoreBreakdown.fuzzyMatches.length > 0) {
      const topFuzzy = hits[0].scoreBreakdown.fuzzyMatches[0];
      if (topFuzzy.distance > 0) {
        didYouMean = topFuzzy.matchedTerm;
      }
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      hits: paginatedHits,
      totalHits,
      page: validPage,
      totalPages,
      limit,
      query: rawQuery,
      normalizedQuery: normalizeText(rawQuery),
      didYouMean,
      facets,
      latencyMs,
      appliedFilters: effectiveFilters,
      sortBy,
      parsedIntent: {
        isNaturalLanguage: nlParsed.isNaturalLanguage,
        cleanQuery: nlParsed.cleanQuery,
        detectedFilters: nlParsed.filters
      }
    };
  }
}

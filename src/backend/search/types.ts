import { Product } from '../../shared/types';

/**
 * Filter parameters applied to a search request
 */
export interface SearchFilters {
  categoryId?: string;
  categoryIds?: string[];
  subCategoryId?: string;
  subCategoryIds?: string[];
  nestedSubCategoryId?: string;
  nestedSubCategoryIds?: string[];
  visualNestedSubcategoryId?: string;
  visualNestedSubcategoryIds?: string[];
  brand?: string;
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStockOnly?: boolean;
  isDeal259?: boolean;
}

/**
 * Sorting options supported by the ViBa Mart Search Engine
 */
export type SearchSortOption = 
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'newest';

/**
 * Request payload for searching products
 */
export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  sortBy?: SearchSortOption;
  page?: number;
  limit?: number;
  enableFuzzy?: boolean;
  enableSynonyms?: boolean;
  rewardProductIds?: string[]; // IDs to strictly exclude from public catalog
}

/**
 * Detailed explanation for why a product matched and its score breakdown
 */
export interface ScoreBreakdown {
  identifierScore: number;
  exactTitleScore: number;
  phraseScore: number;
  brandScore: number;
  categoryScore: number;
  tokenScore: number;
  fuzzyScore: number;
  businessScore: number;
  totalScore: number;
  matchedFields: string[];
  appliedSynonyms?: string[];
  fuzzyMatches?: { queryTerm: string; matchedTerm: string; distance: number }[];
}

/**
 * Ranked search hit wrapping the authoritative Product
 */
export interface SearchHit {
  product: Product;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  highlight?: {
    name?: string;
    brand?: string;
    description?: string;
  };
}

/**
 * Facet bucket with value, display label, and matching count
 */
export interface FacetBucket {
  key: string;
  label: string;
  count: number;
  selected?: boolean;
}

/**
 * Aggregate facet counts returned alongside search results
 */
export interface SearchFacets {
  categories: FacetBucket[];
  subCategories: FacetBucket[];
  brands: FacetBucket[];
  priceRanges: {
    min: number;
    max: number;
    buckets: FacetBucket[];
  };
  ratings: FacetBucket[];
  discountTiers: FacetBucket[];
  availability: {
    inStock: number;
    outOfStock: number;
  };
}

/**
 * Comprehensive search response payload
 */
export interface SearchResponse {
  hits: SearchHit[];
  totalHits: number;
  page: number;
  totalPages: number;
  limit: number;
  query: string;
  normalizedQuery: string;
  didYouMean?: string;
  facets: SearchFacets;
  latencyMs: number;
  appliedFilters: SearchFilters;
  sortBy: SearchSortOption;
  parsedIntent?: {
    isNaturalLanguage: boolean;
    cleanQuery: string;
    detectedFilters: SearchFilters;
  };
}

/**
 * Autocomplete item categories
 */
export type AutocompleteItemType = 'product' | 'brand' | 'category' | 'query';

export interface AutocompleteItem {
  id: string;
  type: AutocompleteItemType;
  title: string;
  subtitle?: string;
  image?: string;
  price?: number;
  discountPrice?: number;
  slug?: string;
  productCode?: string;
  targetUrl: string;
}

export interface AutocompleteResponse {
  query: string;
  suggestions: AutocompleteItem[];
  spellingCorrection?: string;
  latencyMs: number;
}

/**
 * Synonym entry stored in Firestore
 */
export interface SynonymEntry {
  id: string;
  term: string; // Base search term (e.g., "phone")
  synonyms: string[]; // Equivalent terms (e.g., ["mobile", "cellphone", "smartphone"])
  isBidirectional: boolean; // True: any term matches any other; False: term -> synonyms only
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Privacy-conscious search analytics log
 */
export interface SearchAnalyticsEvent {
  id?: string;
  query: string;
  normalizedQuery: string;
  hitCount: number;
  latencyMs: number;
  userId?: string | null;
  userAgent?: string;
  timestamp: string;
  zeroResult: boolean;
  filtersApplied?: Record<string, any>;
  clickedProductId?: string;
  actionType: 'search' | 'suggestion_click' | 'product_click' | 'add_to_cart';
}

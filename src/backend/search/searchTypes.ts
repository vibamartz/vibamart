import { Product } from '../../shared/types';

export interface SearchParams {
  q?: string;
  category?: string;
  subCategory?: string;
  nestedSubCategory?: string;
  visualSubCategory?: string;
  brand?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minDiscount?: number;
  inStock?: boolean;
  color?: string | string[];
  size?: string | string[];
  gender?: string;
  sortBy?: 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'popularity';
  page?: number;
  limit?: number;
  includeDrafts?: boolean;
  useAI?: boolean;
  noAutoCorrect?: boolean;
  semanticIntent?: SemanticIntentData;
  sessionId?: string;
  baselineOnly?: boolean;
}

export interface SessionContext {
  sessionId: string;
  recentQueries: string[];
  clickedProductIds: string[];
  categoryWeights: Record<string, number>;
  brandWeights: Record<string, number>;
  viewedPrices: number[];
  averageViewedPrice: number;
  lastActive: number;
}

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

export interface SearchLatencyTelemetry {
  candidateRetrievalMs: number;
  modelInferenceMs: number;
  rerankingMs: number;
  totalExecutionMs: number;
}

export interface SearchFacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SearchFacets {
  categories: SearchFacetValue[];
  subCategories: SearchFacetValue[];
  nestedSubCategories: SearchFacetValue[];
  brands: SearchFacetValue[];
  colors: SearchFacetValue[];
  sizes: SearchFacetValue[];
  priceRange: {
    min: number;
    max: number;
  };
  ratings: {
    stars: number;
    count: number;
  }[];
  stockStatus: {
    inStock: number;
    outOfStock: number;
  };
}

export interface SemanticIntentData {
  cleanKeyword: string;
  detectedFilters: Record<string, any>;
  semanticTags: string[];
  source: 'gemini' | 'rule_based' | 'cache';
  isNaturalLanguage?: boolean;
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: SearchFacets;
  executionTimeMs: number;
  telemetry?: SearchLatencyTelemetry;
  query?: string;
  exactMatch?: boolean;
  hasAutoCorrected?: boolean;
  originalQuery?: string;
  correctedQuery?: string;
  semanticIntent?: SemanticIntentData;
  recovery?: {
    suggestedQuery?: string;
    suggestedCategories?: string[];
    suggestedBrands?: string[];
  };
}

export interface SuggestionItem {
  id: string;
  title: string;
  type: 'product' | 'brand' | 'category' | 'query' | 'popular';
  subtitle?: string;
  imageUrl?: string;
  price?: number;
  discountPrice?: number;
  slug?: string;
  categorySlug?: string;
}

export interface SuggestionResult {
  query: string;
  suggestions: SuggestionItem[];
  products?: SuggestionItem[];
  categories?: SuggestionItem[];
  brands?: SuggestionItem[];
  popular?: SuggestionItem[];
  queries?: SuggestionItem[];
  executionTimeMs: number;
}

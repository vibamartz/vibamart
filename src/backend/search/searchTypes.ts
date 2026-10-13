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
  sortBy?: 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'discount';
  page?: number;
  limit?: number;
}

export interface SearchFacetValue {
  id: string;
  name: string;
  count: number;
}

export interface SearchFacets {
  categories: SearchFacetValue[];
  subcategories: SearchFacetValue[];
  nestedSubcategories: SearchFacetValue[];
  brands: SearchFacetValue[];
  colors: SearchFacetValue[];
  sizes: SearchFacetValue[];
  priceRange: { min: number; max: number };
  ratingDistribution: { rating: number; count: number }[];
  discountDistribution: { discountRange: string; minDiscount: number; count: number }[];
}

export interface AiDetectedEntity {
  entity: string;
  type: 'brand' | 'category' | 'price' | 'discount' | 'color' | 'size' | 'rating' | 'gender' | 'sort';
}

export interface AiParsedIntent {
  originalQuery: string;
  residualQuery: string;
  extractedFilters: {
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    minDiscount?: number;
    brand?: string;
    color?: string;
    size?: string;
    category?: string;
    gender?: string;
    sortBy?: 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'discount';
  };
  confidence: number;
  detectedEntities: AiDetectedEntity[];
}

export interface RecoveryRecommendation {
  text: string;
  query: string;
  type: 'relaxed_filter' | 'alternative_category' | 'popular_brand';
}

export interface SearchResult {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: SearchFacets;
  query: string;
  correctedQuery?: string;
  didYouMean?: string;
  exactIdentifierMatch?: boolean;
  executionTimeMs: number;
  aiParsedIntent?: AiParsedIntent;
  recoveryRecommendations?: RecoveryRecommendation[];
  isAiRelaxed?: boolean;
  aiExplanation?: string;
}

export interface SuggestionItem {
  id: string;
  name: string;
  slug?: string;
  type: 'product' | 'brand' | 'category' | 'query';
  brand?: string;
  categoryName?: string;
  image?: string;
  price?: number;
  discountPrice?: number;
  score?: number;
}

export interface SuggestionResult {
  query: string;
  suggestions: SuggestionItem[];
  suggestedCategories: { id: string; name: string; slug?: string }[];
  suggestedBrands: string[];
  executionTimeMs: number;
}

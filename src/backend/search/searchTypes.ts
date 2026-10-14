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
  sortBy?: 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'rating' | 'popularity';
  page?: number;
  limit?: number;
  includeDrafts?: boolean;
  useAI?: boolean;
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
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: SearchFacets;
  executionTimeMs: number;
  query?: string;
  exactMatch?: boolean;
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
  type: 'product' | 'brand' | 'category' | 'query';
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
  executionTimeMs: number;
}

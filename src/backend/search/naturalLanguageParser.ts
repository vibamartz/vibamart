import { SearchFilters } from './types';

export interface ParsedNLQuery {
  rawQuery: string;
  cleanQuery: string;
  filters: SearchFilters;
  detectedAttributes: {
    gender?: 'men' | 'women' | 'kids' | 'unisex';
    color?: string;
    categoryHint?: string;
  };
  expandedTerms?: string[];
  isNaturalLanguage: boolean;
}

/**
 * Normalizes number strings supporting Indian number formats and 'k' suffixes
 * e.g., "1,500" -> 1500, "1.5k" -> 1500, "20k" -> 20000
 */
function parsePriceValue(valStr: string): number | null {
  if (!valStr) return null;
  const clean = valStr.trim().toLowerCase().replace(/[,₹rs.\s]/g, '');
  if (clean.endsWith('k')) {
    const num = parseFloat(clean.slice(0, -1));
    return isNaN(num) ? null : Math.round(num * 1000);
  }
  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num);
}

/**
 * Fast, deterministic Natural Language Query Parser
 * Extracts structured constraints (price, discount, rating, stock, gender)
 * and strips constraint phrases to yield the core product intent.
 */
export function parseNaturalLanguageQuery(rawQuery: string): ParsedNLQuery {
  const query = (rawQuery || '').trim();
  if (!query) {
    return {
      rawQuery: '',
      cleanQuery: '',
      filters: {},
      detectedAttributes: {},
      isNaturalLanguage: false
    };
  }

  const filters: SearchFilters = {};
  const detectedAttributes: ParsedNLQuery['detectedAttributes'] = {};
  let workingQuery = query;
  let hasExtractedConstraint = false;

  // 1. Price Range Patterns: "between X and Y", "from X to Y", "X to Y"
  const betweenRegex = /\b(?:between|from)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?k?)\s+(?:and|to|-)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?k?)\b/i;
  const betweenMatch = workingQuery.match(betweenRegex);
  if (betweenMatch) {
    const minVal = parsePriceValue(betweenMatch[1]);
    const maxVal = parsePriceValue(betweenMatch[2]);
    if (minVal !== null && maxVal !== null) {
      filters.minPrice = Math.min(minVal, maxVal);
      filters.maxPrice = Math.max(minVal, maxVal);
      workingQuery = workingQuery.replace(betweenMatch[0], ' ');
      hasExtractedConstraint = true;
    }
  }

  // 2. Max Price Patterns: "under 1500", "below 20k", "less than 500", "< 1000", "within 2000", "upto 3000", "up to 3000"
  if (filters.maxPrice === undefined) {
    const maxPriceRegex = /\b(?:under|below|less than|within|upto|up to|<|<=)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?k?)\b/i;
    const maxMatch = workingQuery.match(maxPriceRegex);
    if (maxMatch) {
      const val = parsePriceValue(maxMatch[1]);
      if (val !== null) {
        filters.maxPrice = val;
        workingQuery = workingQuery.replace(maxMatch[0], ' ');
        hasExtractedConstraint = true;
      }
    }
  }

  // 3. Min Price Patterns: "above 1000", "over 2000", "more than 500", "> 500", "from 1000" (if not already matched)
  if (filters.minPrice === undefined) {
    const minPriceRegex = /\b(?:above|over|more than|>|>=)\s+(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?k?)\b/i;
    const minMatch = workingQuery.match(minPriceRegex);
    if (minMatch) {
      const val = parsePriceValue(minMatch[1]);
      if (val !== null) {
        filters.minPrice = val;
        workingQuery = workingQuery.replace(minMatch[0], ' ');
        hasExtractedConstraint = true;
      }
    }
  }

  // 4. Discount Patterns: "30% off", "min 40% discount", "at least 50% off"
  const discountRegex = /\b(?:at least|min|minimum)?\s*(\d{1,2})\s*%\s*(?:off|discount)?\b/i;
  const discountMatch = workingQuery.match(discountRegex);
  if (discountMatch) {
    const discountVal = parseInt(discountMatch[1], 10);
    if (!isNaN(discountVal) && discountVal > 0 && discountVal <= 90) {
      filters.minDiscount = discountVal;
      workingQuery = workingQuery.replace(discountMatch[0], ' ');
      hasExtractedConstraint = true;
    }
  }

  // 5. Rating Patterns: "4+ stars", "4 star", "rated 4 stars", "4 star rating"
  const ratingRegex = /\b(?:rated\s+)?([1-5])(?:\+|\s*star|\s*stars)\b/i;
  const ratingMatch = workingQuery.match(ratingRegex);
  if (ratingMatch) {
    const ratingVal = parseFloat(ratingMatch[1]);
    if (!isNaN(ratingVal) && ratingVal >= 1 && ratingVal <= 5) {
      filters.minRating = ratingVal;
      workingQuery = workingQuery.replace(ratingMatch[0], ' ');
      hasExtractedConstraint = true;
    }
  }

  // 6. Availability / In-Stock Patterns: "in stock", "available", "ready to ship"
  const stockRegex = /\b(?:in[\s-]stock|available\s+now|ready\s+to\s+ship)\b/i;
  if (stockRegex.test(workingQuery)) {
    filters.inStockOnly = true;
    workingQuery = workingQuery.replace(stockRegex, ' ');
    hasExtractedConstraint = true;
  }

  // 7. Gender & Demographic Attributes: "for men", "for women", "mens", "womens", "kids", "boys", "girls"
  const genderRegex = /\b(?:for\s+)?(men(?:'s)?|mens|women(?:'s)?|womens|ladies|kids|children|boys|girls)\b/i;
  const genderMatch = workingQuery.match(genderRegex);
  if (genderMatch) {
    const g = genderMatch[1].toLowerCase();
    if (g.startsWith('men')) {
      detectedAttributes.gender = 'men';
    } else if (g.startsWith('women') || g.startsWith('lad')) {
      detectedAttributes.gender = 'women';
    } else if (g.startsWith('kid') || g.startsWith('child') || g.startsWith('boy') || g.startsWith('girl')) {
      detectedAttributes.gender = 'kids';
    }
  }

  // 8. Clean up redundant connective words left behind (e.g., "with", "and", "having", "budget")
  let clean = workingQuery
    .replace(/\b(?:with|having|budget|price|cost|rated|rating)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If the query was purely a constraint (e.g. "under 1500"), keep original query as fallback
  if (!clean) {
    clean = query;
  }

  return {
    rawQuery: query,
    cleanQuery: clean,
    filters,
    detectedAttributes,
    isNaturalLanguage: hasExtractedConstraint
  };
}

/**
 * Optional Gemini AI Query Expansion
 * Expands conversational queries into semantic search concepts.
 * Fails safely within 400ms timeout with zero impact on search availability.
 */
export async function expandQueryWithGemini(query: string): Promise<string[]> {
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
  if (!apiKey || query.trim().length < 3) {
    return [];
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Use a lightweight, fast model for query term expansion
    const responsePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an e-commerce search assistant. Given the customer search query: "${query}", generate 3 to 5 related product search keywords or synonyms (comma-separated, lowercase, no commentary). Example for "gym wear": sportswear, activewear, running t-shirt, track pants.`,
    });

    // 400ms timeout guard
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 400));
    const result = await Promise.race([responsePromise, timeoutPromise]);

    if (!result || !result.text) {
      return [];
    }

    const text = result.text.trim();
    const terms = text
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 1 && t !== query.toLowerCase());

    return terms.slice(0, 5);
  } catch {
    // Graceful degradation when offline or unconfigured
    return [];
  }
}

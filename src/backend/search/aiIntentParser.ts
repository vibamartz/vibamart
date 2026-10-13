import { AiParsedIntent, AiDetectedEntity } from './searchTypes';

const KNOWN_COLORS = new Set([
  'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink',
  'purple', 'orange', 'brown', 'grey', 'gray', 'gold', 'silver',
  'titanium', 'navy', 'beige', 'maroon', 'teal', 'olive'
]);

const KNOWN_SIZES = new Set([
  'xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl',
  'uk 6', 'uk 7', 'uk 8', 'uk 9', 'uk 10', 'uk 11', 'uk 12'
]);

const GENDER_MAP: Record<string, string> = {
  'men': 'men',
  'mens': 'men',
  "men's": 'men',
  'women': 'women',
  'womens': 'women',
  "women's": 'women',
  'kids': 'kids',
  'boys': 'boys',
  'girls': 'girls'
};

function parseNumberWithUnit(valStr: string, unitStr?: string): number {
  let num = parseFloat(valStr.replace(/,/g, ''));
  if (isNaN(num)) return 0;
  const unit = (unitStr || '').toLowerCase().trim();
  if (unit === 'k') num *= 1000;
  else if (unit === 'lakh' || unit === 'lac' || unit === 'l') num *= 100000;
  return Math.round(num);
}

/**
 * Natural Language Query Understanding Engine.
 * Extracts price limits, discounts, ratings, colors, sizes, and brands from natural language queries.
 */
export class AiIntentParser {
  private knownBrands: Set<string> = new Set();
  private knownCategories: Map<string, string> = new Map(); // keyword -> categoryId

  constructor(knownBrands?: string[], categoryKeywords?: Record<string, string>) {
    if (knownBrands) {
      knownBrands.forEach(b => this.knownBrands.add(b.toLowerCase().trim()));
    }
    if (categoryKeywords) {
      for (const [kw, catId] of Object.entries(categoryKeywords)) {
        this.knownCategories.set(kw.toLowerCase().trim(), catId);
      }
    }
  }

  public setCatalogMetadata(brands: string[], categoryMap?: Map<string, string>) {
    this.knownBrands.clear();
    brands.forEach(b => {
      if (b && b.trim()) this.knownBrands.add(b.toLowerCase().trim());
    });
    if (categoryMap) {
      this.knownCategories = new Map(categoryMap);
    }
  }

  public parse(rawQuery: string): AiParsedIntent {
    const original = (rawQuery || '').trim();
    if (!original) {
      return {
        originalQuery: '',
        residualQuery: '',
        extractedFilters: {},
        confidence: 0,
        detectedEntities: []
      };
    }

    let query = original.toLowerCase();
    const detectedEntities: AiDetectedEntity[] = [];
    const extractedFilters: AiParsedIntent['extractedFilters'] = {};
    let confidence = 0.5;

    // 1. Price "Between X and Y"
    const betweenPriceRegex = /(?:between|from)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?\s*(?:and|to|-)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i;
    const betweenMatch = query.match(betweenPriceRegex);
    if (betweenMatch) {
      const min = parseNumberWithUnit(betweenMatch[1], betweenMatch[2]);
      const max = parseNumberWithUnit(betweenMatch[3], betweenMatch[4]);
      if (min > 0) extractedFilters.minPrice = min;
      if (max > 0) extractedFilters.maxPrice = max;
      detectedEntities.push({ entity: betweenMatch[0], type: 'price' });
      query = query.replace(betweenMatch[0], ' ');
      confidence += 0.2;
    }

    // 2. Price "Under / Below / Less than / Sub X"
    const underPriceRegex = /(?:under|below|less than|sub|within|up to|max)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i;
    const underMatch = query.match(underPriceRegex);
    if (underMatch) {
      const max = parseNumberWithUnit(underMatch[1], underMatch[2]);
      if (max > 0) {
        extractedFilters.maxPrice = max;
        detectedEntities.push({ entity: underMatch[0], type: 'price' });
        query = query.replace(underMatch[0], ' ');
        confidence += 0.2;
      }
    }

    // 3. Price "Above / Over / More than / Min X"
    const abovePriceRegex = /(?:above|over|more than|starting from|min)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakh|lac)?/i;
    const aboveMatch = query.match(abovePriceRegex);
    if (aboveMatch) {
      const min = parseNumberWithUnit(aboveMatch[1], aboveMatch[2]);
      if (min > 0) {
        extractedFilters.minPrice = min;
        detectedEntities.push({ entity: aboveMatch[0], type: 'price' });
        query = query.replace(aboveMatch[0], ' ');
        confidence += 0.2;
      }
    }

    // 4. Discounts ("over 20% off", "30% discount", "50% off")
    const discountRegex = /(?:at least|over|above|more than)?\s*(\d{1,2})\s*%\s*(?:off|discount)/i;
    const discountMatch = query.match(discountRegex);
    if (discountMatch) {
      const discount = parseInt(discountMatch[1], 10);
      if (discount > 0 && discount <= 100) {
        extractedFilters.minDiscount = discount;
        detectedEntities.push({ entity: discountMatch[0], type: 'discount' });
        query = query.replace(discountMatch[0], ' ');
        confidence += 0.15;
      }
    }

    // 5. Ratings ("best", "top rated", "highest rated", "4 star")
    if (/\b(?:best|top rated|highest rated|top-rated|best rated)\b/i.test(query)) {
      extractedFilters.minRating = 4;
      extractedFilters.sortBy = 'rating';
      detectedEntities.push({ entity: 'top rated', type: 'rating' });
      query = query.replace(/\b(?:best|top rated|highest rated|top-rated|best rated)\b/gi, ' ');
      confidence += 0.15;
    } else if (/\b([3-5])\s*(?:star|stars)\b/i.test(query)) {
      const starMatch = query.match(/\b([3-5])\s*(?:star|stars)\b/i);
      if (starMatch) {
        extractedFilters.minRating = parseInt(starMatch[1], 10);
        detectedEntities.push({ entity: starMatch[0], type: 'rating' });
        query = query.replace(starMatch[0], ' ');
        confidence += 0.1;
      }
    }

    // 6. Price Preferences ("cheap", "affordable", "budget", "expensive")
    if (/\b(?:cheap|cheapest|budget|affordable|low price|low cost)\b/i.test(query)) {
      extractedFilters.sortBy = 'price-asc';
      detectedEntities.push({ entity: 'budget', type: 'sort' });
      query = query.replace(/\b(?:cheap|cheapest|budget|affordable|low price|low cost)\b/gi, ' ');
      confidence += 0.1;
    } else if (/\b(?:expensive|luxury|premium|high end)\b/i.test(query)) {
      extractedFilters.sortBy = 'price-desc';
      detectedEntities.push({ entity: 'premium', type: 'sort' });
      query = query.replace(/\b(?:expensive|luxury|premium|high end)\b/gi, ' ');
      confidence += 0.1;
    } else if (/\b(?:latest|newest|new arrivals?)\b/i.test(query)) {
      extractedFilters.sortBy = 'newest';
      detectedEntities.push({ entity: 'newest', type: 'sort' });
      query = query.replace(/\b(?:latest|newest|new arrivals?)\b/gi, ' ');
      confidence += 0.1;
    }

    // 7. Demographics / Gender
    for (const [kw, gender] of Object.entries(GENDER_MAP)) {
      const genderRegex = new RegExp(`\\b${kw}\\b`, 'i');
      if (genderRegex.test(query)) {
        extractedFilters.gender = gender;
        detectedEntities.push({ entity: kw, type: 'gender' });
        // Retain gender token or strip preposition
        query = query.replace(new RegExp(`\\b(?:for\\s+)?${kw}\\b`, 'gi'), ' ');
        confidence += 0.1;
        break;
      }
    }

    // 8. Colors
    for (const color of KNOWN_COLORS) {
      const colorRegex = new RegExp(`\\b${color}\\b`, 'i');
      if (colorRegex.test(query)) {
        extractedFilters.color = color;
        detectedEntities.push({ entity: color, type: 'color' });
        // Keep or strip depending on whether it defines product color
        query = query.replace(new RegExp(`\\b(?:in\\s+)?${color}\\b`, 'gi'), ' ');
        confidence += 0.1;
        break;
      }
    }

    // 9. Brands (from known catalog brands)
    for (const brand of this.knownBrands) {
      if (brand.length < 2) continue;
      const brandRegex = new RegExp(`\\b${brand}\\b`, 'i');
      if (brandRegex.test(query)) {
        extractedFilters.brand = brand;
        detectedEntities.push({ entity: brand, type: 'brand' });
        // We do NOT completely strip the brand from text search so title matches still score high,
        // but we record it as a dedicated entity
        confidence += 0.2;
        break;
      }
    }

    // 10. Clean residual search query (stripping noise prepositions)
    let residual = query
      .replace(/\b(?:with|in|for|and|of|or|the|a|an)\b/gi, ' ')
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      originalQuery: original,
      residualQuery: residual || original,
      extractedFilters,
      confidence: Math.min(1, Math.round(confidence * 100) / 100),
      detectedEntities
    };
  }
}

import { IndexedProductDoc } from './searchEngine';
import { SearchParams, RecoveryRecommendation, AiParsedIntent } from './searchTypes';

export interface RecoveryPlan {
  relaxedParams: SearchParams;
  explanation: string;
  recommendations: RecoveryRecommendation[];
}

export class ZeroResultRecovery {
  /**
   * Evaluates a zero-result search query and attempts relaxation of restrictive filters.
   */
  public generateRecoveryPlan(
    originalParams: SearchParams,
    intent: AiParsedIntent,
    indexedDocs: Map<string, IndexedProductDoc>
  ): RecoveryPlan | null {
    const recommendations: RecoveryRecommendation[] = [];
    const relaxed: SearchParams = { ...originalParams };
    let hasRelaxation = false;
    let explanation = '';

    // 1. Check if an overly restrictive price ceiling caused zero results
    if (originalParams.maxPrice !== undefined || intent.extractedFilters.maxPrice !== undefined) {
      const maxPrice = originalParams.maxPrice ?? intent.extractedFilters.maxPrice;
      const targetQuery = intent.residualQuery || originalParams.q || '';

      // Find lowest available price for items matching the residual query or brand
      let lowestPrice = Infinity;
      let matchedBrandCount = 0;

      for (const doc of indexedDocs.values()) {
        if (doc.status === 'inactive' || !doc.isVisible || doc.isReward) continue;

        const matchesBrand = intent.extractedFilters.brand &&
          doc.brand.toLowerCase() === intent.extractedFilters.brand.toLowerCase();
        const matchesQuery = targetQuery &&
          doc.name.toLowerCase().includes(targetQuery.toLowerCase());

        if (matchesBrand || matchesQuery) {
          matchedBrandCount++;
          if (doc.effectivePrice < lowestPrice) lowestPrice = doc.effectivePrice;
        }
      }

      if (matchedBrandCount > 0 && lowestPrice > (maxPrice || 0)) {
        // Relax price filter
        delete relaxed.maxPrice;
        delete relaxed.minPrice;
        hasRelaxation = true;

        const brandName = intent.extractedFilters.brand ? ` ${intent.extractedFilters.brand}` : '';
        explanation = `We couldn't find${brandName} products under ₹${maxPrice}. Showing closest matching products starting at ₹${lowestPrice}.`;

        recommendations.push({
          text: `View all${brandName} products`,
          query: intent.extractedFilters.brand || targetQuery,
          type: 'relaxed_filter'
        });
      }
    }

    // 2. Check if color or size caused 0 results
    if (!hasRelaxation && (originalParams.color || intent.extractedFilters.color)) {
      const color = (originalParams.color || intent.extractedFilters.color) as string;
      delete relaxed.color;
      hasRelaxation = true;
      explanation = `No items found in "${color}". Showing available colors.`;

      recommendations.push({
        text: `Search without color filter`,
        query: intent.residualQuery || originalParams.q || '',
        type: 'relaxed_filter'
      });
    }

    // 3. Fallback recommendations for popular catalog categories & brands
    if (recommendations.length === 0) {
      const popularBrands = new Set<string>();
      const popularCats = new Set<string>();

      for (const doc of indexedDocs.values()) {
        if (doc.status === 'inactive' || !doc.isVisible || doc.isReward) continue;
        if (doc.brand && popularBrands.size < 3) popularBrands.add(doc.brand);
        if (doc.categoryName && popularCats.size < 3) popularCats.add(doc.categoryName);
      }

      popularBrands.forEach(b => {
        recommendations.push({
          text: `Explore ${b}`,
          query: b,
          type: 'popular_brand'
        });
      });

      popularCats.forEach(c => {
        recommendations.push({
          text: `Browse ${c}`,
          query: c,
          type: 'alternative_category'
        });
      });
    }

    if (hasRelaxation) {
      return {
        relaxedParams: relaxed,
        explanation,
        recommendations
      };
    }

    return recommendations.length > 0
      ? { relaxedParams: originalParams, explanation: '', recommendations }
      : null;
  }
}

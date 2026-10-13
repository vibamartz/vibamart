import { Product, IntelligentProductMatch, MatchConfidence, IntelligentMatchReason } from '../types';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'with', 'in', 'on', 'at', 'by',
  'to', 'from', 'up', 'down', 'is', 'are', 'was', 'were', 'it', 'its', 'be',
  'pack', 'combo', 'set', 'edition', 'series', 'premium', 'best', 'super', 'new'
]);

function extractKeywords(text?: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function normalizeWord(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

export class IntelligentProductMatcher {
  /**
   * Suggest inventory products similar to a selected set of reference products
   * based on product name, brand, attributes, tags, and existing category assignments.
   */
  public static matchSimilarProductsForSelection(
    selectedProducts: Product[],
    allProducts: Product[],
    options: { threshold?: number; maxResults?: number } = {}
  ): IntelligentProductMatch[] {
    if (!selectedProducts || selectedProducts.length === 0) return [];
    const { threshold = 25, maxResults = 25 } = options;
    const selectedIds = new Set(selectedProducts.map(p => p.id));

    // Aggregate features from selected products
    const brands = new Set(selectedProducts.map(p => (p.brand || '').toLowerCase().trim()).filter(Boolean));
    const categories = new Set(selectedProducts.map(p => p.categoryId).filter(Boolean));
    const subCategories = new Set(selectedProducts.map(p => p.subCategoryId).filter(Boolean));
    const tags = new Set(selectedProducts.flatMap(p => (p.tags || []).map(t => t.toLowerCase().trim())).filter(Boolean));
    
    // Aggregate keywords from selected product names
    const allKeywords = selectedProducts.flatMap(p => extractKeywords(p.name).map(normalizeWord));
    const keywordFreq = new Map<string, number>();
    allKeywords.forEach(k => keywordFreq.set(k, (keywordFreq.get(k) || 0) + 1));
    const prominentKeywords = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    // Average price
    const prices = selectedProducts.map(p => p.discountPrice || p.price || 0).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    const matches: IntelligentProductMatch[] = [];

    for (const candidate of allProducts) {
      if (selectedIds.has(candidate.id)) continue;

      let score = 0;
      const reasons: string[] = [];
      const detailedReasons: IntelligentMatchReason[] = [];

      // 1. Brand match
      const candidateBrand = (candidate.brand || '').toLowerCase().trim();
      if (candidateBrand && brands.has(candidateBrand)) {
        score += 35;
        reasons.push(`Same brand: "${candidate.brand}"`);
        detailedReasons.push({
          type: 'brand',
          message: `Shared brand (${candidate.brand})`,
          weight: 35
        });
      }

      // 2. Keyword overlap in name
      const candidateWords = extractKeywords(candidate.name).map(normalizeWord);
      const matchedWords = prominentKeywords.filter(k => candidateWords.includes(k));
      if (matchedWords.length > 0) {
        const keywordScore = Math.min(40, matchedWords.length * 15);
        score += keywordScore;
        reasons.push(`Title matches: "${matchedWords.slice(0, 3).join(', ')}"`);
        detailedReasons.push({
          type: 'keyword',
          message: `Shared keywords: ${matchedWords.slice(0, 3).join(', ')}`,
          weight: keywordScore
        });
      }

      // 3. Category & Subcategory alignment
      if (candidate.categoryId && categories.has(candidate.categoryId)) {
        let catScore = 15;
        if (candidate.subCategoryId && subCategories.has(candidate.subCategoryId)) {
          catScore += 15;
          reasons.push('Same subcategory');
        } else {
          reasons.push('Same category');
        }
        score += catScore;
        detailedReasons.push({
          type: 'category_path',
          message: 'Belongs to same existing category structure',
          weight: catScore
        });
      }

      // 4. Tags overlap
      const candidateTags = (candidate.tags || []).map(t => t.toLowerCase().trim());
      const sharedTags = candidateTags.filter(t => tags.has(t));
      if (sharedTags.length > 0) {
        const tagScore = Math.min(20, sharedTags.length * 10);
        score += tagScore;
        reasons.push(`Tags match: "${sharedTags.slice(0, 2).join(', ')}"`);
        detailedReasons.push({
          type: 'tag',
          message: `Shared tags: ${sharedTags.slice(0, 2).join(', ')}`,
          weight: tagScore
        });
      }

      // 5. Price proximity
      const candidatePrice = candidate.discountPrice || candidate.price || 0;
      if (avgPrice > 0 && candidatePrice > 0) {
        const diffRatio = Math.abs(candidatePrice - avgPrice) / avgPrice;
        if (diffRatio <= 0.3) {
          score += 10;
          reasons.push(`Similar price (₹${candidatePrice})`);
        }
      }

      const finalScore = Math.min(100, Math.max(0, score));

      if (finalScore >= threshold) {
        let confidence: MatchConfidence = 'low';
        if (finalScore >= 75) confidence = 'strong';
        else if (finalScore >= 50) confidence = 'good';
        else if (finalScore >= 30) confidence = 'fair';

        matches.push({
          product: candidate,
          score: finalScore,
          confidence,
          reasons,
          detailedReasons,
          isAlreadyAssigned: false,
          currentAssignments: []
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }
}

import { Product, FlatCategoryNode, IntelligentProductMatch, MatchConfidence, IntelligentMatchReason } from '../types';
import { isProductAssignedToNode } from './categoryHierarchyUtils';

// Common stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'all', 'any', 'new', 'top', 'best', 'shop', 'buy', 'online', 'viba', 'mart',
  'under', 'min', 'starting', 'off', 'deal', 'deals', 'sale', 'item', 'items', 'category'
]);

/**
 * Tokenize and normalize text into clean keywords
 */
export function extractKeywords(text?: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Stem/normalize common plural forms for matching
 */
function normalizeWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 3) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 2) return w.slice(0, -1);
  return w;
}

/**
 * Intelligent matcher that scores existing inventory products against a destination category
 */
export class IntelligentProductMatcher {
  /**
   * Match inventory products to a target category node
   */
  public static matchProductsForCategory(
    targetNode: FlatCategoryNode,
    products: Product[],
    options: {
      threshold?: number;
      userSearchQuery?: string;
      exemplarProducts?: Product[];
    } = {}
  ): IntelligentProductMatch[] {
    const { threshold = 30, userSearchQuery = '', exemplarProducts = [] } = options;

    const targetNameWords = extractKeywords(targetNode.name);
    const targetPathWords = extractKeywords(targetNode.breadcrumb);
    const targetOfferWords = extractKeywords(targetNode.offerText || '');
    const combinedTargetKeywords = Array.from(new Set([...targetNameWords, ...targetPathWords, ...targetOfferWords]));

    // Exemplar profile if products are already assigned to this category
    const exemplarBrands = new Set(exemplarProducts.map(p => p.brand?.toLowerCase()).filter(Boolean));
    const exemplarTags = new Set(exemplarProducts.flatMap(p => p.tags || []).map(t => t.toLowerCase()));
    const exemplarAvgPrice = exemplarProducts.length > 0
      ? exemplarProducts.reduce((sum, p) => sum + (p.discountPrice || p.price || 0), 0) / exemplarProducts.length
      : 0;

    const results: IntelligentProductMatch[] = [];

    for (const product of products) {
      const detailedReasons: IntelligentMatchReason[] = [];
      let totalScore = 0;

      // Check if product is already assigned
      const isAlreadyAssigned = isProductAssignedToNode(product, targetNode);

      // Search query filtering if user provided search
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase().trim();
        const prodText = [
          product.name,
          product.brand,
          product.sku,
          product.productCode,
          ...(product.tags || [])
        ].filter(Boolean).join(' ').toLowerCase();

        if (!prodText.includes(q)) {
          continue; // Skip products not matching user search filter
        }
      }

      const prodName = (product.name || '').toLowerCase();
      const prodNameWords = extractKeywords(product.name).map(normalizeWord);
      const prodTags = (product.tags || []).map(t => t.toLowerCase());
      const prodBrand = (product.brand || '').toLowerCase();
      const prodDesc = (product.description || '').toLowerCase();

      // 1. Direct name phrase match
      if (targetNode.name && prodName.includes(targetNode.name.toLowerCase())) {
        totalScore += 50;
        detailedReasons.push({
          type: 'exact_name',
          message: `Product title explicitly matches "${targetNode.name}"`,
          weight: 50
        });
      } else {
        // Keyword overlap in product name
        let matchedKeywordsCount = 0;
        const matchedKeywords: string[] = [];
        for (const kw of targetNameWords) {
          const normKw = normalizeWord(kw);
          if (prodNameWords.includes(normKw) || prodName.includes(kw)) {
            matchedKeywordsCount++;
            matchedKeywords.push(kw);
          }
        }

        if (matchedKeywordsCount > 0) {
          const scoreAdd = Math.min(45, matchedKeywordsCount * 20);
          totalScore += scoreAdd;
          detailedReasons.push({
            type: 'keyword',
            message: `Title matches category terms: "${matchedKeywords.join(', ')}"`,
            weight: scoreAdd
          });
        }
      }

      // 2. Breadcrumb / Parent path match
      const pathMatches = targetPathWords.filter(pw => {
        const norm = normalizeWord(pw);
        return prodNameWords.includes(norm) || prodTags.some(t => t.includes(pw));
      });
      if (pathMatches.length > 0 && detailedReasons.every(r => r.type !== 'exact_name')) {
        const pathScore = Math.min(25, pathMatches.length * 10);
        totalScore += pathScore;
        detailedReasons.push({
          type: 'category_path',
          message: `Aligns with hierarchy keywords: "${pathMatches.slice(0, 3).join(', ')}"`,
          weight: pathScore
        });
      }

      // 3. Product Tags match
      const matchingTags = prodTags.filter(t =>
        combinedTargetKeywords.some(kw => t.includes(kw) || kw.includes(t))
      );
      if (matchingTags.length > 0) {
        const tagScore = Math.min(25, matchingTags.length * 10);
        totalScore += tagScore;
        detailedReasons.push({
          type: 'tag',
          message: `Search tags match category: "${matchingTags.slice(0, 3).join(', ')}"`,
          weight: tagScore
        });
      }

      // 4. Specifications match
      if (product.specifications && Array.isArray(product.specifications)) {
        const matchedSpecs = product.specifications.filter(s =>
          combinedTargetKeywords.some(kw =>
            s.key.toLowerCase().includes(kw) || s.value.toLowerCase().includes(kw)
          )
        );
        if (matchedSpecs.length > 0) {
          totalScore += 20;
          detailedReasons.push({
            type: 'spec',
            message: `Product specifications match: ${matchedSpecs[0].key} (${matchedSpecs[0].value})`,
            weight: 20
          });
        }
      }

      // 5. Brand alignment
      if (prodBrand && (targetNameWords.includes(prodBrand) || exemplarBrands.has(prodBrand))) {
        totalScore += 15;
        detailedReasons.push({
          type: 'brand',
          message: `Brand "${product.brand}" strongly aligned with category`,
          weight: 15
        });
      }

      // 6. Exemplar similarity (if category has existing products)
      if (exemplarProducts.length > 0) {
        let exemplarBonus = 0;
        if (prodBrand && exemplarBrands.has(prodBrand)) exemplarBonus += 10;
        const sharedExemplarTags = prodTags.filter(t => exemplarTags.has(t));
        if (sharedExemplarTags.length > 0) exemplarBonus += 10;

        const price = product.discountPrice || product.price || 0;
        if (exemplarAvgPrice > 0 && price > 0) {
          const ratio = Math.abs(price - exemplarAvgPrice) / exemplarAvgPrice;
          if (ratio < 0.35) exemplarBonus += 10; // Within 35% of category price range
        }

        if (exemplarBonus > 0) {
          totalScore += exemplarBonus;
          detailedReasons.push({
            type: 'exemplar_similarity',
            message: 'Strong similarity to products already active in this category',
            weight: exemplarBonus
          });
        }
      }

      // 7. Sibling / Existing Category overlap
      if (targetNode.level !== 'category' && product.categoryId === targetNode.pathIds[0]) {
        totalScore += 10;
      }

      // Normalize score between 0 and 100
      const finalScore = Math.min(100, Math.max(0, totalScore));

      if (finalScore >= threshold || isAlreadyAssigned) {
        let confidence: MatchConfidence = 'low';
        if (finalScore >= 75) confidence = 'strong';
        else if (finalScore >= 50) confidence = 'good';
        else if (finalScore >= 30) confidence = 'fair';

        const humanReasons = detailedReasons.length > 0
          ? detailedReasons.map(r => r.message)
          : [`Matches terms in ${targetNode.name}`];

        results.push({
          product,
          score: finalScore,
          confidence,
          reasons: humanReasons,
          detailedReasons,
          isAlreadyAssigned,
          currentAssignments: []
        });
      }
    }

    // Sort descending by score
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Match inventory products similar to a chosen reference product
   */
  public static matchSimilarProductsToProduct(
    referenceProduct: Product,
    products: Product[],
    options: { threshold?: number } = {}
  ): IntelligentProductMatch[] {
    const { threshold = 30 } = options;
    const refBrand = (referenceProduct.brand || '').toLowerCase();
    const refNameWords = extractKeywords(referenceProduct.name).map(normalizeWord);
    const refTags = new Set((referenceProduct.tags || []).map(t => t.toLowerCase()));
    const refPrice = referenceProduct.discountPrice || referenceProduct.price || 0;

    const results: IntelligentProductMatch[] = [];

    for (const product of products) {
      if (product.id === referenceProduct.id) continue;

      let score = 0;
      const reasons: string[] = [];

      // Same brand
      const prodBrand = (product.brand || '').toLowerCase();
      if (refBrand && prodBrand === refBrand) {
        score += 30;
        reasons.push(`Same brand: ${referenceProduct.brand}`);
      }

      // Title keyword overlap
      const prodNameWords = extractKeywords(product.name).map(normalizeWord);
      const matchingWords = refNameWords.filter(w => prodNameWords.includes(w));
      if (matchingWords.length > 0) {
        const titleScore = Math.min(40, matchingWords.length * 15);
        score += titleScore;
        reasons.push(`Matches product keywords: "${matchingWords.slice(0, 3).join(', ')}"`);
      }

      // Same existing category or subcategory
      if (product.categoryId && product.categoryId === referenceProduct.categoryId) {
        score += 15;
        if (product.subCategoryId && product.subCategoryId === referenceProduct.subCategoryId) {
          score += 10;
          reasons.push('Same primary subcategory');
        } else {
          reasons.push('Same primary category');
        }
      }

      // Tag overlap
      const prodTags = (product.tags || []).map(t => t.toLowerCase());
      const matchingTags = prodTags.filter(t => refTags.has(t));
      if (matchingTags.length > 0) {
        score += 15;
        reasons.push(`Shared search tags: "${matchingTags.slice(0, 2).join(', ')}"`);
      }

      // Price proximity
      const prodPrice = product.discountPrice || product.price || 0;
      if (refPrice > 0 && prodPrice > 0) {
        const diffRatio = Math.abs(prodPrice - refPrice) / refPrice;
        if (diffRatio <= 0.25) {
          score += 15;
          reasons.push(`Similar price point: ₹${prodPrice} vs ₹${refPrice}`);
        }
      }

      const finalScore = Math.min(100, Math.max(0, score));

      if (finalScore >= threshold) {
        let confidence: MatchConfidence = 'low';
        if (finalScore >= 75) confidence = 'strong';
        else if (finalScore >= 50) confidence = 'good';
        else if (finalScore >= 30) confidence = 'fair';

        results.push({
          product,
          score: finalScore,
          confidence,
          reasons,
          isAlreadyAssigned: false,
          currentAssignments: []
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

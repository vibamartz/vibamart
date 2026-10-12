import { Product, FlatCategoryNode, IntelligentProductMatch, IntelligentMatchReason, MatchConfidence } from '../types';
import { isProductAssignedToNode } from './categoryHierarchyUtils';

// ==========================================
// 1. Comprehensive Domain Synonym & Lexicon
// ==========================================
interface SynonymGroup {
  canonical: string;
  terms: string[];
}

const SYNONYM_GROUPS: SynonymGroup[] = [
  // Fashion - Tops
  {
    canonical: 'shirt',
    terms: ['shirt', 'shirts', 't-shirt', 'tshirt', 't-shirts', 'tshirts', 'tee', 'tees', 'polo', 'button-down', 'button-up', 'top', 'tops', 'topwear', 'formal shirt', 'casual shirt', 'henley']
  },
  {
    canonical: 'tshirt',
    terms: ['tshirt', 't-shirt', 't-shirts', 'tshirts', 'tee', 'tees', 'crewneck', 'v-neck', 'polo tee', 'graphic tee', 'oversized tee']
  },
  {
    canonical: 'jacket',
    terms: ['jacket', 'jackets', 'coat', 'coats', 'blazer', 'blazers', 'overcoat', 'hoodie', 'hoodies', 'sweatshirt', 'sweatshirts', 'sweater', 'sweaters', 'cardigan', 'cardigans', 'pullover', 'windcheater', 'shacket', 'bomber jacket', 'leather jacket', 'denim jacket']
  },
  // Fashion - Bottoms
  {
    canonical: 'pants',
    terms: ['pants', 'pant', 'trousers', 'trouser', 'jeans', 'jean', 'denim', 'denims', 'chinos', 'chino', 'joggers', 'jogger', 'cargos', 'cargo', 'track pants', 'trackpants', 'bottomwear', 'sweatpants']
  },
  {
    canonical: 'jeans',
    terms: ['jeans', 'jean', 'denim', 'denims', 'skinny jeans', 'slim fit jeans', 'straight fit jeans', 'baggy jeans', 'distressed denim']
  },
  {
    canonical: 'shorts',
    terms: ['shorts', 'short', 'bermuda', 'boxer shorts', 'cargo shorts', 'swimming trunks', 'boardshorts']
  },
  // Fashion - Ethnic
  {
    canonical: 'ethnic',
    terms: ['kurta', 'kurtas', 'kurti', 'kurtis', 'saree', 'sarees', 'sari', 'saris', 'lehenga', 'choli', 'salwar', 'kameez', 'dupatta', 'sherwani', 'pyjama', 'ethnic wear', 'traditional', 'anarkali']
  },
  // Fashion - Footwear
  {
    canonical: 'footwear',
    terms: ['shoes', 'shoe', 'footwear', 'sneakers', 'sneaker', 'loafers', 'loafer', 'boots', 'boot', 'sandals', 'sandal', 'slippers', 'slipper', 'flip flops', 'flip-flops', 'slides', 'clogs', 'heels', 'flats', 'oxfords', 'derby', 'running shoes', 'sports shoes', 'casual shoes', 'formal shoes', 'moccasins', 'jutti']
  },
  {
    canonical: 'sneakers',
    terms: ['sneakers', 'sneaker', 'kicks', 'trainers', 'running shoes', 'athletic shoes', 'sports shoes', 'canvas shoes', 'casual shoes']
  },
  // Electronics - Mobiles & Gadgets
  {
    canonical: 'mobile',
    terms: ['mobile', 'mobiles', 'smartphone', 'smartphones', 'phone', 'phones', 'cellphone', 'cell phone', 'handset', 'android', 'iphone', 'cellular']
  },
  {
    canonical: 'laptop',
    terms: ['laptop', 'laptops', 'notebook', 'notebooks', 'macbook', 'ultrabook', 'chromebook', 'computer', 'pc']
  },
  {
    canonical: 'audio',
    terms: ['headphones', 'headphone', 'earphones', 'earphone', 'earbuds', 'earbud', 'tws', 'airpods', 'headset', 'neckband', 'speakers', 'speaker', 'soundbar', 'bluetooth speaker']
  },
  {
    canonical: 'wearables',
    terms: ['smartwatch', 'smart watch', 'smartwatches', 'fitness tracker', 'fitness band', 'smart band', 'watch', 'watches', 'chronograph', 'analog watch', 'digital watch']
  },
  {
    canonical: 'accessories',
    terms: ['charger', 'cable', 'adapter', 'powerbank', 'power bank', 'cover', 'case', 'screen protector', 'tempered glass', 'skin', 'stand', 'mount', 'dock']
  },
  // Home & Kitchen
  {
    canonical: 'cookware',
    terms: ['cookware', 'pan', 'pans', 'pot', 'pots', 'kadai', 'kadhai', 'tawa', 'fry pan', 'pressure cooker', 'saucepan', 'casserole', 'wok', 'utensil', 'utensils', 'cooktop', 'induction cookware']
  },
  {
    canonical: 'appliances',
    terms: ['mixer', 'grinder', 'mixer grinder', 'blender', 'juicer', 'toaster', 'kettle', 'electric kettle', 'microwave', 'oven', 'air fryer', 'sandwich maker', 'chimney', 'water purifier', 'geyser', 'iron']
  },
  {
    canonical: 'home_decor',
    terms: ['bedsheet', 'bedsheets', 'bed cover', 'pillow', 'pillows', 'cushion', 'cushions', 'curtain', 'curtains', 'blanket', 'comforter', 'quilt', 'carpet', 'rug', 'mat', 'towel', 'towels', 'clock', 'wall art', 'lamp', 'lamps', 'lighting']
  },
  // Beauty, Personal Care & Grooming
  {
    canonical: 'skincare',
    terms: ['skincare', 'skin care', 'moisturizer', 'cream', 'face cream', 'face wash', 'facewash', 'cleanser', 'serum', 'lotion', 'body lotion', 'sunscreen', 'sunblock', 'toner', 'face scrub', 'sheet mask', 'lip balm']
  },
  {
    canonical: 'haircare',
    terms: ['shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair wax', 'hair gel', 'hair color', 'hair mask']
  },
  {
    canonical: 'fragrance',
    terms: ['perfume', 'perfumes', 'deodorant', 'deodorants', 'deo', 'body spray', 'fragrance', 'cologne', 'eau de parfum', 'body mist']
  },
  {
    canonical: 'grooming',
    terms: ['trimmer', 'shaver', 'razor', 'beard oil', 'beard wash', 'shaving cream', 'aftershave', 'grooming kit']
  },
  {
    canonical: 'makeup',
    terms: ['makeup', 'lipstick', 'lipsticks', 'kajal', 'eyeliner', 'mascara', 'foundation', 'compact powder', 'concealer', 'blush', 'nail polish', 'primer', 'makeup remover']
  },
  // Toys & Kids
  {
    canonical: 'toys',
    terms: ['toy', 'toys', 'game', 'games', 'board game', 'puzzle', 'puzzles', 'action figure', 'doll', 'dolls', 'lego', 'building blocks', 'rc car', 'remote control', 'soft toy', 'teddy bear', 'educational toy']
  },
  // Groceries & Staples
  {
    canonical: 'staples',
    terms: ['rice', 'basmati', 'atta', 'flour', 'wheat', 'dal', 'pulses', 'lentils', 'oil', 'cooking oil', 'mustard oil', 'sunflower oil', 'ghee', 'spices', 'masala', 'turmeric', 'chilli', 'salt', 'sugar']
  },
  {
    canonical: 'snacks',
    terms: ['biscuit', 'biscuits', 'cookie', 'cookies', 'namkeen', 'bhujia', 'chips', 'crisps', 'rusks', 'chocolate', 'chocolates', 'sweets', 'dry fruits', 'almonds', 'cashews', 'walnuts']
  }
];

// Map each term to its set of synonyms for O(1) lookup
const TERM_TO_SYNONYMS = new Map<string, Set<string>>();

SYNONYM_GROUPS.forEach(group => {
  const allTerms = group.terms.map(t => t.toLowerCase().trim());
  allTerms.forEach(term => {
    let existing = TERM_TO_SYNONYMS.get(term);
    if (!existing) {
      existing = new Set<string>();
      TERM_TO_SYNONYMS.set(term, existing);
    }
    allTerms.forEach(other => {
      if (other !== term) existing.add(other);
    });
  });
});

// Common stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'on', 'at', 'to', 'from', 'by', 'of',
  'is', 'are', 'was', 'were', 'it', 'its', 'all', 'new', 'best', 'top', 'pack', 'set', 'pcs',
  'under', 'over', 'off', 'deal', 'deals', 'sale', 'save', 'special', 'premium', 'ultra', 'combo', 'get'
]);

// Generic terms that shouldn't match alone without a noun
const GENERIC_MODIFIERS = new Set([
  'black', 'white', 'blue', 'red', 'green', 'yellow', 'grey', 'gray', 'pink', 'brown', 'cotton',
  'leather', 'silk', 'wool', 'linen', 'polyester', 'metal', 'plastic', 'wooden', 'pure', 'natural',
  'slim', 'regular', 'fit', 'size', 'printed', 'solid', 'striped', 'check', 'plain', 'stylish',
  'classic', 'modern', 'casual', 'formal', 'portable', 'mini', 'pro', 'max', 'plus', 'air', 'lite'
]);

// Gender token sets for safety guard
const MALE_TOKENS = new Set(['men', 'mens', "men's", 'male', 'boy', 'boys', 'gentleman', 'gents']);
const FEMALE_TOKENS = new Set(['women', 'womens', "women's", 'female', 'girl', 'girls', 'ladies', 'lady', 'saree', 'bra', 'lingerie', 'kurti', 'blouse']);

// Core device vs accessory guard
const ACCESSORY_INDICATORS = new Set([
  'case', 'cover', 'back cover', 'tempered glass', 'screen protector', 'skin', 'protective glass',
  'adapter', 'cable', 'strap', 'band replacement', 'pouch', 'holder'
]);
const CORE_DEVICE_CATEGORIES = new Set([
  'smartphones', 'smartphone', 'mobile phones', 'mobile phone', 'mobiles', 'laptops', 'laptop', 'tablets', 'tablet'
]);

// ==========================================
// 2. String & NLP Token Utilities
// ==========================================

/**
 * Tokenize and normalize text into meaningful words
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s,/_|#\-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Basic lemmatization / singularization
 */
export function stemWord(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('es') && w.length > 4) {
    if (w.endsWith('shes') || w.endsWith('ches') || w.endsWith('sses') || w.endsWith('xes')) {
      return w.slice(0, -2);
    }
  }
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Calculate Damerau-Levenshtein normalized similarity ratio [0, 1]
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[a.length][b.length];
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - distance / maxLen);
}

// ==========================================
// 3. Intelligent Matcher Engine
// ==========================================

export interface MatcherOptions {
  threshold?: number; // 0 - 100, default 40
  userSearchQuery?: string; // Additional manual search term
  onlyInStock?: boolean;
  filterAlreadyAssigned?: boolean;
  exemplarProducts?: Product[]; // Products currently in this category to learn from
}

export class IntelligentProductMatcher {
  /**
   * Find and rank matching products for a target category hierarchy node
   */
  public static matchProductsForCategory(
    targetNode: FlatCategoryNode,
    allProducts: Product[],
    options: MatcherOptions = {}
  ): IntelligentProductMatch[] {
    const {
      threshold = 40,
      userSearchQuery = '',
      onlyInStock = false,
      filterAlreadyAssigned = false,
      exemplarProducts = []
    } = options;

    if (!targetNode || !allProducts || allProducts.length === 0) return [];

    // Extract target category features
    const targetName = targetNode.name.toLowerCase();
    const targetBreadcrumb = targetNode.breadcrumb.toLowerCase();
    const targetTokens = tokenizeText(targetNode.name);
    const targetStemTokens = targetTokens.map(stemWord);
    const targetPathTokens = tokenizeText(targetNode.pathNames.join(' '));

    // Compile synonyms for target terms
    const targetSynonyms = new Set<string>();
    targetTokens.forEach(t => {
      const syns = TERM_TO_SYNONYMS.get(t) || TERM_TO_SYNONYMS.get(stemWord(t));
      if (syns) {
        syns.forEach(s => targetSynonyms.add(s));
      }
    });

    // Check target category gender context
    const isTargetMen = targetPathTokens.some(t => MALE_TOKENS.has(t));
    const isTargetWomen = targetPathTokens.some(t => FEMALE_TOKENS.has(t));

    // Check target category device context
    const isTargetCoreDevice = Array.from(CORE_DEVICE_CATEGORIES).some(cdc =>
      targetNode.name.toLowerCase().includes(cdc) ||
      targetNode.breadcrumb.toLowerCase().includes(cdc) ||
      targetNode.id.toLowerCase().includes(cdc)
    );
    const isTargetAccessory = targetNode.name.toLowerCase().includes('case') ||
      targetNode.name.toLowerCase().includes('cover') ||
      targetNode.name.toLowerCase().includes('accessories');

    // Exemplar profile (learned from existing category products)
    const exemplarBrands = new Set<string>();
    const exemplarTags = new Set<string>();
    if (exemplarProducts && exemplarProducts.length > 0) {
      exemplarProducts.forEach(p => {
        if (p.brand) exemplarBrands.add(p.brand.toLowerCase());
        (p.tags || []).forEach(t => exemplarTags.add(t.toLowerCase()));
      });
    }

    const manualSearchTokens = tokenizeText(userSearchQuery);

    const matches: IntelligentProductMatch[] = [];

    for (const product of allProducts) {
      // 1. Basic status and stock filtering
      if (onlyInStock && (product.stock === undefined || product.stock <= 0)) {
        continue;
      }

      const isAlreadyAssigned = isProductAssignedToNode(product, targetNode);
      if (filterAlreadyAssigned && isAlreadyAssigned) {
        continue;
      }

      // Compile current product text fields
      const pName = (product.name || '').toLowerCase();
      const pBrand = (product.brand || '').toLowerCase();
      const pSku = (product.sku || '').toLowerCase();
      const pCode = (product.productCode || '').toLowerCase();
      const pDesc = (product.description || '').toLowerCase();
      const pFullDesc = (product.fullDescription || '').toLowerCase();
      const pTags = (product.tags || []).map(t => t.toLowerCase());

      const pNameTokens = tokenizeText(pName);
      const pNameStemTokens = pNameTokens.map(stemWord);
      const pAllTokens = new Set<string>([
        ...pNameTokens,
        ...tokenizeText(pDesc),
        ...pTags
      ]);

      // Manual search query override / gate
      if (manualSearchTokens.length > 0) {
        const matchesManual = manualSearchTokens.every(st => {
          return pName.includes(st) ||
            pBrand.includes(st) ||
            pSku.includes(st) ||
            pCode.includes(st) ||
            pTags.some(t => t.includes(st)) ||
            pDesc.includes(st);
        });
        if (!matchesManual) continue;
      }

      const reasons: IntelligentMatchReason[] = [];
      let rawScore = 0;

      // ----------------------------------------------------
      // SIGNAL 1: Exact / Normalized Category Name in Title
      // ----------------------------------------------------
      if (pName.includes(targetName)) {
        rawScore += 45;
        reasons.push({
          type: 'exact_name',
          message: `Category name "${targetNode.name}" appears directly in product title`,
          weight: 45
        });
      } else {
        // Multi-token match in product title
        const matchedTitleTokens = targetTokens.filter(tt => {
          const st = stemWord(tt);
          return pNameTokens.includes(tt) || pNameStemTokens.includes(st);
        });

        if (matchedTitleTokens.length === targetTokens.length && targetTokens.length > 0) {
          rawScore += 38;
          reasons.push({
            type: 'keyword',
            message: `All key category words (${matchedTitleTokens.join(', ')}) matched in title`,
            weight: 38
          });
        } else if (matchedTitleTokens.length > 0) {
          const ratio = matchedTitleTokens.length / Math.max(1, targetTokens.length);
          const pts = Math.round(25 * ratio);
          rawScore += pts;
          reasons.push({
            type: 'keyword',
            message: `Category terms matched in title: ${matchedTitleTokens.join(', ')}`,
            weight: pts
          });
        }
      }

      // ----------------------------------------------------
      // SIGNAL 2: Synonyms & Semantic Vocabulary
      // ----------------------------------------------------
      const matchedSynonyms: string[] = [];
      targetSynonyms.forEach(syn => {
        if (pName.includes(syn) || pTags.includes(syn)) {
          matchedSynonyms.push(syn);
        }
      });

      if (matchedSynonyms.length > 0) {
        const pts = Math.min(25, matchedSynonyms.length * 12);
        rawScore += pts;
        reasons.push({
          type: 'synonym',
          message: `Semantic synonyms matched: "${matchedSynonyms.slice(0, 3).join(', ')}"`,
          weight: pts
        });
      }

      // ----------------------------------------------------
      // SIGNAL 3: Typo & Spelling Fuzzy Variation Matching
      // ----------------------------------------------------
      let bestFuzzyRatio = 0;
      let bestFuzzyPair = '';
      for (const tToken of targetTokens) {
        for (const pToken of pNameTokens) {
          if (tToken.length >= 4 && pToken.length >= 4 && !STOP_WORDS.has(pToken)) {
            const sim = calculateStringSimilarity(tToken, pToken);
            if (sim > 0.82 && sim < 1.0 && sim > bestFuzzyRatio) {
              bestFuzzyRatio = sim;
              bestFuzzyPair = `"${pToken}" ≈ "${tToken}"`;
            }
          }
        }
      }

      if (bestFuzzyRatio > 0.82) {
        rawScore += 15;
        reasons.push({
          type: 'keyword',
          message: `Spelling / variation match: ${bestFuzzyPair} (${Math.round(bestFuzzyRatio * 100)}% match)`,
          weight: 15
        });
      }

      // ----------------------------------------------------
      // SIGNAL 4: Product Tags & Keywords Match
      // ----------------------------------------------------
      const matchedTags = pTags.filter(t => {
        return targetTokens.some(tt => t.includes(tt) || calculateStringSimilarity(t, tt) > 0.8) ||
          targetSynonyms.has(t);
      });

      if (matchedTags.length > 0) {
        const pts = Math.min(18, matchedTags.length * 8);
        rawScore += pts;
        reasons.push({
          type: 'tag',
          message: `Inventory search tags match: ${matchedTags.slice(0, 4).join(', ')}`,
          weight: pts
        });
      }

      // ----------------------------------------------------
      // SIGNAL 5: Category Path & Parent Hierarchy Alignment
      // ----------------------------------------------------
      const matchedPathWords = targetNode.pathNames.filter(pn => {
        const pnLower = pn.toLowerCase();
        return pName.includes(pnLower) || pDesc.includes(pnLower) || pTags.includes(pnLower);
      });

      if (matchedPathWords.length > 0) {
        const pts = Math.min(15, matchedPathWords.length * 6);
        rawScore += pts;
        reasons.push({
          type: 'category_path',
          message: `Matches hierarchy path (${matchedPathWords.join(' > ')})`,
          weight: pts
        });
      }

      // ----------------------------------------------------
      // SIGNAL 6: Specifications & Variant Attributes
      // ----------------------------------------------------
      let specMatchFound = false;
      if (product.specifications && product.specifications.length > 0) {
        for (const spec of product.specifications) {
          const specVal = (spec.value || '').toLowerCase();
          const specKey = (spec.key || '').toLowerCase();
          if (targetTokens.some(tt => specVal.includes(tt) || specKey.includes(tt))) {
            specMatchFound = true;
            rawScore += 10;
            reasons.push({
              type: 'spec',
              message: `Specification match: ${spec.key} = "${spec.value}"`,
              weight: 10
            });
            break;
          }
        }
      }

      // ----------------------------------------------------
      // SIGNAL 7: Exemplar Similarity (Learned from assigned products)
      // ----------------------------------------------------
      if (exemplarBrands.size > 0 && pBrand && exemplarBrands.has(pBrand)) {
        rawScore += 10;
        reasons.push({
          type: 'exemplar_similarity',
          message: `Brand "${product.brand}" matches existing approved products in this category`,
          weight: 10
        });
      }

      // ----------------------------------------------------
      // SIGNAL 8: Image Filename Clues
      // ----------------------------------------------------
      if (product.images && product.images.length > 0) {
        const firstImg = product.images[0].toLowerCase();
        const hasImgClue = targetTokens.some(tt => tt.length >= 4 && firstImg.includes(tt));
        if (hasImgClue) {
          rawScore += 5;
        }
      }

      // ----------------------------------------------------
      // SAFETY GUARDS & NEGATIVE PENALTIES
      // ----------------------------------------------------

      // 1. Gender audience mismatch penalty
      const isProductMen = Array.from(pAllTokens).some(t => MALE_TOKENS.has(t));
      const isProductWomen = Array.from(pAllTokens).some(t => FEMALE_TOKENS.has(t));

      if (isTargetMen && isProductWomen && !isProductMen) {
        rawScore -= 50;
        reasons.push({
          type: 'category_path',
          message: `Safety penalty: Product is tagged as Women's apparel, but target is Men's category`,
          weight: -50
        });
      } else if (isTargetWomen && isProductMen && !isProductWomen) {
        rawScore -= 50;
        reasons.push({
          type: 'category_path',
          message: `Safety penalty: Product is tagged as Men's apparel, but target is Women's category`,
          weight: -50
        });
      }

      // 2. Core Device vs Accessory mismatch penalty
      const isProductAccessory = Array.from(pAllTokens).some(t => ACCESSORY_INDICATORS.has(t)) ||
        pName.includes('case') || pName.includes('cover') || pName.includes('tempered glass');

      if (isTargetCoreDevice && !isTargetAccessory && isProductAccessory) {
        rawScore = Math.min(rawScore - 60, 20);
        reasons.push({
          type: 'keyword',
          message: `Safety penalty: Accessory (case/cover/glass) detected for core device category`,
          weight: -60
        });
      }

      // 3. Generic word only without domain match guard
      const nonGenericTargetTokens = targetTokens.filter(t => !GENERIC_MODIFIERS.has(t));
      const hasDomainMatch = nonGenericTargetTokens.some(nt => pNameTokens.includes(nt) || targetSynonyms.has(nt));
      if (!hasDomainMatch && nonGenericTargetTokens.length > 0 && rawScore < 30) {
        // Product only matched generic modifiers like "black", "cotton", "regular"
        rawScore = Math.min(rawScore, 15);
      }

      // Final score normalization
      const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

      // If user provided a manual search query, give an extra relevancy boost
      let adjustedScore = finalScore;
      if (manualSearchTokens.length > 0 && finalScore < 50) {
        adjustedScore = Math.max(finalScore, 60);
      }

      // Check if meets threshold
      if (adjustedScore >= threshold) {
        let confidence: MatchConfidence = 'low';
        if (adjustedScore >= 80) confidence = 'strong';
        else if (adjustedScore >= 60) confidence = 'good';
        else if (adjustedScore >= 40) confidence = 'fair';

        // Current assignment context labels
        const currentAssignments: string[] = [];
        if (product.categoryId) currentAssignments.push(`Category: ${product.categoryId}`);
        if (product.subCategoryId) currentAssignments.push(`Subcategory: ${product.subCategoryId}`);
        if (product.nestedSubCategoryId) currentAssignments.push(`Nested: ${product.nestedSubCategoryId}`);
        if (product.visualNestedSubcategoryId) currentAssignments.push(`Visual: ${product.visualNestedSubcategoryId}`);

        matches.push({
          product,
          score: adjustedScore,
          confidence,
          reasons: reasons.map(r => r.message),
          detailedReasons: reasons,
          isAlreadyAssigned,
          currentAssignments
        });
      }
    }

    // Sort by:
    // 1. Unassigned first (if scores are comparable)
    // 2. Score descending
    // 3. In-stock products first
    matches.sort((a, b) => {
      if (Math.abs(b.score - a.score) >= 10) {
        return b.score - a.score;
      }
      if (a.isAlreadyAssigned !== b.isAlreadyAssigned) {
        return a.isAlreadyAssigned ? 1 : -1;
      }
      const aStock = a.product.stock || 0;
      const bStock = b.product.stock || 0;
      if ((aStock > 0) !== (bStock > 0)) {
        return bStock > 0 ? 1 : -1;
      }
      return b.score - a.score;
    });

    return matches;
  }
}

import { IndexedProductDoc } from './searchEngine';
import { hasSynonym, getAllSynonymTerms } from './searchSynonyms';

export interface CorrectedTerm {
  from: string;
  to: string;
  distance: number;
}

export interface SpellingCorrectionResult {
  originalQuery: string;
  correctedQuery: string;
  hasCorrection: boolean;
  confidence: number; // 0 to 1
  correctedTerms: CorrectedTerm[];
}

/**
 * Standard e-commerce domain dictionary terms to seed baseline vocabulary
 */
const BASELINE_DOMAIN_TERMS = [
  // Categories & Apparel
  'kurti', 'kurtis', 'kurta', 'kurtas', 'shirt', 'shirts', 't-shirt', 'tshirt', 'tshirts',
  'tee', 'tees', 'trouser', 'trousers', 'pant', 'pants', 'jeans', 'dress', 'dresses',
  'frock', 'gown', 'suit', 'suits', 'saree', 'saris', 'sarees', 'jacket', 'coat',
  'hoodie', 'sweatshirt',

  // Footwear
  'shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'boots', 'sandals', 'slippers',

  // Electronics & Gadgets
  'mobile', 'phone', 'smartphone', 'smartphones', 'headphones', 'headphone', 'earbuds',
  'earphones', 'airpods', 'watch', 'watches', 'smartwatch', 'laptop', 'charger',
  'mouse', 'mice', 'keyboard', 'keyboards', 'gaming',

  // Fragrances & Personal Care
  'perfume', 'perfumes', 'fragrance', 'fragrances', 'deodorant', 'deo', 'cologne',

  // Accessories
  'accessories', 'accessory', 'wallet', 'wallets', 'handbag', 'handbags', 'backpack',

  // Colors
  'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'grey', 'gray',
  'brown', 'purple', 'orange', 'maroon', 'navy',

  // Genders
  'men', 'mens', 'women', 'womens', 'kids', 'boys', 'girls',

  // Materials & Attributes
  'cotton', 'denim', 'leather', 'silk', 'printed', 'solid', 'formal', 'casual', 'party',
  'wireless', 'bluetooth', 'running', 'sports', 'budget', 'luxury',

  // Core Brands & Key Device Terms
  'iphone', 'apple', 'samsung', 'galaxy', 'boat', 'sony', 'nike', 'redmi', 'xiaomi', 'dell', 'hp', 'logitech'
];

/**
 * Damerau-Levenshtein Distance calculation
 * Supports insertion, deletion, substitution, and transposition of two adjacent characters.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = [];
  for (let i = 0; i <= al; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= bl; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[al][bl];
}

/**
 * Common phonetic and typing variations normalization
 */
function normalizePhoneticVariants(word: string): string {
  let w = word.toLowerCase();
  // f <-> ph
  w = w.replace(/ph/g, 'f');
  // ee <-> ea
  w = w.replace(/ee/g, 'ea');
  // double letters at end (e.g. ss -> s)
  w = w.replace(/([a-z])\1+$/g, '$1');
  return w;
}

const COMPOUND_PHRASE_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b(?:blu|blue)\s+(?:tooth|tuth|tut|toot)\b/gi, replacement: 'bluetooth' },
  { pattern: /\b(?:hed|head)\s*(?:phones?|fones?)\b/gi, replacement: 'headphones' },
  { pattern: /\b(?:ear)\s*(?:phones?|fones?)\b/gi, replacement: 'earphones' },
  { pattern: /\b(?:ear)\s*(?:buds?)\b/gi, replacement: 'earbuds' },
  { pattern: /\b(?:t|tee)\s*(?:shirts?|shrts?)\b/gi, replacement: 't-shirt' },
  { pattern: /\b(?:smart)\s*(?:phones?)\b/gi, replacement: 'smartphone' },
  { pattern: /\b(?:smart)\s*(?:watch(?:es)?)\b/gi, replacement: 'smartwatch' },
  { pattern: /\b(?:lap)\s*(?:tops?)\b/gi, replacement: 'laptop' },
  { pattern: /\b(?:air)\s*(?:pods?)\b/gi, replacement: 'airpods' },
  { pattern: /\b(?:power)\s*(?:banks?)\b/gi, replacement: 'powerbank' }
];

export class SpellingCorrectionEngine {
  private static cachedVocabulary: Map<string, number> = new Map();
  private static cachedDocsCount = -1;
  private static cachedSynonymsCount = -1;

  /**
   * Extract vocabulary from indexed documents and domain seed terms.
   */
  public static buildVocabulary(docs: IndexedProductDoc[]): Map<string, number> {
    const synTerms = getAllSynonymTerms();
    // If cache is fresh, reuse
    if (this.cachedVocabulary.size > 0 && this.cachedDocsCount === docs.length && this.cachedSynonymsCount === synTerms.length) {
      return this.cachedVocabulary;
    }

    const vocab = new Map<string, number>();

    // Seed domain baseline terms
    for (const term of BASELINE_DOMAIN_TERMS) {
      vocab.set(term.toLowerCase(), 50);
    }

    // Seed configured synonyms
    for (const term of synTerms) {
      vocab.set(term.toLowerCase(), 60);
    }

    // Extract dynamic vocabulary from actual catalog
    for (const doc of docs) {
      if (!doc.isVisible || doc.status === 'inactive' || doc.status === 'draft') continue;

      // Brand
      if (doc.brand) {
        const br = doc.brand.toLowerCase().trim();
        vocab.set(br, (vocab.get(br) || 0) + 100);
      }

      // Categories
      if (doc.categoryName) {
        doc.categoryName.toLowerCase().split(/\s+/).forEach(w => {
          if (w.length >= 2) vocab.set(w, (vocab.get(w) || 0) + 60);
        });
      }
      if (doc.subCategoryName) {
        doc.subCategoryName.toLowerCase().split(/\s+/).forEach(w => {
          if (w.length >= 2) vocab.set(w, (vocab.get(w) || 0) + 40);
        });
      }

      // Title words
      const titleWords = doc.name
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !/^\d+$/.test(w));

      for (const w of titleWords) {
        vocab.set(w, (vocab.get(w) || 0) + 5);
      }

      // Colors & Tags
      if (Array.isArray(doc.colors)) {
        doc.colors.forEach(c => vocab.set(c.toLowerCase(), (vocab.get(c.toLowerCase()) || 0) + 20));
      }
      if (doc.tags) {
        doc.tags.toLowerCase().split(/\s+/).forEach(t => {
          if (t.length >= 3) vocab.set(t, (vocab.get(t) || 0) + 10);
        });
      }
    }

    this.cachedVocabulary = vocab;
    this.cachedDocsCount = docs.length;
    this.cachedSynonymsCount = synTerms.length;
    return vocab;
  }


  /**
   * Correct a search query, identifying misspellings and mapping to best vocabulary candidates.
   */
  public static correct(query: string, docs: IndexedProductDoc[]): SpellingCorrectionResult {
    const raw = (query || '').trim();
    if (!raw) {
      return {
        originalQuery: query,
        correctedQuery: query,
        hasCorrection: false,
        confidence: 1.0,
        correctedTerms: []
      };
    }

    const vocab = this.buildVocabulary(docs);
    const correctedTerms: CorrectedTerm[] = [];

    // Phase 1: Compound phrase normalization (e.g. "blu tooth" -> "bluetooth", "hed phone" -> "headphones")
    let normalizedRaw = raw;
    for (const { pattern, replacement } of COMPOUND_PHRASE_PATTERNS) {
      normalizedRaw = normalizedRaw.replace(pattern, (match) => {
        if (match.toLowerCase() !== replacement.toLowerCase()) {
          correctedTerms.push({
            from: match,
            to: replacement,
            distance: damerauLevenshtein(match.toLowerCase().replace(/\s+/g, ''), replacement.toLowerCase())
          });
        }
        return replacement;
      });
    }

    const tokens = normalizedRaw.split(/\s+/);
    const correctedTokens: string[] = [];

    // Filter syntax tokens that should NEVER be spell-corrected
    const preservedTokens = new Set([
      'under', 'below', 'less', 'than', 'up', 'to', 'upto', 'maximum', 'max',
      'above', 'over', 'more', 'at', 'least', 'min', 'minimum',
      'between', 'from', 'and', 'for', 'in', 'with', 'priced', 'costing',
      '₹', 'rs', 'rs.', 'inr', 'off', 'discount', 'stars', 'star'
    ]);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const cleanToken = token.toLowerCase().replace(/[^\w-]/g, '');

      // Guard 1: Empty or very short symbol
      if (!cleanToken) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 2: Numeric price, dimension, or quantity (e.g. 400, 500, 1000, 15000, 10k)
      if (/^\d+(?:[a-z%]+)?$/i.test(cleanToken)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 2b: Alphanumeric model numbers, hardware codes, or specs (e.g. s24, s24u, 5g, 128gb, 4k, rtx4060, i5, g60)
      if (/(?:[a-z]+\d+|\d+[a-z]+)/i.test(cleanToken)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 3: Exact 12-digit Product Code or SKU format
      if (/^\d{8,14}$/.test(cleanToken) || /^[A-Z0-9]{3,}-[A-Z0-9]{3,}$/i.test(token)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 4: Natural language operators or filters
      if (preservedTokens.has(cleanToken)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 4b: Known or configured synonym term (e.g. kicks -> shoes)
      if (hasSynonym(cleanToken)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 5: Word already exists in catalog vocabulary or baseline
      if (vocab.has(cleanToken)) {
        correctedTokens.push(token);
        continue;
      }

      // Guard 6: Common known contractions or plurals with apostrophe
      if (cleanToken === 'womens' || cleanToken === 'women\'s') {
        correctedTokens.push("women's");
        continue;
      }
      if (cleanToken === 'mens' || cleanToken === 'men\'s') {
        correctedTokens.push("men's");
        continue;
      }

      // Step 7: Check known specific domain typo mappings
      const directTypoMapping = this.getDomainTypoCandidate(cleanToken);
      if (directTypoMapping) {
        correctedTerms.push({
          from: token,
          to: directTypoMapping,
          distance: damerauLevenshtein(cleanToken, directTypoMapping)
        });
        correctedTokens.push(directTypoMapping);
        continue;
      }

      // Step 8: Fuzzy Damerau-Levenshtein Search across Vocabulary
      let bestCandidate: string | null = null;
      let minDistance = cleanToken.length <= 4 ? 1 : 2; // Allow max 1 edit for <= 4 chars, 2 edits for longer
      let maxFrequency = 0;

      const normPhoneticToken = normalizePhoneticVariants(cleanToken);

      for (const [candidate, freq] of vocab.entries()) {
        // Length difference filter: skip if length difference > 2
        if (Math.abs(candidate.length - cleanToken.length) > 2) continue;

        // Never replace with pure numbers or stop words
        if (/^\d+$/.test(candidate) || preservedTokens.has(candidate)) continue;

        const dist = damerauLevenshtein(cleanToken, candidate);

        // Phonetic check bonus (e.g. headfone vs headphone)
        const normPhoneticCand = normalizePhoneticVariants(candidate);
        const isPhoneticMatch = normPhoneticToken === normPhoneticCand;

        const effectiveDist = isPhoneticMatch ? Math.min(dist, 1) : dist;

        if (effectiveDist < minDistance) {
          minDistance = effectiveDist;
          bestCandidate = candidate;
          maxFrequency = freq;
        } else if (effectiveDist === minDistance && freq > maxFrequency) {
          bestCandidate = candidate;
          maxFrequency = freq;
        }
      }

      if (bestCandidate && bestCandidate !== cleanToken) {
        correctedTerms.push({
          from: token,
          to: bestCandidate,
          distance: minDistance
        });
        correctedTokens.push(bestCandidate);
      } else {
        correctedTokens.push(token);
      }
    }

    const hasCorrection = correctedTerms.length > 0;
    const correctedQuery = correctedTokens.join(' ');

    // Calculate confidence score
    let confidence = 1.0;
    if (hasCorrection) {
      const avgDist = correctedTerms.reduce((sum, t) => sum + t.distance, 0) / correctedTerms.length;
      confidence = Math.max(0.6, 1.0 - (avgDist * 0.15));
    }

    return {
      originalQuery: raw,
      correctedQuery: hasCorrection ? correctedQuery : raw,
      hasCorrection,
      confidence,
      correctedTerms
    };
  }

  /**
   * Fast rule-based heuristics for high-frequency e-commerce typos
   */
  private static getDomainTypoCandidate(word: string): string | null {
    switch (word) {
      case 'kurtie':
      case 'kurty':
      case 'kurtti':
      case 'kurtiis':
        return 'kurti';

      case 'tshrt':
      case 't-shrt':
      case 'tshirt':
      case 't-shirt':
        return 't-shirt';

      case 'shose':
      case 'shooes':
      case 'shoos':
      case 'shue':
      case 'shues':
        return 'shoes';

      case 'snikers':
      case 'sneekers':
      case 'snekers':
      case 'sneakerss':
        return 'sneakers';

      case 'jeens':
      case 'jean':
      case 'jeanz':
      case 'jens':
        return 'jeans';

      case 'dres':
      case 'drese':
      case 'dresss':
        return 'dress';

      case 'blu':
        return 'blue';

      case 'blak':
      case 'blck':
        return 'black';

      case 'headfone':
      case 'headfones':
      case 'headfons':
      case 'hedphone':
      case 'hedphones':
        return 'headphones';

      case 'blutooth':
      case 'blutoth':
      case 'bluetoth':
      case 'bluttooth':
        return 'bluetooth';

      case 'iphon':
      case 'iphne':
      case 'iphn':
        return 'iphone';

      case 'moblie':
      case 'mobl':
      case 'mobail':
      case 'mobil':
        return 'mobile';

      case 'samung':
      case 'samsng':
      case 'samsun':
        return 'samsung';

      case 'earbud':
      case 'erabuds':
        return 'earbuds';

      case 'wirless':
      case 'wirles':
      case 'wirelss':
      case 'wireles':
        return 'wireless';

      case 'mose':
      case 'mous':
      case 'mouce':
      case 'moose':
        return 'mouse';

      case 'keybord':
      case 'keybaord':
        return 'keyboard';

      case 'leptop':
      case 'laptap':
        return 'laptop';

      default:
        return null;
    }
  }
}

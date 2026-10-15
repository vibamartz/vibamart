/**
 * Domain-specific synonym mappings and query normalization utilities for ViBa Mart catalog.
 */

// Bidirectional synonym groups
export const DEFAULT_SYNONYM_GROUPS: string[][] = [
  // Mobiles & Electronics
  ['mobile', 'phone', 'smartphone', 'cellphone', 'handset', 'android', 'iphone'],
  ['earbuds', 'earphones', 'headphones', 'airpods', 'tws', 'headset', 'audio', 'wireless earbuds'],
  ['laptop', 'notebook', 'macbook', 'computer', 'pc'],
  ['mouse', 'mice', 'optical mouse', 'wireless mouse', 'gaming mouse'],
  ['keyboard', 'keyboards', 'mechanical keyboard'],
  ['tv', 'television', 'smart tv', 'led', 'display', 'screen'],
  ['charger', 'adapter', 'charging cable', 'power brick'],
  ['watch', 'smartwatch', 'smart watch', 'fitness band', 'timepiece', 'ghadi'],
  ['powerbank', 'power bank', 'portable charger'],
  ['wireless', 'cordless', 'bluetooth', 'bina taar'],

  // Fashion & Apparel
  ['shoe', 'shoes', 'sneaker', 'sneakers', 'sports shoes', 'footwear', 'kicks', 'boots', 'sandals', 'slippers', 'joota', 'joote', 'chappal'],
  ['kurti', 'kurtis', 'kurta', 'kurtas', 'ladies kurti'],
  ['shirt', 'tshirt', 't-shirt', 'tee', 'top', 'formal shirt', 'casual shirt', 'kapde'],
  ['trouser', 'trousers', 'pants', 'jeans', 'pant', 'bottoms', 'chinos', 'denim'],
  ['dress', 'frock', 'gown', 'suit'],
  ['jacket', 'coat', 'blazer', 'hoodie', 'sweatshirt'],
  ['saree', 'sari'],

  // Accessories & Home
  ['bag', 'backpack', 'handbag', 'purse', 'tote', 'duffle'],
  ['wallet', 'purse', 'cardholder'],
  ['perfume', 'deodorant', 'deo', 'fragrance', 'cologne'],
  ['shampoo', 'hair wash', 'cleanser'],
  ['soap', 'body wash', 'shower gel'],
  ['bedsheet', 'bed sheet', 'bed linen', 'bedcover'],
  ['bottle', 'water bottle', 'flask', 'sipper'],
];

// Inverted lookup map
const synonymLookup: Map<string, Set<string>> = new Map();

function buildLookup() {
  synonymLookup.clear();
  for (const group of DEFAULT_SYNONYM_GROUPS) {
    const groupSet = new Set(group.map(w => w.toLowerCase().trim()));
    for (const term of groupSet) {
      if (!synonymLookup.has(term)) {
        synonymLookup.set(term, new Set());
      }
      for (const sibling of groupSet) {
        if (sibling !== term) {
          synonymLookup.get(term)!.add(sibling);
        }
      }
    }
  }
}

buildLookup();

/**
 * Register additional custom synonyms at runtime (e.g. from admin curation).
 */
export function registerCustomSynonyms(groups: string[][]) {
  for (const group of groups) {
    const groupSet = new Set(group.map(w => w.toLowerCase().trim()));
    for (const term of groupSet) {
      if (!synonymLookup.has(term)) {
        synonymLookup.set(term, new Set());
      }
      for (const sibling of groupSet) {
        if (sibling !== term) {
          synonymLookup.get(term)!.add(sibling);
        }
      }
    }
  }
}

/**
 * Get all known synonyms for a term.
 */
export function getSynonymsForTerm(term: string): string[] {
  const normalized = term.toLowerCase().trim();
  const found = synonymLookup.get(normalized);
  return found ? Array.from(found) : [];
}

/**
 * Check if a term exists in configured/built-in synonyms.
 */
export function hasSynonym(term: string): boolean {
  return synonymLookup.has(term.toLowerCase().trim());
}

/**
 * Retrieve all registered synonym terms.
 */
export function getAllSynonymTerms(): string[] {
  return Array.from(synonymLookup.keys());
}

/**
 * Lightweight English stemmer (Porter algorithm lightweight rules)
 */
export function stemToken(word: string): string {
  let w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4 && !w.endsWith('shoes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  return w;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'from', 'with', 'by', 'of',
  'and', 'or', 'size', 'sz', 'under', 'below', 'above', 'over', 'between', 'rs', 'inr',
  'is', 'are', 'was', 'were', 'it', 'its', 'my', 'your', 'me', 'i', 'you'
]);

/**
 * Normalize and tokenize query string
 */
export function normalizeQueryString(rawQuery: string): {
  tokens: string[];
  stemmedTokens: string[];
  cleanDigits: string;
} {
  const clean = (rawQuery || '').trim();
  const cleanDigits = clean.replace(/\D/g, '');
  const tokens = clean
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/[\s-]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const stemmedTokens = tokens.map(stemToken);

  return { tokens, stemmedTokens, cleanDigits };
}

/**
 * Expands a query with high-confidence synonyms, filtering stop words and pure numbers.
 */
export function expandQueryWithSynonyms(rawQuery: string): string[] {
  const { tokens } = normalizeQueryString(rawQuery);
  const terms = new Set<string>();

  const validTokens = tokens.filter(t => !STOP_WORDS.has(t) && t.length > 1 && !/^\d+$/.test(t));

  for (const token of validTokens) {
    terms.add(token);
    const synonyms = getSynonymsForTerm(token);
    for (const syn of synonyms.slice(0, 3)) { // Add top 3 synonyms per token
      if (!STOP_WORDS.has(syn) && syn.length > 1 && !/^\d+$/.test(syn)) {
        terms.add(syn);
      }
    }
  }

  return Array.from(terms);
}


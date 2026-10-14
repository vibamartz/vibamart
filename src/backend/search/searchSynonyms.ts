/**
 * Domain-specific synonym mappings and query normalization utilities for ViBa Mart catalog.
 */

// Bidirectional synonym groups
export const DEFAULT_SYNONYM_GROUPS: string[][] = [
  // Mobiles & Electronics
  ['mobile', 'phone', 'smartphone', 'cellphone', 'handset', 'android', 'iphone'],
  ['earbuds', 'earphones', 'headphones', 'airpods', 'tws', 'headset', 'audio'],
  ['laptop', 'notebook', 'macbook', 'computer', 'pc'],
  ['tv', 'television', 'smart tv', 'led', 'display', 'screen'],
  ['charger', 'adapter', 'charging cable', 'power brick'],
  ['watch', 'smartwatch', 'smart watch', 'fitness band', 'timepiece'],
  ['powerbank', 'power bank', 'portable charger'],

  // Fashion & Apparel
  ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'kicks', 'boots', 'sandals', 'slippers'],
  ['shirt', 'tshirt', 't-shirt', 'tee', 'top', 'formal shirt', 'casual shirt'],
  ['trouser', 'trousers', 'pants', 'jeans', 'pant', 'bottoms', 'chinos'],
  ['dress', 'frock', 'gown', 'kurti', 'suit'],
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
 * Expands a query with high-confidence synonyms
 */
export function expandQueryWithSynonyms(rawQuery: string): string[] {
  const { tokens } = normalizeQueryString(rawQuery);
  const terms = new Set<string>(tokens);

  for (const token of tokens) {
    const synonyms = getSynonymsForTerm(token);
    for (const syn of synonyms.slice(0, 3)) { // Add top 3 synonyms per token
      terms.add(syn);
    }
  }

  return Array.from(terms);
}

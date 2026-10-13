/**
 * Configurable e-commerce synonym dictionary and expansion utilities for ViBa Mart.
 * Allows queries like "cellphone", "mobile", and "smartphone" to resolve seamlessly.
 */

export interface SynonymGroup {
  canonical: string;
  terms: string[];
}

export const DEFAULT_SYNONYM_GROUPS: SynonymGroup[] = [
  {
    canonical: 'mobile',
    terms: ['mobile', 'smartphone', 'phone', 'cellphone', 'handset', 'smart phone']
  },
  {
    canonical: 'shoe',
    terms: ['shoe', 'shoes', 'sneaker', 'sneakers', 'footwear', 'kicks', 'trainers', 'running shoe', 'running shoes']
  },
  {
    canonical: 'tshirt',
    terms: ['tshirt', 't-shirt', 'tee', 'tees', 't shirt', 'polo', 'top']
  },
  {
    canonical: 'shirt',
    terms: ['shirt', 'formal shirt', 'casual shirt', 'button down', 'oxford shirt']
  },
  {
    canonical: 'jeans',
    terms: ['jeans', 'denim', 'trousers', 'pants']
  },
  {
    canonical: 'earphones',
    terms: ['earphones', 'earbuds', 'earphone', 'earbud', 'headphones', 'headphone', 'tws', 'airpods', 'air buds']
  },
  {
    canonical: 'watch',
    terms: ['watch', 'smartwatch', 'smart watch', 'fitness band', 'tracker']
  },
  {
    canonical: 'laptop',
    terms: ['laptop', 'notebook', 'macbook', 'ultrabook', 'pc', 'computer']
  },
  {
    canonical: 'television',
    terms: ['tv', 'television', 'smart tv', 'led tv', 'oled tv', '4k tv']
  },
  {
    canonical: 'perfume',
    terms: ['perfume', 'fragrance', 'cologne', 'scent', 'deodorant', 'deo', 'body spray']
  },
  {
    canonical: 'saree',
    terms: ['saree', 'sari', 'shari']
  },
  {
    canonical: 'kurta',
    terms: ['kurta', 'kurti', 'tunic']
  },
  {
    canonical: 'bag',
    terms: ['bag', 'backpack', 'handbag', 'sling bag', 'purse', 'tote']
  },
  {
    canonical: 'charger',
    terms: ['charger', 'adapter', 'charging cable', 'fast charger', 'power bank']
  }
];

// Inverted lookup map: term -> Set of all synonyms in its group
const TERM_TO_SYNONYMS = new Map<string, Set<string>>();

function buildLookupMap() {
  TERM_TO_SYNONYMS.clear();
  for (const group of DEFAULT_SYNONYM_GROUPS) {
    const all = new Set<string>();
    all.add(group.canonical);
    for (const term of group.terms) {
      all.add(term.toLowerCase().trim());
    }
    for (const member of all) {
      if (!TERM_TO_SYNONYMS.has(member)) {
        TERM_TO_SYNONYMS.set(member, new Set());
      }
      const existing = TERM_TO_SYNONYMS.get(member)!;
      for (const other of all) {
        if (other !== member) existing.add(other);
      }
    }
  }
}

buildLookupMap();

/**
 * Returns all configured synonyms for a term or phrase.
 */
export function getSynonymsForTerm(term: string): string[] {
  const normalized = term.toLowerCase().trim();
  const direct = TERM_TO_SYNONYMS.get(normalized);
  if (direct) {
    return Array.from(direct);
  }
  return [];
}

/**
 * Expands a tokenized query by adding synonym terms.
 */
export function expandQueryWithSynonyms(tokens: string[]): string[] {
  const result = new Set<string>(tokens);
  for (const token of tokens) {
    const synonyms = getSynonymsForTerm(token);
    for (const s of synonyms) {
      result.add(s);
    }
  }
  return Array.from(result);
}

/**
 * Registers custom synonym groups (e.g. from Admin console).
 */
export function registerCustomSynonymGroups(groups: string[][]) {
  buildLookupMap();
  for (const terms of groups) {
    const all = new Set<string>(terms.map(t => t.toLowerCase().trim()).filter(Boolean));
    for (const member of all) {
      if (!TERM_TO_SYNONYMS.has(member)) {
        TERM_TO_SYNONYMS.set(member, new Set());
      }
      const existing = TERM_TO_SYNONYMS.get(member)!;
      for (const other of all) {
        if (other !== member) existing.add(other);
      }
    }
  }
}

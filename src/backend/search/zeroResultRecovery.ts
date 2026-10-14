import { IndexedProductDoc } from './searchEngine';

export interface RecoveryRecommendation {
  suggestedQuery?: string;
  suggestedCategories?: string[];
  suggestedBrands?: string[];
}

export class ZeroResultRecovery {
  /**
   * Levenshtein distance calculation between two words
   */
  public static levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Generates recovery recommendations when a query yields 0 results
   */
  public static recover(
    query: string,
    allDocs: IndexedProductDoc[]
  ): RecoveryRecommendation {
    const raw = (query || '').trim().toLowerCase();
    if (!raw) return {};

    const tokens = raw.split(/\s+/).filter(Boolean);

    // Build unique vocabulary sets from active catalog
    const wordFreq: Map<string, number> = new Map();
    const categories: Set<string> = new Set();
    const brands: Set<string> = new Set();

    for (const doc of allDocs) {
      if (!doc.isVisible || doc.status === 'inactive') continue;

      if (doc.categoryName) categories.add(doc.categoryName);
      if (doc.brand) brands.add(doc.brand);

      // Extract title words
      const titleWords = doc.name.toLowerCase().replace(/[^\w\s-]/g, ' ').split(/\s+/);
      for (const w of titleWords) {
        if (w.length >= 3) {
          wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
        }
      }
    }

    // Attempt to correct each token
    const correctedTokens: string[] = [];
    let hasCorrection = false;

    for (const token of tokens) {
      if (wordFreq.has(token)) {
        correctedTokens.push(token);
        continue;
      }

      // Find closest word in catalog vocabulary
      let bestWord = token;
      let minDistance = 3; // Max allowable distance
      let maxFrequency = 0;

      for (const [candidate, freq] of wordFreq.entries()) {
        if (Math.abs(candidate.length - token.length) > 2) continue;
        const dist = ZeroResultRecovery.levenshtein(token, candidate);
        if (dist < minDistance || (dist === minDistance && freq > maxFrequency)) {
          minDistance = dist;
          bestWord = candidate;
          maxFrequency = freq;
        }
      }

      if (bestWord !== token) {
        hasCorrection = true;
        correctedTokens.push(bestWord);
      } else {
        correctedTokens.push(token);
      }
    }

    // Category suggestions matching query tokens
    const suggestedCats: string[] = [];
    for (const cat of categories) {
      const lowerCat = cat.toLowerCase();
      if (tokens.some(t => lowerCat.includes(t)) || ZeroResultRecovery.levenshtein(raw, lowerCat) <= 3) {
        suggestedCats.push(cat);
      }
    }

    // Brand suggestions matching query tokens
    const suggestedBrands: string[] = [];
    for (const br of brands) {
      const lowerBr = br.toLowerCase();
      if (tokens.some(t => lowerBr.includes(t)) || ZeroResultRecovery.levenshtein(raw, lowerBr) <= 2) {
        suggestedBrands.push(br);
      }
    }

    return {
      suggestedQuery: hasCorrection ? correctedTokens.join(' ') : undefined,
      suggestedCategories: suggestedCats.slice(0, 3),
      suggestedBrands: suggestedBrands.slice(0, 3)
    };
  }
}

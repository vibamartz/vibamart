import { IndexedProductDoc } from './searchEngine';
import { SpellingCorrectionEngine } from './spellingCorrection';

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

    // Run intelligent spelling correction
    const spellingResult = SpellingCorrectionEngine.correct(query, allDocs);
    const hasCorrection = spellingResult.hasCorrection;
    const correctedQuery = spellingResult.correctedQuery;

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
      suggestedQuery: hasCorrection ? correctedQuery : undefined,
      suggestedCategories: (suggestedCats.length > 0 ? suggestedCats : Array.from(categories)).slice(0, 4),
      suggestedBrands: (suggestedBrands.length > 0 ? suggestedBrands : Array.from(brands)).slice(0, 4)
    };
  }
}

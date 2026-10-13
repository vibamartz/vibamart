import { IndexedProductDoc } from './searchEngine';

interface VectorDoc {
  id: string;
  terms: Map<string, number>; // term -> tf-idf weight
  magnitude: number;
}

/**
 * Creates character 3-grams and word tokens from text.
 */
function extractNgrams(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  const ngrams: string[] = [...tokens];

  for (const token of tokens) {
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i++) {
        ngrams.push(`_3_${token.substring(i, i + 3)}`);
      }
    }
  }

  return ngrams;
}

/**
 * In-memory lightweight Semantic Vector Ranker.
 * Uses N-gram TF-IDF vector embeddings to compute semantic cosine similarity
 * between natural language queries and catalog documents with zero cloud costs.
 */
export class SemanticRanker {
  private docVectors: Map<string, VectorDoc> = new Map();
  private docFrequency: Map<string, number> = new Map();
  private totalDocs: number = 0;

  /**
   * Builds the TF-IDF vector space index from indexed product documents.
   */
  public buildIndex(docs: IndexedProductDoc[]) {
    this.docVectors.clear();
    this.docFrequency.clear();
    this.totalDocs = docs.length;

    if (this.totalDocs === 0) return;

    // 1. Calculate document frequency (DF)
    const docTermSets: Array<{ id: string; termCounts: Map<string, number> }> = [];

    for (const doc of docs) {
      // Build rich document representation
      const text = [
        doc.name,
        doc.brand,
        doc.categoryName,
        doc.subCategoryName,
        doc.tags,
        doc.specifications,
        doc.description
      ].join(' ');

      const ngrams = extractNgrams(text);
      const termCounts = new Map<string, number>();

      for (const ng of ngrams) {
        termCounts.set(ng, (termCounts.get(ng) || 0) + 1);
      }

      for (const term of termCounts.keys()) {
        this.docFrequency.set(term, (this.docFrequency.get(term) || 0) + 1);
      }

      docTermSets.push({ id: doc.id, termCounts });
    }

    // 2. Compute TF-IDF vectors and unit magnitudes
    for (const item of docTermSets) {
      const vectorTerms = new Map<string, number>();
      let sumSquares = 0;

      for (const [term, count] of item.termCounts.entries()) {
        const tf = Math.log1p(count);
        const df = this.docFrequency.get(term) || 1;
        const idf = Math.log((this.totalDocs + 1) / (df + 1)) + 1;
        const weight = tf * idf;

        vectorTerms.set(term, weight);
        sumSquares += weight * weight;
      }

      const magnitude = Math.sqrt(sumSquares) || 1;
      this.docVectors.set(item.id, {
        id: item.id,
        terms: vectorTerms,
        magnitude
      });
    }
  }

  /**
   * Computes semantic cosine similarity between query and product document.
   * Returns a value between 0.0 and 1.0.
   */
  public computeSimilarity(query: string, docId: string): number {
    const docVector = this.docVectors.get(docId);
    if (!docVector) return 0;

    const queryNgrams = extractNgrams(query);
    if (queryNgrams.length === 0) return 0;

    const queryCounts = new Map<string, number>();
    for (const ng of queryNgrams) {
      queryCounts.set(ng, (queryCounts.get(ng) || 0) + 1);
    }

    let dotProduct = 0;
    let querySumSquares = 0;

    for (const [term, count] of queryCounts.entries()) {
      const tf = Math.log1p(count);
      const df = this.docFrequency.get(term) || 1;
      const idf = Math.log((this.totalDocs + 1) / (df + 1)) + 1;
      const queryWeight = tf * idf;

      querySumSquares += queryWeight * queryWeight;

      const docWeight = docVector.terms.get(term);
      if (docWeight) {
        dotProduct += queryWeight * docWeight;
      }
    }

    const queryMag = Math.sqrt(querySumSquares) || 1;
    const cosine = dotProduct / (queryMag * docVector.magnitude);
    return Math.max(0, Math.min(1, cosine));
  }

  /**
   * Hybrid Score Blender:
   * Combines normalized BM25 keyword score with Semantic Cosine Similarity and Business Signals.
   */
  public blendScores(
    bm25Score: number,
    maxBM25Score: number,
    semanticCosine: number,
    doc: IndexedProductDoc,
    isExactIdentifier: boolean = false
  ): number {
    if (isExactIdentifier) {
      return 10000;
    }

    const normBM25 = maxBM25Score > 0 ? Math.min(1, bm25Score / maxBM25Score) : 0;
    const normSemantic = Math.max(0, Math.min(1, semanticCosine));

    // Business Boost components (up to ~0.20 total boost)
    const ratingBoost = (Math.max(0, doc.rating || 0) / 5) * 0.10; // 0 - 0.10
    const stockBoost = doc.inStock ? 0.05 : 0;                      // 0 or 0.05
    const discountBoost = (Math.min(50, doc.discountPercentage || 0) / 50) * 0.05; // 0 - 0.05
    const businessSignals = ratingBoost + stockBoost + discountBoost;

    // Weights: 50% keyword precision (BM25), 35% semantic intent similarity, 15% business signals
    const finalScore = (0.50 * normBM25) + (0.35 * normSemantic) + (0.15 * businessSignals);
    return Math.round(finalScore * 1000) / 10; // Normalized to 0 - 100 scale
  }
}

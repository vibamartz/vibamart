/**
 * Utility functions for shuffling and randomizing product display order.
 * Implements Fisher-Yates (Knuth) algorithm to guarantee unbiased random permutations.
 */

/**
 * Returns a new shuffled copy of an array using the Fisher-Yates (Knuth) algorithm.
 * Does not mutate the original array.
 */
export function shuffleArray<T>(array: readonly T[] | null | undefined): T[] {
  if (!array || array.length <= 1) {
    return array ? [...array] : [];
  }

  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}


import { SearchParams } from './searchTypes';

const MAX_QUERY_LENGTH = 120;
const MAX_LIMIT = 100;
const MAX_PAGE = 100;

/**
 * Sanitizes a raw search string to prevent XSS, ReDoS, and control character attacks.
 */
export function sanitizeSearchString(input: string | undefined): string {
  if (!input || typeof input !== 'string') return '';

  return input
    // Truncate to maximum allowable query length
    .slice(0, MAX_QUERY_LENGTH)
    // Strip control characters (ASCII 0-31 and 127)
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Strip script and dangerous tags
    .replace(/<[^>]*>/g, '')
    // Replace multiple spaces with a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates and sanitizes incoming SearchParams.
 */
export function sanitizeSearchParams(raw: Record<string, any>): SearchParams {
  const q = raw.q !== undefined ? sanitizeSearchString(String(raw.q)) : undefined;
  const category = raw.category !== undefined ? sanitizeSearchString(String(raw.category)) : undefined;
  const subCategory = raw.subCategory !== undefined ? sanitizeSearchString(String(raw.subCategory)) : undefined;
  const nestedSubCategory = raw.nestedSubCategory !== undefined ? sanitizeSearchString(String(raw.nestedSubCategory)) : undefined;
  const visualSubCategory = raw.visualSubCategory !== undefined ? sanitizeSearchString(String(raw.visualSubCategory)) : undefined;

  let brand: string[] | string | undefined = undefined;
  if (typeof raw.brand === 'string') {
    const cleaned = sanitizeSearchString(raw.brand);
    brand = cleaned.includes(',') ? cleaned.split(',').map(b => b.trim()).filter(Boolean) : cleaned;
  } else if (Array.isArray(raw.brand)) {
    brand = raw.brand.map(b => sanitizeSearchString(String(b))).filter(Boolean);
  }

  let color: string[] | string | undefined = undefined;
  if (typeof raw.color === 'string') {
    const cleaned = sanitizeSearchString(raw.color);
    color = cleaned.includes(',') ? cleaned.split(',').map(c => c.trim()).filter(Boolean) : cleaned;
  } else if (Array.isArray(raw.color)) {
    color = raw.color.map(c => sanitizeSearchString(String(c))).filter(Boolean);
  }

  let size: string[] | string | undefined = undefined;
  if (typeof raw.size === 'string') {
    const cleaned = sanitizeSearchString(raw.size);
    size = cleaned.includes(',') ? cleaned.split(',').map(s => s.trim()).filter(Boolean) : cleaned;
  } else if (Array.isArray(raw.size)) {
    size = raw.size.map(s => sanitizeSearchString(String(s))).filter(Boolean);
  }

  const gender = raw.gender !== undefined ? sanitizeSearchString(String(raw.gender)) : undefined;

  // Safe numerical validation
  let minPrice = raw.minPrice !== undefined && !isNaN(Number(raw.minPrice))
    ? Math.max(0, Number(raw.minPrice))
    : undefined;

  let maxPrice = raw.maxPrice !== undefined && !isNaN(Number(raw.maxPrice))
    ? Math.max(0, Number(raw.maxPrice))
    : undefined;

  // Reject contradictory price range
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    maxPrice = undefined;
  }

  const minRating = raw.minRating !== undefined && !isNaN(Number(raw.minRating))
    ? Math.min(5, Math.max(0, Number(raw.minRating)))
    : undefined;

  const minDiscount = raw.minDiscount !== undefined && !isNaN(Number(raw.minDiscount))
    ? Math.min(100, Math.max(0, Number(raw.minDiscount)))
    : undefined;

  const inStock = raw.inStock === true || raw.inStock === 'true' || raw.inStock === '1';
  const includeDrafts = raw.includeDrafts === true || raw.includeDrafts === 'true';
  const useAI = raw.useAI === true || raw.useAI === 'true' || raw.ai === 'true' || raw.ai === '1';
  const noAutoCorrect = raw.noAutoCorrect === true || raw.noAutoCorrect === 'true' || raw.noAutoCorrect === '1';

  // Valid sort options whitelist
  const validSorts = ['relevance', 'price-asc', 'price-desc', 'newest', 'rating', 'popularity'];
  const sortBy = (typeof raw.sortBy === 'string' && validSorts.includes(raw.sortBy))
    ? (raw.sortBy as any)
    : undefined;

  // Clamped pagination
  const rawPage = Number(raw.page);
  const page = (!isNaN(rawPage) && rawPage >= 1) ? Math.min(MAX_PAGE, Math.floor(rawPage)) : 1;

  const rawLimit = Number(raw.limit);
  const limit = (!isNaN(rawLimit) && rawLimit >= 1) ? Math.min(MAX_LIMIT, Math.floor(rawLimit)) : 24;

  return {
    q: q || undefined,
    category: category || undefined,
    subCategory: subCategory || undefined,
    nestedSubCategory: nestedSubCategory || undefined,
    visualSubCategory: visualSubCategory || undefined,
    brand,
    color,
    size,
    gender,
    minPrice,
    maxPrice,
    minRating,
    minDiscount,
    inStock,
    includeDrafts,
    useAI,
    noAutoCorrect,
    sortBy,
    page,
    limit
  };
}

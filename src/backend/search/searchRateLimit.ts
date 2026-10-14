import rateLimit from 'express-rate-limit';

/**
 * Public search rate limiter: allows 120 queries per minute per IP (average 2 requests/sec).
 * Sufficient for interactive autocomplete typing while preventing automated abuse.
 */
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many search requests. Please slow down.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * Admin action rate limiter: 60 requests per minute.
 */
export const adminSearchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many administrative requests. Please slow down.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

/**
 * Heavy catalog re-index rate limiter: 5 requests per 5 minutes per IP.
 */
export const reindexRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Catalog reindexing is rate-limited. Please wait 5 minutes before triggering again.'
  },
  skip: () => process.env.NODE_ENV === 'test'
});

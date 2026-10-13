import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class SearchRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 120, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Periodic cleanup of expired records every 2 minutes
    setInterval(() => this.cleanup(), 120000).unref();
  }

  public check(ip: string): { allowed: boolean; remaining: number; resetInSec: number } {
    const now = Date.now();
    let record = this.records.get(ip);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + this.windowMs };
      this.records.set(ip, record);
      return { allowed: true, remaining: this.maxRequests - 1, resetInSec: Math.round(this.windowMs / 1000) };
    }

    if (record.count >= this.maxRequests) {
      const resetInSec = Math.max(1, Math.round((record.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, resetInSec };
    }

    record.count++;
    const resetInSec = Math.max(1, Math.round((record.resetAt - now) / 1000));
    return { allowed: true, remaining: this.maxRequests - record.count, resetInSec };
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [ip, rec] of this.records.entries()) {
      if (now > rec.resetAt) {
        this.records.delete(ip);
      }
    }
  }

  public reset(): void {
    this.records.clear();
  }
}

export const searchRateLimiter = new SearchRateLimiter(120, 60000); // 120 req/min for search
export const suggestionRateLimiter = new SearchRateLimiter(240, 60000); // 240 req/min for autocomplete

/**
 * Express Middleware for search rate limiting
 */
export function createSearchRateLimitMiddleware(limiter: SearchRateLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const result = limiter.check(ip);

    res.setHeader('X-RateLimit-Limit', 120);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetInSec);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please retry in ${result.resetInSec} seconds.`,
        retryAfter: result.resetInSec
      });
    }

    // Query length & character sanity check
    if (typeof req.query.q === 'string' && req.query.q.length > 150) {
      req.query.q = req.query.q.slice(0, 150);
    }

    next();
  };
}

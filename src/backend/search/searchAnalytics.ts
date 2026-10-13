import admin from 'firebase-admin';

export interface SearchAnalyticsEvent {
  query: string;
  normalizedQuery: string;
  resultCount: number;
  isZeroResult: boolean;
  executionTimeMs: number;
  timestamp: string;
  type: 'search' | 'suggestion_click' | 'product_click';
  productId?: string;
  platform?: 'desktop' | 'mobile';
}

/**
 * Sanitizes search terms to strip possible PII like phone numbers, emails, or sensitive patterns.
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return '';
  return rawQuery
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    .replace(/\b\d{10,16}\b/g, (match) => {
      // Preserve 12-digit ViBa Product Codes (starting with 8900 0996...)
      if (match.startsWith('89000996') || match.startsWith('8900')) return match;
      return '[REDACTED_NUMBER]';
    })
    .slice(0, 150)
    .trim();
}

/**
 * Asynchronously logs privacy-conscious search events to Firestore.
 */
export async function recordSearchAnalytics(event: Omit<SearchAnalyticsEvent, 'timestamp' | 'normalizedQuery'>): Promise<void> {
  const sanitized = sanitizeSearchQuery(event.query);
  if (!sanitized) return;

  const payload: SearchAnalyticsEvent = {
    ...event,
    query: sanitized,
    normalizedQuery: sanitized.toLowerCase(),
    timestamp: new Date().toISOString()
  };

  try {
    const db = admin.firestore();
    // Fire and forget asynchronous write
    db.collection('searchAnalytics').add(payload).catch((err) => {
      console.warn('[SEARCH ANALYTICS] Failed to write event:', err);
    });
  } catch {
    // Graceful error suppression
  }
}

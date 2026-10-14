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

const inMemoryAnalytics: SearchAnalyticsEvent[] = [];
const MAX_IN_MEMORY_EVENTS = 1000;

function hasAdminCredentials(): boolean {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const isPlaceholderKey = !rawKey || rawKey.includes('your_private_key') || rawKey.includes('paste_firebase_private_key') || rawKey === 'paste_firebase_private_key_here';
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && !isPlaceholderKey && admin.apps.length > 0);
}

/**
 * Asynchronously logs privacy-conscious search events to in-memory buffer and Firestore.
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

  // 1. Always record into in-memory ring buffer
  inMemoryAnalytics.unshift(payload);
  if (inMemoryAnalytics.length > MAX_IN_MEMORY_EVENTS) {
    inMemoryAnalytics.pop();
  }

  // 2. Persist to Firestore if valid admin credentials exist
  if (hasAdminCredentials()) {
    try {
      const db = admin.firestore();
      db.collection('searchAnalytics').add(payload).catch(() => {});
    } catch {
      // Graceful error suppression
    }
  }
}

export function getInMemoryAnalytics(): SearchAnalyticsEvent[] {
  return inMemoryAnalytics;
}

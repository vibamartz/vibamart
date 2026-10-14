import admin from 'firebase-admin';

export interface SearchEventRecord {
  query: string;
  resultCount: number;
  isZeroResult: boolean;
  executionTimeMs: number;
  type: 'search' | 'suggestion_click' | 'product_click';
  productId?: string;
  platform?: 'desktop' | 'mobile';
  timestamp: string;
}

const IN_MEMORY_BUFFER_SIZE = 500;
const inMemoryEvents: SearchEventRecord[] = [];

/**
 * Record a search or click event
 */
export async function recordSearchAnalytics(event: Omit<SearchEventRecord, 'timestamp'>): Promise<void> {
  const record: SearchEventRecord = {
    ...event,
    timestamp: new Date().toISOString()
  };

  // Add to in-memory rolling buffer
  inMemoryEvents.unshift(record);
  if (inMemoryEvents.length > IN_MEMORY_BUFFER_SIZE) {
    inMemoryEvents.pop();
  }

  // Persist to Firestore asynchronously
  try {
    if (admin.apps.length) {
      const db = admin.firestore();
      await db.collection('searchAnalytics').add(record);
    }
  } catch (err) {
    // Non-blocking telemetry
  }
}

/**
 * Retrieve in-memory events for fast dashboard reporting
 */
export function getInMemoryAnalytics(): SearchEventRecord[] {
  return inMemoryEvents;
}

export interface SearchAnalyticsSummary {
  totalSearches: number;
  avgLatencyMs: number;
  zeroResultCount: number;
  zeroResultRate: number;
  topQueries: { query: string; count: number }[];
  zeroResultQueries: { query: string; count: number; lastSearched: string }[];
  recentEvents: SearchEventRecord[];
}

/**
 * Get aggregated analytics report
 */
export async function getAnalyticsSummary(): Promise<SearchAnalyticsSummary> {
  let events: SearchEventRecord[] = [...inMemoryEvents];

  // Try to supplement or load from Firestore if memory has few items
  try {
    if (admin.apps.length) {
      const db = admin.firestore();
      const snapshot = await db.collection('searchAnalytics')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();

      if (!snapshot.empty) {
        const firestoreEvents = snapshot.docs.map(d => d.data() as SearchEventRecord);
        // Deduplicate or use firestore events if memory is cold
        if (events.length < 10) {
          events = firestoreEvents;
        }
      }
    }
  } catch (err) {
    // Non-blocking fallback to inMemoryEvents
  }

  const searchEvents = events.filter(e => e.type === 'search');
  const totalSearches = searchEvents.length;
  const zeroResultEvents = searchEvents.filter(e => e.isZeroResult || e.resultCount === 0);
  const zeroResultCount = zeroResultEvents.length;
  const zeroResultRate = totalSearches > 0 ? Math.round((zeroResultCount / totalSearches) * 100) : 0;

  const totalLatency = searchEvents.reduce((acc, e) => acc + (e.executionTimeMs || 0), 0);
  const avgLatencyMs = totalSearches > 0 ? Math.round((totalLatency / totalSearches) * 10) / 10 : 0;

  // Query frequency count
  const queryCounts: Record<string, number> = {};
  searchEvents.forEach(e => {
    const q = e.query.trim().toLowerCase();
    if (q) {
      queryCounts[q] = (queryCounts[q] || 0) + 1;
    }
  });

  const topQueries = Object.entries(queryCounts)
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Zero-result query count
  const zeroCounts: Record<string, { count: number; lastSearched: string }> = {};
  zeroResultEvents.forEach(e => {
    const q = e.query.trim().toLowerCase();
    if (q) {
      if (!zeroCounts[q]) {
        zeroCounts[q] = { count: 1, lastSearched: e.timestamp };
      } else {
        zeroCounts[q].count += 1;
        if (new Date(e.timestamp) > new Date(zeroCounts[q].lastSearched)) {
          zeroCounts[q].lastSearched = e.timestamp;
        }
      }
    }
  });

  const zeroResultQueries = Object.entries(zeroCounts)
    .map(([query, info]) => ({ query, count: info.count, lastSearched: info.lastSearched }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSearches,
    avgLatencyMs,
    zeroResultCount,
    zeroResultRate,
    topQueries,
    zeroResultQueries,
    recentEvents: events.slice(0, 50)
  };
}

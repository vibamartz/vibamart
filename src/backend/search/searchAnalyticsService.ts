import admin from 'firebase-admin';
import { db } from '../firebase/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { SearchAnalyticsEvent } from './types';

export class SearchAnalyticsService {
  private static instance: SearchAnalyticsService;

  private constructor() {}

  public static getInstance(): SearchAnalyticsService {
    if (!SearchAnalyticsService.instance) {
      SearchAnalyticsService.instance = new SearchAnalyticsService();
    }
    return SearchAnalyticsService.instance;
  }

  /**
   * Logs a search event asynchronously without blocking response.
   */
  public async logSearchEvent(event: SearchAnalyticsEvent): Promise<void> {
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    try {
      if (admin.apps.length > 0) {
        await admin.firestore().collection('searchAnalytics').add(payload);
      } else {
        await addDoc(collection(db, 'searchAnalytics'), payload);
      }
    } catch (err) {
      console.warn('Failed to record search analytics event:', err);
    }
  }

  /**
   * Aggregates search analytics for the Admin Search Engine Dashboard.
   */
  public async getSearchMetrics(): Promise<{
    totalSearches: number;
    zeroResultCount: number;
    zeroResultRatePct: number;
    avgLatencyMs: number;
    popularQueries: { query: string; count: number }[];
    zeroResultQueries: { query: string; count: number; lastSearched: string }[];
    recentLogs: SearchAnalyticsEvent[];
  }> {
    try {
      let events: SearchAnalyticsEvent[] = [];

      if (admin.apps.length > 0) {
        const snap = await admin.firestore().collection('searchAnalytics')
          .orderBy('timestamp', 'desc')
          .limit(500)
          .get();
        events = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      } else {
        const snap = await getDocs(query(collection(db, 'searchAnalytics'), orderBy('timestamp', 'desc'), limit(500)));
        events = snap.docs.map(d => ({ id: d.id, ...d.data() } as SearchAnalyticsEvent));
      }

      const totalSearches = events.length;
      if (totalSearches === 0) {
        return {
          totalSearches: 0,
          zeroResultCount: 0,
          zeroResultRatePct: 0,
          avgLatencyMs: 0,
          popularQueries: [],
          zeroResultQueries: [],
          recentLogs: [],
        };
      }

      let zeroCount = 0;
      let totalLatency = 0;
      const queryCounts = new Map<string, number>();
      const zeroResultMap = new Map<string, { count: number; lastSearched: string }>();

      for (const e of events) {
        if (!e.query) continue;
        const qClean = e.query.toLowerCase().trim();
        queryCounts.set(qClean, (queryCounts.get(qClean) || 0) + 1);

        totalLatency += (e.latencyMs || 0);

        if (e.zeroResult || e.hitCount === 0) {
          zeroCount++;
          const existing = zeroResultMap.get(qClean) || { count: 0, lastSearched: e.timestamp };
          existing.count++;
          if (new Date(e.timestamp) > new Date(existing.lastSearched)) {
            existing.lastSearched = e.timestamp;
          }
          zeroResultMap.set(qClean, existing);
        }
      }

      const popularQueries = Array.from(queryCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const zeroResultQueries = Array.from(zeroResultMap.entries())
        .map(([query, data]) => ({ query, count: data.count, lastSearched: data.lastSearched }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const avgLatencyMs = Math.round((totalLatency / totalSearches) * 10) / 10;
      const zeroResultRatePct = Math.round((zeroCount / totalSearches) * 1000) / 10;

      return {
        totalSearches,
        zeroResultCount: zeroCount,
        zeroResultRatePct,
        avgLatencyMs,
        popularQueries,
        zeroResultQueries,
        recentLogs: events.slice(0, 50),
      };
    } catch (err) {
      console.error('Error calculating search analytics metrics:', err);
      return {
        totalSearches: 0,
        zeroResultCount: 0,
        zeroResultRatePct: 0,
        avgLatencyMs: 0,
        popularQueries: [],
        zeroResultQueries: [],
        recentLogs: [],
      };
    }
  }
}

export const searchAnalyticsService = SearchAnalyticsService.getInstance();

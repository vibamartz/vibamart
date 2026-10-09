/**
 * Utilities for managing user search history with auto-removal after 24 hours (24hr TTL).
 */

export interface SearchHistoryEntry {
  query: string;
  timestamp: number;
}

export const SEARCH_HISTORY_KEY = 'viba_recent_searches';
export const SEARCH_HISTORY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
export const SEARCH_HISTORY_UPDATED_EVENT = 'viba_recent_searches_updated';

/**
 * Loads, cleans up expired (>24h) searches, and returns valid search entries.
 */
export function loadAndCleanSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    let hasChanges = false;
    const validEntries: SearchHistoryEntry[] = [];
    const seenQueries = new Set<string>();

    for (const item of parsed) {
      let query = '';
      let timestamp = now;

      if (typeof item === 'string') {
        query = item.trim();
        timestamp = now; // Upgrade legacy plain string format
        hasChanges = true;
      } else if (item && typeof item === 'object' && typeof item.query === 'string') {
        query = item.query.trim();
        timestamp = typeof item.timestamp === 'number' ? item.timestamp : now;
      }

      if (!query) {
        hasChanges = true;
        continue;
      }

      // Check if entry exceeds 24 hours
      if (now - timestamp > SEARCH_HISTORY_EXPIRY_MS) {
        hasChanges = true;
        continue; // Auto-removed (expired)
      }

      const lower = query.toLowerCase();
      if (!seenQueries.has(lower)) {
        seenQueries.add(lower);
        validEntries.push({ query, timestamp });
      } else {
        hasChanges = true;
      }
    }

    if (hasChanges) {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(validEntries));
    }

    return validEntries;
  } catch (e) {
    console.error('Error reading/cleaning search history:', e);
    return [];
  }
}

/**
 * Get active recent search queries (string array), guaranteed to be <= 24 hours old.
 */
export function getRecentSearches(maxItems: number = 10): string[] {
  const entries = loadAndCleanSearchHistory();
  return entries.slice(0, maxItems).map(e => e.query);
}

/**
 * Add or refresh a search query with current timestamp and auto-purge expired entries.
 */
export function addRecentSearch(rawQuery: string, maxItems: number = 10): string[] {
  const query = rawQuery?.trim();
  if (!query || typeof window === 'undefined') return getRecentSearches(maxItems);

  try {
    const existing = loadAndCleanSearchHistory();
    const now = Date.now();
    const filtered = existing.filter(e => e.query.toLowerCase() !== query.toLowerCase());
    const updated: SearchHistoryEntry[] = [{ query, timestamp: now }, ...filtered].slice(0, maxItems);

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(SEARCH_HISTORY_UPDATED_EVENT));
    return updated.map(e => e.query);
  } catch (e) {
    console.error('Error adding recent search:', e);
    return [];
  }
}

/**
 * Remove a specific search term from history.
 */
export function removeRecentSearch(rawQuery: string): string[] {
  if (!rawQuery || typeof window === 'undefined') return [];

  try {
    const existing = loadAndCleanSearchHistory();
    const updated = existing.filter(e => e.query.toLowerCase() !== rawQuery.trim().toLowerCase());

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(SEARCH_HISTORY_UPDATED_EVENT));
    return updated.map(e => e.query);
  } catch (e) {
    console.error('Error removing recent search:', e);
    return [];
  }
}

/**
 * Clear all search history.
 */
export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    window.dispatchEvent(new Event(SEARCH_HISTORY_UPDATED_EVENT));
  } catch (e) {
    console.error('Error clearing search history:', e);
  }
}

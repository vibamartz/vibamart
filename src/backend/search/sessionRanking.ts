/**
 * ViBa Mart — Session-Aware Contextual Ranking Engine
 * 
 * Implements lightweight, privacy-conscious contextual reranking within active sessions:
 * - Tracks query refinements, category interactions, brand affinities, and price bands.
 * - Enforces strictly bounded influence (maximum +15% affinity boost) so query relevance is never compromised.
 * - Provides absolute session isolation and explicit session reset capability.
 * - Never infers or stores sensitive personal attributes.
 * - Provides completely neutral, unbiased results for new and anonymous users.
 * 
 * 100% self-hosted, pure TypeScript, zero external dependencies.
 */

export interface SessionEvent {
  type: 'search' | 'filter' | 'click' | 'preference';
  query?: string;
  productId?: string;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  price?: number;
  timestamp?: number;
}

export interface SessionContext {
  sessionId: string;
  recentQueries: string[];
  clickedProductIds: string[];
  categoryWeights: Record<string, number>;
  brandWeights: Record<string, number>;
  viewedPrices: number[];
  averageViewedPrice: number;
  lastActive: number;
}

export class SessionRankingManager {
  private sessions: Map<string, SessionContext> = new Map();
  private readonly sessionTtlMs = 30 * 60 * 1000; // 30 minutes inactivity timeout
  private readonly maxTrackedSessions = 2000;

  constructor() {
    // Periodic garbage collection of expired sessions
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000).unref();
    }
  }

  /**
   * Retrieves active session context if session exists and is unexpired.
   * Returns undefined for anonymous/new users without session history.
   */
  public getSessionContext(sessionId?: string): SessionContext | undefined {
    if (!sessionId || typeof sessionId !== 'string') return undefined;
    const cleanId = sessionId.trim();
    if (!cleanId) return undefined;

    const ctx = this.sessions.get(cleanId);
    if (!ctx) return undefined;

    // Check expiration
    if (Date.now() - ctx.lastActive > this.sessionTtlMs) {
      this.sessions.delete(cleanId);
      return undefined;
    }

    ctx.lastActive = Date.now();
    return ctx;
  }

  /**
   * Records a user interaction within the current session.
   */
  public recordEvent(sessionId: string, event: SessionEvent): void {
    if (!sessionId || typeof sessionId !== 'string') return;
    const cleanId = sessionId.trim();
    if (!cleanId) return;

    let ctx = this.sessions.get(cleanId);
    if (!ctx || Date.now() - ctx.lastActive > this.sessionTtlMs) {
      if (this.sessions.size >= this.maxTrackedSessions) {
        this.evictOldestSession();
      }
      ctx = {
        sessionId: cleanId,
        recentQueries: [],
        clickedProductIds: [],
        categoryWeights: {},
        brandWeights: {},
        viewedPrices: [],
        averageViewedPrice: 0,
        lastActive: Date.now()
      };
      this.sessions.set(cleanId, ctx);
    }

    ctx.lastActive = Date.now();

    // 1. Query refinement tracking (capped at last 5)
    if (event.query && typeof event.query === 'string') {
      const q = event.query.toLowerCase().trim();
      if (q && !ctx.recentQueries.includes(q)) {
        ctx.recentQueries.unshift(q);
        if (ctx.recentQueries.length > 5) ctx.recentQueries.pop();
      }
    }

    // 2. Click tracking (capped at last 10)
    if (event.productId && typeof event.productId === 'string') {
      const pid = event.productId.trim();
      if (pid && !ctx.clickedProductIds.includes(pid)) {
        ctx.clickedProductIds.unshift(pid);
        if (ctx.clickedProductIds.length > 10) ctx.clickedProductIds.pop();
      }
    }

    // 3. Category affinity accumulation (bounded to [0.0, 1.0])
    if (event.categoryId) {
      const cat = event.categoryId.toLowerCase().trim();
      const current = ctx.categoryWeights[cat] || 0;
      ctx.categoryWeights[cat] = Math.min(1.0, current + 0.35);
    }
    if (event.categoryName) {
      const catName = event.categoryName.toLowerCase().trim();
      const current = ctx.categoryWeights[catName] || 0;
      ctx.categoryWeights[catName] = Math.min(1.0, current + 0.35);
    }

    // 4. Brand affinity accumulation (bounded to [0.0, 1.0])
    if (event.brand) {
      const b = event.brand.toLowerCase().trim();
      const current = ctx.brandWeights[b] || 0;
      ctx.brandWeights[b] = Math.min(1.0, current + 0.35);
    }

    // 5. Price preference tracking (rolling average of last 5 viewed items)
    if (typeof event.price === 'number' && event.price > 0) {
      ctx.viewedPrices.push(event.price);
      if (ctx.viewedPrices.length > 5) ctx.viewedPrices.shift();
      const sum = ctx.viewedPrices.reduce((a, b) => a + b, 0);
      ctx.averageViewedPrice = Math.round(sum / ctx.viewedPrices.length);
    }
  }

  /**
   * Resets and clears the session context immediately.
   */
  public resetSession(sessionId: string): boolean {
    if (!sessionId) return false;
    return this.sessions.delete(sessionId.trim());
  }

  /**
   * Calculates a bounded contextual score multiplier for a product [1.0, 1.15].
   * The maximum influence is strictly bounded to +15% so query relevance is never compromised.
   */
  public computeSessionMultiplier(
    product: { categoryId: string; categoryName?: string; brand?: string; effectivePrice: number },
    sessionId?: string
  ): number {
    const ctx = this.getSessionContext(sessionId);
    if (!ctx) return 1.0; // Completely neutral for anonymous/new users

    let affinitySum = 0;

    // Category affinity (up to +0.06)
    const catWeight = (ctx.categoryWeights[product.categoryId?.toLowerCase()] || 0) +
                      (ctx.categoryWeights[product.categoryName?.toLowerCase() || ''] || 0);
    affinitySum += Math.min(0.06, catWeight * 0.06);

    // Brand affinity (up to +0.05)
    if (product.brand) {
      const brandWeight = ctx.brandWeights[product.brand.toLowerCase()] || 0;
      affinitySum += Math.min(0.05, brandWeight * 0.05);
    }

    // Price band alignment (up to +0.04)
    if (ctx.averageViewedPrice > 0) {
      const diffRatio = Math.abs(product.effectivePrice - ctx.averageViewedPrice) / ctx.averageViewedPrice;
      if (diffRatio < 0.3) {
        affinitySum += (1.0 - (diffRatio / 0.3)) * 0.04;
      }
    }

    // Strict ceiling: maximum session boost is +15%
    return 1.0 + Math.min(0.15, affinitySum);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, ctx] of this.sessions.entries()) {
      if (now - ctx.lastActive > this.sessionTtlMs) {
        this.sessions.delete(id);
      }
    }
  }

  private evictOldestSession(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, ctx] of this.sessions.entries()) {
      if (ctx.lastActive < oldestTime) {
        oldestTime = ctx.lastActive;
        oldestId = id;
      }
    }
    if (oldestId) this.sessions.delete(oldestId);
  }
}

export const sessionRankingManager = new SessionRankingManager();

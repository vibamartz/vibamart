import { Product, Order, UserProfile, CartItem } from '../../shared/types';
import { CustomerSegment, CustomerNotificationPreferences, ABTestExperiment } from '../../shared/types/notifications';

export interface CustomerBehaviorProfile {
  userId: string;
  displayName?: string;
  email?: string;
  totalOrders: number;
  totalSpend: number;
  avgOrderValue: number;
  daysSinceLastOrder: number;
  daysSinceLastActive: number;
  cartItemCount: number;
  wishlistItemCount: number;
  topCategoryAffinities: { categoryId: string; score: number }[];
  pricePreference: { min: number; max: number; avg: number };
  activeHoursHistogram: Record<number, number>; // 0 to 23 hours count
  churnRisk: 'low' | 'medium' | 'high';
  purchasePropensityScore: number; // 0.0 - 1.0
  predictedCTR: number; // 0.0 - 1.0
  optimalSendHour: number; // 0 - 23
  matchedSegments: string[];
}

export class EngagementMLEngine {
  /**
   * Build full ML behavioral profile for a customer from raw data
   */
  public static buildCustomerProfile(
    user: UserProfile,
    orders: Order[] = [],
    products: Product[] = [],
    events: any[] = []
  ): CustomerBehaviorProfile {
    const userOrders = orders.filter(o => o.customerId === user.uid || (o.contactEmail && o.contactEmail.toLowerCase() === user.email?.toLowerCase()));
    const totalOrders = userOrders.length;
    const totalSpend = userOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

    const now = Date.now();
    let daysSinceLastOrder = 999;
    if (userOrders.length > 0) {
      const mostRecentOrder = userOrders.reduce((latest, o) => {
        const time = new Date(o.createdAt).getTime();
        return time > latest ? time : latest;
      }, 0);
      daysSinceLastOrder = Math.max(0, Math.floor((now - mostRecentOrder) / (1000 * 60 * 60 * 24)));
    }

    const daysSinceAccountCreated = user.createdAt
      ? Math.max(0, Math.floor((now - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const daysSinceLastActive = Math.min(daysSinceLastOrder, daysSinceAccountCreated);

    // Cart and wishlist counts
    const cartItemCount = Array.isArray(user.cart) ? user.cart.reduce((sum, i) => sum + (i.quantity || 1), 0) : 0;
    const wishlistItemCount = Array.isArray(user.wishlist) ? user.wishlist.length : 0;

    // Category affinities
    const categoryScores: Record<string, number> = {};
    userOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        const cat = p?.categoryId || 'general';
        categoryScores[cat] = (categoryScores[cat] || 0) + 5 * item.quantity;
      });
    });

    events.forEach(ev => {
      if (ev.userId === user.uid && ev.categoryId) {
        categoryScores[ev.categoryId] = (categoryScores[ev.categoryId] || 0) + 1;
      }
    });

    const topCategoryAffinities = Object.entries(categoryScores)
      .map(([categoryId, score]) => ({ categoryId, score }))
      .sort((a, b) => b.score - a.score);

    // Active hours histogram from events and orders
    const activeHoursHistogram: Record<number, number> = {};
    for (let h = 0; h < 24; h++) activeHoursHistogram[h] = 0;

    userOrders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      activeHoursHistogram[hour] = (activeHoursHistogram[hour] || 0) + 3;
    });

    events.forEach(e => {
      if (e.userId === user.uid && e.timestamp) {
        const hour = new Date(e.timestamp).getHours();
        activeHoursHistogram[hour] = (activeHoursHistogram[hour] || 0) + 1;
      }
    });

    // Churn Risk Score
    let churnRisk: 'low' | 'medium' | 'high' = 'low';
    if (totalOrders > 0) {
      if (daysSinceLastOrder > 60) churnRisk = 'high';
      else if (daysSinceLastOrder > 25) churnRisk = 'medium';
      else churnRisk = 'low';
    } else {
      if (daysSinceAccountCreated > 30 && cartItemCount === 0) churnRisk = 'high';
      else if (daysSinceAccountCreated > 14) churnRisk = 'medium';
      else churnRisk = 'low';
    }

    // Purchase Propensity Score (0.0 to 1.0)
    let propensityScore = 0.2; // Base propensity
    if (cartItemCount > 0) propensityScore += 0.35;
    if (wishlistItemCount > 0) propensityScore += 0.15;
    if (daysSinceLastActive <= 3) propensityScore += 0.2;
    else if (daysSinceLastActive <= 7) propensityScore += 0.1;
    if (totalOrders >= 3) propensityScore += 0.15;
    else if (totalOrders >= 1) propensityScore += 0.08;
    propensityScore = Math.min(1.0, Math.max(0.05, Math.round(propensityScore * 100) / 100));

    // CTR Prediction Score
    let predictedCTR = 0.12; // Base 12% CTR
    if (daysSinceLastActive <= 5) predictedCTR += 0.1;
    if (cartItemCount > 0 || wishlistItemCount > 0) predictedCTR += 0.08;
    if (totalOrders >= 2) predictedCTR += 0.06;
    predictedCTR = Math.min(0.85, Math.max(0.02, Math.round(predictedCTR * 100) / 100));

    // Optimal Send Hour (Find peak hour in histogram outside quiet hours 22:00 - 08:00)
    let bestHour = 18; // Default 6 PM
    let maxActivity = -1;
    for (let h = 9; h <= 21; h++) {
      if (activeHoursHistogram[h] > maxActivity) {
        maxActivity = activeHoursHistogram[h];
        bestHour = h;
      }
    }

    // Matched Segments
    const matchedSegments: string[] = [];
    if (totalOrders >= 3) matchedSegments.push('frequent_buyers');
    if (totalOrders === 0 && daysSinceAccountCreated <= 14) matchedSegments.push('new_customers');
    if (totalOrders >= 1 && totalOrders <= 2) matchedSegments.push('returning_customers');
    if (totalSpend >= 5000) matchedSegments.push('high_value_customers');
    if (cartItemCount > 0) matchedSegments.push('cart_abandoners');
    if (wishlistItemCount > 0) matchedSegments.push('wishlist_users');
    if (churnRisk === 'high') matchedSegments.push('churn_risk_high');
    if (daysSinceLastOrder <= 7 && totalOrders > 0) matchedSegments.push('recently_purchased');

    topCategoryAffinities.slice(0, 2).forEach(cat => {
      matchedSegments.push(`category_${cat.categoryId}`);
    });

    return {
      userId: user.uid,
      displayName: user.displayName,
      email: user.email,
      totalOrders,
      totalSpend,
      avgOrderValue,
      daysSinceLastOrder,
      daysSinceLastActive,
      cartItemCount,
      wishlistItemCount,
      topCategoryAffinities,
      pricePreference: {
        min: Math.max(0, avgOrderValue * 0.4),
        max: Math.max(2000, avgOrderValue * 2.2),
        avg: avgOrderValue || 800,
      },
      activeHoursHistogram,
      churnRisk,
      purchasePropensityScore: propensityScore,
      predictedCTR,
      optimalSendHour: bestHour,
      matchedSegments,
    };
  }

  /**
   * Recommendation ML: Rank and return personalized products for customer
   */
  public static getPersonalizedRecommendations(
    profile: CustomerBehaviorProfile,
    products: Product[],
    limitCount: number = 4
  ): { product: Product; reason: string; score: number }[] {
    if (!products || products.length === 0) return [];

    const scored = products
      .filter(p => p.status === 'active' && p.inStock !== false && p.stock > 0)
      .map(product => {
        let score = 50; // base score
        let reason = 'Trending pick for you';

        // Category affinity match
        const catMatch = profile.topCategoryAffinities.find(c => c.categoryId === product.categoryId);
        if (catMatch) {
          score += catMatch.score * 8;
          reason = `Popular in your favorite category`;
        }

        // Price preference match
        const price = product.discountPrice || product.price;
        if (price >= profile.pricePreference.min && price <= profile.pricePreference.max) {
          score += 25;
        }

        // Discount attractiveness
        if (product.discountPercentage && product.discountPercentage >= 20) {
          score += product.discountPercentage;
          if (product.discountPercentage >= 30) {
            reason = `${product.discountPercentage}% OFF special deal`;
          }
        }

        // High rating bonus
        if (product.rating && product.rating >= 4.0) {
          score += product.rating * 5;
        }

        return { product, reason, score: Math.round(score) };
      });

    return scored.sort((a, b) => b.score - a.score).slice(0, limitCount);
  }

  /**
   * Send-Time Optimizer: Check if current time matches optimal window or if quiet hours apply
   */
  public static isOptimalSendWindow(
    optimalHour: number,
    isTransactional: boolean = false,
    quietStart: number = 22,
    quietEnd: number = 8
  ): { canSendNow: boolean; reason: string; nextOptimalTime?: string } {
    if (isTransactional) {
      return { canSendNow: true, reason: 'Transactional notifications deliver immediately.' };
    }

    const currentHour = new Date().getHours();

    // Check quiet hours (e.g. 22:00 to 08:00)
    const isQuietHour = quietStart > quietEnd
      ? (currentHour >= quietStart || currentHour < quietEnd)
      : (currentHour >= quietStart && currentHour < quietEnd);

    if (isQuietHour) {
      return {
        canSendNow: false,
        reason: `Suppressed due to quiet hours (${quietStart}:00 - 0${quietEnd}:00). Scheduled for next morning.`,
      };
    }

    // Window check: within 2 hours of optimal hour or daytime
    const hourDiff = Math.abs(currentHour - optimalHour);
    if (hourDiff <= 2 || optimalHour === currentHour) {
      return { canSendNow: true, reason: 'Within optimal engagement window.' };
    }

    return {
      canSendNow: true, // Allow general daytime sending with standard priority
      reason: 'Daytime delivery allowed.',
    };
  }

  /**
   * Frequency Optimization & Debounce check
   */
  public static checkFrequencyLimits(
    userId: string,
    category: string,
    isTransactional: boolean,
    userRecentNotifications: any[] = [],
    maxPerDay: number = 2,
    maxPerWeek: number = 7,
    minCooldownHours: number = 6
  ): { allowed: boolean; reason?: string } {
    if (isTransactional) {
      return { allowed: true };
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const cooldownMs = minCooldownHours * 60 * 60 * 1000;

    const marketingNotifs = userRecentNotifications.filter(
      n => n.category !== 'orders' && n.category !== 'system'
    );

    // Cooldown check
    if (marketingNotifs.length > 0) {
      const lastNotifTime = new Date(marketingNotifs[0].createdAt).getTime();
      if (now - lastNotifTime < cooldownMs) {
        const remainingMinutes = Math.round((cooldownMs - (now - lastNotifTime)) / (1000 * 60));
        return {
          allowed: false,
          reason: `Frequency limit: Minimum cooldown of ${minCooldownHours}h active (${remainingMinutes} mins remaining).`,
        };
      }
    }

    // Daily limit check
    const sentInLast24h = marketingNotifs.filter(n => new Date(n.createdAt).getTime() > oneDayAgo).length;
    if (sentInLast24h >= maxPerDay) {
      return {
        allowed: false,
        reason: `Daily cap reached (${sentInLast24h}/${maxPerDay} marketing notifications sent in past 24h).`,
      };
    }

    // Weekly limit check
    const sentInLast7d = marketingNotifs.filter(n => new Date(n.createdAt).getTime() > oneWeekAgo).length;
    if (sentInLast7d >= maxPerWeek) {
      return {
        allowed: false,
        reason: `Weekly cap reached (${sentInLast7d}/${maxPerWeek} marketing notifications sent in past 7 days).`,
      };
    }

    return { allowed: true };
  }

  /**
   * Contextual Bandit / Thompson Sampling / Epsilon-Greedy A/B Variant Selection
   */
  public static selectABVariant(
    experiment: ABTestExperiment,
    epsilon: number = 0.15 // 15% exploration rate
  ): 'A' | 'B' {
    if (!experiment || !experiment.variants || experiment.variants.length < 2) return 'A';

    const variantA = experiment.variants.find(v => v.variantId === 'A') || experiment.variants[0];
    const variantB = experiment.variants.find(v => v.variantId === 'B') || experiment.variants[1];

    // Exploration: randomly test variant
    if (Math.random() < epsilon || variantA.sent < 10 || variantB.sent < 10) {
      return Math.random() < 0.5 ? 'A' : 'B';
    }

    // Exploitation: Choose higher converting variant based on Conversion Rate & CTR
    const scoreA = (variantA.conversions * 2 + variantA.clicks) / (variantA.sent || 1);
    const scoreB = (variantB.conversions * 2 + variantB.clicks) / (variantB.sent || 1);

    return scoreA >= scoreB ? 'A' : 'B';
  }

  /**
   * NLP/Template Variable Formatter
   */
  public static formatNotificationCopy(
    templateText: string,
    variables: {
      customer_name?: string;
      product_name?: string;
      discount_percent?: number | string;
      order_id?: string;
      offer_expiry?: string;
      cta_url?: string;
      price?: number | string;
      points_balance?: number | string;
    }
  ): string {
    if (!templateText) return '';

    let formatted = templateText;
    const name = variables.customer_name && variables.customer_name.trim() ? variables.customer_name.trim() : 'there';
    
    formatted = formatted.replace(/\{\{\s*customer_name\s*\}\}/gi, name);
    formatted = formatted.replace(/\{\{\s*product_name\s*\}\}/gi, variables.product_name || 'your favorite item');
    formatted = formatted.replace(/\{\{\s*discount_percent\s*\}\}/gi, variables.discount_percent ? `${variables.discount_percent}` : 'special');
    formatted = formatted.replace(/\{\{\s*order_id\s*\}\}/gi, variables.order_id || '');
    formatted = formatted.replace(/\{\{\s*offer_expiry\s*\}\}/gi, variables.offer_expiry || 'midnight');
    formatted = formatted.replace(/\{\{\s*price\s*\}\}/gi, variables.price ? `₹${variables.price}` : '');
    formatted = formatted.replace(/\{\{\s*points_balance\s*\}\}/gi, variables.points_balance ? `${variables.points_balance}` : '0');

    return formatted;
  }
}

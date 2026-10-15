import admin from 'firebase-admin';
import { registerCustomSynonyms } from './searchSynonyms';

export interface PinnedRule {
  query: string;
  productIds: string[];
}

export interface BoostedRule {
  query: string;
  brand?: string;
  category?: string;
  boostFactor: number;
}

export interface RankingWeightsConfig {
  textRelevanceWeight?: number;
  availabilityWeight?: number;
  qualityWeight?: number;
  popularityWeight?: number;
}

export interface CurationConfig {
  pinnedRules: PinnedRule[];
  boostedRules: BoostedRule[];
  customSynonyms: string[][];
  rankingWeights?: RankingWeightsConfig;
}

export class SearchCurationManager {
  private config: CurationConfig = {
    pinnedRules: [],
    boostedRules: [],
    customSynonyms: [],
    rankingWeights: {
      textRelevanceWeight: 1.0,
      availabilityWeight: 1.25,
      qualityWeight: 1.15,
      popularityWeight: 1.1
    }
  };
  private isLoaded = false;

  constructor() {
    this.loadConfig();
  }

  public getConfig(): CurationConfig {
    return this.config;
  }

  public async loadConfig(): Promise<CurationConfig> {
    try {
      if (admin.apps.length) {
        const db = admin.firestore();
        const docSnap = await db.collection('settings').doc('search_curation').get();
        if (docSnap.exists) {
          const data = docSnap.data() as Partial<CurationConfig>;
          this.config = {
            pinnedRules: Array.isArray(data.pinnedRules) ? data.pinnedRules : [],
            boostedRules: Array.isArray(data.boostedRules) ? data.boostedRules : [],
            customSynonyms: Array.isArray(data.customSynonyms) ? data.customSynonyms : [],
            rankingWeights: data.rankingWeights || this.config.rankingWeights
          };
          if (this.config.customSynonyms.length > 0) {
            registerCustomSynonyms(this.config.customSynonyms);
          }
        }
      }
    } catch (err) {
      console.warn('[SearchCurationManager] Could not load curation config from Firestore:', err);
    }
    this.isLoaded = true;
    return this.config;
  }

  public async saveConfig(newConfig: Partial<CurationConfig>): Promise<CurationConfig> {
    this.config = {
      pinnedRules: newConfig.pinnedRules || this.config.pinnedRules,
      boostedRules: newConfig.boostedRules || this.config.boostedRules,
      customSynonyms: newConfig.customSynonyms || this.config.customSynonyms,
      rankingWeights: newConfig.rankingWeights || this.config.rankingWeights
    };

    if (this.config.customSynonyms.length > 0) {
      registerCustomSynonyms(this.config.customSynonyms);
    }

    try {
      if (admin.apps.length) {
        const db = admin.firestore();
        await db.collection('settings').doc('search_curation').set(this.config, { merge: true });
      }
    } catch (err) {
      console.error('[SearchCurationManager] Error saving curation config to Firestore:', err);
    }

    return this.config;
  }

  /**
   * Returns active ranking weight factors.
   */
  public getRankingWeights(): Required<RankingWeightsConfig> {
    const rw = this.config.rankingWeights || {};
    return {
      textRelevanceWeight: rw.textRelevanceWeight ?? 1.0,
      availabilityWeight: rw.availabilityWeight ?? 1.25,
      qualityWeight: rw.qualityWeight ?? 1.15,
      popularityWeight: rw.popularityWeight ?? 1.1
    };
  }

  /**
   * Returns pinned product IDs for a query if configured
   */
  public getPinnedProductIds(query: string): string[] {
    const q = query.trim().toLowerCase();
    const match = this.config.pinnedRules.find(r => r.query.toLowerCase().trim() === q);
    return match ? match.productIds : [];
  }

  /**
   * Returns boost multipliers for candidate document
   */
  public getBoostMultiplier(query: string, brand?: string, categoryId?: string): number {
    const q = query.trim().toLowerCase();
    let multiplier = 1.0;

    for (const rule of this.config.boostedRules) {
      if (rule.query.toLowerCase().trim() === q) {
        if (rule.brand && brand && rule.brand.toLowerCase() === brand.toLowerCase()) {
          multiplier *= rule.boostFactor;
        }
        if (rule.category && categoryId && rule.category.toLowerCase() === categoryId.toLowerCase()) {
          multiplier *= rule.boostFactor;
        }
      }
    }

    return multiplier;
  }
}

export const searchCurationManager = new SearchCurationManager();

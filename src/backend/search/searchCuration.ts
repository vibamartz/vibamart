import admin from 'firebase-admin';

export interface PinnedRule {
  query: string;
  productIds: string[];
}

export interface BoostedRule {
  query: string;
  productId: string;
  boost: number;
}

export interface SearchCurationConfig {
  pinnedRules: PinnedRule[];
  boostedRules: BoostedRule[];
  customSynonyms: string[][];
}

class SearchCurationManager {
  private static instance: SearchCurationManager;
  private config: SearchCurationConfig = {
    pinnedRules: [],
    boostedRules: [],
    customSynonyms: []
  };
  private isLoaded = false;

  public static getInstance(): SearchCurationManager {
    if (!SearchCurationManager.instance) {
      SearchCurationManager.instance = new SearchCurationManager();
    }
    return SearchCurationManager.instance;
  }

  /**
   * Loads curation rules from Firestore 'searchConfig/curation'
   */
  public async loadConfig(): Promise<SearchCurationConfig> {
    try {
      const db = admin.firestore();
      const docSnap = await db.collection('searchConfig').doc('curation').get();

      if (docSnap.exists) {
        const data = docSnap.data() as Partial<SearchCurationConfig>;
        this.config = {
          pinnedRules: Array.isArray(data.pinnedRules) ? data.pinnedRules : [],
          boostedRules: Array.isArray(data.boostedRules) ? data.boostedRules : [],
          customSynonyms: Array.isArray(data.customSynonyms) ? data.customSynonyms : []
        };
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('[SEARCH CURATION] Firestore config load skipped (using defaults):', err);
    }
    return this.config;
  }

  public getConfig(): SearchCurationConfig {
    return this.config;
  }

  public async saveConfig(newConfig: Partial<SearchCurationConfig>): Promise<SearchCurationConfig> {
    this.config = {
      pinnedRules: newConfig.pinnedRules ?? this.config.pinnedRules,
      boostedRules: newConfig.boostedRules ?? this.config.boostedRules,
      customSynonyms: newConfig.customSynonyms ?? this.config.customSynonyms
    };

    try {
      const db = admin.firestore();
      await db.collection('searchConfig').doc('curation').set(this.config, { merge: true });
    } catch (err) {
      console.warn('[SEARCH CURATION] Failed to persist config to Firestore:', err);
    }

    return this.config;
  }

  public getPinnedProductIds(query: string): string[] {
    const qLower = query.trim().toLowerCase();
    const rule = this.config.pinnedRules.find(r => r.query.trim().toLowerCase() === qLower);
    return rule ? rule.productIds : [];
  }

  public getBoostForProduct(query: string, productId: string): number {
    const qLower = query.trim().toLowerCase();
    const rule = this.config.boostedRules.find(
      r => r.query.trim().toLowerCase() === qLower && r.productId === productId
    );
    return rule ? rule.boost : 0;
  }
}

export const searchCurationManager = SearchCurationManager.getInstance();

import admin from 'firebase-admin';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, doc as clientDoc, getDoc as getClientDoc, setDoc as clientSetDoc } from 'firebase/firestore';

function getValidProjectId(): string {
  const envId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!envId || envId === 'your_firebase_project_id' || envId.includes('dummy') || envId.includes('placeholder')) {
    return 'viba-mart-f46a4';
  }
  return envId;
}

function hasAdminCredentials(): boolean {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
  const isPlaceholderKey = !rawKey || rawKey.includes('your_private_key') || rawKey.includes('paste_firebase_private_key') || rawKey === 'paste_firebase_private_key_here';
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && !isPlaceholderKey && admin.apps.length > 0);
}

function getFallbackDb() {
  const projectId = getValidProjectId();
  const existingApp = getClientApps().find(a => a.name === 'curation-fallback');
  const app = existingApp || initClientApp({ projectId }, 'curation-fallback');
  return getClientFirestore(app);
}

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
      if (hasAdminCredentials()) {
        const db = admin.firestore();
        const docSnap = await db.collection('searchConfig').doc('curation').get();

        if (docSnap.exists) {
          const data = docSnap.data() as Partial<SearchCurationConfig>;
          this.config = {
            pinnedRules: Array.isArray(data.pinnedRules) ? data.pinnedRules : [],
            boostedRules: Array.isArray(data.boostedRules) ? data.boostedRules : [],
            customSynonyms: Array.isArray(data.customSynonyms) ? data.customSynonyms : []
          };
          this.isLoaded = true;
          return this.config;
        }
      }
    } catch {
      // Fall through to client Firestore fallback
    }

    try {
      const clientDb = getFallbackDb();
      const docSnap = await getClientDoc(clientDoc(clientDb, 'searchConfig', 'curation'));
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<SearchCurationConfig>;
        this.config = {
          pinnedRules: Array.isArray(data.pinnedRules) ? data.pinnedRules : [],
          boostedRules: Array.isArray(data.boostedRules) ? data.boostedRules : [],
          customSynonyms: Array.isArray(data.customSynonyms) ? data.customSynonyms : []
        };
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('[SEARCH CURATION] Firestore config load skipped (using defaults):', (err as any)?.message || err);
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
      if (hasAdminCredentials()) {
        const db = admin.firestore();
        await db.collection('searchConfig').doc('curation').set(this.config, { merge: true });
        return this.config;
      }
    } catch {
      // Fall through to client Firestore fallback
    }

    try {
      const clientDb = getFallbackDb();
      await clientSetDoc(clientDoc(clientDb, 'searchConfig', 'curation'), this.config, { merge: true });
    } catch (err) {
      console.warn('[SEARCH CURATION] Failed to persist config to Firestore:', (err as any)?.message || err);
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

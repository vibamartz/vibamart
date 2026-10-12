import { SynonymEntry } from './types';
import { db } from '../firebase/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

/**
 * Built-in default synonym dictionary for common Indian e-commerce terms.
 * Guaranteed to provide immediate value even before admin customizes dictionary.
 */
export const DEFAULT_SYNONYMS: Omit<SynonymEntry, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    term: 'mobile',
    synonyms: ['phone', 'smartphone', 'cellphone', 'android', 'iphone', 'handset'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'laptop',
    synonyms: ['notebook', 'computer', 'pc', 'macbook'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'shoes',
    synonyms: ['sneakers', 'footwear', 'boots', 'sandals', 'loafers', 'slippers'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'earbuds',
    synonyms: ['earphones', 'headphones', 'airpods', 'tws', 'headset', 'neckband'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'tshirt',
    synonyms: ['t-shirt', 'tee', 'shirt', 'polos', 'polo'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'smartwatch',
    synonyms: ['watch', 'fitness band', 'tracker', 'wearable'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'tv',
    synonyms: ['television', 'smart tv', 'led tv', 'oled', 'qled'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'fridge',
    synonyms: ['refrigerator', 'deep freezer'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'kurti',
    synonyms: ['kurta', 'ethnic wear', 'tunic'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'saree',
    synonyms: ['sari'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'bag',
    synonyms: ['backpack', 'handbag', 'purse', 'tote', 'duffle'],
    isBidirectional: true,
    isActive: true,
  },
  {
    term: 'perfume',
    synonyms: ['deodorant', 'fragrance', 'cologne', 'body spray', 'deo'],
    isBidirectional: true,
    isActive: true,
  },
];

export class SynonymService {
  private static instance: SynonymService;
  private cachedEntries: SynonymEntry[] = [];
  private lookupMap: Map<string, Set<string>> = new Map();
  private lastFetchTime: number = 0;
  private cacheTTLMs: number = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {
    this.initializeDefaultIndex();
  }

  public static getInstance(): SynonymService {
    if (!SynonymService.instance) {
      SynonymService.instance = new SynonymService();
    }
    return SynonymService.instance;
  }

  /**
   * Initializes the in-memory lookup map from defaults.
   */
  private initializeDefaultIndex(): void {
    const defaultEntries: SynonymEntry[] = DEFAULT_SYNONYMS.map((d, index) => ({
      id: `default_${index}`,
      term: d.term.toLowerCase(),
      synonyms: d.synonyms.map(s => s.toLowerCase()),
      isBidirectional: d.isBidirectional,
      isActive: d.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    this.cachedEntries = defaultEntries;
    this.rebuildLookupMap(defaultEntries);
  }

  /**
   * Rebuilds fast O(1) synonym lookup map.
   */
  private rebuildLookupMap(entries: SynonymEntry[]): void {
    const map = new Map<string, Set<string>>();

    for (const entry of entries) {
      if (!entry.isActive) continue;

      const base = entry.term.toLowerCase().trim();
      const syns = entry.synonyms.map(s => s.toLowerCase().trim()).filter(Boolean);

      if (!map.has(base)) map.set(base, new Set());
      for (const s of syns) {
        map.get(base)!.add(s);
      }

      if (entry.isBidirectional) {
        for (const s of syns) {
          if (!map.has(s)) map.set(s, new Set());
          map.get(s)!.add(base);
          for (const other of syns) {
            if (other !== s) map.get(s)!.add(other);
          }
        }
      }
    }

    this.lookupMap = map;
  }

  /**
   * Loads synonyms from Firestore or returns cached.
   */
  public async getSynonyms(forceRefresh: boolean = false): Promise<SynonymEntry[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedEntries.length > 0 && (now - this.lastFetchTime < this.cacheTTLMs)) {
      return this.cachedEntries;
    }

    try {
      const snap = await getDocs(collection(db, 'search_synonyms'));
      if (!snap.empty) {
        const firestoreEntries: SynonymEntry[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SynonymEntry));
        this.cachedEntries = firestoreEntries;
        this.rebuildLookupMap(firestoreEntries);
        this.lastFetchTime = now;
        return firestoreEntries;
      }
    } catch (err) {
      console.warn('Failed to fetch synonyms from Firestore, falling back to defaults:', err);
    }

    this.initializeDefaultIndex();
    this.lastFetchTime = now;
    return this.cachedEntries;
  }

  /**
   * Expands query terms with recognized synonyms.
   * Returns original terms plus discovered synonyms.
   */
  public expandQueryTerms(terms: string[]): {
    expandedTerms: string[];
    synonymMap: Record<string, string[]>;
  } {
    const expandedSet = new Set<string>();
    const synonymMap: Record<string, string[]> = {};

    for (const term of terms) {
      const clean = term.toLowerCase().trim();
      expandedSet.add(clean);

      const matches = this.lookupMap.get(clean);
      if (matches && matches.size > 0) {
        const list = Array.from(matches);
        synonymMap[clean] = list;
        for (const s of list) {
          expandedSet.add(s);
        }
      }
    }

    return {
      expandedTerms: Array.from(expandedSet),
      synonymMap,
    };
  }

  /**
   * Admin: Add or update a synonym entry in Firestore.
   */
  public async saveSynonym(entry: Omit<SynonymEntry, 'createdAt' | 'updatedAt'> & { id?: string }): Promise<SynonymEntry> {
    const now = new Date().toISOString();
    const id = entry.id || `syn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEntry: SynonymEntry = {
      id,
      term: entry.term.toLowerCase().trim(),
      synonyms: entry.synonyms.map(s => s.toLowerCase().trim()).filter(Boolean),
      isBidirectional: entry.isBidirectional ?? true,
      isActive: entry.isActive ?? true,
      createdAt: (entry as any).createdAt || now,
      updatedAt: now,
      createdBy: entry.createdBy,
    };

    try {
      await setDoc(doc(db, 'search_synonyms', id), fullEntry);
      await this.getSynonyms(true); // Force refresh cache
    } catch (err) {
      console.error('Error saving synonym to Firestore:', err);
      // Still update in-memory
      const idx = this.cachedEntries.findIndex(e => e.id === id);
      if (idx >= 0) this.cachedEntries[idx] = fullEntry;
      else this.cachedEntries.push(fullEntry);
      this.rebuildLookupMap(this.cachedEntries);
    }

    return fullEntry;
  }

  /**
   * Admin: Delete synonym entry.
   */
  public async deleteSynonym(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, 'search_synonyms', id));
      await this.getSynonyms(true);
      return true;
    } catch (err) {
      console.error('Error deleting synonym from Firestore:', err);
      this.cachedEntries = this.cachedEntries.filter(e => e.id !== id);
      this.rebuildLookupMap(this.cachedEntries);
      return false;
    }
  }

  /**
   * Admin: Toggle active state.
   */
  public async toggleSynonymActive(id: string, isActive: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, 'search_synonyms', id), {
        isActive,
        updatedAt: new Date().toISOString()
      });
      await this.getSynonyms(true);
    } catch (err) {
      console.error('Error toggling synonym status in Firestore:', err);
      const target = this.cachedEntries.find(e => e.id === id);
      if (target) {
        target.isActive = isActive;
        this.rebuildLookupMap(this.cachedEntries);
      }
    }
  }
}

export const synonymService = SynonymService.getInstance();

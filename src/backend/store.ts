import { create } from "zustand";
import { UserProfile, CartItem, Product, Category, StoreSettings, FeatureConfig, UserRewards, RewardTransaction } from "../shared/types";
import { CATEGORIES as INITIAL_CATEGORIES, DEFAULT_FEATURES, DEFAULT_VOUCHERS } from "../shared/constants";
import { auth, db, handleFirestoreError, OperationType } from "./firebase/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  orderedProductIds: string[];
  setUser: (user: UserProfile | null) => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  orderedProductIds: [],
  setUser: (user) => set({ user }),
  initAuth: () => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubscribeOrdersSnapshot: (() => void) | null = null;

    onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous snapshot listener if it exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      if (unsubscribeOrdersSnapshot) {
        unsubscribeOrdersSnapshot();
        unsubscribeOrdersSnapshot = null;
      }

      if (firebaseUser) {
        const lastUid = localStorage.getItem("viba_last_uid");
        if (lastUid && lastUid !== firebaseUser.uid) {
          // User switched accounts directly (e.g., via Google Auth) without logging out.
          // Clear previous user's local session to prevent leakage.
          localStorage.removeItem(`viba_cart_${lastUid}`);
        }
        localStorage.setItem("viba_last_uid", firebaseUser.uid);
        
        useCartStore.getState().setUid(firebaseUser.uid);
        // Subscribe to user details
        const docRef = doc(db, "users", firebaseUser.uid);
        unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;

            if (firebaseUser.email === 'vk311779@gmail.com' && data.role !== 'admin') {
              try {
                await setDoc(docRef, { role: 'admin' }, { merge: true });
              } catch (err) {
                console.error("Failed to bootstrap admin role:", err);
                set({ user: { ...data, role: 'admin' }, loading: false });
              }
            } else {
              set({ user: data, loading: false });
            }

            // Sync cart from Firebase if present, or write local cart to Firebase
            if (data.cart && Array.isArray(data.cart)) {
              useCartStore.getState().setItems(data.cart);
            } else {
              const currentCart = useCartStore.getState().items;
              if (currentCart.length > 0) {
                try {
                  await setDoc(docRef, { cart: currentCart }, { merge: true });
                } catch (cartErr) {
                  console.error("[FIRESTORE WRITE ERROR] Failed to sync local cart to Firebase users collection on auth init:", cartErr);
                }
              }
            }
          } else {
            localStorage.removeItem("viba_last_uid");
            useCartStore.getState().setUid(null);
            set({ user: null, loading: false });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          set({ loading: false });
        });

        // Subscribe to ordered products
        const ordersRef = collection(db, "orders");
        const ordersQuery = query(ordersRef, where("customerId", "==", firebaseUser.uid));
        unsubscribeOrdersSnapshot = onSnapshot(ordersQuery, (ordersSnap) => {
          const productIds = new Set<string>();
          ordersSnap.docs.forEach(docSnap => {
            const items = docSnap.data().items || [];
            items.forEach((item: any) => {
              if (item.productId) {
                productIds.add(item.productId);
              }
            });
          });
          set({ orderedProductIds: Array.from(productIds) });
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `orders?customerId=${firebaseUser.uid}`, false);
        });
      } else {
        const lastUid = localStorage.getItem("viba_last_uid");
        if (lastUid) {
          // Completely clear the local session data for the previous account to prevent leakage
          localStorage.removeItem(`viba_cart_${lastUid}`);
        }
        localStorage.removeItem("viba_last_uid");
        useCartStore.getState().setUid(null);
        set({ user: null, orderedProductIds: [], loading: false });
      }
    });
  },
}));

interface CartState {
  items: CartItem[];
  setUid: (uid: string | null) => void;
  setItems: (items: CartItem[]) => void;
  addItem: (product: Product, quantity: number, variantId?: string) => { success: boolean, exists?: boolean };
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  total: () => number;
}

let currentUid: string | null = localStorage.getItem("viba_last_uid");
const getCartKey = () => currentUid ? `viba_cart_${currentUid}` : "viba_cart_guest";

const syncCartToFirebase = (items: CartItem[]) => {
  if (currentUid) {
    const userRef = doc(db, 'users', currentUid);
    // Strip undefined values which Firebase rejects synchronously
    const cleanItems = JSON.parse(JSON.stringify(items));
    setDoc(userRef, { cart: cleanItems }, { merge: true }).catch(err => {
      console.error("Failed to sync cart to Firebase:", err);
    });
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  items: JSON.parse(localStorage.getItem(getCartKey()) || "[]"),
  setUid: (uid) => {
    currentUid = uid;
    if (uid) {
      localStorage.setItem("viba_last_uid", uid);
    } else {
      localStorage.removeItem("viba_last_uid");
    }
    const newKey = getCartKey();
    const localItems = JSON.parse(localStorage.getItem(newKey) || "[]");
    set({ items: localItems });
  },
  setItems: (items) => {
    set({ items });
    localStorage.setItem(getCartKey(), JSON.stringify(items));
  },
  addItem: (product, quantity, variantId) => {
    const items = get().items;

    // Find the relevant variant if variantId is provided
    const variant = variantId && product.variants ? product.variants.find(v => v.id === variantId) : null;

    // Validation: if variantId is provided but variant not found, don't add
    if (variantId && !variant) {
      console.warn(`Attempted to add invalid variant ${variantId} for product ${product.id}`);
      return { success: false };
    }

    // Validation: Check stock for the selected variant or base product
    const availableStock = variant ? variant.stock : product.stock;
    const existing = items.find(i => i.productId === product.id && i.variantId === variantId);

    if (existing) {
      return { success: false, exists: true };
    }

    if (quantity > availableStock) {
      return { success: false };
    }

    const newItems = [...items, { productId: product.id, variantId, quantity, product }];

    set({ items: newItems });
    localStorage.setItem(getCartKey(), JSON.stringify(newItems));
    syncCartToFirebase(newItems);
    return { success: true };
  },
  removeItem: (productId, variantId) => {
    const newItems = get().items.filter(i => !(i.productId === productId && i.variantId === variantId));
    set({ items: newItems });
    localStorage.setItem(getCartKey(), JSON.stringify(newItems));
    syncCartToFirebase(newItems);
  },
  updateQuantity: (productId, quantity, variantId) => {
    const newItems = get().items.map(i =>
      (i.productId === productId && i.variantId === variantId)
        ? { ...i, quantity }
        : i
    );
    set({ items: newItems });
    localStorage.setItem(getCartKey(), JSON.stringify(newItems));
    syncCartToFirebase(newItems);
  },
  clearCart: () => {
    set({ items: [] });
    localStorage.removeItem(getCartKey());
    syncCartToFirebase([]);
  },
  total: () => {
    return get().items.reduce((acc, item) => {
      const basePrice = item.product.discountPrice || item.product.price;
      const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
      const finalPrice = basePrice + (variant?.extraPrice || 0);
      return acc + finalPrice * item.quantity;
    }, 0);
  }
}));

interface CategoryState {
  categories: Category[];
  loading: boolean;
  initCategories: () => void;
}

export const useCategoryStore = create<CategoryState>((set) => ({
  categories: INITIAL_CATEGORIES,
  loading: true,
  initCategories: () => {
    const q = collection(db, 'categories');
    onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

        // Auto-seed missing initial categories to Firestore (admins only)
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
          INITIAL_CATEGORIES.forEach(async (initialCat) => {
            const exists = fetchedCategories.some(c => c.id === initialCat.id);
            if (!exists) {
              try {
                await setDoc(doc(db, 'categories', initialCat.id), initialCat);
              } catch (e) {
                console.error("Failed to seed missing category:", initialCat.id, e);
              }
            }
          });
        }

        fetchedCategories.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        set({ categories: fetchedCategories, loading: false });
      } else {
        // If empty, seed Firestore with initial categories (admins only)
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
          INITIAL_CATEGORIES.forEach(async (cat) => {
            try {
              await setDoc(doc(db, 'categories', cat.id), cat);
            } catch (e) {
              console.error("Failed to seed category", e);
            }
          });
        }
        set({ categories: INITIAL_CATEGORIES, loading: false });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories', false);
      set({ loading: false });
    });
  }
}));

const DEFAULT_SETTINGS: StoreSettings = {
  minKeywords: 6,
  enableVoiceSearch: true,
  enableVisualSearch: true,
  enableBrandFilter: true,
  enableRatingFilter: true,
  enableDiscountFilter: true,
  enableAvailabilityFilter: true,
  enableBanner: true,
  returnWindowDays: 7,
  enableManualCancellation: false
};

interface SettingsState {
  settings: StoreSettings;
  loading: boolean;
  initSettings: () => void;
  updateSettings: (newSettings: Partial<StoreSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,
  initSettings: () => {
    const docRef = doc(db, 'settings', 'storeConfig');
    onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        set({ settings: { ...DEFAULT_SETTINGS, ...docSnap.data() as StoreSettings }, loading: false });
      } else {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
          try {
            await setDoc(docRef, DEFAULT_SETTINGS);
            set({ settings: DEFAULT_SETTINGS, loading: false });
          } catch (e) {
            console.error('Failed to seed default settings', e);
            set({ settings: DEFAULT_SETTINGS, loading: false });
          }
        } else {
          set({ settings: DEFAULT_SETTINGS, loading: false });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/storeConfig', false);
      set({ loading: false });
    });
  },
  updateSettings: async (newSettings: Partial<StoreSettings>) => {
    try {
      const docRef = doc(db, 'settings', 'storeConfig');
      await setDoc(docRef, newSettings, { merge: true });
    } catch (e) {
      console.error('Failed to update settings', e);
      throw e;
    }
  }
}));

// Shared Feature Registry Store (Synchronized in Real-Time for Desktop + Mobile)
interface FeatureState {
  features: FeatureConfig[];
  loading: boolean;
  initFeatures: () => void;
  isFeatureEnabled: (featureId: string) => boolean;
  updateFeature: (featureId: string, updates: Partial<FeatureConfig>) => Promise<void>;
  toggleFeature: (featureId: string, enabled: boolean) => Promise<void>;
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: DEFAULT_FEATURES as FeatureConfig[],
  loading: true,
  initFeatures: () => {
    const q = collection(db, 'features');
    onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const fetchedFeatures = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as FeatureConfig));

        // Auto-seed missing default features if admin
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
          DEFAULT_FEATURES.forEach(async (defFeature) => {
            const exists = fetchedFeatures.some(f => f.id === defFeature.id);
            if (!exists) {
              try {
                await setDoc(doc(db, 'features', defFeature.id), {
                  ...defFeature,
                  updatedAt: new Date().toISOString()
                });
              } catch (e) {
                console.error("Failed to seed feature:", defFeature.id, e);
              }
            }
          });
        }

        set({ features: fetchedFeatures, loading: false });
      } else {
        // Seed default features if collection is completely empty
        const currentUser = useAuthStore.getState().user;
        if (currentUser && currentUser.role === 'admin') {
          DEFAULT_FEATURES.forEach(async (defFeature) => {
            try {
              await setDoc(doc(db, 'features', defFeature.id), {
                ...defFeature,
                updatedAt: new Date().toISOString()
              });
            } catch (e) {
              console.error("Failed to seed default feature:", defFeature.id, e);
            }
          });
        }
        set({ features: DEFAULT_FEATURES as FeatureConfig[], loading: false });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'features', false);
      set({ loading: false });
    });
  },
  isFeatureEnabled: (featureId: string) => {
    const feat = get().features.find(f => f.id === featureId);
    return feat ? feat.enabled : true;
  },
  updateFeature: async (featureId: string, updates: Partial<FeatureConfig>) => {
    try {
      const docRef = doc(db, 'features', featureId);
      await setDoc(docRef, { ...updates, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error(`Failed to update feature ${featureId}:`, e);
      throw e;
    }
  },
  toggleFeature: async (featureId: string, enabled: boolean) => {
    try {
      const docRef = doc(db, 'features', featureId);
      await setDoc(docRef, { enabled, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error(`Failed to toggle feature ${featureId}:`, e);
      throw e;
    }
  }
}));

// Shared Rewards Store (Synchronized for Desktop + Mobile)
interface RewardsState {
  rewards: UserRewards | null;
  loading: boolean;
  initRewards: (userId?: string) => void;
  claimVoucher: (voucherId: string) => Promise<{ success: boolean; message: string; voucher?: any }>;
  addPoints: (points: number, title: string, description?: string) => Promise<void>;
}

export const useRewardsStore = create<RewardsState>((set, get) => ({
  rewards: null,
  loading: true,
  initRewards: (userId?: string) => {
    const currentUid = userId || useAuthStore.getState().user?.uid;
    if (!currentUid) {
      set({ rewards: null, loading: false });
      return;
    }

    const docRef = doc(db, 'user_rewards', currentUid);
    onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        set({ rewards: docSnap.data() as UserRewards, loading: false });
      } else {
        // Initialize default user rewards profile
        const initialRewards: UserRewards = {
          userId: currentUid,
          pointsBalance: 250, // Welcome points bonus
          totalEarned: 250,
          totalSpent: 0,
          tier: 'Silver',
          claimedVouchers: [],
          transactions: [
            {
              id: 'tx-welcome',
              userId: currentUid,
              title: 'Welcome Bonus',
              type: 'earned',
              points: 250,
              date: new Date().toISOString(),
              description: 'Welcome gift for joining ViBa Mart Rewards!'
            }
          ]
        };

        try {
          await setDoc(docRef, initialRewards);
          set({ rewards: initialRewards, loading: false });
        } catch (err) {
          console.error("Failed to initialize user rewards doc:", err);
          set({ rewards: initialRewards, loading: false });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `user_rewards/${currentUid}`, false);
      set({ loading: false });
    });
  },
  claimVoucher: async (voucherId: string) => {
    const currentRewards = get().rewards;
    const currentUser = useAuthStore.getState().user;
    if (!currentRewards || !currentUser) {
      return { success: false, message: 'Please log in to claim reward vouchers.' };
    }

    const voucher = DEFAULT_VOUCHERS.find(v => v.id === voucherId);
    if (!voucher) {
      return { success: false, message: 'Invalid reward voucher.' };
    }

    if (currentRewards.pointsBalance < voucher.pointsRequired) {
      return { success: false, message: `Insufficient points. You need ${voucher.pointsRequired - currentRewards.pointsBalance} more points.` };
    }

    if (currentRewards.claimedVouchers?.includes(voucherId)) {
      return { success: false, message: 'Voucher code already claimed!' };
    }

    const updatedBalance = currentRewards.pointsBalance - voucher.pointsRequired;
    const updatedSpent = currentRewards.totalSpent + voucher.pointsRequired;
    const newTx: RewardTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.uid,
      title: `Claimed Voucher: ${voucher.code}`,
      type: 'spent',
      points: voucher.pointsRequired,
      date: new Date().toISOString(),
      description: `Redeemed ${voucher.pointsRequired} points for ${voucher.title}`
    };

    const updatedClaimed = [...(currentRewards.claimedVouchers || []), voucherId];
    const updatedTxs = [newTx, ...(currentRewards.transactions || [])];

    const docRef = doc(db, 'user_rewards', currentUser.uid);
    try {
      await updateDoc(docRef, {
        pointsBalance: updatedBalance,
        totalSpent: updatedSpent,
        claimedVouchers: updatedClaimed,
        transactions: updatedTxs
      });
      return { success: true, message: `Successfully claimed ${voucher.title}! Code: ${voucher.code}`, voucher };
    } catch (e) {
      console.error("Failed to claim voucher:", e);
      return { success: false, message: 'Failed to claim voucher due to network error.' };
    }
  },
  addPoints: async (points: number, title: string, description?: string) => {
    const currentRewards = get().rewards;
    const currentUser = useAuthStore.getState().user;
    if (!currentRewards || !currentUser) return;

    const updatedBalance = currentRewards.pointsBalance + points;
    const updatedEarned = currentRewards.totalEarned + points;
    const newTx: RewardTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.uid,
      title,
      type: 'earned',
      points,
      date: new Date().toISOString(),
      description
    };

    const updatedTxs = [newTx, ...(currentRewards.transactions || [])];
    const docRef = doc(db, 'user_rewards', currentUser.uid);

    try {
      await updateDoc(docRef, {
        pointsBalance: updatedBalance,
        totalEarned: updatedEarned,
        transactions: updatedTxs
      });
    } catch (e) {
      console.error("Failed to add reward points:", e);
    }
  }
}));


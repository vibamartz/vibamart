import { create } from "zustand";
import { UserProfile, CartItem, Product, Category, StoreSettings, FeatureConfig, UserRewards, RewardTransaction, RewardsSectionConfig, RewardOffer, BrandCoupon, RewardOrder } from "../shared/types";
import { CATEGORIES as INITIAL_CATEGORIES, DEFAULT_FEATURES, DEFAULT_VOUCHERS, DEFAULT_BRAND_COUPONS, DEFAULT_REWARDS_CONFIG } from "../shared/constants";
import { auth, db, handleFirestoreError, OperationType } from "./firebase/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc, deleteDoc, arrayUnion } from "firebase/firestore";
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

            if (firebaseUser.email === 'vk311779@gmail.com' && data.role !== 'admin' && data.role !== 'super_admin') {
              try {
                await setDoc(docRef, { role: 'super_admin' }, { merge: true });
              } catch (err) {
                console.error("Failed to bootstrap super_admin role:", err);
                set({ user: { ...data, role: 'super_admin' }, loading: false });
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
  syncWithProducts: (products: Product[]) => void;
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

    // Validation: Check stock & status for the selected variant or base product
    const availableStock = variant ? variant.stock : product.stock;
    if (product.inStock === false || product.status === 'out_of_stock' || product.status === 'inactive' || availableStock === undefined || availableStock <= 0) {
      return { success: false };
    }

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
  syncWithProducts: (products) => {
    if (!products || products.length === 0) return;
    const currentItems = get().items;
    let modified = false;

    const validItems = currentItems.filter(item => {
      const liveProd = products.find(p => p.id === item.productId);
      if (!liveProd || liveProd.inStock === false || liveProd.status === 'out_of_stock' || liveProd.status === 'inactive') {
        modified = true;
        return false;
      }

      const variant = item.variantId ? liveProd.variants?.find(v => v.id === item.variantId) : null;
      const stock = variant ? variant.stock : liveProd.stock;

      if (stock === undefined || stock <= 0) {
        modified = true;
        return false;
      }

      if (item.quantity > stock) {
        item.quantity = stock;
        modified = true;
      }

      item.product = liveProd;
      return true;
    });

    if (modified) {
      set({ items: validItems });
      localStorage.setItem(getCartKey(), JSON.stringify(validItems));
      syncCartToFirebase(validItems);
    }
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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
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
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
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
  config: RewardsSectionConfig;
  offers: RewardOffer[];
  rewardOrders: RewardOrder[];
  rewards: UserRewards | null;
  loading: boolean;
  initRewards: (userId?: string) => void;
  updateRewardsConfig: (updates: Partial<RewardsSectionConfig>) => Promise<void>;
  addRewardOffer: (offer: Omit<RewardOffer, 'id'>) => Promise<void>;
  updateRewardOffer: (offerId: string, updates: Partial<RewardOffer>) => Promise<void>;
  toggleRewardOffer: (offerId: string, active: boolean) => Promise<void>;
  deleteRewardOffer: (offerId: string) => Promise<void>;
  reorderRewardOffers: (offers: RewardOffer[]) => Promise<void>;
  placeRewardOrder: (orderData: Partial<RewardOrder>) => Promise<{ success: boolean; message: string; orderId?: string }>;
  confirmRewardOrderPayment: (orderId: string) => Promise<{ success: boolean; message: string }>;
  rejectRewardOrderPayment: (orderId: string, notes?: string) => Promise<{ success: boolean; message: string }>;
  markRewardOrderUsed: (orderId: string) => Promise<{ success: boolean; message: string }>;
  claimVoucher: (voucherId: string) => Promise<{ success: boolean; message: string; voucher?: any }>;
  addPoints: (points: number, title: string, description?: string) => Promise<void>;
  isCouponCodeUnique: (code: string, excludeId?: string) => boolean;
}

export const useRewardsStore = create<RewardsState>((set, get) => ({
  config: DEFAULT_REWARDS_CONFIG,
  offers: DEFAULT_BRAND_COUPONS,
  rewardOrders: [],
  rewards: null,
  loading: true,

  initRewards: (userId?: string) => {
    // 1. Subscribe to Global Rewards Config (settings/rewardsConfig)
    const configRef = doc(db, 'settings', 'rewardsConfig');
    onSnapshot(configRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RewardsSectionConfig;
        set({ config: { ...DEFAULT_REWARDS_CONFIG, ...data } });
      } else {
        const currentUser = useAuthStore.getState().user;
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
          try {
            await setDoc(configRef, DEFAULT_REWARDS_CONFIG);
          } catch (e) {
            console.error("Failed to seed default rewards config:", e);
          }
        }
        set({ config: DEFAULT_REWARDS_CONFIG });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/rewardsConfig', false);
    });

    // 2. Subscribe to Reward Offers / Brand Coupons Collection (reward_offers)
    const offersColRef = collection(db, 'reward_offers');
    let hasSeededCoupons = false;
    onSnapshot(offersColRef, async (snapshot) => {
      if (!snapshot.empty) {
        hasSeededCoupons = true;
        const fetchedOffers = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as RewardOffer));

        fetchedOffers.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        set({ offers: fetchedOffers });
      } else if (!hasSeededCoupons) {
        hasSeededCoupons = true;
        const currentUser = useAuthStore.getState().user;
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
          // Auto-seed DEFAULT_BRAND_COUPONS if empty on initial creation only
          DEFAULT_BRAND_COUPONS.forEach(async (vouch) => {
            try {
              await setDoc(doc(db, 'reward_offers', vouch.id), vouch);
            } catch (e) {
              console.error("Failed to seed default reward offer:", vouch.id, e);
            }
          });
        }
        set({ offers: DEFAULT_BRAND_COUPONS });
      } else {
        set({ offers: [] });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reward_offers', false);
    });

    // 3. Subscribe to Rewards Orders Collection (reward_orders)
    const currentUid = userId || useAuthStore.getState().user?.uid;
    const currentUserRole = useAuthStore.getState().user?.role;
    const ordersColRef = collection(db, 'reward_orders');
    const ordersQuery = ((currentUserRole !== 'admin' && currentUserRole !== 'super_admin') && currentUid)
      ? query(ordersColRef, where('userId', '==', currentUid))
      : ordersColRef;

    onSnapshot(ordersQuery, async (snapshot) => {
      if (!snapshot.empty) {
        const fetchedOrders = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as RewardOrder));

        fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        set({ rewardOrders: fetchedOrders });
      } else {
        set({ rewardOrders: [] });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reward_orders', false);
    });

    // 4. Subscribe to User Personal Rewards (user_rewards/{userId})
    if (!currentUid) {
      set({ rewards: null, loading: false });
      return;
    }

    const docRef = doc(db, 'user_rewards', currentUid);
    onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        set({ rewards: docSnap.data() as UserRewards, loading: false });
      } else {
        const initialRewards: UserRewards = {
          userId: currentUid,
          pointsBalance: get().config.welcomeBonusPoints || 250,
          totalEarned: get().config.welcomeBonusPoints || 250,
          totalSpent: 0,
          tier: 'Silver',
          claimedVouchers: [],
          transactions: [
            {
              id: 'tx-welcome',
              userId: currentUid,
              title: 'Welcome Bonus',
              type: 'earned',
              points: get().config.welcomeBonusPoints || 250,
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

  updateRewardsConfig: async (updates: Partial<RewardsSectionConfig>) => {
    try {
      const configRef = doc(db, 'settings', 'rewardsConfig');
      const payload = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await setDoc(configRef, payload, { merge: true });

      // If 'enabled' status was updated, also sync feature registry
      if (typeof updates.enabled === 'boolean') {
        const featureRef = doc(db, 'features', 'rewards');
        await setDoc(featureRef, { enabled: updates.enabled, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {
      console.error("Failed to update rewards config:", e);
      throw e;
    }
  },

  isCouponCodeUnique: (code: string, excludeId?: string) => {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) return true;
    const match = get().offers.find(o => (o.code || '').trim().toUpperCase() === clean && o.id !== excludeId);
    return !match;
  },

  addRewardOffer: async (offerData: Omit<RewardOffer, 'id'>) => {
    try {
      if (offerData.code && !get().isCouponCodeUnique(offerData.code)) {
        throw new Error(`Coupon code '${offerData.code}' is already assigned to another product. Each product must have a unique coupon code.`);
      }
      const offerId = `vouch-${Date.now()}`;
      const newOffer: RewardOffer = {
        ...offerData,
        code: (offerData.code || '').trim().toUpperCase(),
        id: offerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const docRef = doc(db, 'reward_offers', offerId);
      await setDoc(docRef, newOffer);
    } catch (e) {
      console.error("Failed to add reward offer:", e);
      throw e;
    }
  },

  updateRewardOffer: async (offerId: string, updates: Partial<RewardOffer>) => {
    try {
      if (updates.code && !get().isCouponCodeUnique(updates.code, offerId)) {
        throw new Error(`Coupon code '${updates.code}' is already assigned to another product. Each product must have a unique coupon code.`);
      }
      const payload = { ...updates, updatedAt: new Date().toISOString() };
      if (updates.code) {
        payload.code = updates.code.trim().toUpperCase();
      }
      const docRef = doc(db, 'reward_offers', offerId);
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      console.error(`Failed to update reward offer ${offerId}:`, e);
      throw e;
    }
  },

  toggleRewardOffer: async (offerId: string, active: boolean) => {
    try {
      const docRef = doc(db, 'reward_offers', offerId);
      await setDoc(docRef, { active, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error(`Failed to toggle reward offer ${offerId}:`, e);
      throw e;
    }
  },

  deleteRewardOffer: async (offerId: string) => {
    try {
      const docRef = doc(db, 'reward_offers', offerId);
      await deleteDoc(docRef);
    } catch (e) {
      console.error(`Failed to delete reward offer ${offerId}:`, e);
      throw e;
    }
  },

  reorderRewardOffers: async (orderedOffers: RewardOffer[]) => {
    try {
      for (let i = 0; i < orderedOffers.length; i++) {
        const item = orderedOffers[i];
        const docRef = doc(db, 'reward_offers', item.id);
        await updateDoc(docRef, { order: i + 1, updatedAt: new Date().toISOString() });
      }
    } catch (e) {
      console.error("Failed to reorder reward offers:", e);
      throw e;
    }
  },

  placeRewardOrder: async (orderData: Partial<RewardOrder>) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      return { success: false, message: 'Please log in to purchase reward coupons.' };
    }

    const orderId = `RWD-ORD-${Date.now()}`;
    const newOrder: RewardOrder = {
      id: orderId,
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Customer',
      userEmail: currentUser.email || '',
      userPhone: currentUser.phone || '',
      couponId: orderData.couponId || '',
      brandName: orderData.brandName || 'Brand',
      brandLogo: orderData.brandLogo || '',
      productTitle: orderData.productTitle || '',
      productImage: orderData.productImage || '',
      couponTitle: orderData.couponTitle || '',
      discountType: orderData.discountType || 'flat',
      discountValue: orderData.discountValue || 0,
      amountPaid: orderData.amountPaid || 0,
      paymentMethod: orderData.paymentMethod || 'razorpay',
      paymentReference: orderData.paymentReference || '',
      paymentStatus: (orderData.paymentMethod === 'razorpay' || orderData.paymentReference) ? 'submitted' : 'pending',
      verificationStatus: 'pending',
      couponStatus: 'locked',
      validFrom: orderData.validFrom || new Date().toISOString(),
      expiryDate: orderData.expiryDate || new Date().toISOString(),
      brandWebsiteUrl: orderData.brandWebsiteUrl || '',
      createdAt: new Date().toISOString()
    };

    try {
      const orderRef = doc(db, 'reward_orders', orderId);
      await setDoc(orderRef, newOrder);

      // Auto-expire coupon on successful purchase (set remainingQuantity: 0 & active: false)
      if (orderData.couponId) {
        const coupon = get().offers.find(o => o.id === orderData.couponId);
        if (coupon) {
          const couponRef = doc(db, 'reward_offers', coupon.id);
          await updateDoc(couponRef, {
            remainingQuantity: 0,
            active: false,
            updatedAt: new Date().toISOString()
          });
        }
      }

      return { success: true, message: 'Reward order placed! Payment submitted for admin confirmation.', orderId };
    } catch (e) {
      console.error("Failed to place reward order:", e);
      return { success: false, message: 'Failed to submit reward order.' };
    }
  },

  confirmRewardOrderPayment: async (orderId: string) => {
    try {
      const orderRef = doc(db, 'reward_orders', orderId);
      const existing = get().rewardOrders.find(o => o.id === orderId);
      const coupon = get().offers.find(o => o.id === existing?.couponId);
      
      const unlockedCode = coupon?.code || existing?.unlockedCode || `REWARD-${Math.floor(100000 + Math.random() * 900000)}`;

      await updateDoc(orderRef, {
        paymentStatus: 'confirmed',
        verificationStatus: 'approved',
        couponStatus: 'unlocked',
        unlockedCode,
        unlockDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return { success: true, message: `Payment confirmed! Coupon code unlocked for customer.` };
    } catch (e) {
      console.error("Failed to confirm reward order payment:", e);
      return { success: false, message: 'Failed to confirm payment.' };
    }
  },

  rejectRewardOrderPayment: async (orderId: string, notes?: string) => {
    try {
      const orderRef = doc(db, 'reward_orders', orderId);
      await updateDoc(orderRef, {
        paymentStatus: 'rejected',
        verificationStatus: 'rejected',
        notes: notes || 'Payment verification failed',
        updatedAt: new Date().toISOString()
      });
      return { success: true, message: 'Reward order payment rejected.' };
    } catch (e) {
      console.error("Failed to reject reward order payment:", e);
      return { success: false, message: 'Failed to reject payment.' };
    }
  },

  markRewardOrderUsed: async (orderId: string) => {
    try {
      const orderRef = doc(db, 'reward_orders', orderId);
      await updateDoc(orderRef, {
        couponStatus: 'used',
        updatedAt: new Date().toISOString()
      });
      return { success: true, message: 'Reward coupon marked as used.' };
    } catch (e) {
      console.error("Failed to mark reward order as used:", e);
      return { success: false, message: 'Failed to update status.' };
    }
  },

  claimVoucher: async (voucherId: string) => {
    const currentRewards = get().rewards;
    const currentUser = useAuthStore.getState().user;
    if (!currentRewards || !currentUser) {
      return { success: false, message: 'Please log in to claim reward vouchers.' };
    }

    const availableOffers = get().offers.length > 0 ? get().offers : DEFAULT_BRAND_COUPONS;
    const voucher = availableOffers.find(v => v.id === voucherId);
    if (!voucher) {
      return { success: false, message: 'Invalid reward voucher.' };
    }

    if (!voucher.active) {
      return { success: false, message: 'This reward offer is currently inactive.' };
    }

    if (currentRewards.pointsBalance < (voucher.pointsRequired || 100)) {
      return { success: false, message: `Insufficient points. You need ${(voucher.pointsRequired || 100) - currentRewards.pointsBalance} more points.` };
    }

    if (currentRewards.claimedVouchers?.includes(voucherId)) {
      return { success: false, message: 'Voucher code already claimed!' };
    }

    const updatedBalance = currentRewards.pointsBalance - (voucher.pointsRequired || 100);
    const updatedSpent = currentRewards.totalSpent + (voucher.pointsRequired || 100);
    const newTx: RewardTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.uid,
      title: `Claimed Voucher: ${voucher.code}`,
      type: 'spent',
      points: voucher.pointsRequired || 100,
      date: new Date().toISOString(),
      description: `Redeemed ${voucher.pointsRequired || 100} points for ${voucher.title}`
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



import { create } from "zustand";
import { UserProfile, CartItem, Product } from "./types";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where } from "firebase/firestore";
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
                setDoc(docRef, { cart: currentCart }, { merge: true });
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
          console.warn("Failed to listen to customer orders:", error);
        });
      } else {
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

import { Category } from './types';
import { CATEGORIES as INITIAL_CATEGORIES } from './constants';

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

        // Auto-seed missing initial categories to Firestore
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

        fetchedCategories.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        set({ categories: fetchedCategories, loading: false });
      } else {
        // If empty, seed Firestore with initial categories
        INITIAL_CATEGORIES.forEach(async (cat) => {
          try {
            await setDoc(doc(db, 'categories', cat.id), cat);
          } catch (e) {
            console.error("Failed to seed category", e);
          }
        });
        set({ categories: INITIAL_CATEGORIES, loading: false });
      }
    }, (error) => {
      console.error("Failed to fetch categories", error);
      set({ loading: false });
    });
  }
}));

import { StoreSettings } from './types';

const DEFAULT_SETTINGS: StoreSettings = {
  minKeywords: 6,
  enableVoiceSearch: true,
  enableVisualSearch: true,
  enableBrandFilter: true,
  enableRatingFilter: true,
  enableDiscountFilter: true,
  enableAvailabilityFilter: true,
  enableBanner: true
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
        try {
          await setDoc(docRef, DEFAULT_SETTINGS);
          set({ settings: DEFAULT_SETTINGS, loading: false });
        } catch (e) {
          console.error('Failed to seed default settings', e);
          set({ loading: false });
        }
      }
    }, (error) => {
      console.error('Failed to fetch settings', error);
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

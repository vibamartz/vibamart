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

            // Sync cart from Firebase if present
            if (data.cart && Array.isArray(data.cart)) {
              useCartStore.getState().setItems(data.cart);
            }
          } else {
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
        set({ user: null, orderedProductIds: [], loading: false });
      }
    });
  },
}));

interface CartState {
  items: CartItem[];
  setItems: (items: CartItem[]) => void;
  addItem: (product: Product, quantity: number, variantId?: string) => boolean;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  total: () => number;
}

const syncCartToFirebase = (items: CartItem[]) => {
  const user = auth.currentUser;
  if (user) {
    const userRef = doc(db, 'users', user.uid);
    setDoc(userRef, { cart: items }, { merge: true }).catch(err => {
      console.error("Failed to sync cart to Firebase:", err);
    });
  }
};

export const useCartStore = create<CartState>((set, get) => ({
  items: JSON.parse(localStorage.getItem("viba_cart") || "[]"),
  setItems: (items) => {
    set({ items });
    localStorage.setItem("viba_cart", JSON.stringify(items));
  },
  addItem: (product, quantity, variantId) => {
    const items = get().items;

    // Find the relevant variant if variantId is provided
    const variant = variantId && product.variants ? product.variants.find(v => v.id === variantId) : null;

    // Validation: if variantId is provided but variant not found, don't add
    if (variantId && !variant) {
      console.warn(`Attempted to add invalid variant ${variantId} for product ${product.id}`);
      return false;
    }

    // Validation: Check stock for the selected variant or base product
    const availableStock = variant ? variant.stock : product.stock;
    const existing = items.find(i => i.productId === product.id && i.variantId === variantId);
    const currentQtyInCart = existing ? existing.quantity : 0;

    if (currentQtyInCart + quantity > availableStock) {
      return false;
    }

    let newItems;
    if (existing) {
      newItems = items.map(i =>
        (i.productId === product.id && i.variantId === variantId)
          ? { ...i, quantity: i.quantity + quantity }
          : i
      );
    } else {
      newItems = [...items, { productId: product.id, variantId, quantity, product }];
    }

    set({ items: newItems });
    localStorage.setItem("viba_cart", JSON.stringify(newItems));
    syncCartToFirebase(newItems);
    return true;
  },
  removeItem: (productId, variantId) => {
    const newItems = get().items.filter(i => !(i.productId === productId && i.variantId === variantId));
    set({ items: newItems });
    localStorage.setItem("viba_cart", JSON.stringify(newItems));
    syncCartToFirebase(newItems);
  },
  updateQuantity: (productId, quantity, variantId) => {
    const newItems = get().items.map(i =>
      (i.productId === productId && i.variantId === variantId)
        ? { ...i, quantity }
        : i
    );
    set({ items: newItems });
    localStorage.setItem("viba_cart", JSON.stringify(newItems));
    syncCartToFirebase(newItems);
  },
  clearCart: () => {
    set({ items: [] });
    localStorage.removeItem("viba_cart");
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

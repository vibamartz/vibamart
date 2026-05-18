import { create } from "zustand";
import { UserProfile, CartItem, Product } from "./types";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  initAuth: () => {
    let unsubscribeSnapshot: (() => void) | null = null;
    
    onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous snapshot listener if it exists
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (firebaseUser) {
        const docRef = doc(db, "users", firebaseUser.uid);
        unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            
            if (firebaseUser.email === 'vk311779@gmail.com' && data.role !== 'admin') {
              try {
                await setDoc(docRef, { role: 'admin' }, { merge: true });
              } catch (err) {
                console.error("Failed to bootstrap admin role:", err);
                // Even if bootstrapping fails, we can set the local user if token check passes in rules
                set({ user: { ...data, role: 'admin' }, loading: false });
              }
            } else {
              set({ user: data, loading: false });
            }
          } else {
            set({ user: null, loading: false });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          set({ loading: false });
        });
      } else {
        set({ user: null, loading: false });
      }
    });
  },
}));

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity: number, variantId?: string) => boolean;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: JSON.parse(localStorage.getItem("viba_cart") || "[]"),
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
    return true;
  },
  removeItem: (productId, variantId) => {
    const newItems = get().items.filter(i => !(i.productId === productId && i.variantId === variantId));
    set({ items: newItems });
    localStorage.setItem("viba_cart", JSON.stringify(newItems));
  },
  updateQuantity: (productId, quantity, variantId) => {
    const newItems = get().items.map(i => 
      (i.productId === productId && i.variantId === variantId) 
      ? { ...i, quantity } 
      : i
    );
    set({ items: newItems });
    localStorage.setItem("viba_cart", JSON.stringify(newItems));
  },
  clearCart: () => {
    set({ items: [] });
    localStorage.removeItem("viba_cart");
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
import { collection } from 'firebase/firestore';

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
        // Assume document ID is the category ID or similar, but typically we can store one single doc or multiple docs.
        // Let's expect multiple docs for categories.
        const fetchedCategories = snapshot.docs.map(doc => doc.data() as Category);
        // Sort by ID or order if needed, for simplicity sort by ID
        fetchedCategories.sort((a, b) => a.id.localeCompare(b.id));
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

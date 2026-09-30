import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowRight, Star, CheckSquare, Square } from 'lucide-react';
import { collection, query, where, getDocs, documentId, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { useAuthStore, useCartStore } from '../../backend/store';
import { getProductSlug } from '../../shared/utilities/slug';
import { getExpiredRewardProductIds } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileWishlistScreen() {
  const { user } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !user.wishlist || user.wishlist.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const fetchWishlist = async () => {
      try {
        const uniqueWishlist = Array.from(new Set(user.wishlist));
        const expiredRewardIds = await getExpiredRewardProductIds();

        // Auto-clean expired reward products from user's wishlist in Firestore
        const expiredInUserWishlist = uniqueWishlist.filter(id => expiredRewardIds.has(id));
        if (expiredInUserWishlist.length > 0) {
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              wishlist: uniqueWishlist.filter(id => !expiredRewardIds.has(id))
            });
          } catch (cleanErr) {
            console.error("Error cleaning expired reward products from mobile wishlist:", cleanErr);
          }
        }

        const validWishlistIds = uniqueWishlist.filter(id => !expiredRewardIds.has(id));
        if (validWishlistIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, 'products'),
          where(documentId(), 'in', validWishlistIds)
        );
        const querySnapshot = await getDocs(q);
        const wishProds = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(wishProds);
      } catch (err) {
        console.error("Error fetching mobile wishlist:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user]);

  const handleSingleRemove = async (productId: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: arrayRemove(productId)
      });
      setProducts(prev => prev.filter(p => p.id !== productId));
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
      toast.success("Removed from Wishlist");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.id));
    }
  };

  const handleAddSelectedToCart = () => {
    if (selectedProductIds.length === 0) {
      toast.error("Select at least one product");
      return;
    }

    let addedCount = 0;
    selectedProductIds.forEach(id => {
      const prod = products.find(p => p.id === id);
      if (prod) {
        const res = addItem(prod, 1);
        if (res.success) addedCount++;
      }
    });

    if (addedCount > 0) {
      toast.success(`Added ${addedCount} selected item(s) to Cart!`, { icon: '🛒' });
    } else {
      toast.success("Selected items are already in your Cart");
    }
  };

  const handleRemoveSelectedFromWishlist = async () => {
    if (!user || selectedProductIds.length === 0) {
      toast.error("Select at least one product");
      return;
    }

    try {
      const remainingWishlist = (user.wishlist || []).filter(id => !selectedProductIds.includes(id));
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: remainingWishlist
      });

      setProducts(prev => prev.filter(p => !selectedProductIds.includes(p.id)));
      setSelectedProductIds([]);
      toast.success("Selected items removed from wishlist");
    } catch (err) {
      toast.error("Failed to remove selected items");
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Heart className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Sign in to view your Wishlist</h3>
        <p className="text-xs text-gray-500 mb-4">Save items you love and buy them anytime.</p>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
          Login Now
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-2 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-56 animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Heart className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Your wishlist is empty</h3>
        <p className="text-xs text-gray-500 mb-4">Explore items and save your favorites here.</p>
        <button onClick={() => navigate('/products')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
          Explore Products
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 pb-28">
      {/* Wishlist Header & Bulk Selection Controls */}
      <div className="flex flex-col gap-2 pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500 fill-current" />
            Your Wishlist Products ({products.length})
          </h2>

          <button
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedProductIds([]);
            }}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
              isBulkMode
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-800 border-gray-200'
            }`}
          >
            {isBulkMode ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
            Select Multiple Items
          </button>
        </div>

        {isBulkMode && (
          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-gray-100 flex-wrap">
            <button
              onClick={handleSelectAll}
              className="px-2.5 py-1 bg-white text-gray-700 text-[10px] font-bold rounded-lg border border-gray-200"
            >
              {selectedProductIds.length === products.length ? 'Deselect All' : 'Select All'}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAddSelectedToCart}
                disabled={selectedProductIds.length === 0}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  selectedProductIds.length > 0
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-3 h-3" /> Add ({selectedProductIds.length})
              </button>

              <button
                onClick={handleRemoveSelectedFromWishlist}
                disabled={selectedProductIds.length === 0}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  selectedProductIds.length > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clean Wishlist Product Layout without Unnecessary Card Containers */}
      <div className="grid grid-cols-2 gap-2.5">
        {products.map((product) => {
          const isInCart = cartItems.some(i => i.productId === product.id);
          const isSelected = selectedProductIds.includes(product.id);
          const sellingPrice = product.discountPrice || product.price;

          return (
            <motion.div
              key={product.id}
              whileTap={{ scale: 0.98 }}
              className={`relative p-2 rounded-2xl flex flex-col justify-between cursor-pointer ${
                isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
              }`}
              onClick={() => {
                if (isBulkMode) {
                  handleToggleSelectProduct(product.id);
                } else {
                  navigate(`/products/${getProductSlug(product)}`);
                }
              }}
            >
              {isBulkMode && (
                <div className="absolute top-3 left-3 z-10 p-1 bg-white rounded-md shadow-xs border border-gray-200">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              )}

              <div>
                <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50/80 p-1 flex items-center justify-center mb-1">
                  <img src={product.images?.[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-full object-contain" />
                </div>
                <h4 className="text-[11px] font-bold text-gray-900 line-clamp-1 truncate leading-tight min-h-0">{product.name}</h4>
              </div>

              {/* Price */}
              <div className="space-y-1 mt-1 pt-1 border-t border-gray-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-black text-gray-900">₹{sellingPrice.toLocaleString()}</span>
                  {product.discountPrice && product.price > product.discountPrice && (
                    <span className="text-[9px] text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
                  )}
                </div>

                {/* Action Row: Add to Cart + Direct Delete Icon */}
                <div className="flex items-center gap-1 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInCart) {
                        navigate('/cart');
                      } else {
                        const res = addItem(product, 1);
                        if (res.success) toast.success("Added to Cart", { icon: '🛒' });
                        else navigate('/cart');
                      }
                    }}
                    className={`flex-1 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 ${
                      isInCart ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-600 text-white shadow-xs'
                    }`}
                  >
                    <ShoppingCart className="w-3 h-3" />
                    {isInCart ? 'In Cart' : 'Add'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSingleRemove(product.id);
                    }}
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                    className="p-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAuthStore, useCartStore } from '../../backend/store';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { collection, query, where, getDocs, documentId, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { Product } from '../../shared/types';
import { Heart, ShoppingBag, ArrowRight, Trash2, Star, CheckSquare, Square, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { getProductSlug } from '../../shared/utilities/slug';
import { getExpiredRewardProductIds } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';

export default function Wishlist() {
  const { user, loading } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user?.wishlist || user.wishlist.length === 0) {
        setProducts([]);
        setFetching(false);
        return;
      }

      try {
        // Clean unique user wishlist IDs
        const uniqueWishlist = Array.from(new Set(user.wishlist));
        const expiredRewardIds = await getExpiredRewardProductIds();

        // Check if user has any expired reward products in wishlist and remove them
        const expiredInUserWishlist = uniqueWishlist.filter(id => expiredRewardIds.has(id));
        if (expiredInUserWishlist.length > 0) {
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              wishlist: uniqueWishlist.filter(id => !expiredRewardIds.has(id))
            });
          } catch (cleanErr) {
            console.error("Error auto-cleaning expired reward products from wishlist:", cleanErr);
          }
        }

        const validWishlistIds = uniqueWishlist.filter(id => !expiredRewardIds.has(id));
        if (validWishlistIds.length === 0) {
          setProducts([]);
          setFetching(false);
          return;
        }

        const q = query(
          collection(db, 'products'),
          where(documentId(), 'in', validWishlistIds)
        );
        const querySnapshot = await getDocs(q);
        const wishlistProducts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        setProducts(wishlistProducts);
      } catch (err) {
        console.error("Error fetching wishlist products:", err);
      } finally {
        setFetching(false);
      }
    };

    if (!loading && user) {
      fetchWishlist();
    } else if (!loading && !user) {
      setFetching(false);
    }
  }, [user, loading]);

  const handleSingleRemove = async (productId: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: arrayRemove(productId)
      });
      setProducts(prev => prev.filter(p => p.id !== productId));
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
      toast.success("Removed from wishlist");
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

  if (loading || fetching) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading your wishlist...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Wishlist Header & Bulk Selection Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
              <Heart className="w-7 h-7 fill-rose-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Your Wishlist Products</h1>
              <p className="text-gray-500 text-sm font-bold mt-0.5">
                {products.length} {products.length === 1 ? 'product' : 'products'} saved for later
              </p>
            </div>
          </div>

          {products.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedProductIds([]);
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${
                  isBulkMode 
                    ? 'bg-gray-900 text-white border-gray-900' 
                    : 'bg-white text-gray-800 border-gray-200 hover:border-gray-300'
                }`}
              >
                {isBulkMode ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-gray-400" />}
                Select Multiple Items
              </button>

              {isBulkMode && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2.5 bg-white text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold border border-gray-200"
                  >
                    {selectedProductIds.length === products.length ? 'Deselect All' : 'Select All'}
                  </button>

                  <button
                    onClick={handleAddSelectedToCart}
                    disabled={selectedProductIds.length === 0}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                      selectedProductIds.length > 0
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" /> Add Selected to Cart ({selectedProductIds.length})
                  </button>

                  <button
                    onClick={handleRemoveSelectedFromWishlist}
                    disabled={selectedProductIds.length === 0}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      selectedProductIds.length > 0
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" /> Remove Selected
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Clean Wishlist Product Layout without Unnecessary Card Containers */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => {
              const isInCart = cartItems.some(i => i.productId === product.id);
              const isSelected = selectedProductIds.includes(product.id);
              const sellingPrice = product.discountPrice || product.price;

              return (
                <div
                  key={product.id}
                  className={`relative flex flex-col justify-between p-3 rounded-2xl transition-all ${
                    isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
                  }`}
                >
                  {/* Bulk Checkbox */}
                  {isBulkMode && (
                    <button
                      onClick={() => handleToggleSelectProduct(product.id)}
                      className="absolute top-4 left-4 z-20 p-1.5 bg-white rounded-lg shadow-md border border-gray-200"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}

                  <Link to={`/products/${getProductSlug(product)}`} className="block group">
                    <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 p-2 flex items-center justify-center mb-3">
                      <img
                        src={product.images?.[0] || 'https://via.placeholder.com/300'}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug hover:text-primary transition-colors min-h-[40px]">
                      {product.name}
                    </h3>
                  </Link>

                  {/* Rating Stars & Price Info */}
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-xs font-black">
                        {product.rating || 4.5} <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                      </div>
                      <span className="text-xs text-gray-400 font-bold">({product.numReviews || 0})</span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-gray-900">₹{sellingPrice.toLocaleString()}</span>
                      {product.discountPrice && product.price > product.discountPrice && (
                        <span className="text-xs text-gray-400 line-through font-bold">₹{product.price.toLocaleString()}</span>
                      )}
                    </div>

                    {/* Action Row: Add to Cart + Direct Delete Icon */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => {
                          if (isInCart) {
                            navigate('/cart');
                          } else {
                            const res = addItem(product, 1);
                            if (res.success) toast.success("Added to Cart", { icon: '🛒' });
                            else navigate('/cart');
                          }
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          isInCart
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {isInCart ? 'In Cart' : 'Add to Cart'}
                      </button>

                      <button
                        onClick={() => handleSingleRemove(product.id)}
                        title="Remove from wishlist"
                        aria-label="Remove from wishlist"
                        className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-gray-200 hover:border-rose-200 shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-16 text-center"
          >
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Your wishlist is empty</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-8 text-sm font-medium">
              Save items you love by tapping the heart icon on any product page.
            </p>
            <Link 
              to="/products"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-md"
            >
              Explore Products <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

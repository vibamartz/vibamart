import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Heart, Clock, Truck, Zap 
} from 'lucide-react';
import { useCartStore, useAuthStore } from '../../backend/store';
import { getProductSlug } from '../../shared/utilities/slug';
import { getFormattedDeliveryDate } from '../../shared/utilities/dateUtils';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { Product } from '../../shared/types';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import CategoryLogo from '../../shared/components/CategoryLogo';

function MobileRecentlyViewedSection() {
  const { addItem, items: cartItems } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const savedIds: string[] = JSON.parse(localStorage.getItem('viba_recently_viewed') || '[]');
        if (savedIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }
        const targetIds = savedIds.slice(0, 4);
        const q = query(collection(db, 'products'), where(documentId(), 'in', targetIds));
        const snapshot = await getDocs(q);
        const rewardIds = await getRewardProductIds();
        const fetched = filterOutRewardProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)), rewardIds);
        fetched.sort((a, b) => targetIds.indexOf(a.id) - targetIds.indexOf(b.id));
        setProducts(fetched);
      } catch (err) {
        console.error('Error fetching recently viewed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-emerald-600" />
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Recently Viewed</h3>
      </div>
      {loading ? (
        <div className="py-4 text-center">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-[11px] text-gray-400 font-medium py-2 text-center">No recently viewed items yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {products.map((product) => {
            const isInCart = cartItems.some(i => i.productId === product.id);
            return (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                className="bg-gray-50 rounded-xl p-2 border border-gray-100 cursor-pointer space-y-1.5 flex flex-col justify-between"
              >
                <div>
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-white">
                    <img src={product.images?.[0]} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 line-clamp-1 mt-1">{product.name}</p>
                  <p className="text-xs font-black text-emerald-700">₹{(product.discountPrice || product.price).toLocaleString()}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInCart) {
                      toast.success("Item is in cart");
                    } else {
                      const res = addItem(product, 1);
                      if (res.success) toast.success("Added to Cart", { icon: '🛒' });
                      else toast.error("Could not add to cart");
                    }
                  }}
                  className={`w-full py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                    isInCart ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-600 text-white shadow-xs'
                  }`}
                >
                  {isInCart ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileWishlistSection() {
  const { user } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user?.wishlist || user.wishlist.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      try {
        const targetIds = user.wishlist.slice(0, 4);
        const q = query(collection(db, 'products'), where(documentId(), 'in', targetIds));
        const snapshot = await getDocs(q);
        const rewardIds = await getRewardProductIds();
        const fetched = filterOutRewardProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)), rewardIds);
        setProducts(fetched);
      } catch (err) {
        console.error('Error fetching wishlist:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchWishlist();
    } else {
      setLoading(false);
    }
  }, [user]);

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 space-y-3">
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Your Wishlist Products</h3>
      </div>
      {loading ? (
        <div className="py-4 text-center">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-[11px] text-gray-400 font-medium py-2 text-center">No wishlist products saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {products.map((product) => {
            const isInCart = cartItems.some(i => i.productId === product.id);
            return (
              <div
                key={product.id}
                onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                className="bg-gray-50 rounded-xl p-2 border border-gray-100 cursor-pointer space-y-1.5 flex flex-col justify-between"
              >
                <div>
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-white">
                    <img src={product.images?.[0]} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 line-clamp-1 mt-1">{product.name}</p>
                  <p className="text-xs font-black text-emerald-700">₹{(product.discountPrice || product.price).toLocaleString()}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isInCart) {
                      toast.success("Item is in cart");
                    } else {
                      const res = addItem(product, 1);
                      if (res.success) toast.success("Added to Cart", { icon: '🛒' });
                      else toast.error("Could not add to cart");
                    }
                  }}
                  className={`w-full py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ${
                    isInCart ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-600 text-white shadow-xs'
                  }`}
                >
                  {isInCart ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MobileCartScreen() {
  const { items, updateQuantity, removeItem, clearCart, total } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const cartTotal = total();
  const totalSavings = items.reduce((acc, item) => {
    const origPrice = item.product.price || 0;
    const actualPrice = item.product.discountPrice || origPrice;
    return acc + (origPrice - actualPrice) * item.quantity;
  }, 0);

  const deliveryCharge = cartTotal > 599 || items.length === 0 ? 0 : 40;
  const grandTotal = cartTotal + deliveryCharge;

  const handleDecreaseQuantity = (productId: string, currentQty: number, variantId?: string) => {
    if (currentQty <= 1) {
      removeItem(productId, variantId);
      toast.success("Item removed from cart");
    } else {
      updateQuantity(productId, currentQty - 1, variantId);
    }
  };

  const handleIncreaseQuantity = (productId: string, currentQty: number, maxStock: number, variantId?: string) => {
    if (currentQty >= maxStock) {
      toast.error(`Maximum available stock reached (${maxStock})`);
      return;
    }
    updateQuantity(productId, currentQty + 1, variantId);
  };

  const handleMoveToWishlist = async (productId: string, variantId?: string) => {
    if (!user) {
      toast.error('Please login to move item to wishlist');
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: arrayUnion(productId)
      });
      removeItem(productId, variantId);
      toast.success('Moved to wishlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleBuyNow = (productId: string, variantId?: string) => {
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-44 font-sans select-none p-3 space-y-3">
      
      {/* 1. CART SECTION */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-yellow-100 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-700">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-base font-black text-gray-900">Your Cart is Empty</h2>
          <p className="text-xs text-gray-500 font-medium max-w-xs mt-1 mb-4">
            Looks like you haven't added any products to your cart yet.
          </p>
          <button
            onClick={() => navigate('/products')}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1.5"
          >
            Explore Products <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Top Header Card */}
          <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-900">
                Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
              </h2>
              <p className="text-[10px] text-gray-500 font-bold">
                Account: {user?.displayName || user?.email || 'Guest User'}
              </p>
            </div>
            <button
              onClick={clearCart}
              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Cart
            </button>
          </div>

          {/* Free Delivery Banner */}
          {deliveryCharge === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>🎉 You unlocked <strong>FREE Delivery</strong> on this order!</span>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-800">
              Add ₹{(599 - cartTotal).toLocaleString()} more to get <strong>FREE Delivery</strong>!
            </div>
          )}

          {/* Cart Items List */}
          <div className="space-y-2.5">
            {items.map((item) => {
              const product = item.product;
              const variant = item.variantId ? product.variants?.find(v => v.id === item.variantId) : null;
              const basePrice = product.discountPrice || product.price;
              const unitPrice = basePrice + (variant?.extraPrice || 0);
              const maxStock = variant ? variant.stock : product.stock;
              const deliveryText = getFormattedDeliveryDate(product);

              return (
                <motion.div
                  key={`${item.productId}-${item.variantId || 'default'}`}
                  layout
                  className="bg-white rounded-2xl p-3 shadow-sm border border-yellow-100 flex flex-col gap-2.5 relative"
                >
                  <div className="flex gap-3">
                    {/* Product Image */}
                    <div 
                      onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                      className="w-20 h-20 rounded-xl bg-gray-50 overflow-hidden shrink-0 border border-gray-100 cursor-pointer"
                    >
                      <img 
                        src={variant?.image || product.images?.[0] || 'https://via.placeholder.com/150'} 
                        alt={product.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block truncate">
                          {product.brand || 'ViBa Select'}
                        </span>
                        <h4 
                          onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                          className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight cursor-pointer"
                        >
                          {product.name}
                        </h4>
                        {variant && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            Variant: {variant.name || variant.color || variant.size}
                          </span>
                        )}

                        {/* Requirement 2: Dynamic Delivery Date */}
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                          <Truck className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{deliveryText}</span>
                        </div>
                      </div>

                      {/* Price & Quantity Controls */}
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black text-gray-900">
                            ₹{(unitPrice * item.quantity).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            (₹{unitPrice}/ea)
                          </span>
                        </div>

                        {/* Quantity Incrementor */}
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                          <button
                            onClick={() => handleDecreaseQuantity(product.id, item.quantity, item.variantId)}
                            className="w-6 h-6 rounded-lg bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-gray-900 min-w-[16px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncreaseQuantity(product.id, item.quantity, maxStock, item.variantId)}
                            className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Requirement 2: Cart Product Independent Action Buttons */}
                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleMoveToWishlist(product.id, item.variantId)}
                      className="flex-1 py-1.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-xl border border-rose-100 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Heart className="w-3 h-3 text-rose-500" /> Move to Wishlist
                    </button>
                    
                    <button
                      onClick={() => handleBuyNow(product.id, item.variantId)}
                      className="flex-1 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Zap className="w-3 h-3" /> Buy Now
                    </button>

                    <button
                      onClick={() => { removeItem(product.id, item.variantId); toast.success("Item removed"); }}
                      className="py-1.5 px-3 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-transform"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Bill Details Summary Card */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2.5">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              Price Details & Bill Breakdown
            </h3>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600 font-medium">
                <span>Item Subtotal ({items.length} items)</span>
                <span className="font-bold text-gray-900">₹{cartTotal.toLocaleString()}</span>
              </div>

              {totalSavings > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Total Product Savings</span>
                  <span>-₹{totalSavings.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600 font-medium">
                <span>Delivery Charges</span>
                {deliveryCharge === 0 ? (
                  <span className="font-black text-emerald-600 uppercase">FREE</span>
                ) : (
                  <span className="font-bold text-gray-900">₹{deliveryCharge}</span>
                )}
              </div>

              <div className="flex justify-between text-gray-600 font-medium">
                <span>Estimated Taxes & GST</span>
                <span className="font-bold text-gray-900">Included</span>
              </div>

              <div className="pt-2 border-t border-gray-100 flex justify-between items-baseline text-sm">
                <span className="font-black text-gray-900">Total Payable Amount</span>
                <span className="text-base font-black text-emerald-700">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. RECENTLY VIEWED SECTION */}
      <MobileRecentlyViewedSection />

      {/* 3. YOUR WISHLIST PRODUCTS SECTION */}
      <MobileWishlistSection />

      {/* Sticky Bottom Checkout Bar (only if items present) */}
      {items.length > 0 && (
        <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-yellow-100 p-3 shadow-lg flex items-center justify-between max-w-md mx-auto">
          <div>
            <span className="text-[10px] font-black uppercase text-gray-400">Total</span>
            <p className="text-base font-black text-gray-900">₹{grandTotal.toLocaleString()}</p>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-2 active:scale-95"
          >
            Proceed to Checkout <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useCartStore, useAuthStore } from '../../backend/store';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, Heart, Clock, Truck, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { getProductSlug } from '../../shared/utilities/slug';
import { getFormattedDeliveryDate } from '../../shared/utilities/dateUtils';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { Product } from '../../shared/types';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import ProductCard from '../components/ProductCard';
import toast from 'react-hot-toast';

function RecentlyViewedCartSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-50 rounded-xl text-primary">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-900">Recently Viewed</h3>
          <p className="text-xs text-gray-500 font-medium">Items you recently checked out</p>
        </div>
      </div>
      {loading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-gray-400 font-medium py-4 text-center">No recently viewed items yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function WishlistCartSection() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-rose-50 rounded-xl text-rose-500">
          <Heart className="w-5 h-5 fill-current" />
        </div>
        <div>
          <h3 className="text-xl font-black text-gray-900">Your Wishlist Products</h3>
          <p className="text-xs text-gray-500 font-medium">Products saved for later</p>
        </div>
      </div>
      {loading ? (
        <div className="py-8 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-gray-400 font-medium py-4 text-center">No wishlist products saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Cart() {
  const { items, removeItem, updateQuantity, total } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

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

  const subtotal = total();
  const totalMRP = items.reduce((acc, item) => {
    const origPrice = item.product.price || item.product.discountPrice || 0;
    const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
    const extra = variant?.extraPrice || 0;
    return acc + (origPrice + extra) * item.quantity;
  }, 0);
  const discount = Math.max(0, totalMRP - subtotal);
  const shipping = subtotal < 600 && items.length > 0 ? 49 : 0;
  const grandTotal = subtotal + shipping;

  return (
    <div className="bg-gray-50 min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Cart Top Section */}
        {items.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-md mx-auto border border-gray-100">
            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-8 font-medium">Looks like you haven't added anything to your cart yet. Let's find something amazing for you!</p>
            <Link to="/products" className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-blue-100">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items List */}
            <div className="flex-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black text-gray-900 mb-6">Shopping Cart ({items.length})</h2>
                <div className="divide-y divide-gray-100 font-medium">
                  {items.map((item) => {
                    const deliveryText = getFormattedDeliveryDate(item.product);

                    return (
                      <div key={`${item.productId}-${item.variantId}`} className="py-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
                          <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-xl bg-gray-50" />
                        </div>
                        <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <Link to={`/products/${getProductSlug(item.product)}`} className="text-base sm:text-lg font-bold text-gray-800 hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1">
                                {item.product.name}
                              </Link>
                              <p className="text-[10px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">Official Store</p>
                              {item.variantId && (() => {
                                const variant = item.product.variants?.find(v => v.id === item.variantId);
                                return (
                                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-bold">
                                    Option: <span className="text-primary">{variant?.name || item.variantId}</span>
                                  </p>
                                );
                              })()}

                              {/* Requirement 2: Dynamic Delivery Date */}
                              <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-100">
                                <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{deliveryText}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              {(() => {
                                const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
                                const basePrice = item.product.discountPrice || item.product.price;
                                const itemPrice = basePrice + (variant?.extraPrice || 0);
                                const savings = (item.product.price - (item.product.discountPrice || item.product.price)) * item.quantity;
                                return (
                                  <>
                                    <p className="text-lg sm:text-xl font-black text-gray-900">₹{(itemPrice * item.quantity).toLocaleString()}</p>
                                    {savings > 0 && <p className="text-[10px] sm:text-xs text-green-600 font-black">SAVE ₹{savings.toLocaleString()}</p>}
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-gray-50">
                            {/* Quantity Selector */}
                            <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-gray-100">
                              <button 
                                onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1), item.variantId)}
                                className="text-gray-500 hover:text-primary p-1.5 touch-target transition-colors"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <span className="text-xs sm:text-sm font-black w-4 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                className="text-gray-500 hover:text-primary p-1.5 touch-target transition-colors"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </div>

                            {/* Requirement 2: Cart Product Independent Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => handleMoveToWishlist(item.productId, item.variantId)}
                                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-100"
                              >
                                <Heart className="w-3.5 h-3.5 text-rose-500" /> Move to Wishlist
                              </button>
                              
                              <button
                                onClick={() => handleBuyNow(item.productId, item.variantId)}
                                className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                              >
                                <Zap className="w-3.5 h-3.5" /> Buy Now
                              </button>

                              <button
                                onClick={() => { removeItem(item.productId, item.variantId); toast.success("Item removed"); }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-600">
                  <ShoppingBag className="w-6 h-6" />
                  <p className="font-medium">Add more items to unlock free gifts! 🎁</p>
                </div>
                <Link to="/products" className="text-primary font-bold text-sm hover:underline">Continue Shopping</Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="w-full lg:w-96 space-y-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
                <h3 className="text-xl font-black text-gray-900 mb-6">Price Details</h3>
                <div className="space-y-4 text-sm font-medium border-b border-gray-100 pb-6 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Total MRP ({items.length} items)</span>
                    <span className="text-gray-900 font-bold">₹{totalMRP.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-bold">{discount > 0 ? `- ₹${discount.toLocaleString()}` : '₹0'}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Charges</span>
                    <span className={shipping === 0 ? 'text-emerald-600 font-bold' : 'text-gray-900 font-bold'}>
                      {shipping === 0 ? 'FREE' : `₹${shipping}`}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xl font-black text-gray-900 mb-8 px-1">
                  <span>Total Price</span>
                  <span>₹{grandTotal.toLocaleString()}</span>
                </div>
                <Link to="/checkout" className="w-full touch-target min-h-[44px] bg-primary text-white py-5 rounded-2xl font-black text-center flex items-center justify-center gap-2 hover:bg-primary-hover shadow-lg shadow-blue-100 transition-all uppercase tracking-widest">
                  Place Order <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="mt-4 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest leading-relaxed">
                  Secure SSL Encrypted Payment <br/> 100% Buyer Protection Guaranteed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Requirement 1: Recently Viewed Section */}
        <RecentlyViewedCartSection />

        {/* Requirement 1: Your Wishlist Products Section */}
        <WishlistCartSection />

      </div>
    </div>
  );
}

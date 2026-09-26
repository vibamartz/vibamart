import React, { useState } from 'react';
import { Product, ProductVariant } from '../../shared/types';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Heart, ChevronDown, Eye, Truck } from 'lucide-react';
import { useCartStore, useAuthStore } from '../../backend/store';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { getProductSlug } from '../../shared/utilities/slug';

interface ProductCardProps {
  product: Product;
  key?: any;
  showActionsAlways?: boolean;
  hideButtons?: boolean;
}

export default function ProductCard({ product, showActionsAlways = false, hideButtons = false }: ProductCardProps) {
  const { addItem, items } = useCartStore();
  const { user } = useAuthStore();

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0].id : undefined
  );

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);
  const isInCart = items.some(item => item.productId === product.id && item.variantId === selectedVariantId);

  const navigate = useNavigate();

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      navigate('/checkout');
      return;
    }
    const result = addItem(product, 1, selectedVariantId);
    if (result.success || result.exists) {
      navigate('/checkout');
    } else {
      toast.error('Could not proceed to checkout. Out of stock.');
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const result = addItem(product, 1, selectedVariantId);
    if (result.success) {
      toast.success('Product added to cart');
    } else if (result.exists) {
      navigate('/cart');
    } else if (result.limitReached) {
      toast.error('Cart limit reached (100 items max)');
    } else {
      toast.error('Could not add to cart. Out of stock.');
    }
  };

  const isWishlisted = user?.wishlist?.includes(product.id);

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error('Please login to use wishlist');
      return;
    }

    const currentWishlist = user.wishlist || [];
    const newWishlist = isWishlisted
      ? currentWishlist.filter(id => id !== product.id)
      : Array.from(new Set([...currentWishlist, product.id]));

    useAuthStore.getState().setUser({ ...user, wishlist: newWishlist });

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: isWishlisted ? arrayRemove(product.id) : arrayUnion(product.id)
      });
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const discountAmount = product.discountPrice && product.price ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice && product.price ? Math.round((discountAmount / product.price) * 100) : 0;

  return (
    <Link 
      to={`/products/${getProductSlug(product)}`}
      className="block h-full no-underline text-inherit"
    >
      <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        className="group bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 relative flex flex-col h-full cursor-pointer"
      >
        <div className="block relative aspect-square overflow-hidden bg-gray-50/80 p-1.5 flex items-center justify-center">
          <img
            src={product.images?.[0] || 'https://via.placeholder.com/400x500?text=No+Image'}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
          
          {discountPercentage > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
              {discountPercentage}% OFF
            </span>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); handleToggleWishlist(e); }}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className={`absolute top-2.5 right-2.5 p-2 touch-target rounded-full transition-all shadow-sm z-10 flex items-center justify-center ${
              isWishlisted 
                ? 'bg-rose-500 text-white' 
                : 'bg-white/80 backdrop-blur-sm text-gray-400 hover:text-green-500 hover:bg-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="p-2.5 flex flex-col flex-1">
          <span className="text-sm font-bold text-gray-900 line-clamp-1 hover:text-green-600 transition-colors mb-1">
            {product.name}
          </span>

          {product.variants && product.variants.length > 0 ? (
            <div className="mb-2 space-y-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Select Variant</label>
              </div>
              <div className="relative group/select">
                <select 
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs border-2 border-gray-100 rounded-xl py-1.5 px-3 bg-gray-50 focus:outline-none focus:border-green-600/30 focus:bg-white transition-all font-black appearance-none cursor-pointer pr-8"
                >
                  {product.variants.map((v) => (
                    <option key={v.id} value={v.id} disabled={v.stock === 0}>
                      {v.name} {v.extraPrice > 0 ? `(+₹${v.extraPrice})` : ''} {v.stock === 0 ? '(Out of Stock)' : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover/select:text-green-600 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex items-end justify-between pt-1 border-t border-gray-50">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-gray-900">
                  ₹{((product.discountPrice || product.price || 0) + (selectedVariant?.extraPrice || 0)).toLocaleString()}
                </span>
                {product.discountPrice && product.price && (
                  <span className="text-xs text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {product.isFreeDelivery !== false ? (
                  <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Free Delivery</p>
                ) : (
                  <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Standard Delivery</p>
                )}
                {product.discountPrice && product.price && (
                  <span className="text-[10px] text-green-600 font-black">
                    • Save ₹{(product.price - product.discountPrice).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

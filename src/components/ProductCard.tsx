import React, { useState } from 'react';
import { Product, ProductVariant } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Heart, ChevronDown, Eye, Truck } from 'lucide-react';
import { useCartStore, useAuthStore } from '../store';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';

interface ProductCardProps {
  product: Product;
  key?: any;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const { user, orderedProductIds } = useAuthStore();
  const hasBeenOrdered = orderedProductIds?.includes(product.id);

  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0].id : undefined
  );

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);

  const navigate = useNavigate();

  const handleTrackOrder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    
    const toastId = toast.loading('Locating your order...');
    try {
      const ordersRef = collection(db, "orders");
      const q = query(
        ordersRef, 
        where("customerId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const ordersList: any[] = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.items?.some((item: any) => item.productId === product.id)) {
          ordersList.push({ id: docSnap.id, ...data });
        }
      });
      
      if (ordersList.length > 0) {
        ordersList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        toast.success('Order located!', { id: toastId });
        navigate(`/track-order/${ordersList[0].id}`);
      } else {
        toast.error('Could not find order details', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to locate order', { id: toastId });
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    const success = addItem(product, 1, selectedVariantId);
    if (success) {
      navigate('/checkout');
    } else {
      toast.error('Could not add to cart. Out of stock or limit reached.');
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    const success = addItem(product, 1, selectedVariantId);
    if (success) {
      toast.success('Added to cart!');
    } else {
      toast.error('Could not add to cart. Out of stock or limit reached.');
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

  const discountAmount = product.discountPrice ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice ? Math.round((discountAmount / product.price) * 100) : 0;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      className="group bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 relative flex flex-col h-full"
    >
      <Link to={`/product/${product.id}`} className="block relative aspect-[4/5] overflow-hidden bg-gray-50">
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/400x500?text=No+Image'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10 flex gap-2">
          {hasBeenOrdered ? (
            <button 
              onClick={handleTrackOrder}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-xl"
            >
              <Truck className="w-3.5 h-3.5" />
              Track Order
            </button>
          ) : (
            <>
              <button 
                onClick={handleAddToCart}
                className="p-2.5 bg-white text-gray-900 rounded-xl hover:bg-primary hover:text-white transition-all shadow-xl"
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
              <button 
                onClick={handleBuyNow}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all shadow-xl"
              >
                Buy Now
              </button>
            </>
          )}
        </div>

        {discountPercentage > 0 && (
          <span className="absolute top-3 left-3 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded">
            {discountPercentage}% OFF
          </span>
        )}
        <button 
          onClick={handleToggleWishlist}
          className={`absolute top-3 right-3 p-2 rounded-full transition-all shadow-sm z-10 ${
            isWishlisted 
              ? 'bg-rose-500 text-white' 
              : 'bg-white/80 backdrop-blur-sm text-gray-400 hover:text-green-500 hover:bg-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link to={`/product/${product.id}`} className="text-base font-bold text-gray-900 line-clamp-1 hover:text-green-600 transition-colors mb-1">
          {product.name}
        </Link>
        <div className="flex items-center gap-1 mb-3">
          <div className="flex bg-green-600/10 text-green-700 text-xs items-center gap-1 px-2 py-0.5 rounded font-bold">
            {product.rating} <Star className="w-3 h-3 fill-current" />
          </div>
          <span className="text-xs text-gray-400 font-medium">({product.numReviews})</span>
        </div>

        {product.variants && product.variants.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Select Variant</label>
              {selectedVariant && selectedVariant.stock < 10 && selectedVariant.stock > 0 && (
                <span className="text-[10px] font-bold text-amber-500 animate-pulse">Only {selectedVariant.stock} left!</span>
              )}
            </div>
            <div className="relative group/select">
              <select 
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xs border-2 border-gray-100 rounded-xl py-2.5 px-4 bg-gray-50 focus:outline-none focus:border-green-600/30 focus:bg-white transition-all font-black appearance-none cursor-pointer pr-10"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.stock === 0}>
                    {v.name} {v.extraPrice > 0 ? `(+₹${v.extraPrice})` : ''} {v.stock === 0 ? '(Out of Stock)' : ''}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover/select:text-green-600 transition-colors">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                ₹{((product.discountPrice || product.price) + (selectedVariant?.extraPrice || 0)).toLocaleString()}
              </span>
              {product.discountPrice && (
                <span className="text-xs text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">Free Delivery</p>
              {product.discountPrice && (
                <span className="text-[10px] text-green-600 font-black">
                  • Save ₹{(product.price - product.discountPrice).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

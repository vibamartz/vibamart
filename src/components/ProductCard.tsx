import React, { useState } from 'react';
import { Product, ProductVariant } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useCartStore, useAuthStore } from '../store';
import toast from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

interface ProductCardProps {
  product: Product;
  key?: any;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCartStore();
  const { user } = useAuthStore();
  
  const [selectedVariantId] = useState<string | undefined>(
    product.variants && product.variants.length > 0 ? product.variants[0].id : undefined
  );
  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    const success = addItem(product, 1, selectedVariantId);
    if (success) {
      toast.success('Added to cart!');
    } else {
      toast.error('Out of stock.');
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
      toast.success(isWishlisted ? 'Removed' : 'Added to wishlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const discountAmount = product.discountPrice ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice ? Math.round((discountAmount / product.price) * 100) : 0;

  const currentPrice = ((product.discountPrice || product.price) + (selectedVariant?.extraPrice || 0));

  return (
    <Link to={`/product/${product.id}`} className="block bg-white border border-gray-100 hover:shadow-md transition-shadow relative h-full flex flex-col group touch-target">
      
      {/* Image Section */}
      <div className="relative aspect-[4/5] bg-gray-50 flex items-center justify-center p-2">
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/400x500?text=No+Image'}
          alt={product.name}
          className="w-full h-full object-contain"
        />
        <button 
          onClick={handleToggleWishlist}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute top-2 right-2 p-1.5 touch-target rounded-full bg-white/80 shadow-sm flex items-center justify-center text-gray-400 z-10"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Info Section */}
      <div className="p-2 sm:p-3 flex flex-col flex-1">
        <h3 className="text-[11px] sm:text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-1 text-left">
          {product.name}
        </h3>
        
        {/* Rating Pill */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center gap-0.5 bg-green-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
            {product.rating} <Star className="w-2.5 h-2.5 fill-current" />
          </div>
          <span className="text-[10px] text-gray-400 font-medium">({product.numReviews})</span>
        </div>

        {/* Price Row */}
        <div className="mt-auto flex flex-col items-start text-left">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-gray-900">
              ₹{currentPrice.toLocaleString()}
            </span>
            {product.discountPrice && (
              <>
                <span className="text-[10px] sm:text-xs text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
                <span className="text-[10px] sm:text-xs font-bold text-green-600">{discountPercentage}% off</span>
              </>
            )}
          </div>
          <div className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Free delivery</div>
          
          {/* Add to Cart - Desktop only */}
          <button 
            onClick={(e) => { e.preventDefault(); handleAddToCart(e); }}
            className="hidden md:block w-full mt-2 bg-white border border-gray-200 text-primary py-1.5 rounded-sm text-xs font-bold uppercase touch-target active:bg-primary active:text-white transition-colors hover:bg-gray-50 z-10 relative"
          >
            Add
          </button>
        </div>
      </div>
    </Link>
  );
}

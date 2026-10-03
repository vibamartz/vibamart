import React from 'react';
import { Product } from '../../shared/types';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../backend/store';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { getProductSlug } from '../../shared/utilities/slug';

interface ProductCardProps {
  product: Product;
  key?: any;
  showActionsAlways?: boolean;
  hideButtons?: boolean;
}

export default function ProductCard({ product, showActionsAlways = false, hideButtons = false }: ProductCardProps) {
  const { addItem, items } = useCartStore();
  const isInCart = items.some(item => item.productId === product.id);

  const navigate = useNavigate();

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCart) {
      navigate('/checkout');
      return;
    }
    const result = addItem(product, 1);
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
    const result = addItem(product, 1);
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
        <div className="block relative aspect-square overflow-hidden bg-white p-1.5 flex items-center justify-center">
          <img
            src={product.images?.[0] || 'https://via.placeholder.com/400x500?text=No+Image'}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 bg-white"
          />
          
          {discountPercentage > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-green-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow-xs">
              {discountPercentage}% OFF
            </span>
          )}
        </div>

        <div className="p-2 flex flex-col flex-1">
          <span className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 hover:text-green-600 transition-colors mb-0.5">
            {product.name}
          </span>

          <div className="mt-auto flex items-end justify-between pt-1 border-t border-gray-50">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-bold text-gray-900">
                  ₹{(product.discountPrice || product.price || 0).toLocaleString()}
                </span>
                {product.discountPrice && product.price && (
                  <span className="text-[11px] text-gray-400 line-through">₹{(product.mrp || product.price).toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {product.isFreeDelivery !== false && (
                  <p className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Free Delivery</p>
                )}
                {product.discountPrice && product.price && (
                  <span className="text-[9px] text-green-600 font-black">
                    • Save ₹{((product.mrp || product.price) - (product.discountPrice || product.price)).toLocaleString()}
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


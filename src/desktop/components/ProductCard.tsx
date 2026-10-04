import React from 'react';
import { Product } from '../../shared/types';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../../backend/store';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { getProductSlug } from '../../shared/utilities/slug';
import { getProductPriceRange, getAvailableAttributeSummaries } from '../../shared/utilities/variantMatrixUtils';

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

  const priceInfo = getProductPriceRange(product);
  const attributeBadges = getAvailableAttributeSummaries(product);
  const hasActiveVariants = Array.isArray(product.variants) && product.variants.some(v => !v.disabled && v.status !== 'disabled');

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasActiveVariants) {
      navigate(`/products/${getProductSlug(product)}`);
      return;
    }
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
    if (hasActiveVariants) {
      navigate(`/products/${getProductSlug(product)}`);
      return;
    }
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
            src={product.primaryImage || product.images?.[0] || 'https://via.placeholder.com/400x500?text=No+Image'}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 bg-white"
          />
          
          {priceInfo.discountPercentage > 0 && (
            <span className="absolute top-2.5 left-2.5 bg-green-600 text-white text-xs font-black px-2.5 py-1 rounded-md shadow-xs">
              {priceInfo.discountPercentage}% OFF
            </span>
          )}

          {attributeBadges.length > 0 && (
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 flex-wrap">
              {attributeBadges.slice(0, 2).map((badge, bIdx) => (
                <span
                  key={bIdx}
                  className="bg-gray-900/80 backdrop-blur-xs text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-md shadow-2xs"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-2 flex flex-col flex-1">
          <span className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 hover:text-green-600 transition-colors mb-0.5">
            {product.name}
          </span>

          <div className="mt-auto flex items-end justify-between pt-1 border-t border-gray-50">
            <div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-sm sm:text-base font-bold text-gray-900">
                  ₹{priceInfo.displayPrice.toLocaleString()}
                  {priceInfo.hasRange && (
                    <span className="text-xs font-bold text-gray-500 ml-1">
                      - ₹{priceInfo.maxPrice.toLocaleString()}
                    </span>
                  )}
                </span>
                {priceInfo.displayMrp > priceInfo.displayPrice && (
                  <span className="text-[11px] text-gray-400 line-through">₹{priceInfo.displayMrp.toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {product.isFreeDelivery !== false && (
                  <p className="text-[9px] text-green-600 font-bold uppercase tracking-wider">Free Delivery</p>
                )}
                {priceInfo.displayMrp > priceInfo.displayPrice && (
                  <span className="text-[9px] text-green-600 font-black">
                    • Save ₹{(priceInfo.displayMrp - priceInfo.displayPrice).toLocaleString()}
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


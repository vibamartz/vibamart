import React from 'react';
import { motion } from 'motion/react';
import { Product } from '../../shared/types';
import { getProductSlug } from '../../shared/utilities/slug';
import { useNavigate } from 'react-router-dom';

export interface MobileProductCardItemProps {
  key?: React.Key;
  product: Product;
  cardRadius?: string;
  is3CardLayout?: boolean;
  hideButtons?: boolean;
  onAddToCart?: (e: React.MouseEvent) => void;
  onBuyNow?: (e: React.MouseEvent) => void;
  onCardClick?: () => void | Promise<void>;
}

export default function MobileProductCardItem({
  product,
  cardRadius = "rounded-[16px]",
  is3CardLayout = false,
  onCardClick
}: MobileProductCardItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onCardClick) {
      onCardClick();
    } else {
      navigate(`/products/${getProductSlug(product)}`);
    }
  };

  const discountAmount = product.discountPrice && product.price ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice && product.price
    ? Math.round((discountAmount / product.price) * 100)
    : (product.discountPercentage || 0);

  if (is3CardLayout) {
    return (
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={handleClick}
        className={`w-[calc((100%-12px)/3)] bg-white ${cardRadius} p-1 shadow-xs border border-orange-100 flex flex-col snap-start shrink-0 flex-none cursor-pointer relative overflow-hidden group hover:shadow-md transition-all text-gray-900 min-w-0`}
      >
        {/* Product Image */}
        <div className="relative w-full aspect-[4/5] rounded-[10px] overflow-hidden bg-white p-0.5 flex items-center justify-center shrink-0 mb-0.5">
          <img
            src={product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image'}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform duration-300"
          />

          {discountPercentage > 0 && (
            <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs z-10 leading-tight">
              {discountPercentage}% OFF
            </span>
          )}
        </div>

        {/* Brand & Name */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden mb-0.5">
          <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider truncate leading-none">
            {product.brand || 'ViBa Select'}
          </span>
          <h4 className="text-[10px] font-bold text-gray-900 line-clamp-1 truncate leading-[1.2] mt-0.5 min-h-0">
            {product.name}
          </h4>
        </div>

        {/* Pricing */}
        <div className="mt-auto pt-0.5 border-t border-gray-100 min-w-0">
          <div className="flex items-baseline gap-1 flex-wrap min-w-0">
            <span className="text-[11px] font-black text-gray-900 leading-tight">
              ₹{(product.discountPrice || product.price || 0).toLocaleString()}
            </span>
            {product.discountPrice && product.price && product.discountPrice < product.price && (
              <span className="text-[8px] text-gray-400 line-through leading-tight">
                ₹{product.price.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={handleClick}
      className={`w-full bg-white ${cardRadius} p-1.5 shadow-xs border border-orange-100/80 flex flex-col snap-start shrink-0 cursor-pointer relative overflow-hidden group hover:shadow-md transition-all text-gray-900 min-w-0`}
    >
      {/* Product Image */}
      <div className="relative w-full aspect-square rounded-[10px] overflow-hidden bg-white p-1 flex items-center justify-center mb-1 shrink-0">
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image'}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform duration-300"
        />

        {discountPercentage > 0 && (
          <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs z-10 leading-none">
            {discountPercentage}% OFF
          </span>
        )}
      </div>

      {/* Brand & Name (Max 1 line) */}
      <div className="flex flex-col flex-1 min-w-0 mb-0.5">
        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest truncate leading-none">
          {product.brand || 'ViBa Select'}
        </span>
        <h4 className="text-[11px] font-bold text-gray-900 line-clamp-1 truncate leading-tight mt-0.5">
          {product.name}
        </h4>
      </div>

      {/* Pricing */}
      <div className="mt-auto pt-0.5 border-t border-gray-100 min-w-0">
        <div className="flex items-baseline justify-between gap-1 flex-wrap">
          <div className="flex items-baseline gap-1">
            <span className="text-xs sm:text-sm font-black text-gray-900">
              ₹{(product.discountPrice || product.price || 0).toLocaleString()}
            </span>
            {product.discountPrice && product.price && product.discountPrice < product.price && (
              <span className="text-[9px] text-gray-400 line-through">
                ₹{product.price.toLocaleString()}
              </span>
            )}
          </div>
          {product.isFreeDelivery !== false && (
            <span className="text-[8px] text-green-600 font-extrabold uppercase tracking-tight">Free Delivery</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layers } from 'lucide-react';
import { VisualNestedSubcategory, Category } from '../types';
import { createSlug, getCategorySlug, getSubcategorySlug } from '../utilities/slug';
import { useCategoryStore } from '../../backend/store';
import { getFrameConfig, VisualFrameDefs } from './visualFrames';

export interface VisualNestedSubcategoryCardProps {
  key?: React.Key;
  item: VisualNestedSubcategory;
  category?: Category | null;
  subCategorySlug?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
}

export default function VisualNestedSubcategoryCard({
  item,
  category,
  subCategorySlug,
  className = '',
  size = 'md',
  priority = false
}: VisualNestedSubcategoryCardProps) {
  const navigate = useNavigate();
  const { categories } = useCategoryStore();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Dynamically resolve parent category & subcategory slugs
  const safeCategories = Array.isArray(categories) ? categories : [];
  const parentCat = category || safeCategories.find(c => 
    c && (
      c.id === item.categoryId || 
      c.slug === item.categoryId || 
      (c as any).seoSlug === item.categoryId || 
      (c.name && createSlug(c.name) === item.categoryId) ||
      (item.categoryName && c.name && c.name.toLowerCase() === item.categoryName.toLowerCase())
    )
  );
  const catSlug = parentCat ? getCategorySlug(parentCat) : (item.categoryId || 'categories');
  
  const parentSub = parentCat?.subcategories?.find(s => 
    s && (
      s.id === item.subCategoryId || 
      s.slug === item.subCategoryId || 
      (s as any).seoSlug === item.subCategoryId || 
      (s.name && createSlug(s.name) === item.subCategoryId) ||
      (item.subCategoryName && s.name && s.name.toLowerCase() === item.subCategoryName.toLowerCase())
    )
  );
  const subSlug = parentSub ? getSubcategorySlug(parentSub) : (subCategorySlug || item.subCategoryId || 'all');
  
  const nestedSlug = item.seoSlug || item.slug || (item.name ? createSlug(item.name) : 'all');

  const handleClick = () => {
    navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
  };

  // Frame shape configuration
  const frame = getFrameConfig(item.frameShape);

  // Offer Strip logic (Optional & customizable)
  const isOfferEnabled = item.showOfferStrip === undefined 
    ? Boolean(item.offerText || item.badgeText) 
    : Boolean(item.showOfferStrip);

  const offerText = item.offerText || item.badgeText || 'Under ₹299';
  const offerBgColor = item.offerBgColor || '#047857';
  const offerTextColor = item.offerTextColor || '#ffffff';
  const offerFontSize = item.offerFontSize || '11px';
  const offerFontWeight = item.offerFontWeight || '900';

  const isSvgClipped = Boolean(frame.clipPathId);

  return (
    <>
      {/* SVG Defs for shaped clip paths */}
      <VisualFrameDefs />

      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2 }}
        onClick={handleClick}
        className={`group cursor-pointer select-none flex flex-col ${className}`}
      >
        {/* Frame Outer Wrapper with Drop Shadow / Hover Styling */}
        <div
          className="relative w-full transition-all duration-300 filter drop-shadow-xs group-hover:drop-shadow-md"
          style={{
            filter: isSvgClipped ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' : undefined
          }}
        >
          {/* Card Container with dynamic Aspect Ratio & Clip Shape */}
          <div
            className={`relative w-full ${frame.aspectClass} bg-gray-100 ${!isSvgClipped ? (frame.borderRadius || 'rounded-2xl') : ''} overflow-hidden ${!isSvgClipped ? 'border border-gray-200/80 shadow-xs' : ''} transition-all duration-300 flex flex-col justify-end`}
            style={{
              clipPath: frame.clipPathId ? `url(#${frame.clipPathId})` : undefined,
              WebkitClipPath: frame.clipPathId ? `url(#${frame.clipPathId})` : undefined,
            }}
          >
            {/* Image Area */}
            <div className="absolute inset-0 w-full h-full">
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
              )}
              
              {item.image && !imageError ? (
                <img
                  src={item.image}
                  alt={item.name || offerText || 'Visual Category'}
                  loading={priority ? 'eager' : 'lazy'}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 text-emerald-700">
                  <Layers className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 opacity-60" />
                </div>
              )}
            </div>

            {/* Optional Offer / Price Strip at the bottom of the card */}
            {isOfferEnabled && (
              <div
                className="relative z-10 w-full py-1.5 px-2 text-center transition-colors shadow-xs"
                style={{
                  backgroundColor: offerBgColor,
                  color: offerTextColor
                }}
              >
                <span
                  className="block tracking-tight leading-tight uppercase truncate"
                  style={{
                    fontSize: offerFontSize,
                    fontWeight: offerFontWeight
                  }}
                >
                  {offerText}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Category / Brand Name displayed below the card (Optional) */}
        {Boolean(item.name && item.name.trim()) && (
          <div className="pt-2 pb-1 px-1 text-center">
            <h4 className="text-xs sm:text-sm font-bold text-gray-800 tracking-tight leading-tight line-clamp-2 group-hover:text-emerald-600 transition-colors">
              {item.name}
            </h4>
          </div>
        )}
      </motion.div>
    </>
  );
}

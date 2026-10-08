import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Layers } from 'lucide-react';
import { VisualNestedSubcategory, Category } from '../types';
import { createSlug, getCategorySlug, getSubcategorySlug } from '../utilities/slug';
import { useCategoryStore } from '../../backend/store';

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
    if (item.targetUrl) {
      if (item.targetUrl.startsWith('http://') || item.targetUrl.startsWith('https://')) {
        window.location.href = item.targetUrl;
      } else {
        navigate(item.targetUrl);
      }
      return;
    }
    navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
  };

  const offerBg = item.offerBgColor || '#047857';
  const offerColor = item.offerTextColor || '#FFFFFF';

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={`group cursor-pointer select-none flex flex-col shrink-0 ${className}`}
    >
      {/* Portrait Image Container with Attached Offer Strip */}
      <div className="relative w-full aspect-[3/4] sm:aspect-[3/4.1] bg-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs hover:shadow-md border border-gray-100/90 transition-all duration-300 flex flex-col justify-between">
        
        {/* Optional Floating Top Badge */}
        {item.badgeText && (
          <div className="absolute top-2 left-2 z-20">
            <span
              style={{
                backgroundColor: item.badgeBgColor || '#EF4444',
                color: item.badgeTextColor || '#FFFFFF'
              }}
              className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm drop-shadow-xs"
            >
              {item.badgeText}
            </span>
          </div>
        )}

        {/* Shimmer Placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
        )}
        
        {/* Main Portrait Image */}
        {item.image && !imageError ? (
          <img
            src={item.image}
            alt={item.name}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 text-emerald-700">
            <Layers className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 opacity-60" />
            <span className="text-xs font-bold text-center px-2 line-clamp-2">{item.name}</span>
          </div>
        )}

        {/* Attached Colored Offer / Price Strip at bottom of image */}
        {item.offerText ? (
          <div
            style={{ backgroundColor: offerBg, color: offerColor }}
            className="relative z-10 mt-auto w-full py-1.5 sm:py-2 px-1.5 text-center font-black text-[10px] sm:text-xs tracking-wider uppercase shadow-xs transition-colors"
          >
            <span className="truncate block font-black leading-tight drop-shadow-xs">
              {item.offerText}
            </span>
          </div>
        ) : null}
      </div>

      {/* Category / Brand / Subcategory Display Name Centered Below Card */}
      <div className="pt-2 sm:pt-2.5 pb-0.5 px-1 text-center">
        <h4 className="text-xs sm:text-sm font-bold text-gray-800 tracking-tight leading-tight line-clamp-1 group-hover:text-emerald-600 transition-colors">
          {item.name}
        </h4>
      </div>
    </motion.div>
  );
}

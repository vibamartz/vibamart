import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight, Layers, Tag } from 'lucide-react';
import { VisualNestedSubcategory, Category } from '../types';
import { createSlug, getCategorySlug, getSubcategorySlug, getNestedSubcategorySlug } from '../utilities/slug';
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
  const parentCat = category || categories.find(c => c.id === item.categoryId || c.slug === item.categoryId || createSlug(c.name) === item.categoryId);
  const catSlug = parentCat ? getCategorySlug(parentCat) : (item.categoryId || 'categories');
  
  const parentSub = parentCat?.subcategories?.find(s => s.id === item.subCategoryId || s.slug === item.subCategoryId || createSlug(s.name) === item.subCategoryId);
  const subSlug = parentSub ? getSubcategorySlug(parentSub) : (subCategorySlug || item.subCategoryId || 'all');
  
  const nestedSlug = item.seoSlug || item.slug || createSlug(item.name);

  const handleClick = () => {
    navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer bg-white shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 flex flex-col justify-end select-none ${className}`}
    >
      {/* Image Container with strict Aspect Ratio & Preservation */}
      <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] bg-gray-100 overflow-hidden">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
        )}
        
        {item.image && !imageError ? (
          <img
            src={item.image}
            alt={item.name}
            loading={priority ? 'eager' : 'lazy'}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-teal-50 to-indigo-50 text-emerald-700">
            <Layers className="w-10 h-10 mb-2 opacity-60" />
            <span className="text-xs font-bold text-center px-2 line-clamp-2">{item.name}</span>
          </div>
        )}

        {/* Top Promotional Badge */}
        {item.badgeText && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-md border border-white/20 backdrop-blur-sm">
              <Sparkles className="w-2.5 h-2.5" />
              {item.badgeText}
            </span>
          </div>
        )}

        {/* Subtle Gradient Overlay at Bottom for optimal text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent pointer-events-none" />

        {/* Card Content Overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 z-10 flex flex-col justify-end text-white">
          <h4 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight group-hover:text-emerald-300 transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] line-clamp-1">
            {item.name}
          </h4>

          {item.description && (
            <p className="text-[11px] sm:text-xs text-gray-200 line-clamp-1 font-medium mt-0.5 opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {item.description}
            </p>
          )}

          <div className="mt-2 pt-1.5 flex items-center justify-between border-t border-white/15">
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              <span>Explore</span>
              <ArrowRight className="w-3 h-3" />
            </span>
            {item.subCategoryName && (
              <span className="text-[9px] text-gray-300 truncate max-w-[90px] opacity-80">
                {item.subCategoryName}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

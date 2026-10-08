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
  const parentCat = category || categories.find(c => 
    c.id === item.categoryId || 
    c.slug === item.categoryId || 
    (c as any).seoSlug === item.categoryId || 
    createSlug(c.name) === item.categoryId ||
    (item.categoryName && c.name.toLowerCase() === item.categoryName.toLowerCase())
  );
  const catSlug = parentCat ? getCategorySlug(parentCat) : (item.categoryId || 'categories');
  
  const parentSub = parentCat?.subcategories?.find(s => 
    s.id === item.subCategoryId || 
    s.slug === item.subCategoryId || 
    (s as any).seoSlug === item.subCategoryId || 
    createSlug(s.name) === item.subCategoryId ||
    (item.subCategoryName && s.name.toLowerCase() === item.subCategoryName.toLowerCase())
  );
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
      className={`group cursor-pointer select-none flex flex-col ${className}`}
    >
      {/* Image Container with strict Aspect Ratio & Preservation */}
      <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] bg-gray-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs hover:shadow-md border border-gray-100 transition-all duration-300">
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
            <Layers className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 opacity-60" />
            <span className="text-xs font-bold text-center px-2 line-clamp-2">{item.name}</span>
          </div>
        )}
      </div>

      {/* ONLY ONE text/name below the card */}
      <div className="pt-2 sm:pt-2.5 pb-1 px-1 text-center">
        <h4 className="text-xs sm:text-sm font-bold text-gray-800 tracking-tight leading-tight line-clamp-1 group-hover:text-emerald-600 transition-colors">
          {item.name}
        </h4>
      </div>
    </motion.div>
  );
}

import React, { useState, useMemo } from 'react';
import { Sparkles, ArrowRight, Grid, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVisualNestedSubcategoryStore, useCategoryStore } from '../../backend/store';
import VisualNestedSubcategoryCard from './VisualNestedSubcategoryCard';
import { Category, SubCategory } from '../types';

interface VisualNestedSubcategoriesSectionProps {
  categoryId?: string;
  subCategoryId?: string;
  title?: string;
  subtitle?: string;
  isMobile?: boolean;
  limitCount?: number;
  className?: string;
}

export default function VisualNestedSubcategoriesSection({
  categoryId,
  subCategoryId,
  title,
  subtitle,
  isMobile = false,
  limitCount = 12,
  className = ''
}: VisualNestedSubcategoriesSectionProps) {
  const { items, loading } = useVisualNestedSubcategoryStore();
  const { categories } = useCategoryStore();
  const [showAll, setShowAll] = useState(false);

  // Find parent Category & Subcategory objects
  const activeCategory = useMemo(() => {
    if (!categoryId) return null;
    return categories.find(c => 
      c.id === categoryId || 
      c.slug === categoryId || 
      (c as any).seoSlug === categoryId ||
      createSlug(c.name) === categoryId ||
      c.name.toLowerCase() === categoryId.toLowerCase()
    ) || null;
  }, [categoryId, categories]);

  const activeSubCategory = useMemo(() => {
    if (!subCategoryId) return null;
    if (activeCategory?.subcategories) {
      const found = activeCategory.subcategories.find(s => 
        s.id === subCategoryId || 
        s.slug === subCategoryId || 
        (s as any).seoSlug === subCategoryId ||
        createSlug(s.name) === subCategoryId ||
        s.name.toLowerCase() === subCategoryId.toLowerCase()
      );
      if (found) return found;
    }
    for (const cat of categories) {
      const found = cat.subcategories?.find(s => 
        s.id === subCategoryId || 
        s.slug === subCategoryId || 
        (s as any).seoSlug === subCategoryId ||
        createSlug(s.name) === subCategoryId ||
        s.name.toLowerCase() === subCategoryId.toLowerCase()
      );
      if (found) return found;
    }
    return null;
  }, [subCategoryId, activeCategory, categories]);

  // Dynamically filter active visual nested subcategories
  const matchingItems = useMemo(() => {
    if (loading) return [];
    if (!categoryId && !subCategoryId) return [];
    
    return items.filter(item => {
      if (item.isActive === false || item.isVisible === false) return false;

      // 1. Strict Category Matching
      if (categoryId) {
        const matchesCategory = 
          item.categoryId === categoryId ||
          (activeCategory && item.categoryId === activeCategory.id) ||
          (activeCategory && item.categoryName?.toLowerCase() === activeCategory.name.toLowerCase());
        
        if (!matchesCategory) return false;
      }

      // 2. Strict Subcategory Matching
      if (subCategoryId) {
        const matchesSubCategory = 
          item.subCategoryId === subCategoryId ||
          (activeSubCategory && item.subCategoryId === activeSubCategory.id) ||
          (activeSubCategory && item.subCategoryName?.toLowerCase() === activeSubCategory.name.toLowerCase());
        
        if (!matchesSubCategory) return false;
      }

      return true;
    });
  }, [items, categoryId, subCategoryId, activeCategory, activeSubCategory, loading]);

  // If no items match, hide section completely
  if (!loading && matchingItems.length === 0) {
    return null;
  }

  const displayedItems = showAll ? matchingItems : matchingItems.slice(0, limitCount);
  const hasMore = matchingItems.length > limitCount;

  const dynamicTitle = title || (
    activeSubCategory
      ? `Popular ${activeSubCategory.name} Collections`
      : activeCategory
        ? `Explore ${activeCategory.name} Visual Collections`
        : 'Featured Visual Categories'
  );

  const dynamicSubtitle = subtitle || (
    activeSubCategory
      ? `Discover trending styles and subcategories in ${activeSubCategory.name}`
      : activeCategory
        ? `Browse hand-picked visual collections and top styles in ${activeCategory.name}`
        : 'Hand-picked visual subcategories with exclusive designs'
  );

  return (
    <section className={`my-6 sm:my-8 ${className}`}>
      <div className="bg-gradient-to-b from-emerald-50/40 via-white to-white p-4 sm:p-6 lg:p-7 rounded-3xl border border-emerald-100/70 shadow-sm">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6 pb-3 border-b border-emerald-100/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-sm flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                {dynamicTitle}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {matchingItems.length} {matchingItems.length === 1 ? 'Collection' : 'Collections'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
              {dynamicSubtitle}
            </p>
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer self-start sm:self-center"
            >
              <span>{showAll ? 'Show Less' : `View All (${matchingItems.length})`}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        {/* Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
          {displayedItems.map((item, index) => (
            <VisualNestedSubcategoryCard
              key={item.id || index}
              item={item}
              category={activeCategory}
              subCategorySlug={activeSubCategory?.slug}
              priority={index < 4}
            />
          ))}
        </div>

        {/* Load more indicator / button at bottom if many items */}
        {hasMore && !showAll && (
          <div className="mt-5 pt-3 text-center">
            <button
              onClick={() => setShowAll(true)}
              className="px-5 py-2 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-black border border-emerald-200 shadow-sm hover:shadow transition-all cursor-pointer"
            >
              Load {matchingItems.length - limitCount} More Collections
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

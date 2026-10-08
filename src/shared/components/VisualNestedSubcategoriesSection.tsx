import React, { useState, useMemo, useRef } from 'react';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVisualNestedSubcategoryStore, useCategoryStore } from '../../backend/store';
import VisualNestedSubcategoryCard from './VisualNestedSubcategoryCard';
import { Category, SubCategory } from '../types';
import { createSlug } from '../utilities/slug';

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
  const [showGrid, setShowGrid] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Find parent Category & Subcategory objects
  const activeCategory = useMemo(() => {
    if (!categoryId || !Array.isArray(categories)) return null;
    return categories.find(c => 
      c && (
        c.id === categoryId || 
        c.slug === categoryId || 
        (c as any).seoSlug === categoryId ||
        (c.name && createSlug(c.name) === categoryId) ||
        (c.name && c.name.toLowerCase() === categoryId.toLowerCase())
      )
    ) || null;
  }, [categoryId, categories]);

  const activeSubCategory = useMemo(() => {
    if (!subCategoryId || !Array.isArray(categories)) return null;
    if (activeCategory?.subcategories) {
      const found = activeCategory.subcategories.find(s => 
        s && (
          s.id === subCategoryId || 
          s.slug === subCategoryId || 
          (s as any).seoSlug === subCategoryId ||
          (s.name && createSlug(s.name) === subCategoryId) ||
          (s.name && s.name.toLowerCase() === subCategoryId.toLowerCase())
        )
      );
      if (found) return found;
    }
    for (const cat of categories) {
      const found = cat?.subcategories?.find(s => 
        s && (
          s.id === subCategoryId || 
          s.slug === subCategoryId || 
          (s as any).seoSlug === subCategoryId ||
          (s.name && createSlug(s.name) === subCategoryId) ||
          (s.name && s.name.toLowerCase() === subCategoryId.toLowerCase())
        )
      );
      if (found) return found;
    }
    return null;
  }, [subCategoryId, activeCategory, categories]);

  // Dynamically filter active visual nested subcategories
  const matchingItems = useMemo(() => {
    if (loading || !Array.isArray(items)) return [];
    if (!categoryId && !subCategoryId) return [];
    
    return items.filter(item => {
      if (!item || item.isActive === false || item.isVisible === false) return false;

      // 1. Strict Category Matching
      if (categoryId) {
        const matchesCategory = 
          item.categoryId === categoryId ||
          (activeCategory && item.categoryId === activeCategory.id) ||
          (activeCategory && item.categoryName && activeCategory.name && item.categoryName.toLowerCase() === activeCategory.name.toLowerCase());
        
        if (!matchesCategory) return false;
      }

      // 2. Strict Subcategory Matching
      if (subCategoryId) {
        const matchesSubCategory = 
          item.subCategoryId === subCategoryId ||
          (activeSubCategory && item.subCategoryId === activeSubCategory.id) ||
          (activeSubCategory && item.subCategoryName && activeSubCategory.name && item.subCategoryName.toLowerCase() === activeSubCategory.name.toLowerCase());
        
        if (!matchesSubCategory) return false;
      }

      return true;
    });
  }, [items, categoryId, subCategoryId, activeCategory, activeSubCategory, loading]);

  // If no items match, hide section completely
  if (!loading && matchingItems.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.75;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const dynamicTitle = title || (
    activeSubCategory
      ? `Popular ${activeSubCategory.name} Collections`
      : activeCategory
        ? `Explore ${activeCategory.name} Visual Collections`
        : 'Featured Collections'
  );

  const dynamicSubtitle = subtitle || (
    activeSubCategory
      ? `Discover trending styles and offers in ${activeSubCategory.name}`
      : activeCategory
        ? `Browse hand-picked visual collections and top styles in ${activeCategory.name}`
        : 'Hand-picked visual subcategories with exclusive offers'
  );

  return (
    <section className={`my-4 sm:my-6 lg:my-8 ${className}`}>
      <div className="bg-gradient-to-b from-emerald-50/40 via-white to-white p-3.5 sm:p-5 lg:p-6 rounded-3xl border border-emerald-100/70 shadow-sm relative group">
        
        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 mb-3.5 sm:mb-5 pb-2.5 sm:pb-3 border-b border-emerald-100/60">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight truncate">
                {dynamicTitle}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                {matchingItems.length} {matchingItems.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5 truncate">
              {dynamicSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {matchingItems.length > 5 && (
              <button
                onClick={() => setShowGrid(prev => !prev)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-xl hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                {showGrid ? 'Horizontal View' : 'View All'}
              </button>
            )}

            {/* Desktop / Tablet Scroll Navigation Arrows */}
            {!showGrid && matchingItems.length > 3 && (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  onClick={() => scroll('left')}
                  className="p-1.5 rounded-xl bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 hover:border-emerald-300 shadow-xs transition-all cursor-pointer active:scale-95"
                  title="Scroll Left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="p-1.5 rounded-xl bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 hover:border-emerald-300 shadow-xs transition-all cursor-pointer active:scale-95"
                  title="Scroll Right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Layout Modes */}
        {showGrid ? (
          /* Full Grid View (When View All is clicked) */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {matchingItems.map((item, index) => (
              <VisualNestedSubcategoryCard
                key={item.id || index}
                item={item}
                category={activeCategory}
                subCategorySlug={activeSubCategory?.slug}
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          /* Standard Horizontal Scroll Track:
             - Mobile: ~2–2.5 cards visible with touch swipe (w-[40vw] max-w-[160px])
             - Tablet: ~3–4 cards visible (md:w-[23%])
             - Desktop: ~5–6 cards visible (lg:w-[15.5%] xl:w-[15%])
          */
          <div
            ref={scrollContainerRef}
            className="flex gap-2.5 sm:gap-3.5 lg:gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1 px-0.5"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {matchingItems.map((item, index) => (
              <div
                key={item.id || index}
                className="w-[38vw] min-w-[130px] max-w-[155px] sm:w-[28vw] sm:max-w-[170px] md:w-[22%] md:max-w-[190px] lg:w-[15.5%] xl:w-[15%] shrink-0 snap-start"
              >
                <VisualNestedSubcategoryCard
                  item={item}
                  category={activeCategory}
                  subCategorySlug={activeSubCategory?.slug}
                  priority={index < 4}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}

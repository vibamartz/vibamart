import React, { useState, useMemo } from 'react';
import { Sparkles, ArrowRight, Grid, ChevronRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVisualNestedSubcategoryStore, useCategoryStore } from '../../backend/store';
import VisualNestedSubcategoryCard from './VisualNestedSubcategoryCard';
import { Category, SubCategory } from '../types';
import { createSlug } from '../utilities/slug';

interface VisualNestedSubcategoriesSectionProps {
  categoryId?: string;
  subCategoryId?: string;
  nestedSubCategoryId?: string;
  parentTargetId?: string;
  title?: string;
  subtitle?: string;
  isMobile?: boolean;
  limitCount?: number;
  className?: string;
}

export default function VisualNestedSubcategoriesSection({
  categoryId,
  subCategoryId,
  nestedSubCategoryId,
  parentTargetId,
  title,
  subtitle,
  isMobile = false,
  limitCount = 12,
  className = ''
}: VisualNestedSubcategoriesSectionProps) {
  const { items, loading } = useVisualNestedSubcategoryStore();
  const { categories } = useCategoryStore();
  const [showAll, setShowAll] = useState(false);

  // 1. Find Root Parent Category
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

  // 2. Find Level 1 SubCategory
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

  // 3. Find Level 2+ Nested SubCategory
  const activeNestedSubCategory = useMemo(() => {
    const targetNestedId = nestedSubCategoryId || (parentTargetId && parentTargetId !== subCategoryId && parentTargetId !== categoryId ? parentTargetId : null);
    if (!targetNestedId || !Array.isArray(categories)) return null;

    if (activeSubCategory?.subcategories) {
      const found = activeSubCategory.subcategories.find(n => 
        n && (
          n.id === targetNestedId || 
          n.slug === targetNestedId || 
          (n as any).seoSlug === targetNestedId ||
          (n.name && createSlug(n.name) === targetNestedId) ||
          (n.name && n.name.toLowerCase() === targetNestedId.toLowerCase())
        )
      );
      if (found) return found;
    }

    for (const cat of categories) {
      for (const sub of cat.subcategories || []) {
        const found = sub.subcategories?.find(n => 
          n && (
            n.id === targetNestedId || 
            n.slug === targetNestedId || 
            (n as any).seoSlug === targetNestedId ||
            (n.name && createSlug(n.name) === targetNestedId) ||
            (n.name && n.name.toLowerCase() === targetNestedId.toLowerCase())
          )
        );
        if (found) return found;
      }
    }
    return null;
  }, [nestedSubCategoryId, parentTargetId, subCategoryId, categoryId, activeSubCategory, categories]);

  // 4. Resolve effective active target ID and level
  const effectiveTargetId = useMemo(() => {
    if (parentTargetId) return parentTargetId;
    if (activeNestedSubCategory) return activeNestedSubCategory.id;
    if (nestedSubCategoryId) return nestedSubCategoryId;
    if (activeSubCategory) return activeSubCategory.id;
    if (subCategoryId) return subCategoryId;
    if (activeCategory) return activeCategory.id;
    return categoryId || '';
  }, [parentTargetId, activeNestedSubCategory, nestedSubCategoryId, activeSubCategory, subCategoryId, activeCategory, categoryId]);

  const isNestedLevelActive = Boolean(activeNestedSubCategory || nestedSubCategoryId || (parentTargetId && activeSubCategory && parentTargetId !== activeSubCategory.id));
  const isSubCategoryLevelActive = Boolean(!isNestedLevelActive && (activeSubCategory || subCategoryId));

  // 5. Dynamically filter active visual nested subcategories with strict isolation
  const matchingItems = useMemo(() => {
    if (loading || !Array.isArray(items) || items.length === 0) return [];
    if (!categoryId && !subCategoryId && !nestedSubCategoryId && !parentTargetId) return [];

    const activeCatId = activeCategory?.id || categoryId;
    const activeSubId = activeSubCategory?.id || subCategoryId;
    const activeNestedId = activeNestedSubCategory?.id || nestedSubCategoryId;

    return items.filter(item => {
      if (!item || item.isActive === false || item.isVisible === false) return false;

      // Case A: A Nested Subcategory (Level 2+) is currently active
      if (isNestedLevelActive) {
        const matchesTarget = 
          item.parentTargetId === activeNestedId ||
          item.parentTargetId === effectiveTargetId ||
          item.nestedSubCategoryId === activeNestedId ||
          item.nestedSubCategoryId === effectiveTargetId ||
          (activeNestedSubCategory && item.nestedSubCategoryName && activeNestedSubCategory.name && item.nestedSubCategoryName.toLowerCase() === activeNestedSubCategory.name.toLowerCase());
        
        return Boolean(matchesTarget);
      }

      // Case B: A Subcategory (Level 1) is currently active (and no nested subcategory is selected)
      if (isSubCategoryLevelActive) {
        // Must NOT match items that belong to a child nested subcategory
        if (item.nestedSubCategoryId && item.nestedSubCategoryId.trim() !== '') {
          return false;
        }
        if (item.parentTargetType === 'nested_subcategory') {
          return false;
        }

        const matchesSub = 
          item.parentTargetId === activeSubId ||
          item.parentTargetId === effectiveTargetId ||
          item.subCategoryId === activeSubId ||
          item.subCategoryId === effectiveTargetId ||
          (activeSubCategory && item.subCategoryName && activeSubCategory.name && item.subCategoryName.toLowerCase() === activeSubCategory.name.toLowerCase());

        if (!matchesSub) return false;

        // Ensure category matches if specified
        if (activeCatId && item.categoryId && item.categoryId !== activeCatId) {
          if (activeCategory && item.categoryName && activeCategory.name && item.categoryName.toLowerCase() !== activeCategory.name.toLowerCase()) {
            return false;
          }
        }

        return true;
      }

      // Case C: Top Category Level (no subcategory or nested subcategory active)
      if (activeCatId) {
        // Must NOT match items belonging to any subcategory or nested subcategory
        if (item.subCategoryId && item.subCategoryId !== 'all' && item.subCategoryId.trim() !== '') {
          return false;
        }
        if (item.nestedSubCategoryId && item.nestedSubCategoryId.trim() !== '') {
          return false;
        }
        if (item.parentTargetType === 'subcategory' || item.parentTargetType === 'nested_subcategory') {
          return false;
        }

        const matchesCat = 
          item.categoryId === activeCatId ||
          item.parentTargetId === activeCatId ||
          (activeCategory && item.categoryName && activeCategory.name && item.categoryName.toLowerCase() === activeCategory.name.toLowerCase());

        return Boolean(matchesCat);
      }

      return false;
    });
  }, [items, categoryId, subCategoryId, nestedSubCategoryId, parentTargetId, effectiveTargetId, isNestedLevelActive, isSubCategoryLevelActive, activeCategory, activeSubCategory, activeNestedSubCategory, loading]);

  // If no items match, hide section completely without an empty gap
  if (!loading && matchingItems.length === 0) {
    return null;
  }

  const displayedItems = showAll ? matchingItems : matchingItems.slice(0, limitCount);
  const hasMore = matchingItems.length > limitCount;

  // Clean user-friendly titles without route paths or breadcrumbs
  const dynamicTitle = title || (
    activeNestedSubCategory
      ? `Popular ${activeNestedSubCategory.name} Collections`
      : activeSubCategory
        ? `Popular ${activeSubCategory.name} Collections`
        : activeCategory
          ? `Explore ${activeCategory.name} Visual Collections`
          : 'Featured Visual Categories'
  );

  const dynamicSubtitle = subtitle || (
    activeNestedSubCategory
      ? `Discover trending styles and collections in ${activeNestedSubCategory.name}`
      : activeSubCategory
        ? `Discover trending styles and collections in ${activeSubCategory.name}`
        : activeCategory
          ? `Browse hand-picked visual collections and top styles in ${activeCategory.name}`
          : 'Hand-picked visual collections with exclusive designs'
  );

  return (
    <section className={`my-4 sm:my-8 ${className}`}>
      <div className="bg-gradient-to-b from-emerald-50/40 via-white to-white p-3 sm:p-6 lg:p-7 rounded-2xl sm:rounded-3xl border border-emerald-100/70 shadow-sm">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-6 pb-2.5 sm:pb-3 border-b border-emerald-100/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-sm flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <h2 className="text-base sm:text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                {dynamicTitle}
              </h2>
            </div>
            <p className="text-[11px] sm:text-sm text-gray-500 font-medium mt-0.5 sm:mt-1">
              {dynamicSubtitle}
            </p>
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer self-start sm:self-center"
            >
              <span>{showAll ? 'Show Less' : 'View All'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>

        {/* Responsive Grid: Minimum 3 cards in a single row on mobile */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 lg:gap-5">
          {displayedItems.map((item, index) => (
            <VisualNestedSubcategoryCard
              key={item.id || index}
              item={item}
              category={activeCategory}
              subCategorySlug={activeSubCategory?.slug}
              nestedSubCategorySlug={activeNestedSubCategory?.slug}
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
              Load More Collections
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

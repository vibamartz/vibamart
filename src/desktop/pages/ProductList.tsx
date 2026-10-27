import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { useAuthStore, useCartStore, useCategoryStore, useSettingsStore, useVisualNestedSubcategoryStore } from '../../backend/store';
import { Product, Banner } from '../../shared/types';
import { toast } from 'react-hot-toast';
import {
  Filter, SlidersHorizontal, ChevronDown, ChevronRight, Grid, List as ListIcon, X, Star, Heart, Layers, Sparkles, Tag, ArrowRight, RefreshCw, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProductCard from '../components/ProductCard';
import { getCategorySlug, getSubcategorySlug, getNestedSubcategorySlug, createSlug, getBannerSlug } from '../../shared/utilities/slug';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import CategoryLogo, { renderCategoryFallbackIcon } from '../../shared/components/CategoryLogo';
import VisualNestedSubcategoriesSection from '../../shared/components/VisualNestedSubcategoriesSection';

import { getRecentSearches, addRecentSearch, SEARCH_HISTORY_UPDATED_EVENT } from '../../shared/utilities/searchHistoryUtils';
import { searchApiClient } from '../../services/searchApiClient';
import { isProductInHierarchy, getOrCreateHierarchyEngine } from '../../shared/utilities/categoryHierarchyUtils';

export default function ProductList() {
  const { settings } = useSettingsStore();
  const { categories: CATEGORIES } = useCategoryStore();
  const { items: visualNestedItems } = useVisualNestedSubcategoryStore();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useParams<{
    categorySlug?: string;
    subcategorySlug?: string;
    nestedSubcategorySlug?: string;
    visualSlug?: string;
    subLevel5?: string;
    brandSlug?: string;
    offerSlug?: string;
    '*'?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('popularity');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches(5));
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searchRecovery, setSearchRecovery] = useState<any | null>(null);
  const [searchCorrection, setSearchCorrection] = useState<{
    hasAutoCorrected?: boolean;
    originalQuery?: string;
    correctedQuery?: string;
  } | null>(null);
  const [searchIntent, setSearchIntent] = useState<any | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);

  // Fetch results from Search Engine API when query 'q' is present
  useEffect(() => {
    const qStr = searchParams.get('q');
    if (!qStr) {
      setSearchResults(null);
      setSearchRecovery(null);
      setSearchCorrection(null);
      setSearchIntent(null);
      setSearchLoading(false);
      setSearchCompleted(false);
      return;
    }

    // Reset lingering category/brand filters from previous route navigation unless explicitly in query params
    if (!searchParams.get('category')) {
      setSelectedCategories([]);
      setSelectedSubCategories([]);
      setSelectedNestedSubCategories([]);
    }
    if (!searchParams.get('brand')) {
      setSelectedBrands([]);
    }

    let isCurrent = true;
    setSearchResults(null);
    setSearchLoading(true);
    setSearchCompleted(false);

    const noAutoCorrectParam = searchParams.get('noAutoCorrect') === '1' || searchParams.get('noAutoCorrect') === 'true';

    searchApiClient.search({
      q: qStr,
      limit: 100,
      noAutoCorrect: noAutoCorrectParam
    }).then(res => {
      if (isCurrent) {
        setSearchResults(res.products || []);
        setSearchRecovery(res.recovery || null);
        setSearchCorrection(res.hasAutoCorrected ? {
          hasAutoCorrected: res.hasAutoCorrected,
          originalQuery: res.originalQuery,
          correctedQuery: res.correctedQuery
        } : null);

        if (res.semanticIntent?.isNaturalLanguage) {
          setSearchIntent(res.semanticIntent);
          if (res.semanticIntent.detectedFilters?.maxPrice) {
            setPriceRange(res.semanticIntent.detectedFilters.maxPrice);
          }
        } else {
          setSearchIntent(null);
        }

        setSearchLoading(false);
        setSearchCompleted(true);
      }
    }).catch(err => {
      console.warn('[ProductList] Search API error, falling back to local dataset:', err);
      if (isCurrent) {
        setSearchResults(null);
        setSearchRecovery(null);
        setSearchCorrection(null);
        setSearchIntent(null);
        setSearchLoading(false);
        setSearchCompleted(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [searchParams]);

  // Extract all path segments after "/categories"
  const pathSegments = useMemo(() => {
    const cleanPath = location.pathname.replace(/^\/categories\/?/, '').replace(/\/+$/, '');
    if (!cleanPath) return [];
    return cleanPath.split('/').filter(Boolean).map(s => decodeURIComponent(s));
  }, [location.pathname]);

  // Resolve active category/subcategory/nestedSubcategory/brand/offer from route params, path segments, or search params
  const rawCat = routeParams.categorySlug || pathSegments[0] || searchParams.get('category') || '';
  const rawSubCat = routeParams.subcategorySlug || pathSegments[1] || searchParams.get('subCategory') || '';
  const rawNestedSubCat = routeParams.nestedSubcategorySlug || pathSegments[2] || searchParams.get('nestedSubCategory') || '';
  const rawVisual = routeParams.visualSlug || pathSegments[3] || searchParams.get('visual') || '';
  const rawLevel5 = routeParams.subLevel5 || pathSegments[4] || '';
  const rawBrand = routeParams.brandSlug || searchParams.get('brand') || '';
  const rawOffer = routeParams.offerSlug || searchParams.get('offer') || '';

  // Match root category object by ID, seoSlug, or generated slug
  const matchedCategory = useMemo(() => {
    if (!rawCat) return null;
    return CATEGORIES.find(c => 
      c && (
        c.id === rawCat || 
        c.slug === rawCat || 
        c.seoSlug === rawCat || 
        createSlug(c.name) === rawCat ||
        (c.name && c.name.toLowerCase() === rawCat.toLowerCase())
      )
    ) || null;
  }, [rawCat, CATEGORIES]);

  // Match subcategory object (Level 1) by ID, slug, or generated slug
  const matchedSubcategory = useMemo(() => {
    if (!rawSubCat) return null;
    if (matchedCategory?.subcategories) {
      const found = matchedCategory.subcategories.find(s => 
        s && (
          s.id === rawSubCat || 
          s.slug === rawSubCat || 
          (s as any).seoSlug === rawSubCat || 
          createSlug(s.name) === rawSubCat ||
          (s.name && s.name.toLowerCase() === rawSubCat.toLowerCase())
        )
      );
      if (found) return found;
    }
    for (const cat of CATEGORIES) {
      const found = cat.subcategories?.find(s => 
        s && (
          s.id === rawSubCat || 
          s.slug === rawSubCat || 
          (s as any).seoSlug === rawSubCat || 
          createSlug(s.name) === rawSubCat ||
          (s.name && s.name.toLowerCase() === rawSubCat.toLowerCase())
        )
      );
      if (found) return found;
    }
    return null;
  }, [rawSubCat, matchedCategory, CATEGORIES]);

  // Match nested subcategory object (Level 2) by ID, slug, or generated slug
  const matchedNestedSubcategory = useMemo(() => {
    if (!rawNestedSubCat) return null;
    if (matchedSubcategory?.subcategories) {
      const found = matchedSubcategory.subcategories.find(n => 
        n && (
          n.id === rawNestedSubCat || 
          n.slug === rawNestedSubCat || 
          (n as any).seoSlug === rawNestedSubCat || 
          createSlug(n.name) === rawNestedSubCat ||
          (n.name && n.name.toLowerCase() === rawNestedSubCat.toLowerCase())
        )
      );
      if (found) return found;
    }
    return matchedCategory?.subcategories?.flatMap(s => s.subcategories || []).find(n => 
      n && (
        n.id === rawNestedSubCat || 
        n.slug === rawNestedSubCat || 
        (n as any).seoSlug === rawNestedSubCat || 
        createSlug(n.name) === rawNestedSubCat ||
        (n.name && n.name.toLowerCase() === rawNestedSubCat.toLowerCase())
      )
    ) || null;
  }, [rawNestedSubCat, matchedSubcategory, matchedCategory]);

  // Match deeper Level 3+ recursive child subcategory if present
  const matchedDeepChildSubcategory = useMemo(() => {
    const deepSlug = rawVisual || rawLevel5;
    if (!deepSlug || !matchedNestedSubcategory?.subcategories) return null;
    return matchedNestedSubcategory.subcategories.find(c => 
      c && (
        c.id === deepSlug || 
        c.slug === deepSlug || 
        (c as any).seoSlug === deepSlug || 
        createSlug(c.name) === deepSlug ||
        (c.name && c.name.toLowerCase() === deepSlug.toLowerCase())
      )
    ) || null;
  }, [rawVisual, rawLevel5, matchedNestedSubcategory]);

  // Match Visual Nested Subcategory object dynamically across all depth levels
  const matchedVisualNestedSubcategory = useMemo(() => {
    if (!Array.isArray(visualNestedItems) || visualNestedItems.length === 0) return null;
    
    // Check candidate slugs from deepest segment backwards
    const candidateSlugs = [
      searchParams.get('visual'),
      rawLevel5,
      rawVisual,
      pathSegments[pathSegments.length - 1],
      rawNestedSubCat,
      rawSubCat,
    ].filter(Boolean) as string[];

    for (const targetSlug of candidateSlugs) {
      const found = visualNestedItems.find(v => {
        if (!v || v.isActive === false) return false;
        const slugMatch = 
          v.id === targetSlug || 
          v.slug === targetSlug || 
          v.seoSlug === targetSlug || 
          createSlug(v.name || '') === targetSlug ||
          (v.name && v.name.toLowerCase() === targetSlug.toLowerCase());
        if (!slugMatch) return false;

        // Align with active category hierarchy if present
        if (matchedCategory && v.categoryId && v.categoryId !== matchedCategory.id && v.categoryId !== matchedCategory.slug && v.categoryId !== createSlug(matchedCategory.name)) {
          if (v.categoryName && matchedCategory.name && v.categoryName.toLowerCase() !== matchedCategory.name.toLowerCase()) {
            return false;
          }
        }
        if (matchedSubcategory && v.subCategoryId && v.subCategoryId !== matchedSubcategory.id && v.subCategoryId !== matchedSubcategory.slug && v.subCategoryId !== createSlug(matchedSubcategory.name)) {
          if (v.subCategoryName && matchedSubcategory.name && v.subCategoryName.toLowerCase() !== matchedSubcategory.name.toLowerCase()) {
            return false;
          }
        }
        return true;
      });
      if (found) return found;
    }
    return null;
  }, [rawVisual, rawLevel5, pathSegments, rawNestedSubCat, rawSubCat, searchParams, matchedCategory, matchedSubcategory, visualNestedItems]);

  // Match banner object if opening a banner route
  const isSearchQuery = Boolean(searchParams.get('q'));

  const matchedBanner = useMemo(() => {
    if (isSearchQuery || !rawOffer) return null;
    return allBanners.find(b => b.id === rawOffer || b.slug === rawOffer || getBannerSlug(b) === rawOffer || (b.link && b.link.includes(rawOffer))) || null;
  }, [isSearchQuery, rawOffer, allBanners]);

  // Category-Specific Banners for the selected category (Strict Isolation)
  const categoryBanners = useMemo(() => {
    if (!matchedCategory) return [];
    const catId = matchedCategory.id;
    const catSlug = getCategorySlug(matchedCategory);
    return allBanners.filter(b => (b.categoryId === catId || b.categoryId === catSlug) && b.active !== false);
  }, [matchedCategory, allBanners]);

  // Backward compatibility redirect: if accessed via numeric category ID like /category/1, redirect replace to /category/mobiles
  useEffect(() => {
    if (matchedCategory && (rawCat === matchedCategory.id || /^\d+$/.test(rawCat))) {
      const canonical = getCategorySlug(matchedCategory);
      if (canonical && rawCat !== canonical) {
        navigate(`/category/${canonical}`, { replace: true });
      }
    }
  }, [matchedCategory, rawCat, navigate]);

  // Sync recent searches with storage events
  useEffect(() => {
    const loadRecent = () => {
      setRecentSearches(getRecentSearches(5));
    };
    loadRecent();
    window.addEventListener('storage', loadRecent);
    window.addEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);
    return () => {
      window.removeEventListener('storage', loadRecent);
      window.removeEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);
    };
  }, []);

  // Base Page Context (from route / visual / brand / category hierarchy)
  const baseCatId = useMemo(() => {
    if (isSearchQuery) {
      return searchParams.get('category') || '';
    }
    return matchedCategory?.id || matchedVisualNestedSubcategory?.categoryId || (rawCat && rawCat !== 'products' && rawCat !== 'categories' ? rawCat : '');
  }, [isSearchQuery, searchParams, matchedCategory, matchedVisualNestedSubcategory, rawCat]);

  const baseSubId = useMemo(() => {
    if (isSearchQuery) {
      return searchParams.get('subCategory') || '';
    }
    return matchedSubcategory?.id || (matchedVisualNestedSubcategory?.subCategoryId && matchedVisualNestedSubcategory.subCategoryId !== 'all' ? matchedVisualNestedSubcategory.subCategoryId : '');
  }, [isSearchQuery, searchParams, matchedSubcategory, matchedVisualNestedSubcategory]);

  const baseNestedId = useMemo(() => {
    if (isSearchQuery) {
      return searchParams.get('nestedSubCategory') || '';
    }
    return matchedDeepChildSubcategory?.id || matchedNestedSubcategory?.id || matchedVisualNestedSubcategory?.nestedSubCategoryId || (matchedVisualNestedSubcategory?.parentTargetType === 'nested_subcategory' ? matchedVisualNestedSubcategory.parentTargetId : '') || '';
  }, [isSearchQuery, searchParams, matchedDeepChildSubcategory, matchedNestedSubcategory, matchedVisualNestedSubcategory]);

  const baseBrand = useMemo(() => {
    if (!rawBrand) return '';
    return allProducts.find(p => p.brand && (p.brand === rawBrand || createSlug(p.brand) === rawBrand))?.brand || rawBrand;
  }, [rawBrand, allProducts]);

  // Filter States
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : (baseCatId ? [baseCatId] : []);
  });
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(baseSubId ? [baseSubId] : []);
  const [selectedNestedSubCategories, setSelectedNestedSubCategories] = useState<string[]>(baseNestedId ? [baseNestedId] : []);
  const [expandedFilterCats, setExpandedFilterCats] = useState<string[]>([]);
  const [expandedFilterSubs, setExpandedFilterSubs] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState(200000);
  const [minRating, setMinRating] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(baseBrand ? [baseBrand] : []);

  // Helper for dynamic faceted search counts
  const getFilterCount = (filterType: string, value: any) => {
    return allProducts.filter(p => {
      // Visual Nested Subcategory filter
      const hasVisualExplicit = Boolean(
        !isSearchQuery &&
        matchedVisualNestedSubcategory && (
          (matchedVisualNestedSubcategory.productIds && matchedVisualNestedSubcategory.productIds.length > 0) ||
          allProducts.some(item =>
            item.visualNestedSubcategoryIds?.includes(matchedVisualNestedSubcategory.id) ||
            item.visualNestedSubcategoryId === matchedVisualNestedSubcategory.id
          )
        )
      );

      if (hasVisualExplicit && matchedVisualNestedSubcategory) {
        const assignedIds = new Set(matchedVisualNestedSubcategory.productIds || []);
        const isAssigned = assignedIds.has(p.id) ||
          Boolean(p.visualNestedSubcategoryIds?.includes(matchedVisualNestedSubcategory.id)) ||
          p.visualNestedSubcategoryId === matchedVisualNestedSubcategory.id;
        if (!isAssigned) return false;
      }

      // Category filter across entire hierarchy
      if (!hasVisualExplicit) {
        const effectiveCats = selectedCategories.length > 0 ? selectedCategories : (baseCatId ? [baseCatId] : []);
        if (effectiveCats.length > 0) {
          if (effectiveCats.includes('all-deals')) {
            if (!p.discountPrice && !effectiveCats.some(c => isProductInHierarchy(p, c, CATEGORIES, visualNestedItems))) return false;
          } else if (!effectiveCats.some(c => isProductInHierarchy(p, c, CATEGORIES, visualNestedItems))) {
            return false;
          }
        }
      }

      // SubCategory filter across entire hierarchy
      if (!hasVisualExplicit) {
        const effectiveSubs = filterType !== 'subcategory' && selectedSubCategories.length > 0 ? selectedSubCategories : (filterType !== 'subcategory' && baseSubId ? [baseSubId] : []);
        if (effectiveSubs.length > 0 && !effectiveSubs.some(s => isProductInHierarchy(p, s, CATEGORIES, visualNestedItems))) return false;
      }

      // Brand filter
      const effectiveBrands = filterType !== 'brand' && selectedBrands.length > 0 ? selectedBrands : (filterType !== 'brand' && baseBrand ? [baseBrand] : []);
      if (effectiveBrands.length > 0 && p.brand && !effectiveBrands.includes(p.brand)) return false;

      const effectivePrice = p.discountPrice || p.price;
      if (filterType !== 'price' && effectivePrice > priceRange) return false;
      if (filterType !== 'rating' && p.rating < minRating) return false;

      if (filterType !== 'discount') {
        if (p.discountPrice) {
          const discount = ((p.price - p.discountPrice) / p.price) * 100;
          if (discount < minDiscount) return false;
        } else if (minDiscount > 0) {
          return false;
        }
      }

      if (filterType !== 'availability' && onlyInStock && p.stock <= 0) return false;

      // Search query filter across all hierarchy levels
      const queryStr = searchParams.get('q');
      if (queryStr) {
        const terms = queryStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
          const engine = getOrCreateHierarchyEngine(CATEGORIES, visualNestedItems);
          const { categoryNames, visualNames } = engine.resolveProductHierarchy(p);
          const searchableText = [
            p.name,
            p.brand,
            p.id,
            p.productCode,
            p.productCode ? cleanProductCode(p.productCode) : '',
            p.description,
            p.fullDescription,
            ...categoryNames,
            ...visualNames,
            ...(p.tags || [])
          ].filter(Boolean).join(' ').toLowerCase();
          const isMatch = terms.every(term => searchableText.includes(term) || (cleanProductCode(term).length > 0 && searchableText.includes(cleanProductCode(term))));
          if (!isMatch) return false;
        }
      }

      // Check the specific value for the current filterType
      if (filterType === 'subcategory' && !isProductInHierarchy(p, value, CATEGORIES, visualNestedItems)) return false;
      if (filterType === 'brand' && p.brand !== value) return false;
      if (filterType === 'price' && effectivePrice > value) return false;
      if (filterType === 'rating' && p.rating < value) return false;
      if (filterType === 'discount') {
        if (p.discountPrice) {
          const discount = ((p.price - p.discountPrice) / p.price) * 100;
          if (discount < value) return false;
        } else {
          return false;
        }
      }
      if (filterType === 'availability' && value && p.stock <= 0) return false;

      return true;
    }).length;
  };

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const rewardIds = await getRewardProductIds();
      setAllProducts(filterOutRewardProducts(data, rewardIds));
      setLoadError(false);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products', false);
      setLoadError(true);
      setLoading(false);
    });

    const bq = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribeBanners = onSnapshot(bq, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Banner))
        .filter(b => Boolean(b.image && typeof b.image === 'string' && b.image.trim()));
      setAllBanners(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banners', false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeBanners();
    };
  }, [retryKey]);

  // Sync category, subcategory, nested subcategory, and brand from URL params or route params
  useEffect(() => {
    const activeCatId = baseCatId;
    if (activeCatId && !selectedCategories.includes(activeCatId)) {
      setSelectedCategories([activeCatId]);
    }

    if (baseSubId) {
      setSelectedSubCategories([baseSubId]);
    } else if (rawSubCat) {
      const foundSub = matchedCategory?.subcategories?.find(s => s.id === rawSubCat || s.slug === rawSubCat || createSlug(s.name) === rawSubCat);
      if (foundSub) setSelectedSubCategories([foundSub.id]);
    } else {
      setSelectedSubCategories([]);
    }

    if (baseNestedId) {
      setSelectedNestedSubCategories([baseNestedId]);
    } else if (rawNestedSubCat) {
      const foundNested = matchedSubcategory?.subcategories?.find(n => n.id === rawNestedSubCat || n.slug === rawNestedSubCat || createSlug(n.name) === rawNestedSubCat);
      if (foundNested) setSelectedNestedSubCategories([foundNested.id]);
    } else {
      setSelectedNestedSubCategories([]);
    }

    if (baseBrand && !selectedBrands.includes(baseBrand)) {
      setSelectedBrands([baseBrand]);
    }
  }, [baseCatId, baseSubId, baseNestedId, baseBrand, matchedCategory, matchedSubcategory, rawSubCat, rawNestedSubCat]);

  useEffect(() => {
    // Clear subcategories if they don't belong to any of the selected categories
    if (selectedCategories.length === 0) {
      setSelectedSubCategories([]);
      setSelectedNestedSubCategories([]);
    } else {
      const validSubIds = selectedCategories.flatMap(catId =>
        CATEGORIES.find(c => c.id === catId)?.subcategories?.map(s => s.id) || []
      );
      setSelectedSubCategories(prev => prev.filter(id => validSubIds.includes(id)));
      // Clear nested if parent sub is deselected
      const validNestedIds = selectedCategories.flatMap(catId =>
        CATEGORIES.find(c => c.id === catId)?.subcategories?.flatMap(s => s.subcategories?.map(n => n.id) || []) || []
      );
      setSelectedNestedSubCategories(prev => prev.filter(id => validNestedIds.includes(id)));
    }
  }, [selectedCategories, CATEGORIES]);

  const filteredProducts = useMemo(() => {
    const baseList = searchResults !== null ? searchResults : allProducts;
    let result = baseList.filter(p => {
      // Banner filter (Show ONLY products assigned to this banner when viewing a banner route)
      if (matchedBanner) {
        const assignedIds = new Set(matchedBanner.productIds || []);
        if (!assignedIds.has(p.id)) return false;
      }

      // Visual Nested Subcategory filter (Show assigned products when explicitly assigned to this visual subcategory)
      const hasVisualExplicit = Boolean(
        !isSearchQuery &&
        matchedVisualNestedSubcategory && (
          (matchedVisualNestedSubcategory.productIds && matchedVisualNestedSubcategory.productIds.length > 0) ||
          allProducts.some(item =>
            item.visualNestedSubcategoryIds?.includes(matchedVisualNestedSubcategory.id) ||
            item.visualNestedSubcategoryId === matchedVisualNestedSubcategory.id
          )
        )
      );

      if (hasVisualExplicit && matchedVisualNestedSubcategory) {
        const assignedIds = new Set(matchedVisualNestedSubcategory.productIds || []);
        const isAssigned = assignedIds.has(p.id) ||
          Boolean(p.visualNestedSubcategoryIds?.includes(matchedVisualNestedSubcategory.id)) ||
          p.visualNestedSubcategoryId === matchedVisualNestedSubcategory.id;
        if (!isAssigned) return false;
      }

      // Category filter across entire hierarchy (Skip category filter if viewing explicit banner or explicit visual subcategory)
      if (!matchedBanner && !hasVisualExplicit) {
        const effectiveCats = isSearchQuery
          ? (searchParams.get('category') ? [searchParams.get('category')!] : selectedCategories)
          : (selectedCategories.length > 0 ? selectedCategories : (baseCatId ? [baseCatId] : []));
        if (effectiveCats.length > 0) {
          if (effectiveCats.includes('all-deals')) {
            const hasCatMatch = effectiveCats.some(c => isProductInHierarchy(p, c, CATEGORIES, visualNestedItems));
            if (!p.discountPrice && !hasCatMatch) return false;
          } else {
            const hasCatMatch = effectiveCats.some(c => isProductInHierarchy(p, c, CATEGORIES, visualNestedItems));
            if (!hasCatMatch) return false;
          }
        }
      }

      // SubCategory filter across entire hierarchy (Skip if explicit visual subcategory assignment)
      if (!hasVisualExplicit) {
        const effectiveSubs = isSearchQuery
          ? (searchParams.get('subCategory') ? [searchParams.get('subCategory')!] : selectedSubCategories)
          : (selectedSubCategories.length > 0 ? selectedSubCategories : (baseSubId ? [baseSubId] : []));
        if (effectiveSubs.length > 0) {
          const hasSubMatch = effectiveSubs.some(s => isProductInHierarchy(p, s, CATEGORIES, visualNestedItems));
          if (!hasSubMatch) return false;
        }

        // Nested SubCategory filter across entire hierarchy
        const effectiveNested = isSearchQuery
          ? (searchParams.get('nestedSubCategory') ? [searchParams.get('nestedSubCategory')!] : selectedNestedSubCategories)
          : (selectedNestedSubCategories.length > 0 ? selectedNestedSubCategories : (baseNestedId ? [baseNestedId] : []));
        if (effectiveNested.length > 0) {
          const hasNestedMatch = effectiveNested.some(n => isProductInHierarchy(p, n, CATEGORIES, visualNestedItems));
          if (!hasNestedMatch) return false;
        }
      }

      // Brand filter
      const effectiveBrands = isSearchQuery
        ? (searchParams.get('brand') ? [searchParams.get('brand')!] : selectedBrands)
        : (selectedBrands.length > 0 ? selectedBrands : (baseBrand ? [baseBrand] : []));
      if (effectiveBrands.length > 0 && p.brand && !effectiveBrands.includes(p.brand)) return false;

      // Price filter
      const effectivePrice = p.discountPrice || p.price;
      if (effectivePrice > priceRange) return false;

      // Rating filter
      if (p.rating < minRating) return false;

      // Discount filter
      if (p.discountPrice) {
        const discount = ((p.price - p.discountPrice) / p.price) * 100;
        if (discount < minDiscount) return false;
      } else if (minDiscount > 0) {
        return false;
      }

      // Availability filter
      if (onlyInStock && p.stock <= 0) return false;

      // Search query filter (from URL) - executed locally as fallback only when server searchResults is not loaded
      const queryStr = searchParams.get('q');
      if (queryStr && searchResults === null) {
        const terms = queryStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
          const engine = getOrCreateHierarchyEngine(CATEGORIES, visualNestedItems);
          const { categoryNames, visualNames } = engine.resolveProductHierarchy(p);

          const searchableText = [
            p.name,
            p.brand,
            p.id,
            p.productCode,
            p.productCode ? cleanProductCode(p.productCode) : '',
            p.description,
            p.fullDescription,
            ...categoryNames,
            ...visualNames,
            ...(p.tags || [])
          ].filter(Boolean).join(' ').toLowerCase();

          const isMatch = terms.every(term => searchableText.includes(term) || (cleanProductCode(term).length > 0 && searchableText.includes(cleanProductCode(term))));
          if (!isMatch) return false;
        }
      }

      return true;
    });

    // Sorting
    if (sortBy === 'price-asc') result.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
    if (sortBy === 'price-desc') result.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
    if (sortBy === 'newest') result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [allProducts, searchResults, selectedCategories, selectedSubCategories, selectedNestedSubCategories, selectedBrands, baseCatId, baseSubId, baseNestedId, baseBrand, matchedCategory, matchedBanner, priceRange, minRating, minDiscount, onlyInStock, sortBy, searchParams, CATEGORIES, visualNestedItems, isSearchQuery]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.includes(id) ? [] : [id]);
  };

  const toggleSubCategory = (id: string) => {
    setSelectedSubCategories(prev => prev.includes(id) ? [] : [id]);
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => prev.includes(brand) ? [] : [brand]);
  };

  const toggleNestedSubCategory = (id: string) => {
    setSelectedNestedSubCategories(prev =>
      prev.includes(id) ? [] : [id]
    );
  };

  const toggleFilterCat = (id: string) => {
    setExpandedFilterCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleFilterSub = (id: string) => {
    setExpandedFilterSubs(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const clearFilters = () => {
    setSelectedCategories(baseCatId ? [baseCatId] : []);
    setSelectedSubCategories(baseSubId ? [baseSubId] : []);
    setSelectedNestedSubCategories(baseNestedId ? [baseNestedId] : []);
    setSelectedBrands(baseBrand ? [baseBrand] : []);
    setPriceRange(200000);
    setMinRating(0);
    setMinDiscount(0);
    setOnlyInStock(false);
    setSearchParams({});
  };

  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    allProducts.forEach(p => {
      if (p.brand && (!selectedCategories.length || selectedCategories.includes('all-deals') || selectedCategories.includes(p.categoryId))) {
        brands.add(p.brand);
      }
    });
    return Array.from(brands).sort();
  }, [allProducts, selectedCategories]);

  const uniqueSubCategories = useMemo(() => {
    const subs = new Set<string>();
    allProducts.forEach(p => {
      if (p.subCategoryId && (!selectedCategories.length || selectedCategories.includes('all-deals') || selectedCategories.includes(p.categoryId))) {
        subs.add(p.subCategoryId);
      }
    });
    return Array.from(subs).map(subId => {
      let name = subId;
      CATEGORIES.forEach(cat => {
        const found = cat.subcategories?.find(s => s.id === subId);
        if (found) name = found.name;
      });
      return { id: subId, name };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, selectedCategories, CATEGORIES]);

  const FiltersContent = () => (
    <>
      {settings.enableAvailabilityFilter && (
        <FilterSection title="Availability">
          <FilterOption
            label="In Stock Only"
            count={getFilterCount('availability', true)}
            checked={onlyInStock}
            onChange={() => setOnlyInStock(!onlyInStock)}
          />
        </FilterSection>
      )}

      <FilterSection title="Collections">
        {uniqueSubCategories.length > 0 ? uniqueSubCategories.map(sub => (
          <FilterOption
            key={sub.id}
            label={sub.name}
            count={getFilterCount('subcategory', sub.id)}
            checked={selectedSubCategories.includes(sub.id)}
            onChange={() => toggleSubCategory(sub.id)}
          />
        )) : (
          <p className="text-xs text-gray-400">No items available</p>
        )}
      </FilterSection>

      {settings.enableBrandFilter && (
        <FilterSection title="Brand">
          {uniqueBrands.length > 0 ? uniqueBrands.map(brand => (
            <FilterOption
              key={brand}
              label={brand}
              count={getFilterCount('brand', brand)}
              checked={selectedBrands.includes(brand)}
              onChange={() => toggleBrand(brand)}
            />
          )) : (
            <p className="text-xs text-gray-400">No brands</p>
          )}
        </FilterSection>
      )}

      <FilterSection title="Price Range">
        <div className="space-y-4 pt-2">
          <input
            type="range"
            min="0"
            max="200000"
            step="1000"
            value={priceRange}
            onChange={(e) => setPriceRange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between items-center text-xs font-bold text-gray-600">
            <span>₹0</span>
            <span>₹{priceRange.toLocaleString()}+</span>
          </div>
        </div>
      </FilterSection>

      {settings.enableRatingFilter && (
        <FilterSection title="Customer Ratings">
          {[4, 3, 2].map(r => (
            <FilterOption
              key={r}
              label={
                <div className="flex items-center gap-1">
                  {r} <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> & above
                </div>
              }
              count={getFilterCount('rating', r)}
              checked={minRating === r}
              onChange={() => setMinRating(prev => (prev === r ? 0 : r))}
            />
          ))}
        </FilterSection>
      )}

      {settings.enableDiscountFilter && (
        <FilterSection title="Discount">
          {[40, 30, 10].map(d => (
            <FilterOption
              key={d}
              label={`${d}% or more`}
              count={getFilterCount('discount', d)}
              checked={minDiscount === d}
              onChange={() => setMinDiscount(prev => (prev === d ? 0 : d))}
            />
          ))}
        </FilterSection>
      )}
    </>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header / Breadcrumbs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          
          {/* Matched Banner Hero Header */}
          {matchedBanner && (
            <div className="mb-6 rounded-3xl overflow-hidden shadow-xl border border-indigo-100 bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> Featured Offer Banner
                  </span>
                  {matchedCategory && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-900/60 px-3 py-1 rounded-full border border-indigo-400/30">
                      {matchedCategory.name}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                  {matchedBanner.title}
                </h1>
                {matchedBanner.subtitle && (
                  <p className="text-sm text-gray-300 font-medium">{matchedBanner.subtitle}</p>
                )}
                <p className="text-xs text-indigo-300 font-bold flex items-center gap-1.5 pt-1">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Showing products assigned to this banner
                </p>
              </div>
              {matchedBanner.image && (
                <div className="w-full md:w-80 aspect-[21/9] md:aspect-[16/9] rounded-2xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                  <img src={matchedBanner.image} alt={matchedBanner.title} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          )}

          {/* Category-Specific Banners Carousel (When Category is selected) */}
          {categoryBanners.length > 0 && !matchedBanner && (
            <div className="mb-6 space-y-2">
              <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-1">
                {categoryBanners.map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (b.link) navigate(b.link);
                      else navigate(`/offers/${b.slug || b.id}`);
                    }}
                    className="relative group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0 w-80 sm:w-96 aspect-[21/9] snap-start bg-white"
                  >
                    <img src={b.image} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {(b.title || b.subtitle) && (
                      <div className="absolute inset-0 p-4 flex flex-col justify-end pointer-events-none">
                        <h4 className="text-sm font-black text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{b.title}</h4>
                        {b.subtitle && <p className="text-[11px] text-white/90 line-clamp-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{b.subtitle}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!matchedBanner && (
            <div className="mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                  {isSearchQuery
                    ? `Search results for "${searchParams.get('q') || ''}"`
                    : (matchedVisualNestedSubcategory
                      ? (matchedVisualNestedSubcategory.name || matchedVisualNestedSubcategory.offerText || 'Visual Collection')
                      : (matchedDeepChildSubcategory
                        ? matchedDeepChildSubcategory.name
                        : (matchedNestedSubcategory
                          ? matchedNestedSubcategory.name
                          : (matchedSubcategory
                            ? matchedSubcategory.name
                            : (matchedCategory ? matchedCategory.name : 'Browse Products')))))}
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {isSearchQuery
                  ? `Showing ${filteredProducts.length} ${filteredProducts.length === 1 ? 'product' : 'products'} matching your search`
                  : (matchedVisualNestedSubcategory
                    ? (matchedVisualNestedSubcategory.description || `Browse all products in ${matchedVisualNestedSubcategory.name || 'this collection'}`)
                    : (matchedDeepChildSubcategory
                      ? `Browse all ${matchedDeepChildSubcategory.name} products and collections`
                      : (matchedNestedSubcategory
                        ? `Browse all ${matchedNestedSubcategory.name} products and collections`
                        : (matchedSubcategory
                          ? `Browse all ${matchedSubcategory.name} products and collections`
                          : (matchedCategory ? `Explore all products and collections in ${matchedCategory.name}` : 'Discover products matching your selection')))))}
              </p>
            </div>
          )}

          {/* Categories/Collections Horizontal Bar (Shown ONLY when browsing Category and no subcategory is selected) */}
          {!matchedSubcategory && matchedCategory && matchedCategory.subcategories && matchedCategory.subcategories.length > 0 && (
            <div className="py-4 mb-4 border-t border-b border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                  {matchedCategory.name}
                </span>
              </div>
              <div
                className="flex gap-4 overflow-x-auto hide-scrollbar no-scrollbar py-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {matchedCategory.subcategories.map(sub => {
                  const isSubActive = matchedSubcategory?.id === sub.id || selectedSubCategories.includes(sub.id);
                  const catSlug = getCategorySlug(matchedCategory);
                  const subSlug = getSubcategorySlug(sub);
                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        navigate(`/categories/${catSlug}/${subSlug}`);
                      }}
                      className="flex flex-col items-center gap-1.5 group transition-all shrink-0 w-24 sm:w-28 cursor-pointer"
                    >
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden group-hover:scale-105 transition-all flex items-center justify-center ${
                        isSubActive ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                      }`}>
                        {sub.image && (sub.image.startsWith('http') || sub.image.startsWith('data:') || sub.image.startsWith('/')) ? (
                          <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${isSubActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                            {renderCategoryFallbackIcon(sub.name, sub.icon, "w-8 h-8 sm:w-10 sm:h-10", isSubActive)}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs sm:text-sm font-extrabold text-center max-w-[100px] leading-tight transition-colors line-clamp-1 ${
                        isSubActive ? 'text-emerald-900 font-black' : 'text-gray-700 group-hover:text-emerald-700'
                      }`}>
                        {sub.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deep Collections Showcase (if matchedNestedSubcategory has children) */}
          {matchedNestedSubcategory && matchedNestedSubcategory.subcategories && matchedNestedSubcategory.subcategories.length > 0 && (
            <div className="p-5 mb-6 rounded-3xl bg-emerald-50/40 border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Explore {matchedNestedSubcategory.name}</span>
                  </h3>
                  <p className="text-xs text-gray-600 font-medium">Click to filter by collection</p>
                </div>
                {matchedDeepChildSubcategory && (
                  <button
                    onClick={() => {
                      const catSlug = getCategorySlug(matchedCategory!);
                      const subSlug = getSubcategorySlug(matchedSubcategory!);
                      const nestedSlug = getNestedSubcategorySlug(matchedNestedSubcategory);
                      navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    View All in {matchedNestedSubcategory.name}
                  </button>
                )}
              </div>

              <div
                className="flex gap-4 overflow-x-auto hide-scrollbar no-scrollbar py-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {matchedNestedSubcategory.subcategories.map(child => {
                  const isChildActive = matchedDeepChildSubcategory?.id === child.id;
                  const catSlug = getCategorySlug(matchedCategory!);
                  const subSlug = getSubcategorySlug(matchedSubcategory!);
                  const nestedSlug = getNestedSubcategorySlug(matchedNestedSubcategory);
                  const childSlug = getNestedSubcategorySlug(child);
                  return (
                    <button
                      key={child.id}
                      onClick={() => {
                        if (isChildActive) {
                          navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
                        } else {
                          navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}/${childSlug}`);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 group transition-all shrink-0 w-24 sm:w-28 cursor-pointer"
                    >
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden group-hover:scale-105 transition-all flex items-center justify-center ${
                        isChildActive ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                      }`}>
                        {child.image && (child.image.startsWith('http') || child.image.startsWith('data:') || child.image.startsWith('/')) ? (
                          <img src={child.image} alt={child.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${isChildActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                            {renderCategoryFallbackIcon(child.name, child.icon, "w-8 h-8 sm:w-10 sm:h-10", isChildActive)}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs sm:text-sm font-extrabold text-center max-w-[100px] leading-tight transition-colors line-clamp-1 ${
                        isChildActive ? 'text-emerald-900 font-black' : 'text-gray-700 group-hover:text-emerald-700'
                      }`}>
                        {child.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dedicated Collections Showcase for the active Subcategory (Level 2) */}
          {!matchedNestedSubcategory && matchedSubcategory && matchedSubcategory.subcategories && matchedSubcategory.subcategories.length > 0 && (
            <div className="p-5 mb-6 rounded-3xl bg-emerald-50/40 border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Explore {matchedSubcategory.name}</span>
                  </h3>
                  <p className="text-xs text-gray-600 font-medium">Click to filter by collection</p>
                </div>
                {matchedNestedSubcategory && (
                  <button
                    onClick={() => {
                      const catSlug = getCategorySlug(matchedCategory!);
                      const subSlug = getSubcategorySlug(matchedSubcategory);
                      navigate(`/categories/${catSlug}/${subSlug}`);
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    View All in {matchedSubcategory.name}
                  </button>
                )}
              </div>

              <div
                className="flex gap-4 overflow-x-auto hide-scrollbar no-scrollbar py-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {matchedSubcategory.subcategories.map(nested => {
                  const isNestedActive = matchedNestedSubcategory?.id === nested.id || selectedNestedSubCategories.includes(nested.id);
                  const catSlug = getCategorySlug(matchedCategory!);
                  const subSlug = getSubcategorySlug(matchedSubcategory);
                  const nestedSlug = getNestedSubcategorySlug(nested);
                  return (
                    <button
                      key={nested.id}
                      onClick={() => {
                        if (isNestedActive) {
                          navigate(`/categories/${catSlug}/${subSlug}`);
                        } else {
                          navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 group transition-all shrink-0 w-24 sm:w-28 cursor-pointer"
                    >
                      <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden group-hover:scale-105 transition-all flex items-center justify-center ${
                        isNestedActive ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                      }`}>
                        {nested.image && (nested.image.startsWith('http') || nested.image.startsWith('data:') || nested.image.startsWith('/')) ? (
                          <img src={nested.image} alt={nested.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${isNestedActive ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                            {renderCategoryFallbackIcon(nested.name, nested.icon, "w-8 h-8 sm:w-10 sm:h-10", isNestedActive)}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs sm:text-sm font-extrabold text-center max-w-[100px] leading-tight transition-colors line-clamp-1 ${
                        isNestedActive ? 'text-emerald-900 font-black' : 'text-gray-700 group-hover:text-emerald-700'
                      }`}>
                        {nested.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Visual Nested Subcategories Showcase (Only shown when not already on a dedicated visual card page) */}
          {matchedCategory && !matchedVisualNestedSubcategory && (
            <VisualNestedSubcategoriesSection
              categoryId={matchedCategory.id}
              subCategoryId={matchedSubcategory?.id}
              nestedSubCategoryId={matchedNestedSubcategory?.id}
              parentTargetId={matchedDeepChildSubcategory?.id || matchedNestedSubcategory?.id || matchedSubcategory?.id || matchedCategory.id}
            />
          )}

          {/* Query Intelligence Intent Badge */}
          {searchIntent?.isNaturalLanguage && (
            <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 rounded-2xl border border-blue-200/90 flex flex-wrap items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" /> Intelligent Search
                </span>
                <span className="text-xs text-gray-800 font-bold">
                  Searching for <span className="text-blue-900 font-black">"{searchIntent.cleanKeyword}"</span>
                </span>
                {searchIntent.detectedFilters?.maxPrice !== undefined && (
                  <span className="text-[11px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Max Price: ₹{searchIntent.detectedFilters.maxPrice.toLocaleString()}
                  </span>
                )}
                {searchIntent.detectedFilters?.minPrice !== undefined && (
                  <span className="text-[11px] font-black bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Min Price: ₹{searchIntent.detectedFilters.minPrice.toLocaleString()}
                  </span>
                )}
                {searchIntent.detectedFilters?.color && (
                  <span className="text-[11px] font-black bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200 capitalize">
                    Color: {searchIntent.detectedFilters.color}
                  </span>
                )}
                {searchIntent.detectedFilters?.gender && (
                  <span className="text-[11px] font-black bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200 capitalize">
                    For: {searchIntent.detectedFilters.gender}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchIntent(null);
                  setPriceRange(200000);
                  setSearchParams({ q: searchIntent.cleanKeyword });
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                Clear Budget & Filters
              </button>
            </div>
          )}

          {/* Spelling Auto-Correction Notice */}
          {searchCorrection?.hasAutoCorrected && searchCorrection?.correctedQuery && searchCorrection?.originalQuery && (
            <div className="mb-4 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-gray-700">
                  Showing results for <span className="font-black text-gray-950">"{searchCorrection.correctedQuery}"</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Search instead for</span>
                <button
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set('q', searchCorrection.originalQuery!);
                    next.set('noAutoCorrect', '1');
                    setSearchParams(next);
                  }}
                  className="text-xs font-bold text-primary underline hover:text-primary-hover cursor-pointer"
                >
                  "{searchCorrection.originalQuery}"
                </button>
              </div>
            </div>
          )}

          {searchParams.get('q') && (
            <p className="inline-flex items-center gap-2 bg-blue-50 text-primary px-3 py-1 rounded-full text-xs font-bold ring-1 ring-blue-100 mb-4">
              Search results for: "{searchParams.get('q')}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchParams({})} />
            </p>
          )}
          <p className="text-gray-500 font-medium">Discover products matching your selection</p>
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-3 mt-6 overflow-x-auto no-scrollbar pb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">Recently Searched:</span>
              <div className="flex gap-2">
                {recentSearches.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      addRecentSearch(s, 10);
                      setSearchParams({ q: s });
                    }}
                    className="text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
                >
                  Clear All
                </button>
              </div>

              <FiltersContent />
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden touch-target min-h-[44px] flex items-center justify-center gap-2 text-sm font-bold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                </button>
                <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-400">
                  <button
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    className={`p-2.5 touch-target flex items-center justify-center rounded-md ${viewMode === 'grid' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    className={`p-2.5 touch-target flex items-center justify-center rounded-md ${viewMode === 'list' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-400 hidden md:block">SORT BY:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none bg-gray-50 font-bold text-xs rounded-lg px-4 py-2 pr-8 border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="popularity">Popularity</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="newest">New Arrivals</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-2.5 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Grid / Skeletons / States */}
            {(searchParams.get('q') ? (!searchCompleted && searchLoading) : loading) ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
                  {Array(10).fill(0).map((_, i) => (
                    <div key={i} className="bg-white rounded-3xl p-4 border border-gray-100 animate-pulse space-y-3">
                      <div className="w-full aspect-square bg-gray-100 rounded-2xl" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                        <div className="h-4 bg-gray-100 rounded w-3/4" />
                        <div className="h-4 bg-gray-100 rounded w-1/2 pt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse flex gap-4 items-center">
                      <div className="w-24 h-24 bg-gray-100 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-1/4" />
                        <div className="h-4 bg-gray-100 rounded w-1/2" />
                        <div className="h-4 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : loadError && allProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm max-w-md mx-auto my-8">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Failed to load products</h3>
                <p className="text-xs text-gray-500 mb-4">Please check your network connection and try again.</p>
                <button
                  onClick={() => setRetryKey(k => k + 1)}
                  className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6' : 'space-y-6'}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm max-w-lg mx-auto my-8">
                <div className="w-16 h-16 bg-red-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {searchParams.get('q') ? <Search className="w-8 h-8" /> : <Layers className="w-8 h-8" />}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">
                  {searchParams.get('q')
                    ? `No products found matching "${searchParams.get('q')}"`
                    : matchedBanner
                    ? 'No products assigned to this banner yet.'
                    : 'No products available in this category yet.'}
                </h3>
                <p className="text-gray-500 mb-4 text-xs font-medium">
                  {searchParams.get('q')
                    ? 'Try checking for typos or searching for broader terms like "kurti", "t-shirt", or "shoes".'
                    : matchedBanner
                    ? 'Check back soon as new products are assigned to this banner offer.'
                    : 'Check back soon as new products are regularly added to our store.'}
                </p>

                {/* Did you mean recovery suggestion */}
                {searchRecovery?.suggestedQuery && (
                  <div className="mb-6 p-3 bg-red-50/60 rounded-xl border border-red-100 inline-flex items-center gap-2 text-xs">
                    <span className="text-gray-600 font-medium">Did you mean:</span>
                    <button
                      onClick={() => setSearchParams({ q: searchRecovery.suggestedQuery })}
                      className="font-black text-primary hover:underline cursor-pointer"
                    >
                      "{searchRecovery.suggestedQuery}"
                    </button>
                  </div>
                )}

                {/* Suggested Categories */}
                {searchRecovery?.suggestedCategories && searchRecovery.suggestedCategories.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Explore related categories</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {searchRecovery.suggestedCategories.slice(0, 4).map((c: string) => (
                        <button
                          key={c}
                          onClick={() => setSearchParams({ q: c })}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-full transition-colors cursor-pointer"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <button
                    onClick={() => {
                      setSearchParams({});
                      navigate('/products');
                    }}
                    className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-md shadow-primary/20 hover:bg-primary-hover transition-all active:scale-95 cursor-pointer"
                  >
                    Browse All Products
                  </button>
                </div>
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > 0 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50 disabled:opacity-50" disabled>Previous</button>
                <button className="w-10 h-10 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-blue-100">1</button>
                <button className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50 disabled:opacity-50" disabled>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Modal */}
      <AnimatePresence>
        {showFilters && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-[320px] bg-white p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-black text-gray-900">Filters</h3>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-8">
                <FiltersContent />

                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 mt-4"
                >
                  Apply Filters
                </button>
                <button
                  onClick={() => { clearFilters(); setShowFilters(false); }}
                  className="w-full bg-gray-50 text-gray-400 py-4 rounded-2xl font-black text-sm uppercase tracking-widest"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 pb-6 mb-6 last:border-0 last:mb-0">
      <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

interface FilterOptionProps {
  label: React.ReactNode;
  count: number;
  checked?: boolean;
  onChange?: (e: React.MouseEvent) => void;
  key?: string | number;
  small?: boolean;
}

function FilterOption({ label, count, checked, onChange, small }: FilterOptionProps) {
  return (
    <label className="flex items-center group cursor-pointer" onClick={(e) => {
      e.preventDefault();
      onChange?.(e);
    }}>
      <div className={`${small ? 'w-3 h-3' : 'w-4 h-4'} rounded border flex items-center justify-center transition-all ${checked ? 'bg-primary border-primary' : 'border-gray-300 group-hover:border-primary'}`}>
        {checked && <div className={`${small ? 'w-1 h-1' : 'w-1.5 h-1.5'} bg-white rounded-full`} />}
      </div>
      <span className={`ml-3 ${small ? 'text-xs' : 'text-sm'} font-medium transition-colors ${checked ? 'text-primary font-bold' : 'text-gray-600 group-hover:text-gray-900'}`}>{label}</span>
      <span className="ml-auto text-[10px] font-bold text-gray-300 tracking-wider">({count})</span>
    </label>
  );
}

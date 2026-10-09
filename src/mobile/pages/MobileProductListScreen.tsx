import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { 
  Filter, SlidersHorizontal, ArrowUpDown, Grid, List, X, Star, ShoppingCart, Check, RefreshCw, Layers, Sparkles
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Banner } from '../../shared/types';
import { useCartStore, useCategoryStore, useVisualNestedSubcategoryStore } from '../../backend/store';
import { getCategorySlug, getSubcategorySlug, getNestedSubcategorySlug, getProductSlug, createSlug, getBannerSlug } from '../../shared/utilities/slug';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import CategoryLogo, { renderCategoryFallbackIcon } from '../../shared/components/CategoryLogo';
import VisualNestedSubcategoriesSection from '../../shared/components/VisualNestedSubcategoriesSection';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProductListScreen() {
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
  const { categories } = useCategoryStore();
  const { items: visualNestedItems } = useVisualNestedSubcategoryStore();
  const { addItem, items: cartItems } = useCartStore();

  const querySearch = searchParams.get('q') || searchParams.get('search') || '';

  // Extract all path segments after "/categories"
  const pathSegments = useMemo(() => {
    const cleanPath = location.pathname.replace(/^\/categories\/?/, '').replace(/\/+$/, '');
    if (!cleanPath) return [];
    return cleanPath.split('/').filter(Boolean).map(s => decodeURIComponent(s));
  }, [location.pathname]);

  const rawCat = routeParams.categorySlug || pathSegments[0] || searchParams.get('category') || '';
  const rawSubCat = routeParams.subcategorySlug || pathSegments[1] || searchParams.get('subCategory') || '';
  const rawNestedSubCat = routeParams.nestedSubcategorySlug || pathSegments[2] || searchParams.get('nestedSubCategory') || '';
  const rawVisual = routeParams.visualSlug || pathSegments[3] || searchParams.get('visual') || '';
  const rawLevel5 = routeParams.subLevel5 || pathSegments[4] || '';
  const rawBrand = routeParams.brandSlug || searchParams.get('brand') || '';
  const rawOffer = routeParams.offerSlug || searchParams.get('offer') || '';

  // Active Category Object
  const currentCategoryObj = useMemo(() => {
    if (!rawCat) return null;
    return categories.find(c => 
      c && (
        c.id === rawCat || 
        c.slug === rawCat || 
        c.seoSlug === rawCat || 
        createSlug(c.name) === rawCat ||
        (c.name && c.name.toLowerCase() === rawCat.toLowerCase())
      )
    ) || null;
  }, [rawCat, categories]);

  // Backward compatibility redirect for numeric category routes
  useEffect(() => {
    if (currentCategoryObj && (rawCat === currentCategoryObj.id || /^\d+$/.test(rawCat))) {
      const canonical = getCategorySlug(currentCategoryObj);
      if (canonical && rawCat !== canonical) {
        navigate(`/category/${canonical}`, { replace: true });
      }
    }
  }, [currentCategoryObj, rawCat, navigate]);

  // Active SubCategory Object (Level 1)
  const currentSubCategoryObj = useMemo(() => {
    if (!rawSubCat) return null;
    if (currentCategoryObj?.subcategories) {
      const found = currentCategoryObj.subcategories.find(s => 
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
    for (const cat of categories) {
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
  }, [rawSubCat, currentCategoryObj, categories]);

  // Active Nested SubCategory Object (Level 2)
  const currentNestedSubCategoryObj = useMemo(() => {
    if (!rawNestedSubCat) return null;
    if (currentSubCategoryObj?.subcategories) {
      const found = currentSubCategoryObj.subcategories.find(n => 
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
    return currentCategoryObj?.subcategories?.flatMap(s => s.subcategories || []).find(n => 
      n && (
        n.id === rawNestedSubCat || 
        n.slug === rawNestedSubCat || 
        (n as any).seoSlug === rawNestedSubCat || 
        createSlug(n.name) === rawNestedSubCat ||
        (n.name && n.name.toLowerCase() === rawNestedSubCat.toLowerCase())
      )
    ) || null;
  }, [rawNestedSubCat, currentSubCategoryObj, currentCategoryObj]);

  // Active Level 3 Deep SubCategory Object
  const currentDeepChildSubCategoryObj = useMemo(() => {
    const deepSlug = rawVisual || rawLevel5;
    if (!deepSlug || !currentNestedSubCategoryObj?.subcategories) return null;
    return currentNestedSubCategoryObj.subcategories.find(c => 
      c && (
        c.id === deepSlug || 
        c.slug === deepSlug || 
        (c as any).seoSlug === deepSlug || 
        createSlug(c.name) === deepSlug ||
        (c.name && c.name.toLowerCase() === deepSlug.toLowerCase())
      )
    ) || null;
  }, [rawVisual, rawLevel5, currentNestedSubCategoryObj]);

  // Active Visual Nested SubCategory Object
  const currentVisualNestedSubcategoryObj = useMemo(() => {
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

        if (currentCategoryObj && v.categoryId && v.categoryId !== currentCategoryObj.id && v.categoryId !== currentCategoryObj.slug && v.categoryId !== createSlug(currentCategoryObj.name)) {
          if (v.categoryName && currentCategoryObj.name && v.categoryName.toLowerCase() !== currentCategoryObj.name.toLowerCase()) {
            return false;
          }
        }
        if (currentSubCategoryObj && v.subCategoryId && v.subCategoryId !== currentSubCategoryObj.id && v.subCategoryId !== currentSubCategoryObj.slug && v.subCategoryId !== createSlug(currentSubCategoryObj.name)) {
          if (v.subCategoryName && currentSubCategoryObj.name && v.subCategoryName.toLowerCase() !== currentSubCategoryObj.name.toLowerCase()) {
            return false;
          }
        }
        return true;
      });
      if (found) return found;
    }
    return null;
  }, [rawVisual, rawLevel5, pathSegments, rawNestedSubCat, rawSubCat, searchParams, currentCategoryObj, currentSubCategoryObj, visualNestedItems]);

  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  // Match banner if accessing a banner route
  const matchedBanner = useMemo(() => {
    if (!rawOffer) return null;
    return banners.find(b => b.id === rawOffer || b.slug === rawOffer || getBannerSlug(b) === rawOffer || (b.link && b.link.includes(rawOffer))) || null;
  }, [rawOffer, banners]);

  // Base Page Context (from route / visual / brand / category hierarchy)
  const baseCatId = useMemo(() => {
    return currentCategoryObj?.id || currentVisualNestedSubcategoryObj?.categoryId || (rawCat && rawCat !== 'products' && rawCat !== 'categories' ? rawCat : '');
  }, [currentCategoryObj, currentVisualNestedSubcategoryObj, rawCat]);

  const baseSubId = useMemo(() => {
    return currentSubCategoryObj?.id || (currentVisualNestedSubcategoryObj?.subCategoryId && currentVisualNestedSubcategoryObj.subCategoryId !== 'all' ? currentVisualNestedSubcategoryObj.subCategoryId : '') || (rawSubCat || '');
  }, [currentSubCategoryObj, currentVisualNestedSubcategoryObj, rawSubCat]);

  const baseNestedId = useMemo(() => {
    return currentDeepChildSubCategoryObj?.id || currentNestedSubCategoryObj?.id || currentVisualNestedSubcategoryObj?.nestedSubCategoryId || (currentVisualNestedSubcategoryObj?.parentTargetType === 'nested_subcategory' ? currentVisualNestedSubcategoryObj.parentTargetId : '') || (rawNestedSubCat || '');
  }, [currentDeepChildSubCategoryObj, currentNestedSubCategoryObj, currentVisualNestedSubcategoryObj, rawNestedSubCat]);

  const baseBrand = useMemo(() => {
    return rawBrand || '';
  }, [rawBrand]);

  // Layout state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'low-high' | 'high-low' | 'rating'>('featured');

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(baseCatId);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(baseSubId);
  const [selectedNestedSubCategory, setSelectedNestedSubCategory] = useState<string>(baseNestedId);
  const [selectedBrand, setSelectedBrand] = useState<string>(baseBrand);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minRating, setMinRating] = useState<number>(0);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Sync state when URL params change
  useEffect(() => {
    setSelectedCategory(baseCatId);
    setSelectedSubCategory(baseSubId);
    setSelectedNestedSubCategory(baseNestedId);
    setSelectedBrand(baseBrand);
  }, [baseCatId, baseSubId, baseNestedId, baseBrand]);

  // Category-Specific Banners for active Category (Strict Isolation)
  const categoryBanners = useMemo(() => {
    const catId = currentCategoryObj?.id || selectedCategory || baseCatId;
    const catSlug = currentCategoryObj ? getCategorySlug(currentCategoryObj) : (selectedCategory || baseCatId);
    if (!catId) return [];
    if (catId === 'for-you' || catSlug === 'for-you') {
      return banners.filter(b => (b.categoryId === 'for-you' || !b.categoryId) && b.active !== false);
    }
    return banners.filter(b => (b.categoryId === catId || b.categoryId === catSlug) && b.active !== false);
  }, [currentCategoryObj, selectedCategory, baseCatId, banners]);

  // Fetch Products & Banners from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const rewardIds = await getRewardProductIds();
      setProducts(filterOutRewardProducts(docs, rewardIds));
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch products:', error);
      setLoading(false);
    });

    const bq = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribeBanners = onSnapshot(bq, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(docs);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeBanners();
    };
  }, []);

  // Derive unique brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands);
  }, [products]);

  // Filter and Sort products according to 3-tier hierarchy (Requirement 4, 5, 6, 9)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (product.status === 'inactive') return false;

      // Banner filter (Show ONLY products assigned to this banner when viewing a banner route)
      if (matchedBanner) {
        const assignedIds = new Set(matchedBanner.productIds || []);
        if (!assignedIds.has(product.id)) return false;
      }

      // Query Search
      if (querySearch) {
        const q = querySearch.toLowerCase();
        const cleanQ = cleanProductCode(q);
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesBrand = product.brand?.toLowerCase().includes(q);
        const matchesId = product.id.toLowerCase().includes(q);
        const matchesCode = product.productCode && (
          product.productCode.toLowerCase().includes(q) ||
          (cleanQ.length > 0 && cleanProductCode(product.productCode).includes(cleanQ))
        );
        const matchesTags = product.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesBrand && !matchesId && !matchesCode && !matchesTags) return false;
      }

      // Skip category hierarchy filtering if opening explicit banner
      if (!matchedBanner) {
        const effectiveNested = selectedNestedSubCategory || baseNestedId;
        const effectiveSub = selectedSubCategory || baseSubId;
        const effectiveCat = selectedCategory || baseCatId;

        // 1. Nested SubCategory Filter
        if (effectiveNested) {
          const targetNested = (currentNestedSubCategoryObj?.id || effectiveNested).toLowerCase();
          const pNested = (product.nestedSubCategoryId || '').toLowerCase();
          if (pNested !== targetNested) return false;
        }
        // 2. SubCategory Filter
        else if (effectiveSub) {
          const targetSub = (currentSubCategoryObj?.id || effectiveSub).toLowerCase();
          const pSub = (product.subCategoryId || '').toLowerCase();
          if (pSub !== targetSub) return false;
        }
        // 3. Category Filter
        else if (effectiveCat && effectiveCat !== 'all-deals') {
          const catId = (product.categoryId || '').toLowerCase();
          const target = (currentCategoryObj?.id || effectiveCat).toLowerCase();
          const targetSlug = currentCategoryObj ? getCategorySlug(currentCategoryObj).toLowerCase() : target;
          if (catId !== target && catId !== targetSlug) return false;
        }
      }

      // Brand filter
      const effectiveBrand = selectedBrand || baseBrand;
      if (effectiveBrand && product.brand !== effectiveBrand) {
        return false;
      }

      // Price filter
      const price = product.discountPrice || product.price;
      if (price > maxPrice) return false;

      // Rating filter
      if (minRating > 0 && (product.rating || 0) < minRating) return false;

      // Discount filter
      const discountPct = product.price && product.discountPrice 
        ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
        : (product.discountPercentage || 0);
      if (minDiscount > 0 && discountPct < minDiscount) return false;

      // Stock filter
      if (inStockOnly && (product.stock <= 0 || product.status === 'out_of_stock')) return false;

      return true;
    }).sort((a, b) => {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;
      if (sortBy === 'low-high') return priceA - priceB;
      if (sortBy === 'high-low') return priceB - priceA;
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      return 0;
    });
  }, [products, querySearch, selectedCategory, currentCategoryObj, selectedSubCategory, currentSubCategoryObj, selectedNestedSubCategory, currentNestedSubCategoryObj, selectedBrand, baseCatId, baseSubId, baseNestedId, baseBrand, matchedBanner, maxPrice, minRating, minDiscount, inStockOnly, sortBy]);

  const activeFilterCount = (selectedCategory !== baseCatId ? 1 : 0) +
    (selectedSubCategory !== baseSubId ? 1 : 0) +
    (selectedNestedSubCategory !== baseNestedId ? 1 : 0) +
    (selectedBrand !== baseBrand ? 1 : 0) +
    (maxPrice < 100000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (minDiscount > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (querySearch ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategory(baseCatId);
    setSelectedSubCategory(baseSubId);
    setSelectedNestedSubCategory(baseNestedId);
    setSelectedBrand(baseBrand);
    setMaxPrice(100000);
    setMinRating(0);
    setMinDiscount(0);
    setInStockOnly(false);
    setSearchParams({});
  };

  const handleSubCategorySelect = (subId: string) => {
    if (!currentCategoryObj) return;
    const catSlug = getCategorySlug(currentCategoryObj);
    const subObj = currentCategoryObj.subcategories?.find(s => s.id === subId || s.slug === subId || createSlug(s.name) === subId);
    if (!subObj) return;
    const subSlug = getSubcategorySlug(subObj);

    if (currentSubCategoryObj && (currentSubCategoryObj.id === subId || currentSubCategoryObj.slug === subSlug || createSlug(currentSubCategoryObj.name) === subSlug)) {
      // If clicking current subcategory, return to top-level category page
      navigate(`/categories/${catSlug}`);
    } else {
      navigate(`/categories/${catSlug}/${subSlug}`);
    }
  };

  const handleNestedSubCategorySelect = (nestedId: string) => {
    if (!currentCategoryObj || !currentSubCategoryObj) return;
    const catSlug = getCategorySlug(currentCategoryObj);
    const subSlug = getSubcategorySlug(currentSubCategoryObj);
    const nestedObj = currentSubCategoryObj.subcategories?.find(n => n.id === nestedId || n.slug === nestedId || createSlug(n.name) === nestedId);
    if (!nestedObj) return;
    const nestedSlug = getNestedSubcategorySlug(nestedObj);

    if (currentNestedSubCategoryObj && (currentNestedSubCategoryObj.id === nestedId || currentNestedSubCategoryObj.slug === nestedSlug || createSlug(currentNestedSubCategoryObj.name) === nestedSlug)) {
      // Toggle back to subcategory page
      navigate(`/categories/${catSlug}/${subSlug}`);
    } else {
      navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const isInCart = cartItems.some(i => i.productId === product.id);
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const res = addItem(product, 1);
    if (res.success) {
      toast.success("Added to Cart", { icon: '🛒' });
    } else if (res.exists) {
      navigate('/cart');
    } else {
      toast.error("Out of stock");
    }
  };

  const handleBuyNow = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const isInCart = cartItems.some(i => i.productId === product.id);
    if (!isInCart) {
      addItem(product, 1);
    }
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-white pb-36 sm:pb-40 font-sans select-none p-3 space-y-3">
      {/* Top Filter & Sort Bar */}
      <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-yellow-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Filter Drawer Trigger */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-black border border-emerald-200"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </motion.button>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold px-2.5 py-1.5 rounded-xl appearance-none pr-6 focus:outline-none"
            >
              <option value="featured">Sort: Featured</option>
              <option value="low-high">Price: Low to High</option>
              <option value="high-low">Price: High to Low</option>
              <option value="rating">Top Rated</option>
            </select>
            <ArrowUpDown className="w-3 h-3 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Grid vs List View Switcher */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Matched Banner Hero Card */}
      {matchedBanner && (
        <div className="bg-gradient-to-r from-gray-900 via-indigo-950 to-gray-900 rounded-2xl p-4 text-white shadow-md border border-indigo-900/50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-emerald-400" /> Featured Offer Banner
            </span>
          </div>
          <h3 className="text-base font-black tracking-tight text-white leading-tight">
            {matchedBanner.title}
          </h3>
          {matchedBanner.subtitle && (
            <p className="text-xs text-gray-300 font-medium line-clamp-2">{matchedBanner.subtitle}</p>
          )}
          <div className="flex items-center justify-between text-[10px] text-indigo-300 pt-1 font-bold">
            <span>Products Assigned to this Banner</span>
          </div>
        </div>
      )}

      {/* Category-Specific Banners Slider */}
      {categoryBanners.length > 0 && !matchedBanner && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> {currentCategoryObj?.name || 'Category'} Banners
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-0.5">
            {categoryBanners.map(b => (
              <div
                key={b.id}
                onClick={() => {
                  if (b.link) navigate(b.link);
                  else navigate(`/offers/${b.slug || b.id}`);
                }}
                className="relative rounded-xl overflow-hidden border border-gray-100 shadow-xs aspect-[2/1] bg-white shrink-0 w-64 snap-start cursor-pointer active:scale-95 transition-transform"
              >
                <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                {(b.title || b.subtitle) && (
                  <div className="absolute inset-0 p-2.5 flex flex-col justify-end text-white pointer-events-none">
                    <h4 className="text-xs font-black line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{b.title}</h4>
                    {b.subtitle && <p className="text-[9px] text-white/90 line-clamp-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{b.subtitle}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category / Collection Title Bar */}
      {(currentCategoryObj || currentVisualNestedSubcategoryObj) && (
        <div className="bg-white rounded-2xl p-3 shadow-xs border border-yellow-100/60 space-y-1">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight">
            {currentVisualNestedSubcategoryObj
              ? (currentVisualNestedSubcategoryObj.name || currentVisualNestedSubcategoryObj.offerText || 'Visual Collection')
              : (currentDeepChildSubCategoryObj
                ? currentDeepChildSubCategoryObj.name
                : (currentNestedSubCategoryObj
                  ? currentNestedSubCategoryObj.name
                  : (currentSubCategoryObj
                    ? currentSubCategoryObj.name
                    : (currentCategoryObj ? currentCategoryObj.name : 'All Products'))))}
          </h2>
        </div>
      )}

      {/* Collections Bar (Shown ONLY when browsing Category and no subcategory is selected) */}
      {!currentSubCategoryObj && currentCategoryObj && currentCategoryObj.subcategories && currentCategoryObj.subcategories.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-yellow-100 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-gray-900">
              {currentCategoryObj.name}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
            {currentCategoryObj.subcategories.map(sub => {
              const isSelected = selectedSubCategory === sub.id || selectedSubCategory === sub.slug || createSlug(sub.name) === selectedSubCategory;
              return (
                <button
                  key={sub.id}
                  onClick={() => handleSubCategorySelect(sub.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 transition-all w-20 cursor-pointer"
                >
                  <div className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center ${
                    isSelected ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                  }`}>
                    {sub.image && (sub.image.startsWith('http') || sub.image.startsWith('data:') || sub.image.startsWith('/')) ? (
                      <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        {renderCategoryFallbackIcon(sub.name, sub.icon, "w-7 h-7", isSelected)}
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-extrabold text-center max-w-[76px] leading-tight line-clamp-1 ${
                    isSelected ? 'text-emerald-900 font-black' : 'text-gray-700'
                  }`}>
                    {sub.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated Level 3 Deep Collections Showcase (if currentNestedSubCategoryObj has children) */}
      {currentNestedSubCategoryObj && currentNestedSubCategoryObj.subcategories && currentNestedSubCategoryObj.subcategories.length > 0 && (
        <div className="bg-emerald-50/60 rounded-2xl p-3 shadow-sm border border-emerald-100 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-black text-gray-900">
                Explore {currentNestedSubCategoryObj.name}
              </span>
            </div>
            {currentDeepChildSubCategoryObj && (
              <button
                onClick={() => {
                  const catSlug = getCategorySlug(currentCategoryObj!);
                  const subSlug = getSubcategorySlug(currentSubCategoryObj!);
                  const nestedSlug = getNestedSubcategorySlug(currentNestedSubCategoryObj);
                  navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
                }}
                className="text-[10px] font-bold text-emerald-700 underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
            {currentNestedSubCategoryObj.subcategories.map(child => {
              const isChildSelected = currentDeepChildSubCategoryObj?.id === child.id || rawVisual === child.id || rawVisual === child.slug || createSlug(child.name) === rawVisual;
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    const catSlug = getCategorySlug(currentCategoryObj!);
                    const subSlug = getSubcategorySlug(currentSubCategoryObj!);
                    const nestedSlug = getNestedSubcategorySlug(currentNestedSubCategoryObj);
                    const childSlug = getNestedSubcategorySlug(child);
                    if (isChildSelected) {
                      navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}`);
                    } else {
                      navigate(`/categories/${catSlug}/${subSlug}/${nestedSlug}/${childSlug}`);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 shrink-0 transition-all w-20 cursor-pointer"
                >
                  <div className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center ${
                    isChildSelected ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                  }`}>
                    {child.image && (child.image.startsWith('http') || child.image.startsWith('data:') || child.image.startsWith('/')) ? (
                      <img src={child.image} alt={child.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${isChildSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        {renderCategoryFallbackIcon(child.name, child.icon, "w-7 h-7", isChildSelected)}
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-extrabold text-center max-w-[76px] leading-tight line-clamp-1 ${
                    isChildSelected ? 'text-emerald-900 font-black' : 'text-gray-700'
                  }`}>
                    {child.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated Collections Showcase (Shown ONLY for active Subcategory) */}
      {!currentNestedSubCategoryObj && currentSubCategoryObj && currentSubCategoryObj.subcategories && currentSubCategoryObj.subcategories.length > 0 && (
        <div className="bg-emerald-50/60 rounded-2xl p-3 shadow-sm border border-emerald-100 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-black text-gray-900">
                Explore {currentSubCategoryObj.name}
              </span>
            </div>
            {currentNestedSubCategoryObj && (
              <button
                onClick={() => {
                  const catSlug = getCategorySlug(currentCategoryObj!);
                  const subSlug = getSubcategorySlug(currentSubCategoryObj);
                  navigate(`/categories/${catSlug}/${subSlug}`);
                }}
                className="text-[10px] font-bold text-emerald-700 underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
            {currentSubCategoryObj.subcategories.map(nested => {
              const isNestedSelected = selectedNestedSubCategory === nested.id || selectedNestedSubCategory === nested.slug || createSlug(nested.name) === selectedNestedSubCategory;
              return (
                <button
                  key={nested.id}
                  onClick={() => handleNestedSubCategorySelect(nested.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0 transition-all w-20 cursor-pointer"
                >
                  <div className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center ${
                    isNestedSelected ? 'ring-2 ring-emerald-600 shadow-sm scale-105' : 'bg-gray-50'
                  }`}>
                    {nested.image && (nested.image.startsWith('http') || nested.image.startsWith('data:') || nested.image.startsWith('/')) ? (
                      <img src={nested.image} alt={nested.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${isNestedSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                        {renderCategoryFallbackIcon(nested.name, nested.icon, "w-7 h-7", isNestedSelected)}
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] font-extrabold text-center max-w-[76px] leading-tight line-clamp-1 ${
                    isNestedSelected ? 'text-emerald-900 font-black' : 'text-gray-700'
                  }`}>
                    {nested.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic Visual Nested Subcategories Showcase (Only shown when not on a dedicated visual card page) */}
      {!currentVisualNestedSubcategoryObj && (currentCategoryObj || selectedCategory) && (
        <VisualNestedSubcategoriesSection
          categoryId={currentCategoryObj?.id || selectedCategory}
          subCategoryId={currentSubCategoryObj?.id || selectedSubCategory}
          nestedSubCategoryId={currentNestedSubCategoryObj?.id || selectedNestedSubCategory}
          parentTargetId={currentDeepChildSubCategoryObj?.id || currentNestedSubCategoryObj?.id || selectedNestedSubCategory || currentSubCategoryObj?.id || selectedSubCategory || currentCategoryObj?.id || selectedCategory}
          isMobile={true}
        />
      )}

      {/* Active Filter Pills */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-end px-1">
          <button
            onClick={clearAllFilters}
            className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Clear All
          </button>
        </div>
      )}

      {/* Product List Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white rounded-2xl animate-pulse border border-yellow-100" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
          {filteredProducts.map((product) => {
            const isInCart = cartItems.some(i => i.productId === product.id);
            const discountPct = product.price && product.discountPrice
              ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
              : (product.discountPercentage || 0);

            if (viewMode === 'list') {
              return (
                <motion.div
                  key={product.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                  className="bg-white rounded-2xl p-2 shadow-sm border border-yellow-100 flex gap-2.5 cursor-pointer group hover:shadow-md transition-all"
                >
                  <div className="w-24 h-24 rounded-xl bg-white p-1 overflow-hidden relative shrink-0 flex items-center justify-center border border-gray-100">
                    <img 
                      src={product.images?.[0] || 'https://via.placeholder.com/150'} 
                      alt={product.name} 
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform bg-white" 
                    />
                    {discountPct > 0 && (
                      <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                        {discountPct}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate block">
                        {product.brand || 'ViBa Select'}
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1 truncate leading-tight mt-0.5">
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 pt-0.5 border-t border-gray-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-gray-900">
                          ₹{(product.discountPrice || product.price).toLocaleString()}
                        </span>
                        {product.discountPrice && (
                          <span className="text-[10px] text-gray-400 line-through">
                            ₹{product.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                className="bg-white rounded-2xl p-2 shadow-sm border border-yellow-100 flex flex-col justify-between cursor-pointer group hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center mb-1 border border-gray-50">
                  <img 
                    src={product.images?.[0] || 'https://via.placeholder.com/300'} 
                    alt={product.name} 
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform bg-white" 
                  />
                  {discountPct > 0 && (
                    <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                      {discountPct}% OFF
                    </span>
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0 mb-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">
                    {product.brand || 'ViBa Select'}
                  </span>
                  <h4 className="text-xs font-bold text-gray-900 line-clamp-1 truncate leading-tight mt-0.5">
                    {product.name}
                  </h4>
                </div>

                <div className="pt-1 border-t border-gray-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-gray-900">
                      ₹{(product.discountPrice || product.price).toLocaleString()}
                    </span>
                    {product.discountPrice && (
                      <span className="text-[10px] text-gray-400 line-through">
                        ₹{product.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-yellow-100 space-y-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-800">
            {matchedBanner ? 'No products assigned to this banner yet.' : 'No products available in this category yet.'}
          </h4>
          <p className="text-xs text-gray-500">
            {matchedBanner ? 'Check back soon as new products are assigned to this offer.' : 'Check back soon as new inventory is added regularly.'}
          </p>
          <button
            onClick={() => navigate('/products')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95"
          >
            Browse All Products
          </button>
        </div>
      )}

      {/* Mobile Filter Drawer (Slide-Up Sheet) */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[28px] max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Filter Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-gray-900">Filter Products</h3>
                </div>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Body */}
              <div className="p-4 overflow-y-auto space-y-5 flex-1">
                {/* Category Filter */}
                <div>
                  <label className="text-xs font-black text-gray-800 uppercase tracking-wider block mb-2">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          selectedCategory === cat.id
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brand Filter */}
                {availableBrands.length > 0 && (
                  <div>
                    <label className="text-xs font-black text-gray-800 uppercase tracking-wider block mb-2">
                      Brand
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableBrands.map((brand) => (
                        <button
                          key={brand}
                          onClick={() => setSelectedBrand(selectedBrand === brand ? '' : brand)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            selectedBrand === brand
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Range Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-gray-800 uppercase tracking-wider">
                      Max Price
                    </label>
                    <span className="text-xs font-extrabold text-emerald-700">₹{maxPrice.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="100000"
                    step="500"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                {/* Minimum Rating */}
                <div>
                  <label className="text-xs font-black text-gray-800 uppercase tracking-wider block mb-2">
                    Minimum Rating
                  </label>
                  <div className="flex gap-2">
                    {[4, 3, 2, 1].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(minRating === r ? 0 : r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-all ${
                          minRating === r
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        <span>{r}★ & up</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability Filter */}
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    In Stock Only
                  </span>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600 rounded"
                  />
                </div>
              </div>

              {/* Filter Footer */}
              <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
                <button
                  onClick={clearAllFilters}
                  className="flex-1 py-3 bg-white text-gray-800 rounded-2xl text-xs font-black uppercase tracking-wider border border-gray-200"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

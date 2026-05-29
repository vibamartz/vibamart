import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store';
import { Product } from '../types';
import { toast } from 'react-hot-toast';
import {
  Filter, SlidersHorizontal, ChevronDown, ChevronRight, Grid, List as ListIcon, X, Star, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore, useCategoryStore } from '../store';
import ProductCard from '../components/ProductCard';

export default function ProductList() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('popularity');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
    } catch { return []; }
  });

  // Persist and restore search state
  useEffect(() => {
    const currentQuery = searchParams.toString();
    if (!currentQuery) {
      const savedSearch = sessionStorage.getItem('viba_last_search');
      if (savedSearch) {
        setSearchParams(new URLSearchParams(savedSearch), { replace: true });
      }
    } else {
      sessionStorage.setItem('viba_last_search', currentQuery);
      const q = searchParams.get('q');
      if (q) {
        setRecentSearches(prevArr => {
          const filtered = prevArr.filter(item => item !== q);
          const updated = [q, ...filtered].slice(0, 5);
          localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
          return updated;
        });
      }
    }
  }, [searchParams, setSearchParams]);

  // Filter States
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : [];
  });
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedNestedSubCategories, setSelectedNestedSubCategories] = useState<string[]>([]);
  const [expandedFilterCats, setExpandedFilterCats] = useState<string[]>([]);
  const [expandedFilterSubs, setExpandedFilterSubs] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState(200000);
  const [minRating, setMinRating] = useState(0);
  const [minDiscount, setMinDiscount] = useState(0);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Helper for dynamic faceted search counts
  const getFilterCount = (filterType: string, value: any) => {
    return allProducts.filter(p => {
      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.categoryId)) return false;

      // SubCategory filter
      if (filterType !== 'subcategory' && selectedSubCategories.length > 0 && p.subCategoryId && !selectedSubCategories.includes(p.subCategoryId)) return false;

      // Brand filter
      if (filterType !== 'brand' && selectedBrands.length > 0 && p.brand && !selectedBrands.includes(p.brand)) return false;

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

      // Search query filter
      const queryStr = searchParams.get('q');
      if (queryStr) {
        const terms = queryStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
          const searchableText = [p.name, p.brand, p.description, p.fullDescription, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
          const isMatch = terms.every(term => searchableText.includes(term));
          if (!isMatch) return false;
        }
      }

      // Check the specific value for the current filterType
      if (filterType === 'subcategory' && p.subCategoryId !== value) return false;
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
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync category from URL
  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat && !selectedCategories.includes(cat)) {
      setSelectedCategories([cat]);
      setSelectedSubCategories([]); // Clear subcategories when switching category from URL
    }
  }, [searchParams]);

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
  }, [selectedCategories]);

  const filteredProducts = useMemo(() => {
    let result = allProducts.filter(p => {
      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.categoryId)) return false;

      // SubCategory filter
      if (selectedSubCategories.length > 0 && p.subCategoryId && !selectedSubCategories.includes(p.subCategoryId)) return false;

      // Nested SubCategory filter
      if (selectedNestedSubCategories.length > 0 && p.nestedSubCategoryId && !selectedNestedSubCategories.includes(p.nestedSubCategoryId)) return false;

      // Brand filter
      if (selectedBrands.length > 0 && p.brand && !selectedBrands.includes(p.brand)) return false;

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

      // Search query filter (from URL)
      const queryStr = searchParams.get('q');
      if (queryStr) {
        const terms = queryStr.toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
          const catObj = CATEGORIES.find(c => c.id === p.categoryId);
          const catName = catObj?.name || '';
          const subCatObj = catObj?.subcategories?.find(s => s.id === p.subCategoryId);
          const subCatName = subCatObj?.name || '';
          const nestedSubCatName = subCatObj?.subcategories?.find(n => n.id === p.nestedSubCategoryId)?.name || '';

          const searchableText = [
            p.name,
            p.brand,
            p.description,
            p.fullDescription,
            catName,
            subCatName,
            nestedSubCatName,
            ...(p.tags || [])
          ].filter(Boolean).join(' ').toLowerCase();

          const isMatch = terms.every(term => searchableText.includes(term));
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
  }, [allProducts, selectedCategories, selectedSubCategories, selectedNestedSubCategories, selectedBrands, priceRange, minRating, minDiscount, onlyInStock, sortBy, searchParams]);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleSubCategory = (id: string) => {
    setSelectedSubCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
  };

  const toggleNestedSubCategory = (id: string) => {
    setSelectedNestedSubCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleFilterCat = (id: string) => {
    setExpandedFilterCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleFilterSub = (id: string) => {
    setExpandedFilterSubs(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedNestedSubCategories([]);
    setSelectedBrands([]);
    setPriceRange(200000);
    setMinRating(0);
    setMinDiscount(0);
    setOnlyInStock(false);
    setSearchParams({});
  };

  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    allProducts.forEach(p => {
      if (p.brand && (!selectedCategories.length || selectedCategories.includes(p.categoryId))) {
        brands.add(p.brand);
      }
    });
    return Array.from(brands).sort();
  }, [allProducts, selectedCategories]);

  const uniqueSubCategories = useMemo(() => {
    const subs = new Set<string>();
    allProducts.forEach(p => {
      if (p.subCategoryId && (!selectedCategories.length || selectedCategories.includes(p.categoryId))) {
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
      <FilterSection title="Availability">
        <FilterOption
          label="In Stock Only"
          count={getFilterCount('availability', true)}
          checked={onlyInStock}
          onChange={() => setOnlyInStock(!onlyInStock)}
        />
      </FilterSection>

      <FilterSection title="Subcategory">
        {uniqueSubCategories.length > 0 ? uniqueSubCategories.map(sub => (
          <FilterOption
            key={sub.id}
            label={sub.name}
            count={getFilterCount('subcategory', sub.id)}
            checked={selectedSubCategories.includes(sub.id)}
            onChange={() => toggleSubCategory(sub.id)}
          />
        )) : (
          <p className="text-xs text-gray-400">No subcategories</p>
        )}
      </FilterSection>

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
    </>
  );

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header / Breadcrumbs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Browse Products</h1>

          {/* Subcategories Horizontal Bar (Flipkart/Myntra Style) */}
          {selectedCategories.length > 0 && (
            <div className="flex gap-6 overflow-x-auto no-scrollbar py-8 mb-4">
              {selectedCategories.flatMap(catId =>
                CATEGORIES.find(c => c.id === catId)?.subcategories || []
              ).map(sub => (
                <button
                  key={sub.id}
                  onClick={() => toggleSubCategory(sub.id)}
                  className="flex flex-col items-center gap-3 min-w-[70px] group transition-all"
                >
                  <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all p-0.5 bg-white shadow-sm flex-shrink-0 ${selectedSubCategories.includes(sub.id)
                      ? 'border-primary ring-4 ring-primary/10 scale-110 shadow-lg'
                      : 'border-gray-100 group-hover:border-primary/50 group-hover:scale-105'
                    }`}>
                    <img
                      src={sub.image || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200&h=200&fit=crop'}
                      className="w-full h-full rounded-full object-cover"
                      alt={sub.name}
                    />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-tight text-center whitespace-wrap max-w-[80px] leading-tight transition-colors ${selectedSubCategories.includes(sub.id) ? 'text-primary' : 'text-gray-500 group-hover:text-gray-900'
                    }`}>
                    {sub.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Nested Subcategories Horizontal Bar with Icon/Logo */}
          {selectedSubCategories.length > 0 && (
            <div className="flex gap-6 overflow-x-auto no-scrollbar py-4 mb-4 border-t border-gray-100/50">
              {selectedSubCategories.flatMap(subId => {
                const cat = CATEGORIES.find(c => c.subcategories?.some(s => s.id === subId));
                const sub = cat?.subcategories?.find(s => s.id === subId);
                return sub?.subcategories || [];
              }).map(nested => (
                <button
                  key={nested.id}
                  onClick={() => toggleNestedSubCategory(nested.id)}
                  className="flex flex-col items-center gap-2.5 min-w-[60px] group transition-all animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all p-0.5 bg-white shadow-sm flex-shrink-0 ${selectedNestedSubCategories.includes(nested.id)
                      ? 'border-primary ring-4 ring-primary/10 scale-110 shadow-md'
                      : 'border-gray-100 group-hover:border-primary/50 group-hover:scale-105'
                    }`}>
                    <img
                      src={nested.image || 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=200&h=200&fit=crop'}
                      className="w-full h-full rounded-full object-cover"
                      alt={nested.name}
                    />
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-tight text-center max-w-[70px] leading-tight transition-colors ${selectedNestedSubCategories.includes(nested.id) ? 'text-primary' : 'text-gray-500 group-hover:text-gray-900'
                    }`}>
                    {nested.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchParams.get('q') && (
            <p className="inline-flex items-center gap-2 bg-blue-50 text-primary px-3 py-1 rounded-full text-xs font-bold ring-1 ring-blue-100 mb-4">
              Search results for: "{searchParams.get('q')}"
              <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchParams({})} />
            </p>
          )}
          <p className="text-gray-500 font-medium">Discover {filteredProducts.length} items matching your criteria</p>
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-3 mt-6 overflow-x-auto no-scrollbar pb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">Recently Searched:</span>
              <div className="flex gap-2">
                {recentSearches.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setSearchParams({ q: s })}
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
                  className="lg:hidden flex items-center gap-2 text-sm font-bold bg-gray-50 px-4 py-2 rounded-lg border border-gray-100"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                </button>
                <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-gray-400">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-blue-50 text-primary' : 'hover:bg-gray-50'}`}
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

            {/* Grid */}
            {filteredProducts.length > 0 ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6' : 'space-y-6'}>
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Filter className="w-8 h-8 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-500 mb-6">Try adjusting your filters or search query to find what you're looking for.</p>
                <button
                  onClick={clearFilters}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-50 hover:bg-primary-hover transition-all"
                >
                  Clear All Filters
                </button>
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

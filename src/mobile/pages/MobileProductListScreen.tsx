import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Filter, SlidersHorizontal, ArrowUpDown, Grid, List, X, Star, ShoppingCart, Check, RefreshCw 
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { useCartStore, useCategoryStore } from '../../backend/store';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProductListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { categories } = useCategoryStore();
  const { addItem, items: cartItems } = useCartStore();

  const querySearch = searchParams.get('q') || searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialSubCategory = searchParams.get('subCategory') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Layout state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'low-high' | 'high-low' | 'rating'>('featured');

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(initialSubCategory);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minRating, setMinRating] = useState<number>(0);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Sync state when URL params change
  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
    if (initialSubCategory) setSelectedSubCategory(initialSubCategory);
  }, [initialCategory, initialSubCategory]);

  // Fetch Products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch products:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Derive unique brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands);
  }, [products]);

  // Filter and Sort products
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Query Search
      if (querySearch) {
        const q = querySearch.toLowerCase();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesBrand = product.brand?.toLowerCase().includes(q);
        const matchesTags = product.tags?.some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesBrand && !matchesTags) return false;
      }

      // Category filter
      if (selectedCategory && selectedCategory !== 'all-deals') {
        const catId = (product.categoryId || '').toLowerCase();
        const target = selectedCategory.toLowerCase();
        if (!catId.includes(target) && !target.includes(catId)) return false;
      }

      // SubCategory filter
      if (selectedSubCategory) {
        const subId = (product.subCategoryId || '').toLowerCase();
        if (subId !== selectedSubCategory.toLowerCase()) return false;
      }

      // Brand filter
      if (selectedBrand && product.brand !== selectedBrand) {
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
  }, [products, querySearch, selectedCategory, selectedSubCategory, selectedBrand, maxPrice, minRating, minDiscount, inStockOnly, sortBy]);

  const activeFilterCount = (selectedCategory ? 1 : 0) +
    (selectedSubCategory ? 1 : 0) +
    (selectedBrand ? 1 : 0) +
    (maxPrice < 100000 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (minDiscount > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedSubCategory('');
    setSelectedBrand('');
    setMaxPrice(100000);
    setMinRating(0);
    setMinDiscount(0);
    setInStockOnly(false);
    setSearchParams({});
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
    <div className="min-h-screen bg-[#FFFDF5] pb-36 sm:pb-40 font-sans select-none p-3 space-y-3">
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

      {/* Item Count & Active Filter Pills */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-gray-700">
          Showing {filteredProducts.length} Products
        </span>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Clear All
          </button>
        )}
      </div>

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
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="bg-white rounded-2xl p-3 shadow-sm border border-yellow-100 flex gap-3 cursor-pointer group hover:shadow-md transition-all"
                >
                  <div className="w-24 h-24 rounded-xl bg-gray-50 overflow-hidden relative shrink-0">
                    <img 
                      src={product.images?.[0] || 'https://via.placeholder.com/150'} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    {discountPct > 0 && (
                      <span className="absolute top-1 left-1 bg-emerald-600 text-white text-[8px] font-black px-1 py-0.5 rounded">
                        {discountPct}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate block">
                        {product.brand || 'ViBa Select'}
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mt-0.5">
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          {product.rating || 4.5} <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100">
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

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${
                            isInCart
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isInCart ? 'Go to Cart' : 'Add'}
                        </button>
                        <button
                          onClick={(e) => handleBuyNow(e, product)}
                          className="px-2.5 py-1.5 bg-yellow-500 text-gray-950 rounded-xl text-[9px] font-black uppercase tracking-wider"
                        >
                          Buy
                        </button>
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
                onClick={() => navigate(`/product/${product.id}`)}
                className="bg-white rounded-2xl p-2.5 shadow-sm border border-yellow-100 flex flex-col justify-between cursor-pointer group hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                  <img 
                    src={product.images?.[0] || 'https://via.placeholder.com/300'} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                  />
                  {discountPct > 0 && (
                    <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                      {discountPct}% OFF
                    </span>
                  )}
                  <div className="absolute top-2 right-2 bg-black/45 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <span>{product.rating || 4.5}</span>
                    <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>

                <div className="flex flex-col flex-1 min-w-0 mb-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">
                    {product.brand || 'ViBa Select'}
                  </span>
                  <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mt-0.5 min-h-[32px]">
                    {product.name}
                  </h4>
                </div>

                <div className="space-y-2 pt-1 border-t border-gray-100">
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

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center transition-all ${
                        isInCart
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isInCart ? 'Go to Cart' : 'Add'}
                    </button>
                    <button
                      onClick={(e) => handleBuyNow(e, product)}
                      className="py-1.5 px-2 bg-yellow-500 text-gray-950 rounded-xl text-[9px] font-black uppercase tracking-wider"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-yellow-100 space-y-3">
          <p className="text-sm font-bold text-gray-700">No products match your filters.</p>
          <button
            onClick={clearAllFilters}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
          >
            Clear Filters
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
                  Apply Filters ({filteredProducts.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

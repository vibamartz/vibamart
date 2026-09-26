import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Deal259PageConfig, Deal259SubDeal } from '../../shared/types';
import { getDeal259Products, DEFAULT_DEAL259_CONFIG, DEFAULT_DEAL259_SUBDEALS } from '../../shared/utilities/deal259Utils';
import { shareDeal259Store } from '../../shared/utilities/shareUtils';
import ProductCard from '../components/ProductCard';
import { useCategoryStore } from '../../backend/store';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tag, Search, Filter, ArrowUpDown, ChevronDown, Check, Sparkles, RefreshCw, X, ShoppingBag, Flame, Share2
} from 'lucide-react';

export default function Deal259Page() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<Deal259PageConfig>(DEFAULT_DEAL259_CONFIG);
  const [loading, setLoading] = useState(true);

  // Filters & Controls
  const [activeSubDealId, setActiveSubDealId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'discount' | 'rating' | 'newest'>('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(1000);

  const { categories } = useCategoryStore();

  useEffect(() => {
    // Listen to Deal 259 config
    const unsubConfig = onSnapshot(doc(db, 'settings', 'deal259'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Deal259PageConfig;
        setConfig({
          ...DEFAULT_DEAL259_CONFIG,
          ...data,
          subDeals: data.subDeals && data.subDeals.length > 0 ? data.subDeals : DEFAULT_DEAL259_SUBDEALS
        });
      }
    });

    // Listen to all products, filter ONLY those specifically assigned to Deal 259
    const unsubProducts = onSnapshot(query(collection(db, 'products')), (snap) => {
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const dealProds = getDeal259Products(allDocs);
      setProducts(dealProds);
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubProducts();
    };
  }, []);

  // Compute sub-deals list
  const subDeals = config.subDeals && config.subDeals.length > 0 ? config.subDeals : DEFAULT_DEAL259_SUBDEALS;

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Must be Deal 259 product
      if (!p.isDeal259 || p.deal259Status === 'disabled') return false;

      // Search filter
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(queryLower);
        const matchesBrand = p.brand?.toLowerCase().includes(queryLower);
        const matchesTags = p.tags?.some(t => t.toLowerCase().includes(queryLower));
        if (!matchesName && !matchesBrand && !matchesTags) return false;
      }

      // Sub-deal filter
      if (activeSubDealId !== 'all' && p.deal259SubDealId !== activeSubDealId) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
        return false;
      }

      // In-stock filter
      if (onlyInStock && p.stock <= 0) {
        return false;
      }

      // Max price filter
      const effectivePrice = p.discountPrice || p.price;
      if (effectivePrice > maxPrice) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;

      if (sortBy === 'price-low') return priceA - priceB;
      if (sortBy === 'price-high') return priceB - priceA;
      if (sortBy === 'discount') {
        const discA = a.price > 0 ? ((a.price - priceA) / a.price) : 0;
        const discB = b.price > 0 ? ((b.price - priceB) / b.price) : 0;
        return discB - discA;
      }
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      // Default: Featured by deal259Order
      return (a.deal259Order || 999) - (b.deal259Order || 999);
    });
  }, [products, searchQuery, activeSubDealId, selectedCategory, onlyInStock, maxPrice, sortBy]);

  // Categories present in Deal 259 products
  const availableCategories = useMemo(() => {
    const catIds = new Set(products.map(p => p.categoryId).filter(Boolean));
    return categories.filter(c => catIds.has(c.id));
  }, [products, categories]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-rose-600 animate-spin" />
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Loading Deal 259 Store...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/60 font-sans pb-24 select-none">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white overflow-hidden py-10 px-4 sm:px-6 lg:px-8 shadow-xl">
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-amber-200 border border-white/20 shadow-sm">
              <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
              {config.badgeText || 'OFFICIAL DEAL 259 STORE'}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight drop-shadow-sm">
              {config.title || 'Deal 259 Super Store'}
            </h1>
            <p className="text-white/90 text-sm sm:text-base font-medium max-w-xl leading-relaxed">
              {config.subtitle || 'Exclusive deals, mega savings, and unbeatable budget picks!'}
            </p>
          </div>

          {/* Controls: Share & Quick Search on Deal 259 */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Share Deal 259 Store Button - Anyone can share */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => shareDeal259Store(config)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-rose-700 hover:bg-rose-50 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg border border-white/40 cursor-pointer shrink-0"
              title="Share Deal 259 Store link"
            >
              <Share2 className="w-4 h-4 text-rose-600" />
              Share Store
            </motion.button>

            {/* Quick Search on Deal 259 */}
            <div className="w-full sm:w-72 bg-white/15 backdrop-blur-xl p-2 rounded-2xl border border-white/25 shadow-lg">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Deal 259 products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-gray-900 placeholder:text-gray-400 text-xs font-bold rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Sub-Deal Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-1">
          <button
            onClick={() => setActiveSubDealId('all')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
              activeSubDealId === 'all'
                ? 'bg-rose-600 text-white shadow-rose-600/30 shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            All Deal 259 Items ({products.length})
          </button>
          {subDeals.map((sd) => {
            const count = products.filter(p => p.deal259SubDealId === sd.id).length;
            const isActive = activeSubDealId === sd.id;
            return (
              <button
                key={sd.id}
                onClick={() => setActiveSubDealId(sd.id)}
                className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-rose-600/30 shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{sd.icon || '⚡'}</span>
                {sd.title} ({count})
              </button>
            );
          })}
        </div>

        {/* Category Pills & Sort Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider shrink-0 mr-1">Categories:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all' ? 'bg-rose-100 text-rose-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat.id ? 'bg-rose-100 text-rose-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort Dropdown & In-Stock Filter */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500"
              />
              In Stock Only
            </label>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer pr-2"
              >
                <option value="featured">Sort: Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="discount">Biggest Discount</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-800">No Deal 259 products match your selection</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Try adjusting your search keywords, sub-deal filter, or category selection to find products in Deal 259.
            </p>
            <button
              onClick={() => {
                setActiveSubDealId('all');
                setSelectedCategory('all');
                setSearchQuery('');
                setOnlyInStock(false);
              }}
              className="bg-rose-600 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl hover:bg-rose-700 transition-all inline-flex items-center gap-2 cursor-pointer mt-2"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

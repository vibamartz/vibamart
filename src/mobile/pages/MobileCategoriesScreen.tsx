import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, SubCategory } from '../../shared/types';
import { useCategoryStore, useCartStore } from '../../backend/store';
import { getCategorySlug, getSubcategorySlug, getProductSlug } from '../../shared/utilities/slug';
import { Grid, ArrowRight, Layers, Star, RefreshCw, ShoppingCart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CategoryLogo from '../../shared/components/CategoryLogo';
import toast from 'react-hot-toast';

export default function MobileCategoriesScreen() {
  const { categories } = useCategoryStore();
  const { addItem, items: cartItems } = useCartStore();
  const navigate = useNavigate();

  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id || 'all-deals');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [selectedNestedSubCatId, setSelectedNestedSubCatId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync active category fallback when categories load
  useEffect(() => {
    if (categories.length > 0 && !categories.some(c => c.id === activeCategoryId)) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  // Fetch real products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (error) => {
      console.error('Failed to fetch products:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === activeCategoryId) || categories[0];
  }, [categories, activeCategoryId]);

  const selectedSubCategory = useMemo(() => {
    if (!selectedSubCatId || !selectedCategory?.subcategories) return null;
    return selectedCategory.subcategories.find(s => s.id === selectedSubCatId) || null;
  }, [selectedCategory, selectedSubCatId]);

  // Reset subcategory selection when switching top-level category
  const handleCategorySelect = (catId: string) => {
    setActiveCategoryId(catId);
    setSelectedSubCatId(null);
    setSelectedNestedSubCatId(null);
  };

  const handleSubCategorySelect = (subId: string) => {
    if (selectedSubCatId === subId) {
      setSelectedSubCatId(null);
      setSelectedNestedSubCatId(null);
    } else {
      setSelectedSubCatId(subId);
      setSelectedNestedSubCatId(null);
    }
  };

  const handleNestedSubCategorySelect = (nestedId: string) => {
    if (selectedNestedSubCatId === nestedId) {
      setSelectedNestedSubCatId(null);
    } else {
      setSelectedNestedSubCatId(nestedId);
    }
  };

  // Filter products by hierarchy selection (Requirement 4, 5, 6)
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];

    return products.filter((p) => {
      if (p.status === 'inactive') return false;

      // 1. Nested Subcategory Selected -> Show ONLY assigned products
      if (selectedNestedSubCatId) {
        return p.nestedSubCategoryId === selectedNestedSubCatId;
      }

      // 2. Subcategory Selected -> Show products assigned to Subcategory
      if (selectedSubCatId) {
        return (
          p.subCategoryId === selectedSubCatId ||
          (p.categoryId === selectedCategory.id && p.subCategoryId === selectedSubCatId)
        );
      }

      // 3. Category Selected -> Show products assigned to Category
      if (selectedCategory.id === 'all-deals') {
        return true;
      }

      return p.categoryId === selectedCategory.id;
    });
  }, [products, selectedCategory, selectedSubCatId, selectedNestedSubCatId]);

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
      toast.success('Added to Cart', { icon: '🛒' });
    } else if (res.exists) {
      navigate('/cart');
    } else {
      toast.error('Out of stock');
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-36 sm:pb-40 font-sans select-none flex flex-col">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-yellow-500 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full">
              Explore Collections
            </span>
            <h2 className="text-lg font-black tracking-tight text-white mt-1">
              All Categories & Departments
            </h2>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
            <Grid className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Sidebar + Right Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-[70vh]">
        {/* Left Sidebar (Categories with Unified Logo Style) */}
        <div className="w-28 bg-white border-r border-yellow-100/80 overflow-y-auto hide-scrollbar py-2 pb-36 sm:pb-40 space-y-1.5 shrink-0">
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCategorySelect(cat.id)}
                className={`w-full p-2.5 flex flex-col items-center justify-center text-center transition-all relative ${
                  isActive
                    ? 'bg-emerald-50/90 text-emerald-900 font-extrabold'
                    : 'text-gray-600 hover:bg-yellow-50/40 font-semibold'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="categoryActiveBar"
                    className="absolute left-0 top-1 bottom-1 w-1 bg-emerald-600 rounded-r-full"
                  />
                )}

                <CategoryLogo
                  name={cat.name}
                  image={cat.image}
                  icon={cat.icon}
                  size="md"
                  active={isActive}
                />

                <span className="text-[10px] leading-tight line-clamp-2 px-1 mt-1 font-bold">
                  {cat.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto p-3 pb-36 sm:pb-40 space-y-4">
          {selectedCategory && (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Category Header Card */}
                <div className="bg-white rounded-[22px] p-3.5 shadow-sm border border-yellow-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CategoryLogo
                      name={selectedCategory.name}
                      image={selectedCategory.image}
                      icon={selectedCategory.icon}
                      size="md"
                      active={true}
                    />
                    <div>
                      <h3 className="text-sm font-black text-gray-900">
                        {selectedCategory.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {selectedCategory.subcategories?.length || 0} Subcategories Available
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/categories/${getCategorySlug(selectedCategory)}`)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 shrink-0"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </motion.button>
                </div>

                {/* Level 2: Subcategories Grid */}
                {selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">
                        Subcategories
                      </h4>
                      {selectedSubCatId && (
                        <button
                          onClick={() => { setSelectedSubCatId(null); setSelectedNestedSubCatId(null); }}
                          className="text-[10px] font-extrabold text-emerald-700 hover:underline"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {selectedCategory.subcategories.map((sub) => {
                        const isSubSelected = selectedSubCatId === sub.id;
                        return (
                          <motion.div
                            key={sub.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => handleSubCategorySelect(sub.id)}
                            className={`rounded-[20px] p-3 border shadow-sm flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                              isSubSelected
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                                : 'bg-white border-yellow-100 hover:border-emerald-300'
                            }`}
                          >
                            <CategoryLogo
                              name={sub.name}
                              image={sub.image}
                              icon={sub.icon}
                              size="md"
                              active={isSubSelected}
                            />
                            <span className={`text-xs font-bold leading-tight mt-1.5 ${isSubSelected ? 'text-emerald-900' : 'text-gray-900'}`}>
                              {sub.name}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Level 3: Nested Subcategories (Appears directly below selected Subcategory - Requirement 5) */}
                {selectedSubCategory && selectedSubCategory.subcategories && selectedSubCategory.subcategories.length > 0 && (
                  <div className="space-y-2 bg-emerald-50/50 p-3 rounded-[22px] border border-emerald-100 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between px-1">
                      <h5 className="text-[11px] font-black text-emerald-900 uppercase tracking-wider">
                        {selectedSubCategory.name} → Nested Subcategories
                      </h5>
                      {selectedNestedSubCatId && (
                        <button
                          onClick={() => setSelectedNestedSubCatId(null)}
                          className="text-[10px] font-extrabold text-emerald-700 hover:underline"
                        >
                          Show All {selectedSubCategory.name}
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                      {selectedSubCategory.subcategories.map((nested) => {
                        const isNestedSelected = selectedNestedSubCatId === nested.id;
                        return (
                          <motion.button
                            key={nested.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleNestedSubCategorySelect(nested.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-extrabold shrink-0 flex items-center gap-2 border transition-all ${
                              isNestedSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white text-gray-800 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            <CategoryLogo name={nested.name} image={nested.image} size="sm" active={isNestedSelected} />
                            <span>{nested.name}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category / Subcategory / Nested Subcategory Products Display (Requirement 4, 5, 6) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1 border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      {selectedNestedSubCatId
                        ? 'Assigned Products'
                        : selectedSubCatId
                        ? `${selectedSubCategory?.name || 'Subcategory'} Products`
                        : `${selectedCategory.name} Products`}
                    </h4>
                    <span className="text-[10px] font-bold text-gray-500">
                      {categoryProducts.length} Items Available
                    </span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {Array(4).fill(0).map((_, i) => (
                        <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-yellow-100" />
                      ))}
                    </div>
                  ) : categoryProducts.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {categoryProducts.map((product) => {
                        const isInCart = cartItems.some(i => i.productId === product.id);
                        const discountPct = product.price && product.discountPrice
                          ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
                          : (product.discountPercentage || 0);

                        return (
                          <motion.div
                            key={product.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                            className="bg-white rounded-2xl p-2.5 shadow-sm border border-yellow-100 flex flex-col justify-between cursor-pointer group hover:shadow-md transition-all relative overflow-hidden"
                          >
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2">
                              <img
                                src={product.images?.[0] || 'https://via.placeholder.com/200'}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              {discountPct > 0 && (
                                <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                  {discountPct}% OFF
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 mb-1.5">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">
                                {product.brand || 'ViBa Select'}
                              </span>
                              <h5 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mt-0.5">
                                {product.name}
                              </h5>
                            </div>

                            <div className="space-y-1.5 pt-1 border-t border-gray-100">
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs font-black text-gray-900">
                                  ₹{(product.discountPrice || product.price).toLocaleString()}
                                </span>
                                {product.discountPrice && (
                                  <span className="text-[9px] text-gray-400 line-through">
                                    ₹{product.price.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              <button
                                onClick={(e) => handleAddToCart(e, product)}
                                className={`w-full py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                                  isInCart
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                }`}
                              >
                                {isInCart ? <Check className="w-3 h-3 text-emerald-600" /> : <ShoppingCart className="w-3 h-3" />}
                                {isInCart ? 'In Cart' : 'Add to Cart'}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Requirement 8: Professional Empty State - NO temporary/fake products */
                    <div className="bg-white rounded-[22px] p-6 text-center border border-yellow-100 space-y-2 my-2">
                      <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mx-auto text-yellow-600">
                        <Layers className="w-6 h-6" />
                      </div>
                      <h4 className="text-xs font-bold text-gray-800">
                        No products available in this category yet.
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        Check back soon as new products are regularly added.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

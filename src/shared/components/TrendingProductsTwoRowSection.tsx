import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Flame, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { isProductAssignedToCategory } from '../../shared/utilities/productCategoryFilter';
import { useCategoryStore } from '../../backend/store';
import ProductCard from '../../desktop/components/ProductCard';
import MobileProductCardItem from '../../mobile/components/MobileProductCardItem';
import { getProductSlug } from '../../shared/utilities/slug';

interface TrendingProductsTwoRowSectionProps {
  categoryId?: string;
  categorySlug?: string;
  subCategoryId?: string;
  subCategorySlug?: string;
  nestedSubCategoryId?: string;
  isMobile?: boolean;
  title?: string;
  products?: Product[];
}

export default function TrendingProductsTwoRowSection({
  categoryId,
  categorySlug,
  subCategoryId,
  subCategorySlug,
  nestedSubCategoryId,
  isMobile = false,
  title = "Trending Products",
  products: initialProducts
}: TrendingProductsTwoRowSectionProps) {
  const { categories } = useCategoryStore();
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // If caller provided a rich set of products (at least 20), use it directly
    if (initialProducts && initialProducts.length >= 20) {
      setProducts(initialProducts);
      setLoading(false);
      return;
    }

    // Always fetch full catalog products so we have fallback trending products
    // to fill both rows whenever a category has few (or only 1) products
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const rewardIds = await getRewardProductIds();
      const valid = filterOutRewardProducts(data, rewardIds).filter(
        p => p.status !== 'inactive' && p.isVisible !== false
      );
      setProducts(valid);
      setLoading(false);
    }, (error) => {
      console.error("Trending products fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [initialProducts]);

  // Filter or prioritize products
  const displayProducts = useMemo(() => {
    const targetFilter = categorySlug || categoryId;

    const productMap = new Map<string, Product>();
    (initialProducts || []).forEach(p => { if (p && p.id) productMap.set(p.id, p); });
    products.forEach(p => { if (p && p.id && !productMap.has(p.id)) productMap.set(p.id, p); });
    const allAvailable = Array.from(productMap.values());

    const sortByTrending = (a: Product, b: Product) => {
      const rateA = a.rating || 0;
      const rateB = b.rating || 0;
      if (rateB !== rateA) return rateB - rateA;
      return (b.discountPercentage || 0) - (a.discountPercentage || 0);
    };

    const effectiveSub = subCategoryId || subCategorySlug;
    const hasCatFilter = Boolean(targetFilter && targetFilter !== 'for-you' && targetFilter !== 'all' && targetFilter !== 'all-deals');
    const hasSubFilter = Boolean(effectiveSub && effectiveSub !== 'all');
    const hasNestedFilter = Boolean(nestedSubCategoryId && nestedSubCategoryId !== 'all');

    if (hasCatFilter || hasSubFilter || hasNestedFilter) {
      const catFiltered = allAvailable.filter(p =>
        isProductAssignedToCategory(p, targetFilter || '', categories, effectiveSub, nestedSubCategoryId)
      );
      catFiltered.sort(sortByTrending);
      return catFiltered.slice(0, 24);
    }

    const list = [...allAvailable];
    list.sort(sortByTrending);
    return list.slice(0, 24);
  }, [products, initialProducts, categoryId, categorySlug, subCategoryId, subCategorySlug, nestedSubCategoryId, categories]);

  // Group into columns of 2 for the 2-row layout
  const columns = useMemo(() => {
    const cols: Product[][] = [];
    for (let i = 0; i < displayProducts.length; i += 2) {
      cols.push(displayProducts.slice(i, i + 2));
    }
    return cols;
  }, [displayProducts]);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  if (!loading && displayProducts.length === 0) {
    return null;
  }

  // Mobile Render
  if (isMobile) {
    return (
      <section className="w-full min-w-0 space-y-2.5 my-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight truncate">
              {title}
            </h3>
          </div>
          <Link to="/products" className="text-xs font-black text-emerald-700 uppercase tracking-wider shrink-0 ml-2">
            View All
          </Link>
        </div>

        {/* 2-Row Scrollable Layout without visible scrollbars */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-2 hide-scrollbar no-scrollbar scrollbar-none scroll-smooth snap-x py-1 px-1 min-w-0 w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 shrink-0 w-[135px] sm:w-[155px]">
                <div className="w-full h-[215px] sm:h-[235px] bg-gray-100 rounded-[16px] animate-pulse" />
                <div className="w-full h-[215px] sm:h-[235px] bg-gray-100 rounded-[16px] animate-pulse" />
              </div>
            ))
          ) : (
            columns.map((col, colIdx) => (
              <div
                key={`trending-col-${colIdx}`}
                className="flex flex-col gap-2 shrink-0 w-[135px] sm:w-[155px] snap-start"
              >
                {col.map(product => (
                  <div key={`trending-${product.id}`} className="w-full h-[215px] sm:h-[235px] flex flex-col shrink-0">
                    <MobileProductCardItem
                      product={product}
                      onCardClick={() => navigate(`/products/${getProductSlug(product)}`)}
                    />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  // Desktop Render
  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4 my-6 relative group/trending">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Flame className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            High demand items with top customer ratings
          </p>
        </div>
        <Link
          to="/products"
          className="text-xs font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1"
        >
          Explore All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="relative">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 shadow-lg border border-gray-200 text-gray-700 hover:text-emerald-600 hover:scale-105 transition-all opacity-0 group-hover/trending:opacity-100 hidden md:flex items-center justify-center cursor-pointer"
          title="Scroll Left"
          aria-label="Scroll Left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* 2-Row Scrollable Layout without visible scrollbars */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-4 hide-scrollbar no-scrollbar scrollbar-none scroll-smooth snap-x py-1 min-w-0 w-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col gap-4 shrink-0 w-[175px] sm:w-[190px] md:w-[210px]">
                <div className="w-full h-[285px] sm:h-[300px] md:h-[320px] bg-white rounded-2xl p-3 border border-gray-100 animate-pulse" />
                <div className="w-full h-[285px] sm:h-[300px] md:h-[320px] bg-white rounded-2xl p-3 border border-gray-100 animate-pulse" />
              </div>
            ))
          ) : (
            columns.map((col, colIdx) => (
              <div
                key={`trending-col-${colIdx}`}
                className="flex flex-col gap-4 shrink-0 w-[175px] sm:w-[190px] md:w-[210px] snap-start"
              >
                {col.map(product => (
                  <div key={`trending-${product.id}`} className="w-full h-[285px] sm:h-[300px] md:h-[320px] flex flex-col shrink-0">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={scrollRight}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 shadow-lg border border-gray-200 text-gray-700 hover:text-emerald-600 hover:scale-105 transition-all opacity-0 group-hover/trending:opacity-100 hidden md:flex items-center justify-center cursor-pointer"
          title="Scroll Right"
          aria-label="Scroll Right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

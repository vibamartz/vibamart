import React, { useState, useEffect, useRef, useMemo } from 'react';
import { History, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { fetchRecentlyViewedProducts } from '../../shared/utilities/recentlyViewedUtils';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import ProductCard from '../../desktop/components/ProductCard';
import MobileProductCardItem from '../../mobile/components/MobileProductCardItem';
import { getProductSlug } from '../../shared/utilities/slug';

interface RecentlyViewedTwoRowSectionProps {
  isMobile?: boolean;
  fallbackProducts?: Product[];
}

export default function RecentlyViewedTwoRowSection({
  isMobile = false,
  fallbackProducts = []
}: RecentlyViewedTwoRowSectionProps) {
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const loadRecent = async () => {
      const recent = await fetchRecentlyViewedProducts('', 16);
      if (isMounted) {
        setRecentlyViewed(recent);
        setLoading(false);
      }
    };

    loadRecent();
    const handleUpdate = () => loadRecent();
    window.addEventListener('viba_recently_viewed_updated', handleUpdate);

    // Fetch catalog products to ensure fallback is always rich and both rows are filled
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!isMounted) return;
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const rewardIds = await getRewardProductIds();
      const valid = filterOutRewardProducts(data, rewardIds).filter(
        p => p.status !== 'inactive' && p.isVisible !== false
      );
      setCatalogProducts(valid);
      setLoading(false);
    }, (error) => {
      console.error("Recently viewed catalog fallback fetch error:", error);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      window.removeEventListener('viba_recently_viewed_updated', handleUpdate);
      unsubscribe();
    };
  }, []);

  const displayProducts = useMemo(() => {
    const recentIds = new Set(recentlyViewed.map(p => p.id));
    const extra = (fallbackProducts || []).filter(p => !recentIds.has(p.id));
    const combined = [...recentlyViewed, ...extra];
    
    // If combined has fewer than 8 items, fill with catalog products to avoid broken 1-product rows
    if (combined.length < 8 && catalogProducts.length > 0) {
      const combinedIds = new Set(combined.map(p => p.id));
      const more = catalogProducts.filter(p => !combinedIds.has(p.id));
      return [...combined, ...more].slice(0, 20);
    }
    
    return combined.slice(0, 20);
  }, [recentlyViewed, fallbackProducts, catalogProducts]);

  // Group into columns of 2 for 2-row layout
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

  if (!loading && displayProducts.length < 2) {
    return null;
  }

  // Mobile Render
  if (isMobile) {
    return (
      <section className="w-full min-w-0 space-y-2.5 my-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <History className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight truncate">
              Recently Viewed & Popular
            </h3>
          </div>
          <Link to="/products" className="text-xs font-black text-emerald-700 uppercase tracking-wider shrink-0 ml-2">
            Explore
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
                key={`recent-col-${colIdx}`}
                className="flex flex-col gap-2 shrink-0 w-[135px] sm:w-[155px] snap-start"
              >
                {col.map(product => (
                  <div key={`recent-${product.id}`} className="w-full h-[215px] sm:h-[235px] flex flex-col shrink-0">
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
    <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4 my-6 relative group/recent">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-amber-600" />
            Recently Viewed
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            Based on items you browsed and popular recommendations
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
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 shadow-lg border border-gray-200 text-gray-700 hover:text-emerald-600 hover:scale-105 transition-all opacity-0 group-hover/recent:opacity-100 hidden md:flex items-center justify-center cursor-pointer"
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
                key={`recent-col-${colIdx}`}
                className="flex flex-col gap-4 shrink-0 w-[175px] sm:w-[190px] md:w-[210px] snap-start"
              >
                {col.map(product => (
                  <div key={`recent-${product.id}`} className="w-full h-[285px] sm:h-[300px] md:h-[320px] flex flex-col shrink-0">
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
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/95 shadow-lg border border-gray-200 text-gray-700 hover:text-emerald-600 hover:scale-105 transition-all opacity-0 group-hover/recent:opacity-100 hidden md:flex items-center justify-center cursor-pointer"
          title="Scroll Right"
          aria-label="Scroll Right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

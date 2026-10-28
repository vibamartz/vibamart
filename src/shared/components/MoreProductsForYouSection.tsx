import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, ShoppingBag } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { isProductAssignedToCategory } from '../../shared/utilities/productCategoryFilter';
import { useCategoryStore } from '../../backend/store';
import ProductCard from '../../desktop/components/ProductCard';
import MobileProductCardItem from '../../mobile/components/MobileProductCardItem';
import { getProductSlug } from '../../shared/utilities/slug';
import { useNavigate } from 'react-router-dom';

interface MoreProductsForYouSectionProps {
  categoryId?: string;
  categorySlug?: string;
  isMobile?: boolean;
  products?: Product[];
}

export default function MoreProductsForYouSection({
  categoryId,
  categorySlug,
  isMobile = false,
  products: initialProducts
}: MoreProductsForYouSectionProps) {
  const { categories } = useCategoryStore();
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
      setLoading(false);
      return;
    }

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
      console.error("More Products for You fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [initialProducts]);

  // Determine category target and matching category object
  const targetCategorySlug = (categorySlug || categoryId || '').trim();
  const isGeneralForYou = (
    !targetCategorySlug ||
    targetCategorySlug === 'for-you' ||
    targetCategorySlug === 'all' ||
    targetCategorySlug === 'all-deals'
  );

  const matchedCategoryObj = useMemo(() => {
    if (isGeneralForYou) return null;
    const lower = targetCategorySlug.toLowerCase();
    return categories.find(c => {
      if (!c) return false;
      return (
        String(c.id || '').toLowerCase() === lower ||
        String(c.slug || '').toLowerCase() === lower ||
        String((c as any).seoSlug || '').toLowerCase() === lower ||
        String(c.name || '').toLowerCase() === lower
      );
    }) || null;
  }, [targetCategorySlug, isGeneralForYou, categories]);

  // Requirement 4:
  // On general For You page: display products from all categories
  // On other category pages: display ONLY products assigned to the respective category
  const displayProducts = useMemo(() => {
    if (isGeneralForYou) {
      return products;
    }
    return products.filter(p => isProductAssignedToCategory(p, targetCategorySlug, categories));
  }, [products, isGeneralForYou, targetCategorySlug, categories]);

  const categoryDisplayName = matchedCategoryObj?.name || (targetCategorySlug !== 'for-you' ? targetCategorySlug : '');

  // Mobile Render
  if (isMobile) {
    return (
      <section className="w-full min-w-0 space-y-3 pt-3 pb-8 px-1 mt-4 border-t border-gray-100">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 fill-emerald-500 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight truncate">
                More Products for You
              </h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate">
                {isGeneralForYou
                  ? "Personalized picks across all categories"
                  : `Curated selections in ${categoryDisplayName || 'this category'}`}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-2 border border-gray-100 animate-pulse space-y-2">
                <div className="w-full aspect-square bg-gray-100 rounded-xl" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : displayProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {displayProducts.map(product => (
              <MobileProductCardItem
                key={`more-mobile-${product.id}`}
                product={product}
                onCardClick={() => navigate(`/products/${getProductSlug(product)}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100 space-y-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto text-gray-400 shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-gray-700">No more products available in this category.</p>
            <p className="text-[10px] text-gray-400">Check back soon for new arrivals!</p>
          </div>
        )}
      </section>
    );
  }

  // Desktop Render
  return (
    <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 pt-6 pb-12 mt-6 border-t border-gray-100">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600 fill-emerald-100" />
            More Products for You
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
            {isGeneralForYou
              ? "Personalized picks across all categories"
              : `Curated selections in ${categoryDisplayName || 'this category'}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-4 border border-gray-100 animate-pulse space-y-3">
              <div className="w-full aspect-square bg-gray-100 rounded-2xl" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : displayProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {displayProducts.map(product => (
            <div key={`more-desktop-${product.id}`} className="h-full flex flex-col">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-3xl p-10 text-center border border-gray-100 space-y-2 max-w-md mx-auto">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-gray-400 shadow-sm">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-800">No more products in this category</h3>
          <p className="text-xs text-gray-400">Explore other categories or check back soon.</p>
        </div>
      )}
    </section>
  );
}

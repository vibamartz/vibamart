import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Star, Zap, ShieldCheck,
  Truck, ArrowRight, Heart, Filter,
  Search, ChevronLeft, ChevronRight,
  Sparkles, Flame, RefreshCcw, Headset, ChevronRight as ChevronRightIcon,
  MapPin, ChevronDown, Mic, Camera, QrCode, Gift, Award, Wallet,
  History, TrendingUp, X, Check, ShoppingCart, Layers, Smartphone,
  Shirt, Laptop, Home as HomeIcon, Tv, Tag, CheckCircle2, UserCheck
} from 'lucide-react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import LocationPickerModal from '../components/LocationPickerModal';
import CameraSearchModal from '../components/CameraSearchModal';
import Logo from '../components/Logo';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Banner } from '../../shared/types';
import { useCategoryStore, useSettingsStore, useAuthStore, useCartStore, useRewardsStore } from '../../backend/store';
import { getCategorySlug, getSubcategorySlug } from '../../shared/utilities/slug';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';

import CategoryLogo, { Lipstick, renderCategoryFallbackIcon } from '../../shared/components/CategoryLogo';
import { fetchRecentlyViewedProducts } from '../../shared/utilities/recentlyViewedUtils';
import CashbackScheduleSection from '../../shared/components/CashbackScheduleSection';

export default function Home() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { user, orderedProductIds } = useAuthStore();
  const { addItem, items } = useCartStore();
  const { config: rewardsConfig } = useRewardsStore();
  const navigate = useNavigate();
  const routeParams = useParams<{ categorySlug?: string }>();
  const location = useLocation();

  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [recentlyViewedProds, setRecentlyViewedProds] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;
    const loadRecent = async () => {
      const recent = await fetchRecentlyViewedProducts('', 8);
      if (isMounted) setRecentlyViewedProds(recent);
    };
    loadRecent();
    const handleUpdate = () => loadRecent();
    window.addEventListener('viba_recently_viewed_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('viba_recently_viewed_updated', handleUpdate);
    };
  }, []);

  const userName = user?.displayName
    ? user.displayName.split(' ')[0]
    : (user?.email ? user.email.split('@')[0] : '');

  const personalizedTitle = userName
    ? `${userName}, still looking for these?`
    : 'Still Looking For These?';

  const [selectedSubCatId, setSelectedSubCatId] = useState<string | null>(null);
  const [selectedNestedSubCatId, setSelectedNestedSubCatId] = useState<string | null>(null);

  const bannerScrollRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingBanner = useRef(false);

  // Active Category filter from URL route
  const activeCategorySlug = useMemo(() => {
    if (location.pathname === '/' || location.pathname === '/for-you') {
      return 'for-you';
    }
    return routeParams.categorySlug || 'for-you';
  }, [location.pathname, routeParams.categorySlug]);

  const activeCategoryObj = useMemo(() => {
    if (activeCategorySlug === 'for-you') return null;
    return CATEGORIES.find(c => c.id === activeCategorySlug || c.slug === activeCategorySlug || c.seoSlug === activeCategorySlug || getCategorySlug(c) === activeCategorySlug) || null;
  }, [activeCategorySlug, CATEGORIES]);

  // Reset subcategory selections when active category changes
  useEffect(() => {
    setSelectedSubCatId(null);
    setSelectedNestedSubCatId(null);
  }, [activeCategorySlug]);

  // Category-Specific Banners for Desktop (Strict Isolation)
  const activeBanners = useMemo(() => {
    if (activeCategorySlug === 'for-you') {
      return banners.filter(b => b.categoryId === 'for-you' || !b.categoryId);
    }
    const targetId = activeCategoryObj?.id || activeCategorySlug;
    const targetSlug = activeCategoryObj ? getCategorySlug(activeCategoryObj) : activeCategorySlug;
    return banners.filter(b => b.categoryId === targetId || b.categoryId === targetSlug || b.categoryId === activeCategorySlug);
  }, [banners, activeCategorySlug, activeCategoryObj]);

  // Filter products by active category, subcategory, and nested subcategory hierarchy
  const filteredProducts = useMemo(() => {
    if (activeCategorySlug === 'for-you') return products.filter(p => p.isVisible !== false && p.status !== 'inactive');
    return products.filter(p => {
      if (p.isVisible === false || p.status === 'inactive') return false;

      // 1. Nested Subcategory Filter
      if (selectedNestedSubCatId) {
        return p.nestedSubCategoryId === selectedNestedSubCatId;
      }

      // 2. Subcategory Filter
      if (selectedSubCatId) {
        return p.subCategoryId === selectedSubCatId;
      }

      // 3. Category Filter
      const targetId = (activeCategoryObj?.id || activeCategorySlug).toLowerCase();
      const targetSlug = activeCategorySlug.toLowerCase();
      const catId = (p.categoryId || '').toLowerCase();
      return catId === targetId || catId === targetSlug;
    });
  }, [products, activeCategorySlug, activeCategoryObj, selectedSubCatId, selectedNestedSubCatId]);

  const displayStillLooking = useMemo(() => {
    const recentIds = new Set(recentlyViewedProds.map(p => p.id));
    const fallback = [...filteredProducts].filter(p => !recentIds.has(p.id));
    return [...recentlyViewedProds, ...fallback].slice(0, 8);
  }, [recentlyViewedProds, filteredProducts]);

  const scrollCategoryLeft = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollCategoryRight = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Header & Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Category selection state
  const [selectedCategory, setSelectedCategory] = useState<string>('for-you');

  // Load recent searches
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      setRecentSearches(saved);
    } catch {
      setRecentSearches([]);
    }
  }, [isSearchFocused]);

  const trendingSearches = [
    "5G Mobiles", "Wireless Earbuds", "Running Shoes", "Smart TVs", "Summer Fashion"
  ];

  // Voice Search Handler
  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice search is not supported on this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        toast('Listening... Speak now', { icon: '🎙️' });
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        setIsListening(false);
        saveSearchQuery(transcript);
        navigate(`/products?search=${encodeURIComponent(transcript)}`);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        toast.error('Could not catch that. Please try again.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
      toast.error('Voice search initialization failed');
    }
  };

  const saveSearchQuery = (q: string) => {
    if (!q.trim()) return;
    try {
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const filtered = existing.filter((item: string) => item.toLowerCase() !== q.toLowerCase());
      const updated = [q, ...filtered].slice(0, 5);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
      setRecentSearches(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const clearRecentSearches = () => {
    localStorage.removeItem('viba_recent_searches');
    setRecentSearches([]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveSearchQuery(searchQuery);
      setIsSearchFocused(false);
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'active'),
      limit(40)
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const rewardIds = await getRewardProductIds();
      setProducts(filterOutRewardProducts(data, rewardIds));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const bQuery = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribeBanners = onSnapshot(bQuery, (snapshot) => {
      const now = Date.now();
      const desktopBanners = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Banner))
        .filter(b => {
          if (b.active === false) return false;
          const p = b.platform || 'all';
          if (p !== 'all' && p !== 'desktop') return false;
          const start = b.startDate ? new Date(b.startDate).getTime() : 0;
          const end = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return now >= start && now <= end;
        });
      setBanners(desktopBanners);
    });
    return () => unsubscribeBanners();
  }, []);

  const scrollToBannerSlide = (index: number) => {
    setCurrentSlide(index);
    if (bannerScrollRef.current) {
      const container = bannerScrollRef.current;
      const child = container.children[index] as HTMLElement;
      if (child) {
        isAutoScrollingBanner.current = true;
        const targetLeft = child.offsetLeft - (container.offsetWidth - child.offsetWidth) / 2;
        container.scrollTo({
          left: Math.max(0, targetLeft),
          behavior: 'smooth',
        });
        setTimeout(() => {
          isAutoScrollingBanner.current = false;
        }, 500);
      }
    }
  };

  const handleBannerScroll = () => {
    if (isAutoScrollingBanner.current || !bannerScrollRef.current) return;
    const container = bannerScrollRef.current;
    const containerCenter = container.scrollLeft + container.offsetWidth / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    Array.from(container.children).forEach((child, index) => {
      const el = child as HTMLElement;
      const childCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(containerCenter - childCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = index;
      }
    });

    if (closestIndex !== currentSlide) {
      setCurrentSlide(closestIndex);
    }
  };

  useEffect(() => {
    if (activeBanners.length <= 2) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 2 >= activeBanners.length) ? 0 : prev + 2;
        scrollToBannerSlide(next);
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  const nextSlide = () => {
    const next = (currentSlide + 2 >= activeBanners.length) ? 0 : currentSlide + 2;
    scrollToBannerSlide(next);
  };

  const prevSlide = () => {
    const prev = (currentSlide - 2 < 0) ? Math.max(0, activeBanners.length - 2) : currentSlide - 2;
    scrollToBannerSlide(prev);
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 pt-2 sm:pt-4">



      {/* 1. Selected Category's Subcategories (Displays in the space below Search Bar ONLY when a Category is selected) */}
      {activeCategoryObj && activeCategoryObj.subcategories && activeCategoryObj.subcategories.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative group/subcat">
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={scrollCategoryLeft}
              className="absolute left-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-gray-200 text-gray-600 hover:text-emerald-600 transition-opacity opacity-0 group-hover/subcat:opacity-100 hidden md:flex items-center justify-center -translate-x-3 cursor-pointer"
              title="Scroll Left"
              aria-label="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={categoryScrollRef}
              className="flex gap-3.5 overflow-x-auto scroll-smooth hide-scrollbar py-1 min-w-0 w-full snap-x snap-mandatory"
            >
              {activeCategoryObj.subcategories.map((sub) => {
                const catSlug = getCategorySlug(activeCategoryObj);
                const subSlug = getSubcategorySlug(sub);
                return (
                  <Link
                    key={sub.id}
                    to={`/categories/${catSlug}/${subSlug}`}
                    className="group/item p-3 rounded-2xl border shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center shrink-0 w-28 sm:w-32 snap-start bg-white border-gray-100 hover:border-emerald-500 cursor-pointer"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden mb-2 group-hover/item:scale-105 transition-transform flex items-center justify-center border bg-gray-50 border-gray-100">
                      <CategoryLogo
                        name={sub.name}
                        image={sub.image}
                        icon={sub.icon}
                        size="md"
                      />
                    </div>
                    <h3 className="text-xs font-bold text-gray-800 group-hover/item:text-emerald-700 transition-colors line-clamp-1">
                      {sub.name}
                    </h3>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={scrollCategoryRight}
              className="absolute right-0 z-10 p-1.5 rounded-full bg-white/95 shadow-md border border-gray-200 text-gray-600 hover:text-emerald-600 transition-opacity opacity-0 group-hover/subcat:opacity-100 hidden md:flex items-center justify-center translate-x-3 cursor-pointer"
              title="Scroll Right"
              aria-label="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* 2. Category Banners Hero Section */}
      <section className={`relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden ${activeCategoryObj && activeCategoryObj.subcategories && activeCategoryObj.subcategories.length > 0 ? '-mt-2 sm:-mt-4' : ''}`}>
        <div
          ref={bannerScrollRef}
          onScroll={handleBannerScroll}
          className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth hide-scrollbar gap-4 lg:gap-6 px-0.5 py-0.5 min-w-0 w-full"
        >
          {activeBanners.length > 0 ? (
            activeBanners.map((banner, i) => (
              <div
                key={banner.id || i}
                onClick={() => {
                  if (banner.link) {
                    if (/^https?:\/\//i.test(banner.link) || banner.link.startsWith('www.')) {
                      const url = banner.link.startsWith('www.') ? `https://${banner.link}` : banner.link;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(banner.link);
                    }
                  } else {
                    navigate('/products');
                  }
                }}
                className={`relative h-[160px] sm:h-[190px] md:h-[220px] lg:h-[240px] rounded-3xl sm:rounded-[32px] overflow-hidden shadow-sm group border border-gray-100 bg-white ${
                  activeBanners.length > 1 ? 'w-full sm:w-[calc(50%-8px)] lg:w-[calc(50%-12px)] shrink-0 snap-start' : 'w-full'
                } cursor-pointer`}
              >
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />

                {(banner.title || banner.subtitle) && (
                  <div className="absolute inset-0 flex items-center px-4 sm:px-6 md:px-8 pointer-events-none">
                    <div className="max-w-xs sm:max-w-sm pointer-events-auto">
                      {banner.subtitle && (
                        <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 bg-primary text-white text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] rounded-full mb-1.5 sm:mb-2.5 shadow-sm">
                          {banner.subtitle}
                        </span>
                      )}
                      {banner.title && (
                        <h1 className="text-base sm:text-lg md:text-xl font-black text-white leading-tight mb-2 sm:mb-3 tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] line-clamp-2">
                          {banner.title}
                        </h1>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <div className="bg-white text-gray-900 touch-target min-h-[32px] px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-[9px] hover:bg-primary hover:text-white transition-all transform hover:scale-105 shadow-md flex items-center gap-1.5">
                          Explore Now <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              onClick={() => navigate('/products')}
              className="relative h-[160px] sm:h-[190px] md:h-[220px] lg:h-[240px] rounded-3xl sm:rounded-[32px] overflow-hidden shadow-sm border border-gray-100 w-full bg-primary flex items-center px-6 sm:px-10 md:px-14 cursor-pointer group active:scale-[0.99] transition-all duration-150 shrink-0"
            >
              <div className="max-w-xl text-white space-y-3 sm:space-y-4">
                <h1 className="text-xl sm:text-2xl md:text-4xl font-black tracking-tight leading-none">
                  UP TO <span className="text-secondary">80%</span> OFF ON ELECTRONICS
                </h1>
                <p className="text-xs sm:text-sm text-white/80 max-w-md">
                  Elevate your lifestyle with the latest tech and fashion.
                </p>
                <div className="inline-block bg-white text-primary touch-target px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold shadow-lg hover:bg-secondary hover:text-black transition-all text-xs sm:text-sm">
                  Shop Now
                </div>
              </div>
            </div>
          )}
        </div>

        {activeBanners.length > 2 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="absolute left-6 sm:left-10 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 bg-white/90 backdrop-blur-md rounded-full text-gray-800 hover:bg-white hover:text-gray-900 transition-all shadow-md border border-gray-200 z-10 hidden sm:block"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="absolute right-6 sm:right-10 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 bg-white/90 backdrop-blur-md rounded-full text-gray-800 hover:bg-white hover:text-gray-900 transition-all shadow-md border border-gray-200 z-10 hidden sm:block"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Pagination Indicators directly below banner */}
            <div className="flex justify-center items-center gap-2 pt-3">
              {Array.from({ length: Math.ceil(activeBanners.length / 2) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToBannerSlide(i * 2)}
                  className={`h-2 rounded-full transition-all ${
                    Math.floor(currentSlide / 2) === i ? 'w-8 bg-primary' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* 2.1. Monthly First-3-Orders Cashback Schedule Section (Directly BELOW Home Banner) */}
      <CashbackScheduleSection />

      {/* Still Looking For These? Section (Desktop - Visible ONLY in For You category) */}
      {activeCategorySlug === 'for-you' && (
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
              <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                {personalizedTitle}
              </h2>
            </div>
            <Link to="/products" className="text-xs font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
              Explore All <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex gap-4 overflow-x-auto hide-scrollbar py-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-[165px] sm:w-[185px] h-[240px] bg-white rounded-2xl p-3 border border-gray-100 animate-pulse shrink-0" />
              ))}
            </div>
          ) : (
            <div className="flex overflow-x-auto gap-4 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
              {displayStillLooking.map((product) => (
                <div key={`still-looking-${product.id}`} className="w-[165px] sm:w-[185px] shrink-0 snap-start flex flex-col">
                  <ProductCard product={product} hideButtons={true} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Trending / Recommended Products Grid */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Flame className="w-6 h-6 text-yellow-500 fill-yellow-500" /> Trending Products
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">High demand items with top customer ratings</p>
          </div>
          <Link to="/products" className="text-xs font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
            Explore All <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-4 border border-gray-100 animate-pulse space-y-3">
                <div className="w-full aspect-square bg-gray-100 rounded-2xl" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {filteredProducts.slice(0, 15).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
      />

      <CameraSearchModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSearch={(query) => {
          setIsCameraModalOpen(false);
          navigate(`/products?q=${encodeURIComponent(query)}`);
        }}
      />
    </div>
  );
}

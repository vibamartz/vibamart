import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Mic, Camera, QrCode, MapPin, ChevronDown,
  Sparkles, Flame, Gift, Zap, Heart, Shirt, Smartphone,
  Laptop, Home as HomeIcon, Tv, ShoppingCart, Star,
  TrendingUp, History, ArrowRight, Truck, ShieldCheck,
  RefreshCcw, Headset, Tag, Award, User, Grid
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LocationPickerModal from '../../desktop/components/LocationPickerModal';
import CameraSearchModal from '../../desktop/components/CameraSearchModal';
import Logo from '../../components/Logo';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { Product, Banner } from '../../shared/types';
import { useCategoryStore, useSettingsStore, useAuthStore, useCartStore, useRewardsStore } from '../../backend/store';
import toast from 'react-hot-toast';

export default function MobileHomepage() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();
  const { addItem, items } = useCartStore();
  const { config: rewardsConfig } = useRewardsStore();
  const navigate = useNavigate();


  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const bannerScrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingBanner = useRef(false);

  // Modals & Address
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [userPincode, setUserPincode] = useState<string>('560064');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('for-you');

  // Derive initial user address from user profile if logged in
  useEffect(() => {
    if (user?.address) {
      const addr = user.address;
      const formatted = `${addr.house ? addr.house + ', ' : ''}${addr.street || ''}, ${addr.city || ''}`.trim();
      setUserAddress(formatted || "Home centre 2nd floor Esplanade mall, Ras...");
      if (addr.zip) setUserPincode(addr.zip);
    } else {
      setUserAddress("Home centre 2nd floor Esplanade mall, Ras...");
    }
  }, [user]);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      setRecentSearches(saved);
    } catch {
      setRecentSearches([]);
    }
  }, [isSearchFocused]);

  // Categories definition
  const MOBILE_NAV_CATEGORIES = [
    { id: 'for-you', name: 'For You', icon: Sparkles },
    { id: 'fashion', name: 'Fashion', icon: Shirt },
    { id: 'mobiles', name: 'Mobiles', icon: Smartphone },
    { id: 'electronics', name: 'Electronics', icon: Laptop },
    { id: 'beauty', name: 'Beauty', icon: Sparkles },
    { id: 'home', name: 'Home', icon: HomeIcon },
    { id: 'toys', name: 'Toys', icon: Gift },
    { id: 'appliances', name: 'Appliances', icon: Tv },
    { id: 'food-health', name: 'Food & Health', icon: Heart }
  ];

  const trendingSearches = [
    "5G Mobiles", "Wireless Earbuds", "Running Shoes", "Smart TVs", "Summer Fashion"
  ];

  // Fetch banners & products
  useEffect(() => {
    const bannersQuery = query(
      collection(db, 'banners'),
      orderBy('order', 'asc')
    );

    const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
      const now = Date.now();
      const bannerData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Banner))
        .filter(b => {
          if (b.active === false) return false;
          const p = b.platform || 'all';
          if (p !== 'all' && p !== 'mobile') return false;
          const start = b.startDate ? new Date(b.startDate).getTime() : 0;
          const end = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return now >= start && now <= end;
        });
      setBanners(bannerData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'banners', false);
    });

    const productsQuery = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products', false);
      setLoading(false);
    });

    return () => {
      unsubscribeBanners();
      unsubscribeProducts();
    };
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

  // Banner auto slide
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % banners.length;
        scrollToBannerSlide(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleLocationSelect = (pincode: string, address: string) => {
    setUserPincode(pincode);
    setUserAddress(address);
    toast.success(`Delivery pincode set to ${pincode}`);
  };

  const navigateBanner = (link?: string) => {
    if (!link) {
      navigate('/products');
      return;
    }
    if (/^https?:\/\//i.test(link) || link.startsWith('www.')) {
      const url = link.startsWith('www.') ? `https://${link}` : link;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(link);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (queryStr) {
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const updated = [queryStr, ...existing.filter((s: string) => s !== queryStr)].slice(0, 8);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
      navigate(`/products?q=${queryStr}`);
      setIsSearchFocused(false);
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice search is not supported on this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => {
      setIsListening(true);
      toast('Listening for voice search...', { icon: '🎤', id: 'voice-search' });
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      toast.success(`Voice query: "${transcript}"`, { id: 'voice-search' });
      navigate(`/products?q=${transcript}`);
      setIsListening(false);
      setIsSearchFocused(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const isInCart = items.some(i => i.productId === product.id);
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const result = addItem(product, 1);
    if (result.success) {
      toast.success("Product added to cart", { icon: '🛒' });
    } else if (result.exists) {
      navigate('/cart');
    } else {
      toast.error('Out of stock');
    }
  };

  const handleBuyNow = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const isInCart = items.some(i => i.productId === product.id);
    if (!isInCart) {
      addItem(product, 1);
    }
    navigate('/checkout');
  };

  // Filter products by selected category
  const filteredProducts = selectedCategory === 'for-you'
    ? products
    : products.filter(p => {
      const catId = (p.categoryId || '').toLowerCase();
      const target = selectedCategory.toLowerCase();
      return catId.includes(target) || target.includes(catId);
    });

  // User display name for personalized recommendations
  const userName = user?.displayName
    ? user.displayName.split(' ')[0]
    : (user?.email ? user.email.split('@')[0] : '');

  const personalizedTitle = userName
    ? `${userName}, still looking for these?`
    : 'Recommended For You';

  return (
    <div
      className="min-h-screen bg-[#FFF3EB] w-full max-w-[768px] mx-auto font-sans select-none overflow-x-hidden space-y-4 sm:space-y-5 px-3.5 xs:px-4 sm:px-5 pt-3 sm:pt-4 min-w-0"
      style={{ paddingBottom: 'calc(clamp(60px, 18vw, 76px) + env(safe-area-inset-bottom, 0px) + 20px)' }}
    >

      {/* ========================================================================= */}
      {/* 1. VIBA + REWARDS (2 equal cards in 1 row, ratio ~2.1:1, radius 22px)      */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0">
        <div className="grid grid-cols-2 gap-[clamp(10px,3.5vw,16px)] w-full min-w-0">
          {/* Card 1: VIBA */}
          <motion.div
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/')}
            style={{ height: 'clamp(78px, 22vw, 105px)' }}
            className="w-full bg-gradient-to-r from-emerald-500 via-emerald-500 to-yellow-500 rounded-[22px] p-[clamp(8px,2.5vw,14px)] shadow-md shadow-emerald-400/5 text-white flex flex-col items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border border-amber-300/40 active:scale-95 transition-transform overflow-hidden min-w-0"
          >
            <div className="w-[clamp(38px,8vw,38px)] h-[clamp(38px,8vw,38px)] bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner shrink-0">
              <Logo iconOnly className="scale-65" />
            </div>
            <span className="text-[clamp(12px,3.5vw,15px)] font-black tracking-wider text-white drop-shadow-sm truncate max-w-full">
              ViBa
            </span>
          </motion.div>

          {/* Card 2: REWARDS */}
          <motion.div
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(user ? (rewardsConfig.targetLink || '/rewards') : '/login')}
            style={{ height: 'clamp(78px, 22vw, 105px)' }}
            className="w-full bg-white rounded-[22px] p-[clamp(8px,2.5vw,14px)] shadow-sm border border-emerald-100 flex flex-col items-center justify-center gap-1 sm:gap-1.5 cursor-pointer active:scale-95 transition-transform overflow-hidden min-w-0"
          >

            <div className="w-[clamp(38px,8vw,38px)] h-[clamp(38px,8vw,38px)] bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shrink-0">
              <Gift className="w-[clamp(18px,4.5vw,22px)] h-[clamp(18px,4.5vw,22px)]" />
            </div>
            <span className="text-[clamp(12px,3.5vw,15px)] font-black tracking-wider text-gray-900 uppercase truncate max-w-full">
              REWARDS
            </span>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DELIVERY ADDRESS CARD (Compact small height ~48-52px, radius 16px)      */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0">
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsLocationModalOpen(true)}
          style={{ minHeight: '46px', height: 'clamp(46px, 12vw, 54px)', maxHeight: '56px' }}
          className="w-full min-w-0 bg-white/95 backdrop-blur-md rounded-[16px] px-3.5 py-2 shadow-sm border border-orange-200/60 flex items-center justify-between cursor-pointer hover:border-orange-300 transition-all overflow-hidden"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
            </div>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 shrink-0">
                  HOME
                </span>
                <span className="text-[11px] font-bold text-gray-500 truncate">
                  ({userPincode})
                </span>
              </div>
              <p className="text-[11px] font-semibold text-gray-600 truncate leading-tight overflow-hidden text-ellipsis min-w-0">
                {userAddress}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1.5" />
        </motion.div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SEARCH BAR (h-52-64px, radius-18px, compact icons)                      */}
      {/* ========================================================================= */}
      <section className="relative w-full min-w-0">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full min-w-0" style={{ height: 'clamp(52px, 14vw, 64px)' }}>
          <div className="absolute left-3.5 sm:left-4 z-10 flex items-center pointer-events-none text-gray-400">
            <Search className="w-5 h-5 text-emerald-600" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white h-full rounded-[18px] pl-11 pr-28 sm:pr-32 text-xs sm:text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-sm border border-orange-200/80 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all min-w-0"
          />

          <div className="absolute right-1.5 sm:right-2 flex items-center gap-0.5 sm:gap-1 bg-white pl-1 rounded-r-[18px]">
            {settings.enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label="Voice Search"
                className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all ${isListening ? 'text-rose-500 animate-pulse bg-rose-50' : 'text-gray-400 hover:text-emerald-600'
                  }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            {settings.enableVisualSearch && (
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                aria-label="Camera Search"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-all rounded-full"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              aria-label="QR Code Scanner"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-emerald-600 transition-all rounded-full"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Search Suggestions Overlay */}
        <AnimatePresence>
          {isSearchFocused && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[20px] shadow-2xl border border-orange-100 p-4 z-40 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Search Insights</span>
                <button
                  onClick={() => setIsSearchFocused(false)}
                  className="text-xs font-bold text-emerald-600"
                >
                  Close
                </button>
              </div>

              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Recent Searches</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSearchQuery(s);
                          navigate(`/products?q=${s}`);
                          setIsSearchFocused(false);
                        }}
                        className="bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Trending Searches</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {trendingSearches.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSearchQuery(t);
                        navigate(`/products?q=${t}`);
                        setIsSearchFocused(false);
                      }}
                      className="bg-orange-50 text-orange-700 border border-orange-200/60 text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                    >
                      🔥 {t}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ========================================================================= */}
      {/* 4. CATEGORY CAROUSEL (Compact small size: w-74px, h-82px, gap-2.5)        */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0">
        <div className="flex overflow-x-auto gap-2.5 hide-scrollbar scroll-smooth snap-x py-1 px-0.5 min-w-0 w-full">
          {MOBILE_NAV_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  width: 'clamp(70px, 19vw, 78px)',
                  height: 'clamp(76px, 21vw, 84px)'
                }}
                className={`flex flex-col items-center justify-between p-2 flex-none shrink-0 rounded-[16px] transition-all snap-start border overflow-hidden ${isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white border-orange-100 text-gray-700 hover:bg-orange-50/50 hover:border-orange-200'
                  }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-orange-50 text-emerald-600'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[11px] tracking-tight leading-tight text-center line-clamp-1 w-full px-0.5 ${isSelected ? 'font-bold text-white' : 'font-semibold text-gray-800'}`}>
                  {cat.name}
                </span>

                {/* Active indicator dot */}
                {isSelected ? (
                  <motion.div
                    layoutId="activeCategoryDot"
                    className="w-4 h-1 bg-white rounded-full mb-0.5 shrink-0"
                  />
                ) : (
                  <div className="h-1 mb-0.5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. PROMOTIONAL BANNER (aspect-ratio 2:1, rounded corners 22px)            */}
      {/* ========================================================================= */}
      {settings.enableBanner && banners.length > 0 && (
        <section className="w-full min-w-0 space-y-2 overflow-hidden">
          <div
            ref={bannerScrollRef}
            onScroll={handleBannerScroll}
            className="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth hide-scrollbar gap-3 px-0.5 py-0.5 min-w-0 w-full"
          >
            {banners.map((banner, i) => (
              <div
                key={banner.id || i}
                onClick={() => navigateBanner(banner.link)}
                className={`relative rounded-[22px] overflow-hidden shadow-md border border-orange-100 aspect-[2/1] bg-gray-900 cursor-pointer group active:scale-[0.99] transition-transform ${
                  banners.length > 1 ? 'w-[88%] shrink-0 snap-center' : 'w-full'
                }`}
              >
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                <div className="absolute bottom-0 inset-x-0 p-[clamp(12px,3.5vw,20px)] text-white">
                  <span className="inline-block px-2.5 py-0.5 bg-orange-500 text-white text-[clamp(8px,2.2vw,10px)] font-black uppercase tracking-widest rounded-full mb-1">
                    {banner.subtitle || 'Special Offer'}
                  </span>
                  <h2 className="text-[clamp(13px,4vw,18px)] font-black text-white leading-snug line-clamp-1">
                    {banner.title}
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-1 bg-white text-gray-900 px-3 py-1 rounded-full text-[clamp(9px,2.5vw,11px)] font-black uppercase tracking-wider shadow">
                    Shop Now <ArrowRight className="w-3 h-3 text-emerald-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Indicators directly below banner */}
          {banners.length > 1 && (
            <div className="flex justify-center items-center gap-1.5 pt-1">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToBannerSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    currentSlide === i ? 'w-5 bg-orange-500' : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. RECOMMENDED PRODUCTS (Card w: 185-215px, h: 275-320px)                  */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0 bg-emerald-800/95 backdrop-blur-md rounded-[22px] p-3.5 sm:p-4 text-white border border-emerald-700/50 shadow-md space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-base font-black text-white tracking-tight flex items-center gap-1.5 truncate">
              <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300 shrink-0" />
              <span className="truncate">{personalizedTitle}</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-emerald-200/90 font-medium truncate">Tailored to your preferences</p>
          </div>
          <Link to="/products" className="text-xs font-black text-emerald-200 hover:text-white uppercase tracking-wider shrink-0 ml-2">
            SEE ALL
          </Link>
        </div>

        {/* Horizontal Carousel: Recommended items */}
        <div className="flex overflow-x-auto gap-[clamp(10px,3vw,16px)] hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div
                key={i}
                style={{ width: 'clamp(185px, 52vw, 215px)', height: 'clamp(275px, 75vw, 320px)' }}
                className="bg-white/10 rounded-[20px] animate-pulse shrink-0"
              />
            ))
          ) : (
            filteredProducts.slice(0, 8).map((product) => (
              <MobileProductCardItem
                key={`personalized-${product.id}`}
                product={product}
                cardRadius="rounded-[20px]"
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>



      {/* ========================================================================= */}
      {/* 8. TRENDING PRODUCTS & DEALS CAROUSEL                                     */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0 space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Flame className="w-3.5 h-3.5 fill-rose-500" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight truncate">Trending Products & Deals</h3>
          </div>
          <Link to="/products" className="text-xs font-black text-emerald-700 uppercase tracking-wider shrink-0 ml-2">
            View All
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-[clamp(10px,3vw,16px)] hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div
                key={i}
                style={{ width: 'clamp(185px, 52vw, 215px)', height: 'clamp(275px, 75vw, 320px)' }}
                className="bg-white rounded-[20px] animate-pulse border border-gray-100 shrink-0"
              />
            ))
          ) : (
            products.slice(0, 10).map((product) => (
              <MobileProductCardItem
                key={`trending-${product.id}`}
                product={product}
                cardRadius="rounded-[20px]"
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. RECENTLY VIEWED & POPULAR CAROUSEL                                     */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0 space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <History className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 tracking-tight truncate">Recently Viewed & Popular</h3>
          </div>
          <Link to="/products" className="text-xs font-black text-emerald-700 uppercase tracking-wider shrink-0 ml-2">
            Explore
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-[clamp(10px,3vw,16px)] hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div
                key={i}
                style={{ width: 'clamp(185px, 52vw, 215px)', height: 'clamp(275px, 75vw, 320px)' }}
                className="bg-white rounded-[20px] animate-pulse border border-gray-100 shrink-0"
              />
            ))
          ) : (
            [...products].reverse().slice(0, 8).map((product) => (
              <MobileProductCardItem
                key={`recent-${product.id}`}
                product={product}
                cardRadius="rounded-[20px]"
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 10. TRUST & GUARANTEE GRID FOR MOBILE                                     */}
      {/* ========================================================================= */}
      <section className="w-full min-w-0 bg-white rounded-[22px] p-3.5 sm:p-4 shadow-sm border border-orange-100/80 grid grid-cols-2 gap-2.5 sm:gap-3">
        {[
          { icon: Truck, title: 'Free Shipping', sub: 'On orders > ₹500', color: 'text-emerald-600 bg-emerald-50' },
          { icon: ShieldCheck, title: '100% Protected', sub: 'Secure Checkout', color: 'text-blue-600 bg-blue-50' },
          { icon: RefreshCcw, title: '7 Days Return', sub: 'Easy Replacement', color: 'text-amber-600 bg-amber-50' },
          { icon: Headset, title: '24/7 Support', sub: 'Instant Assistance', color: 'text-purple-600 bg-purple-50' }
        ].map((f, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-gray-50/70 border border-gray-100 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${f.color}`}>
              <f.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-black text-gray-900 leading-tight truncate">{f.title}</p>
              <p className="text-[8px] sm:text-[9px] font-medium text-gray-400 truncate">{f.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Modals */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={handleLocationSelect}
      />

      <CameraSearchModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSearch={(queryStr) => {
          setSearchQuery(queryStr);
          navigate(`/products?q=${queryStr}`);
        }}
      />
    </div>
  );
}

// =========================================================================
// MOBILE PRODUCT CARD COMPONENT
// =========================================================================
interface MobileProductCardItemProps {
  key?: React.Key;
  product: Product;
  cardRadius?: string;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
  onCardClick: () => void | Promise<void>;
}

function MobileProductCardItem({
  product,
  cardRadius = "rounded-[20px]",
  onAddToCart,
  onBuyNow,
  onCardClick
}: MobileProductCardItemProps) {
  const { items } = useCartStore();
  const isInCart = items.some(i => i.productId === product.id);

  const discountAmount = product.discountPrice && product.price ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice && product.price
    ? Math.round((discountAmount / product.price) * 100)
    : (product.discountPercentage || 0);

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onCardClick}
      style={{
        width: 'clamp(185px, 52vw, 215px)',
        height: 'clamp(275px, 75vw, 320px)'
      }}
      className={`bg-white ${cardRadius} p-3 shadow-sm border border-orange-100 flex flex-col snap-start shrink-0 flex-none cursor-pointer relative overflow-hidden group hover:shadow-md transition-all text-gray-900 min-w-0`}
    >
      {/* Product Image (Responsive clamp height) */}
      <div
        style={{ height: 'clamp(120px, 34vw, 145px)' }}
        className="relative w-full rounded-[14px] overflow-hidden bg-gray-50 mb-2 shrink-0"
      >
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image'}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {discountPercentage > 0 && (
          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm z-10">
            {discountPercentage}% OFF
          </span>
        )}

        <div className="absolute top-2 right-2 bg-black/45 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 z-10">
          <span>{product.rating || 4.5}</span>
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
        </div>
      </div>

      {/* Brand & Name (Max 2 lines) */}
      <div className="flex flex-col flex-1 min-w-0 mb-1">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">
          {product.brand || 'ViBa Select'}
        </span>
        <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mt-0.5">
          {product.name}
        </h4>
      </div>

      {/* Pricing & Actions */}
      <div className="mt-auto space-y-2 pt-1 border-t border-gray-100 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs sm:text-sm font-black text-gray-900">
            ₹{(product.discountPrice || product.price || 0).toLocaleString()}
          </span>
          {product.discountPrice && product.price && product.discountPrice < product.price && (
            <span className="text-[10px] text-gray-400 line-through">
              ₹{product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {isInCart ? (
            <button
              onClick={onAddToCart}
              className="w-full py-2 px-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 border border-blue-200 active:scale-95"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
              Go to Cart
            </button>
          ) : (
            <>
              <button
                onClick={onAddToCart}
                aria-label="Add to Cart"
                className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition-all flex items-center justify-center shrink-0 border border-emerald-200/60 active:scale-95"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onBuyNow}
                className="flex-1 py-2 px-2 bg-gradient-to-r from-emerald-600 to-orange-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all text-center truncate"
              >
                Buy Now
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

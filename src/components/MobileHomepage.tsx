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
import LocationPickerModal from './LocationPickerModal';
import CameraSearchModal from './CameraSearchModal';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product, Banner } from '../types';
import { useCategoryStore, useSettingsStore, useAuthStore, useCartStore } from '../store';
import toast from 'react-hot-toast';

export default function MobileHomepage() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { user } = useAuthStore();
  const { addItem, items } = useCartStore();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

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
      const bannerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(bannerData.filter(b => b.active !== false));
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

  // Banner auto slide
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
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
    <div className="min-h-screen bg-[#FFF3EB] pb-24 px-3 pt-3 space-y-4 font-sans select-none overflow-x-hidden">

      {/* ========================================================================= */}
      {/* 1. MOBILE TOP SECTION: Smartphone-safe Top Bar & Shortcut Cards           */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        {/* Smartphone-safe Status/Header Banner */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-emerald-800 uppercase">ViBa Mart Mobile</span>
          </div>
          <span className="text-[10px] font-bold text-gray-500 bg-white/80 px-2 py-0.5 rounded-full border border-orange-100">
            Fast Delivery ⚡
          </span>
        </div>

        {/* Equal-Width Horizontally Scrollable Shortcut Cards */}
        <div className="flex overflow-x-auto gap-2.5 hide-scrollbar py-0.5 scroll-smooth snap-x">
          {/* Card 1: Existing ViBa Mart logo + "ViBa" (ViBa Green + Orange Gradient) */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="flex-1 min-w-[115px] max-w-[140px] bg-gradient-to-r from-emerald-700 via-emerald-600 to-orange-500 rounded-[20px] p-3 shadow-md shadow-emerald-900/10 text-white flex flex-col items-center justify-center gap-1.5 cursor-pointer snap-start border border-emerald-400/30 shrink-0"
          >
            <div className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 100 100" className="w-6 h-6 drop-shadow-sm">
                <path d="M10 25 L38 85 L48 85 L32 25 Z" fill="#ffffff" />
                <path d="M45 25 L65 85 H70 L50 25 Z" fill="#ffffff" className="opacity-90" />
                <path d="M55 25 L75 85 H80 L60 25 Z" fill="#fde047" className="opacity-90" />
                <path d="M65 25 L88 25 C95 25 100 30 100 38 C100 45 95 50 88 52 C95 54 100 59 100 68 C100 77 95 85 85 85 H70 L90 25 Z" fill="#fde047" />
              </svg>
            </div>
            <span className="text-xs font-black tracking-wide uppercase text-white drop-shadow-sm">
              ViBa
            </span>
          </motion.div>

          {/* Card 2: Rewards icon + "Rewards" */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(user ? '/profile' : '/login')}
            className="flex-1 min-w-[115px] max-w-[140px] bg-white rounded-[20px] p-3 shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1.5 cursor-pointer snap-start shrink-0"
          >
            <div className="w-9 h-9 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center border border-orange-100">
              <Gift className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-wide text-gray-800 uppercase">
              Rewards
            </span>
          </motion.div>

          {/* Card 3: Deals */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/products?category=all-deals')}
            className="flex-1 min-w-[115px] max-w-[140px] bg-white rounded-[20px] p-3 shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1.5 cursor-pointer snap-start shrink-0"
          >
            <div className="w-9 h-9 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center border border-rose-100">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-wide text-gray-800 uppercase">
              Deals
            </span>
          </motion.div>

          {/* Card 4: Express */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/products')}
            className="flex-1 min-w-[115px] max-w-[140px] bg-white rounded-[20px] p-3 shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1.5 cursor-pointer snap-start shrink-0"
          >
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-100">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-black tracking-wide text-gray-800 uppercase">
              Express
            </span>
          </motion.div>

          {/* Card 5: Wishlist */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/wishlist')}
            className="flex-1 min-w-[115px] max-w-[140px] bg-white rounded-[20px] p-3 shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1.5 cursor-pointer snap-start shrink-0"
          >
            <div className="w-9 h-9 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100">
              <Heart className="w-5 h-5 fill-red-400/20" />
            </div>
            <span className="text-xs font-black tracking-wide text-gray-800 uppercase">
              Wishlist
            </span>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DELIVERY LOCATION ROW                                                  */}
      {/* ========================================================================= */}
      <section>
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsLocationModalOpen(true)}
          className="bg-white/95 backdrop-blur-md rounded-[20px] p-3 shadow-sm border border-orange-200/60 flex items-center justify-between cursor-pointer hover:border-orange-300 transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-emerald-600 fill-emerald-100" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  Home
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  ({userPincode})
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800 truncate leading-tight mt-0.5">
                {userAddress}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
        </motion.div>
      </section>

      {/* ========================================================================= */}
      {/* 3. LARGE MOBILE SEARCH BAR                                               */}
      {/* ========================================================================= */}
      <section className="relative">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="absolute left-4 z-10 flex items-center pointer-events-none text-gray-400">
            <Search className="w-5 h-5 text-emerald-600" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products"
            value={searchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white h-[58px] rounded-[24px] pl-12 pr-28 text-sm font-semibold text-gray-900 placeholder-gray-400 shadow-md border border-orange-200/80 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
          />

          <div className="absolute right-2 flex items-center gap-1 bg-white pl-1 rounded-r-[24px]">
            {settings.enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                aria-label="Voice Search"
                className={`p-2.5 touch-target rounded-full transition-all ${
                  isListening ? 'text-rose-500 animate-pulse bg-rose-50' : 'text-gray-400 hover:text-emerald-600'
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
                className="p-2.5 touch-target text-gray-400 hover:text-emerald-600 transition-all rounded-full"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCameraModalOpen(true)}
              aria-label="QR Code Scanner"
              className="p-2.5 touch-target text-gray-400 hover:text-emerald-600 transition-all rounded-full"
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
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[22px] shadow-2xl border border-orange-100 p-4 z-40 space-y-4"
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
      {/* 4. CATEGORY NAVIGATION                                                   */}
      {/* ========================================================================= */}
      <section className="space-y-1.5">
        <div className="flex overflow-x-auto gap-2.5 hide-scrollbar scroll-smooth snap-x py-1">
          {MOBILE_NAV_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex flex-col items-center justify-between p-2.5 min-w-[76px] rounded-[18px] transition-all snap-start border ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-300/80 text-blue-700 shadow-sm'
                    : 'bg-white border-orange-100 text-gray-600 hover:bg-orange-50/50'
                }`}
              >
                <div className={`p-2 rounded-full mb-1 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] tracking-tight leading-tight text-center ${isSelected ? 'font-black text-blue-900' : 'font-semibold'}`}>
                  {cat.name}
                </span>

                {/* Active indicator bar */}
                {isSelected && (
                  <motion.div
                    layoutId="activeCategoryDot"
                    className="w-5 h-1 bg-blue-600 rounded-full mt-1.5"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. HERO BANNERS (Entire Banner is Clickable)                              */}
      {/* ========================================================================= */}
      {settings.enableBanner && banners.length > 0 && (
        <section className="relative rounded-[20px] overflow-hidden shadow-md border border-orange-100 h-[195px] bg-gray-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              onClick={() => navigateBanner(banners[currentSlide].link)}
              className="absolute inset-0 cursor-pointer group active:scale-[0.99] transition-transform"
            >
              <img
                src={banners[currentSlide].image}
                alt={banners[currentSlide].title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

              <div className="absolute bottom-0 inset-x-0 p-4 text-white">
                <span className="inline-block px-2.5 py-0.5 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full mb-1">
                  {banners[currentSlide].subtitle || 'Special Offer'}
                </span>
                <h2 className="text-base font-black text-white leading-tight line-clamp-1">
                  {banners[currentSlide].title}
                </h2>
                <div className="mt-2 inline-flex items-center gap-1 bg-white text-gray-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
                  Shop Now <ArrowRight className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Banner Dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-3 right-3 flex gap-1.5 z-20">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                  className={`h-1.5 rounded-full transition-all ${
                    currentSlide === i ? 'w-5 bg-orange-500' : 'w-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 7. PERSONALIZED RECOMMENDATIONS SECTIONS                                  */}
      {/* ========================================================================= */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
              {personalizedTitle}
            </h3>
            <p className="text-[10px] text-gray-500 font-bold">Tailored to your preferences</p>
          </div>
          <Link to="/products" className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
            See All
          </Link>
        </div>

        {/* Carousel 1: Personalized items */}
        <div className="flex overflow-x-auto gap-3 hide-scrollbar scroll-smooth snap-x pb-2 pt-1">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="min-w-[165px] h-[260px] bg-white rounded-[20px] animate-pulse border border-gray-100" />
            ))
          ) : (
            filteredProducts.slice(0, 8).map((product) => (
              <MobileProductCardItem
                key={`personalized-${product.id}`}
                product={product}
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. PRODUCT CAROUSELS: Trending & Popular Products                         */}
      {/* ========================================================================= */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 fill-rose-500" />
            </div>
            <h3 className="text-sm font-black text-gray-900 tracking-tight">Trending Products & Deals</h3>
          </div>
          <Link to="/products" className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
            View All
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-3 hide-scrollbar scroll-smooth snap-x pb-2 pt-1">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="min-w-[165px] h-[260px] bg-white rounded-[20px] animate-pulse border border-gray-100" />
            ))
          ) : (
            products.slice(0, 10).map((product) => (
              <MobileProductCardItem
                key={`trending-${product.id}`}
                product={product}
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>

      {/* Recently Viewed / Popular Products Carousel */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <History className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-black text-gray-900 tracking-tight">Recently Viewed & Popular</h3>
          </div>
          <Link to="/products" className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">
            Explore
          </Link>
        </div>

        <div className="flex overflow-x-auto gap-3 hide-scrollbar scroll-smooth snap-x pb-2 pt-1">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="min-w-[165px] h-[260px] bg-white rounded-[20px] animate-pulse border border-gray-100" />
            ))
          ) : (
            [...products].reverse().slice(0, 8).map((product) => (
              <MobileProductCardItem
                key={`recent-${product.id}`}
                product={product}
                onAddToCart={(e) => handleAddToCart(e, product)}
                onBuyNow={(e) => handleBuyNow(e, product)}
                onCardClick={() => navigate(`/product/${product.id}`)}
              />
            ))
          )}
        </div>
      </section>

      {/* Trust & Guarantee Grid for Mobile */}
      <section className="bg-white rounded-[20px] p-4 shadow-sm border border-orange-100/80 grid grid-cols-2 gap-3">
        {[
          { icon: Truck, title: 'Free Shipping', sub: 'On orders > ₹500', color: 'text-emerald-600 bg-emerald-50' },
          { icon: ShieldCheck, title: '100% Protected', sub: 'Secure Checkout', color: 'text-blue-600 bg-blue-50' },
          { icon: RefreshCcw, title: '7 Days Return', sub: 'Easy Replacement', color: 'text-amber-600 bg-amber-50' },
          { icon: Headset, title: '24/7 Support', sub: 'Instant Assistance', color: 'text-purple-600 bg-purple-50' }
        ].map((f, idx) => (
          <div key={idx} className="flex items-center gap-2.5 p-2 rounded-xl bg-gray-50/70 border border-gray-100">
            <div className={`p-2 rounded-lg ${f.color}`}>
              <f.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-black text-gray-900 leading-tight">{f.title}</p>
              <p className="text-[9px] font-medium text-gray-400">{f.sub}</p>
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
// 5. MOBILE PRODUCT CARD COMPONENT
// =========================================================================
interface MobileProductCardItemProps {
  key?: React.Key;
  product: Product;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
  onCardClick: () => void | Promise<void>;
}

function MobileProductCardItem({ product, onAddToCart, onBuyNow, onCardClick }: MobileProductCardItemProps) {
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
      className="bg-white rounded-[20px] p-2.5 shadow-sm border border-orange-100 flex flex-col min-w-[165px] max-w-[180px] snap-start shrink-0 cursor-pointer relative overflow-hidden group hover:shadow-md transition-all"
    >
      {/* Product Image */}
      <div className="relative aspect-[4/5] rounded-[16px] overflow-hidden bg-gray-50 mb-2">
        <img
          src={product.images?.[0] || 'https://via.placeholder.com/300x400?text=No+Image'}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {discountPercentage > 0 && (
          <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
            {discountPercentage}% OFF
          </span>
        )}

        <div className="absolute top-2 right-2 bg-black/45 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <span>{product.rating || 4.5}</span>
          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
        </div>
      </div>

      {/* Brand & Name */}
      <div className="flex flex-col flex-1 min-w-0 mb-2">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">
          {product.brand || 'ViBa Select'}
        </span>
        <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight mt-0.5 min-h-[32px]">
          {product.name}
        </h4>
      </div>

      {/* Pricing & Actions */}
      <div className="mt-auto space-y-2 pt-1 border-t border-gray-100">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-black text-gray-900">
            ₹{(product.discountPrice || product.price || 0).toLocaleString()}
          </span>
          {product.discountPrice && product.price && product.discountPrice < product.price && (
            <span className="text-[10px] text-gray-400 line-through">
              ₹{product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Separate Action Buttons */}
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
                className="p-2 touch-target bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl transition-all flex items-center justify-center shrink-0 border border-emerald-200/60 active:scale-95"
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

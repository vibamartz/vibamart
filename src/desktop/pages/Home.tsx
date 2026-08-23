import React, { useState, useEffect, useRef } from 'react';
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
import { Link, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import LocationPickerModal from '../components/LocationPickerModal';
import CameraSearchModal from '../components/CameraSearchModal';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Banner } from '../../shared/types';
import { useCategoryStore, useSettingsStore, useAuthStore, useCartStore } from '../../backend/store';
import toast from 'react-hot-toast';

export default function Home() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { user, orderedProductIds } = useAuthStore();
  const { addItem, items } = useCartStore();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  const bannerScrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingBanner = useRef(false);

  // Header & Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [userAddress, setUserAddress] = useState("Home centre 2nd floor Esplanade mall, Ras...");
  const [userPincode, setUserPincode] = useState("560064");

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
      limit(24)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const bQuery = query(collection(db, 'banners'), where('active', '==', true), orderBy('order', 'asc'));
    const unsubscribeBanners = onSnapshot(bQuery, (snapshot) => {
      const desktopBanners = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Banner))
        .filter(b => (b.platform || 'desktop') === 'desktop');
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
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % banners.length;
        scrollToBannerSlide(next);
        return next;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const nextSlide = () => {
    const next = (currentSlide + 1) % banners.length;
    scrollToBannerSlide(next);
  };

  const prevSlide = () => {
    const prev = (currentSlide - 1 + banners.length) % banners.length;
    scrollToBannerSlide(prev);
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-20">

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-6 overflow-hidden">
        <div
          ref={bannerScrollRef}
          onScroll={handleBannerScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar gap-4 sm:gap-6 px-0.5 py-0.5 min-w-0 w-full"
        >
          {banners.length > 0 ? (
            banners.map((banner, i) => (
              <div
                key={banner.id || i}
                onClick={() => {
                  if (banner.link) {
                    navigate(banner.link);
                  } else {
                    navigate('/products');
                  }
                }}
                className={`relative h-[140px] sm:h-[220px] md:h-[280px] lg:h-[340px] rounded-3xl sm:rounded-[40px] overflow-hidden shadow-2xl group border border-white/20 ${
                  banners.length > 1 ? 'w-[88%] shrink-0 snap-center' : 'w-full'
                } cursor-pointer`}
              >
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute inset-0 flex items-center px-6 sm:px-12 md:px-20">
                  <div className="max-w-2xl">
                    <span className="inline-block px-3 py-1 sm:px-4 sm:py-1 bg-primary text-white text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-3 sm:mb-6">
                      {banner.subtitle || 'Exclusive Offer'}
                    </span>
                    <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white leading-[1.1] mb-4 sm:mb-6 tracking-tighter drop-shadow-sm">
                      {banner.title}
                    </h1>
                    <div className="flex flex-wrap gap-4">
                      <div className="bg-white text-gray-900 touch-target min-h-[44px] px-5 py-2.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[11px] hover:bg-primary hover:text-white transition-all transform hover:scale-105 shadow-xl flex items-center gap-2">
                        Explore Now <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              onClick={() => navigate('/products')}
              className="relative h-[140px] sm:h-[220px] md:h-[280px] lg:h-[340px] rounded-3xl sm:rounded-[40px] overflow-hidden shadow-2xl border border-white/20 w-full bg-primary flex items-center px-6 sm:px-12 md:px-20 cursor-pointer group active:scale-[0.99] transition-all duration-150 shrink-0"
            >
              <div className="max-w-2xl text-white space-y-4 sm:space-y-6">
                <h1 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight leading-none">
                  UP TO <span className="text-secondary">80%</span> OFF ON ELECTRONICS
                </h1>
                <p className="text-xs sm:text-lg text-white/80 max-w-lg">
                  Elevate your lifestyle with the latest tech and fashion.
                </p>
                <div className="inline-block bg-white text-primary touch-target px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl font-bold shadow-lg hover:bg-secondary hover:text-black transition-all text-xs sm:text-base">
                  Shop Now
                </div>
              </div>
            </div>
          )}
        </div>

        {banners.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prevSlide(); }}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); nextSlide(); }}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Pagination Indicators directly below banner */}
            <div className="flex justify-center items-center gap-2 pt-3">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToBannerSlide(i)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlide === i ? 'w-8 bg-primary' : 'w-2 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Featured Collections / Categories */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Explore Categories</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Curated catalog of authentic quality items</p>
          </div>
          <Link to="/products" className="text-xs font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
            View All <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?category=${cat.id}`}
              className="group bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-gray-50 mb-2 group-hover:scale-105 transition-transform flex items-center justify-center border border-gray-100">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <h3 className="text-xs font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-1">{cat.name}</h3>
            </Link>
          ))}
        </div>
      </section>

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
            {products.slice(0, 15).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Trust Badges */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gray-900 text-white rounded-3xl p-8 sm:p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl text-primary">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider">Fast Nationwide Delivery</h4>
              <p className="text-xs text-gray-400 mt-0.5">Reliable tracking across all pin codes</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider">100% Authentic Products</h4>
              <p className="text-xs text-gray-400 mt-0.5">Directly sourced verified items</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl text-primary">
              <RefreshCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider">Hassle-Free Returns</h4>
              <p className="text-xs text-gray-400 mt-0.5">Easy returns and quick refunds</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl text-primary">
              <Headset className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider">24/7 Dedicated Support</h4>
              <p className="text-xs text-gray-400 mt-0.5">Instant assistance anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={(pincode, address) => {
          setUserAddress(address);
          setUserPincode(pincode);
        }}
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

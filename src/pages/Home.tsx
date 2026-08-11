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
import MobileHomepage from '../components/MobileHomepage';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Banner } from '../types';
import { useCategoryStore, useSettingsStore, useAuthStore, useCartStore } from '../store';
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

  // Mobile Header & Modal states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [userAddress, setUserAddress] = useState("Home centre 2nd floor Esplanade mall, Ras...");
  const [userPincode, setUserPincode] = useState("560064");
  
  // Mobile Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    sessionStorage.removeItem('viba_last_search');

    // Fetch Banners
    const bannersQuery = query(
      collection(db, 'banners'),
      orderBy('order', 'asc')
    );

    const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(bannerData.filter(b => b.active));
    });

    // Fetch Products
    const productsQuery = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(16)
    );

    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productData);
      setLoading(false);
    });

    return () => {
      unsubscribeBanners();
      unsubscribeProducts();
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);

  const handleLocationSelect = (pincode: string, address: string) => {
    setUserPincode(pincode);
    setUserAddress(address);
    toast.success(`Location set to ${pincode}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const updated = [query, ...existing.filter((s: string) => s !== query)].slice(0, 8);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
      navigate(`/products?q=${query}`);
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
      toast('Listening...', { icon: '🎤', id: 'voice-search' });
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      toast.success(`Heard: "${transcript}"`, { id: 'voice-search' });
      navigate(`/products?q=${transcript}`);
      setIsListening(false);
      setIsSearchFocused(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.start();
  };

  const handleAddToCartMobile = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const result = addItem(product, 1);
    if (result.success) {
      toast.success(`${product.name.slice(0, 18)}... added to cart!`, { icon: '🛒' });
    } else {
      toast.error(result.exists ? 'Already in cart' : 'Out of stock');
    }
  };

  const handleBuyNowMobile = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    const inCart = items.some(i => i.productId === product.id);
    if (!inCart) {
      addItem(product, 1);
    }
    navigate('/checkout');
  };

  // Filter products dynamically for category selection
  const filteredProducts = selectedCategory === 'for-you'
    ? products
    : products.filter(p => {
        const catId = p.categoryId?.toLowerCase() || '';
        const target = selectedCategory.toLowerCase();
        return catId.includes(target) || target.includes(catId);
      });

  // Dynamic recommendations logic
  const personalizedTitle = user
    ? `${user.displayName || 'Shopper'}, still looking for these?`
    : 'Popular & Trending Near You';

  return (
    <div className="min-h-screen bg-[#FFF3EB] md:bg-gray-50 pb-24 md:pb-20 space-y-4 md:space-y-12 overflow-x-hidden">

      {/* ========================================================================= */}
      {/* MOBILE-FIRST ANDROID ECOMMERCE UI (Visible on Mobile/Tablet <768px)       */}
      {/* ========================================================================= */}
      <div className="block md:hidden">
        <MobileHomepage />
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP LAYOUT (100% UNTOUCHED, Visible on Desktop md:block >=768px)      */}
      {/* ========================================================================= */}
      <div className="hidden md:block">
        {/* Hero Section / Multi-Banner Slider */}
        {settings.enableBanner && (
          <section className="max-w-7xl mx-0 sm:mx-4 lg:mx-auto relative h-[260px] sm:h-[300px] md:h-[350px] lg:h-[450px] overflow-hidden sm:rounded-[40px] sm:mt-4 shadow-2xl shadow-blue-50">
            <AnimatePresence mode="wait">
              {banners.length > 0 ? (
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  onClick={() => navigateBanner(banners[currentSlide].link)}
                  className="absolute inset-0 group cursor-pointer active:scale-[0.99] transition-all duration-150"
                >
                  <img
                    src={banners[currentSlide].image}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    alt={banners[currentSlide].title}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

                  <div className="absolute inset-0 flex items-center px-6 sm:px-12 md:px-20">
                    <div className="max-w-2xl">
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <span className="inline-block px-3 py-1 sm:px-4 sm:py-1 bg-primary text-white text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-3 sm:mb-6">
                          {banners[currentSlide].subtitle || 'Exclusive Offer'}
                        </span>
                        <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white leading-[1.1] mb-4 sm:mb-6 tracking-tighter drop-shadow-sm">
                          {banners[currentSlide].title}
                        </h1>
                        <div className="flex flex-wrap gap-4">
                          <div
                            className="bg-white text-gray-900 touch-target min-h-[44px] px-5 py-2.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[11px] hover:bg-primary hover:text-white transition-all transform hover:scale-105 shadow-xl flex items-center gap-2"
                          >
                            Explore Now <ArrowRight className="w-5 h-5" />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div
                  onClick={() => navigate('/products')}
                  className="absolute inset-0 bg-primary flex items-center px-6 sm:px-12 md:px-20 cursor-pointer group active:scale-[0.99] transition-all duration-150"
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
            </AnimatePresence>

            {banners.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                  className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                  className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="absolute bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-10">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                      className={`h-1 sm:h-1.5 transition-all rounded-full ${currentSlide === i ? 'w-8 sm:w-12 bg-primary' : 'w-2 sm:w-3 bg-white/40'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Desktop Categories */}
        <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Shop by Category</h2>
            <Link to="/categories" className="text-primary font-bold flex items-center hover:underline text-sm uppercase tracking-widest">
              View All <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="flex overflow-x-auto pb-6 gap-6 md:gap-10 hide-scrollbar scroll-smooth snap-x">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                className="group flex flex-col items-center gap-3 transition-all flex-shrink-0 snap-center first:pl-2 last:pr-2"
              >
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white group-hover:border-primary transition-all p-0.5 bg-white shadow-sm ring-1 ring-gray-100 hover:scale-110 duration-500">
                  <img src={cat.image} alt={cat.name} className="w-full h-full rounded-full object-cover" />
                </div>
                <p className="text-[10px] md:text-xs font-black text-gray-400 group-hover:text-primary transition-colors tracking-[0.1em] text-center uppercase">{cat.name}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Desktop Featured Products */}
        <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Trending Now</h2>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mt-1">Handpicked deals just for you</p>
            </div>
            <Link to="/products" className="bg-white touch-target border-2 border-gray-100 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center">
              See All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl sm:rounded-[32px] h-[300px] sm:h-[400px] animate-pulse" />
              ))
            ) : (
              products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </section>

        {/* Desktop Features Banner */}
        <section className="bg-white border-y border-gray-100 py-10 sm:py-20">
          <div className="max-w-7xl mx-auto px-6 sm:px-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-12">
              {[
                { icon: Truck, title: 'Free Shipping', sub: 'On orders above ₹500', color: 'bg-green-50 text-green-600' },
                { icon: ShieldCheck, title: 'Secure Payment', sub: '100% protected', color: 'bg-blue-50 text-blue-600' },
                { icon: RefreshCcw, title: 'Easy Returns', sub: '7 days policy', color: 'bg-amber-50 text-amber-600' },
                { icon: Headset, title: '24/7 Support', sub: 'Dedicated help', color: 'bg-purple-50 text-purple-600' }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-4 sm:gap-6 text-center sm:text-left">
                  <div className={`${feature.color} p-4 sm:p-5 rounded-2xl sm:rounded-[24px]`}>
                    <feature.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-black text-gray-900 tracking-tight text-xs sm:text-base leading-tight">{feature.title}</p>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-medium">{feature.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onLocationSelect={handleLocationSelect}
      />

      {/* Camera & Barcode Search Modal */}
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
interface MobileProductCardProps {
  key?: React.Key;
  product: Product;
  onAddToCart: (e: React.MouseEvent) => void;
  onBuyNow: (e: React.MouseEvent) => void;
  onCardClick: () => void;
}

function MobileProductCard({ product, onAddToCart, onBuyNow, onCardClick }: MobileProductCardProps) {
  const discountAmount = product.discountPrice && product.price ? product.price - product.discountPrice : 0;
  const discountPercentage = product.discountPrice && product.price ? Math.round((discountAmount / product.price) * 100) : 0;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onCardClick}
      className="bg-white rounded-[20px] p-2.5 shadow-sm border border-orange-100 flex flex-col min-w-[165px] max-w-[180px] snap-start shrink-0 cursor-pointer relative overflow-hidden group"
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

        <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
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

      {/* Pricing */}
      <div className="mt-auto space-y-2 pt-1 border-t border-gray-100">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-black text-gray-900">
            ₹{(product.discountPrice || product.price || 0).toLocaleString()}
          </span>
          {product.discountPrice && product.price && (
            <span className="text-[10px] text-gray-400 line-through">
              ₹{product.price.toLocaleString()}
            </span>
          )}
        </div>

        {/* Touch-friendly Add to Cart & Buy Now Action Buttons */}
        <div className="flex items-center gap-1.5">
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
        </div>
      </div>
    </motion.div>
  );
}

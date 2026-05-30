import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight as ChevronRightIcon,
  Zap,
  TrendingUp,
  Tag,
  Clock,
  Crown,
  Sparkles,
  Percent
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Banner } from '../types';
import { useCategoryStore, useAuthStore } from '../store';

export default function Home() {
  const { categories: CATEGORIES } = useCategoryStore();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 15, seconds: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 2, minutes: 15, seconds: 30 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch Banners
    const bannersQuery = query(
      collection(db, 'banners'), 
      where('active', '==', true),
      orderBy('order', 'asc')
    );
    
    const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(bannerData);
    });

    // Fetch Products for various sections
    const productsQuery = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(20)
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
    }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);

  // Derive specialized product lists for demo
  const electronics = products.filter(p => p.categoryId === '3' || p.categoryId === '1' || p.name.toLowerCase().includes('phone') || p.name.toLowerCase().includes('watch'));
  const fashion = products.filter(p => p.categoryId === '2' || p.name.toLowerCase().includes('shirt') || p.name.toLowerCase().includes('shoe'));
  const others = products.filter(p => !electronics.includes(p) && !fashion.includes(p));

  return (
    <div className="bg-gray-50 min-h-screen md:pb-8 pb-[calc(4rem+env(safe-area-inset-bottom))] overflow-x-hidden">
      
      {/* 1. Category Navigation */}
      <section className="bg-white shadow-sm mb-2 md:mb-4">
        <div className="max-w-[1920px] mx-auto px-2 py-3 md:py-4">
          <div className="flex overflow-x-auto md:flex-wrap md:justify-center hide-scrollbar gap-4 md:gap-8 px-2 md:px-4">
            {CATEGORIES.map((cat) => (
              <Link 
                key={cat.id} 
                to={`/products?category=${cat.id}`}
                className="flex flex-col items-center gap-1.5 md:gap-2 flex-shrink-0 min-w-[64px] md:min-w-[80px] group transition-transform md:hover:-translate-y-1"
              >
                <div className="w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center p-1 border border-gray-100 touch-target md:group-hover:border-primary transition-colors md:shadow-sm">
                  <img src={cat.image} alt={cat.name} className="w-full h-full rounded-full object-cover" />
                </div>
                <p className="text-[10px] md:text-sm font-semibold text-gray-800 text-center md:group-hover:text-primary transition-colors">{cat.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1920px] mx-auto w-full md:px-4 lg:px-8 space-y-2 md:space-y-6">
        
        {/* 2. Hero Banner Slider */}
        <section className="relative w-full h-[180px] sm:h-[300px] md:h-[400px] lg:h-[450px] xl:h-[500px] bg-white md:rounded-2xl overflow-hidden shadow-sm">
          <AnimatePresence mode="wait">
            {banners.length > 0 ? (
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <img 
                  src={banners[currentSlide].image} 
                  className="w-full h-full object-cover"
                  alt={banners[currentSlide].title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r md:from-black/80 md:to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-12 flex justify-between md:justify-start md:flex-col md:items-start items-end md:max-w-xl gap-4">
                  <div>
                    <h2 className="text-white font-black text-lg sm:text-2xl md:text-4xl lg:text-5xl shadow-sm md:leading-tight mb-1 md:mb-3">{banners[currentSlide].title}</h2>
                    <p className="text-white/90 text-xs sm:text-sm md:text-lg font-medium">{banners[currentSlide].subtitle}</p>
                  </div>
                  <Link to={banners[currentSlide].link || '/products'} className="bg-primary hover:bg-primary-hover text-white px-4 md:px-8 py-1.5 md:py-3 rounded-sm md:rounded-lg text-xs md:text-sm font-bold uppercase touch-target flex items-center justify-center transition-colors">
                    Shop Now
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="absolute inset-0 bg-primary flex items-center justify-center">
                 <div className="text-white text-center">
                   <h1 className="text-xl md:text-3xl font-bold">ViBa Mart Offers</h1>
                   <p className="text-xs md:text-sm opacity-80 mt-2">Loading banners...</p>
                 </div>
              </div>
            )}
          </AnimatePresence>
          
          {banners.length > 1 && (
            <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-2 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1.5 md:h-2 rounded-full transition-all ${currentSlide === i ? 'w-4 md:w-8 bg-white' : 'w-1.5 md:w-2 bg-white/50 hover:bg-white/80'}`}
                />
              ))}
            </div>
          )}
        </section>

        {/* 3. Promotional Banners Row (Bank Offer & Plus) */}
        <section className="flex flex-col md:flex-row gap-2 md:gap-6 px-2 md:px-0">
          <div className="flex-1 bg-secondary hover:bg-secondary-hover transition-colors rounded-md md:rounded-2xl p-3 md:p-6 flex items-center justify-between shadow-sm cursor-pointer group">
            <div className="flex items-center gap-3 md:gap-6">
              <div className="bg-white p-1.5 md:p-3 rounded-full md:rounded-2xl shadow-sm"><Zap className="w-5 h-5 md:w-8 md:h-8 text-secondary" /></div>
              <div>
                <p className="text-primary font-black text-xs md:text-sm uppercase tracking-wider mb-0.5 md:mb-1">Bank Offer</p>
                <p className="text-gray-900 font-medium text-xs md:text-base">Extra 10% Off on HDFC Cards</p>
              </div>
            </div>
            <ChevronRightIcon className="w-5 h-5 md:w-8 md:h-8 text-primary group-hover:translate-x-1 transition-transform" />
          </div>

          <div className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 rounded-md md:rounded-2xl p-3 md:p-6 text-white shadow-sm relative overflow-hidden group cursor-pointer">
             <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none group-hover:scale-110 transition-transform duration-500">
               <Crown className="w-24 h-24 md:w-40 md:h-40 text-secondary -mb-4 -mr-4 md:-mb-8 md:-mr-8" />
             </div>
             <div className="flex items-center justify-between relative z-10">
               <div>
                 <div className="flex items-center gap-2 mb-1 md:mb-2">
                   <Crown className="w-4 h-4 md:w-6 md:h-6 text-secondary fill-secondary" />
                   <h2 className="text-sm md:text-xl font-black italic tracking-wide">ViBa<span className="text-secondary">Plus</span></h2>
                 </div>
                 <p className="text-xs md:text-sm text-gray-300 font-medium max-w-[80%] md:max-w-md">
                   Get extra 5% cashback, free shipping, and early access.
                 </p>
               </div>
               <ChevronRightIcon className="w-5 h-5 md:w-8 md:h-8 text-secondary group-hover:translate-x-1 transition-transform" />
             </div>
          </div>
        </section>

        {/* 4. Personalized Section */}
        {user && (
          <section className="bg-[#FFFDF7] md:bg-white border-y md:border border-secondary/20 md:rounded-2xl p-3 md:p-6 shadow-sm px-2 md:px-6 mx-0 md:mx-0">
            <div className="flex items-center justify-between mb-3 md:mb-6">
              <h2 className="text-sm md:text-xl font-bold text-gray-900">{user.displayName?.split(' ')[0] || 'User'}, Still Looking For These?</h2>
              <Link to="/products" className="bg-secondary text-primary rounded-full md:rounded-lg md:px-4 w-6 h-6 md:w-auto md:h-10 flex items-center justify-center touch-target md:hover:bg-secondary-hover transition-colors font-bold text-sm gap-2">
                <span className="hidden md:block">View History</span>
                <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 hide-scrollbar gap-3 md:gap-6 pb-2 md:pb-0">
              {products.slice(0, 6).map(product => (
                <div key={product.id} className="bg-white min-w-[140px] max-w-[140px] md:min-w-0 md:max-w-none flex-shrink-0 border border-secondary/20 md:border-gray-100 rounded-md md:rounded-xl p-2 md:p-4 shadow-sm md:hover:shadow-md transition-shadow group">
                  <div className="h-28 md:h-48 w-full bg-gray-50 rounded-sm md:rounded-lg mb-2 md:mb-4 flex items-center justify-center relative overflow-hidden group-hover:bg-white transition-colors">
                    <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <p className="text-xs md:text-sm font-medium text-gray-800 line-clamp-2 md:mb-2 leading-tight h-8 md:h-10">{product.name}</p>
                  <div className="flex items-center gap-1 md:gap-2 mt-1 md:mt-auto">
                    <span className="text-sm md:text-lg font-bold text-gray-900">₹{product.discountPrice || product.price}</span>
                    {product.discountPrice && (
                      <span className="text-[9px] md:text-xs text-gray-400 line-through">₹{product.price}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Promotional Cards (2 Column Mobile / 4 Desktop) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 px-2 md:px-0">
          <Link to="/products" className="bg-rose-50 hover:bg-rose-100 rounded-md md:rounded-2xl p-3 md:p-8 flex flex-col items-center justify-center gap-2 md:gap-4 touch-target shadow-sm border border-rose-100 relative overflow-hidden transition-colors group">
             <div className="absolute -right-2 -top-2 w-12 h-12 md:w-32 md:h-32 bg-rose-200 rounded-full opacity-30 group-hover:scale-150 transition-transform duration-700"></div>
             <Tag className="w-6 h-6 md:w-12 md:h-12 text-rose-600 relative z-10" />
             <div className="flex flex-col items-center relative z-10">
               <span className="text-xs md:text-lg font-bold text-rose-700 text-center">Daily Deals</span>
               <span className="text-[9px] md:text-sm text-rose-600 font-medium">Up to 70% Off</span>
             </div>
          </Link>
          <Link to="/products" className="bg-blue-50 hover:bg-blue-100 rounded-md md:rounded-2xl p-3 md:p-8 flex flex-col items-center justify-center gap-2 md:gap-4 touch-target shadow-sm border border-blue-100 relative overflow-hidden transition-colors group">
             <div className="absolute -right-2 -top-2 w-12 h-12 md:w-32 md:h-32 bg-blue-200 rounded-full opacity-30 group-hover:scale-150 transition-transform duration-700"></div>
             <TrendingUp className="w-6 h-6 md:w-12 md:h-12 text-blue-600 relative z-10" />
             <div className="flex flex-col items-center relative z-10">
               <span className="text-xs md:text-lg font-bold text-blue-700 text-center">Trending</span>
               <span className="text-[9px] md:text-sm text-blue-600 font-medium">Top Sellers</span>
             </div>
          </Link>
          <Link to="/products" className="hidden lg:flex bg-green-50 hover:bg-green-100 rounded-2xl p-8 flex-col items-center justify-center gap-4 touch-target shadow-sm border border-green-100 relative overflow-hidden transition-colors group">
             <div className="absolute -right-2 -top-2 w-32 h-32 bg-green-200 rounded-full opacity-30 group-hover:scale-150 transition-transform duration-700"></div>
             <Sparkles className="w-12 h-12 text-green-600 relative z-10" />
             <div className="flex flex-col items-center relative z-10">
               <span className="text-lg font-bold text-green-700 text-center">New Arrivals</span>
               <span className="text-sm text-green-600 font-medium">Fresh Drops</span>
             </div>
          </Link>
          <Link to="/products" className="hidden lg:flex bg-purple-50 hover:bg-purple-100 rounded-2xl p-8 flex-col items-center justify-center gap-4 touch-target shadow-sm border border-purple-100 relative overflow-hidden transition-colors group">
             <div className="absolute -right-2 -top-2 w-32 h-32 bg-purple-200 rounded-full opacity-30 group-hover:scale-150 transition-transform duration-700"></div>
             <Percent className="w-12 h-12 text-purple-600 relative z-10" />
             <div className="flex flex-col items-center relative z-10">
               <span className="text-lg font-bold text-purple-700 text-center">Clearance</span>
               <span className="text-sm text-purple-600 font-medium">Lowest Prices</span>
             </div>
          </Link>
        </section>

        {/* 6. Flash Sale Section */}
        <section className="bg-gradient-to-b md:bg-gradient-to-r from-blue-900 to-primary p-3 md:p-8 md:rounded-2xl shadow-sm text-white relative overflow-hidden px-2 md:px-8 mx-0 md:mx-0">
          <div className="absolute right-0 top-0 w-32 h-32 md:w-96 md:h-96 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 relative z-10 gap-3">
            <div className="flex items-center md:items-start flex-row md:flex-col justify-between md:justify-start">
              <h2 className="text-sm md:text-3xl font-black flex items-center gap-1.5 md:gap-3 mb-1 md:mb-4">
                <Zap className="w-4 h-4 md:w-8 md:h-8 text-secondary fill-secondary" /> 
                Flash Sale
              </h2>
              <div className="flex items-center gap-1.5 md:gap-3 text-xs md:text-xl font-bold font-mono">
                <span className="bg-white/20 px-1.5 md:px-3 py-0.5 md:py-1.5 rounded-md backdrop-blur-sm">{String(timeLeft.hours).padStart(2, '0')}</span> :
                <span className="bg-white/20 px-1.5 md:px-3 py-0.5 md:py-1.5 rounded-md backdrop-blur-sm">{String(timeLeft.minutes).padStart(2, '0')}</span> :
                <span className="bg-white/20 px-1.5 md:px-3 py-0.5 md:py-1.5 rounded-md backdrop-blur-sm">{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            </div>
            <Link to="/products" className="hidden md:flex bg-white hover:bg-gray-50 text-primary px-6 py-3 rounded-lg text-sm font-bold shadow-lg transition-colors items-center gap-2">
              View All <ChevronRightIcon className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex overflow-x-auto md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 hide-scrollbar gap-3 md:gap-6 pb-1 relative z-10">
            {products.slice(5, 11).map(product => (
              <div key={product.id} className="min-w-[130px] max-w-[130px] md:min-w-0 md:max-w-none flex-shrink-0">
                 <div className="bg-white rounded-md md:rounded-xl p-2 md:p-4 shadow-sm md:hover:scale-105 transition-transform cursor-pointer h-full flex flex-col">
                    <div className="aspect-square w-full bg-gray-50 rounded-sm md:rounded-lg mb-2 md:mb-4 flex items-center justify-center p-1 md:p-4 relative">
                       <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-red-500 text-white text-[8px] md:text-xs font-bold px-1.5 py-0.5 rounded-sm">-40%</div>
                       <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                    </div>
                    <p className="text-[11px] md:text-sm font-medium text-gray-800 line-clamp-2 mb-1 md:mb-2 flex-1">{product.name}</p>
                    <div className="text-sm md:text-xl font-black text-gray-900 mt-auto">₹{product.discountPrice || product.price}</div>
                 </div>
              </div>
            ))}
          </div>
        </section>

        {/* 7. Product Sections */}
        <ProductSliderSection title="Best of Electronics" products={electronics.length > 0 ? electronics : products} />
        <ProductSliderSection title="Fashion Picks" products={fashion.length > 0 ? fashion : products} />
        <ProductSliderSection title="Home Essentials" products={others.length > 0 ? others : products} />
        
      </div>
    </div>
  );
}

// Helper Component for Horizontal Product Sliders -> Grid on Desktop
function ProductSliderSection({ title, products }: { title: string, products: Product[] }) {
  if (!products || products.length === 0) return null;
  
  return (
    <section className="bg-white p-3 md:p-6 md:rounded-2xl shadow-sm px-2 md:px-6 mx-0 md:mx-0">
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <h2 className="text-sm md:text-2xl font-bold text-gray-900">{title}</h2>
        <Link to="/products" className="bg-primary hover:bg-primary-hover text-white rounded-full md:rounded-lg w-6 h-6 md:w-auto md:h-10 md:px-4 flex items-center justify-center touch-target transition-colors gap-2">
          <span className="hidden md:block font-bold text-sm">View All</span>
          <ChevronRightIcon className="w-4 h-4 md:w-5 md:h-5" />
        </Link>
      </div>
      <div className="flex overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 hide-scrollbar gap-3 md:gap-6 pb-2 md:pb-0">
        {products.slice(0, 6).map(product => (
          <div key={product.id} className="min-w-[150px] max-w-[150px] md:min-w-0 md:max-w-none flex-shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, Star, Zap, ShieldCheck, 
  Truck, ArrowRight, Heart, Filter,
  Search, ChevronLeft, ChevronRight,
  Sparkles, Flame, RefreshCcw, Headset, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, Banner } from '../types';
import { useCategoryStore } from '../store';

export default function Home() {
  const { categories: CATEGORIES } = useCategoryStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    sessionStorage.removeItem('viba_last_search');

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

    // Fetch Featured Products (using a general query and filtering manually or by a flag if exists)
    // Note: If 'featured' field doesn't exist, we just take top products
    const productsQuery = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(8)
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

  return (
    <div className="bg-gray-50 min-h-screen space-y-6 sm:space-y-12 pb-20 overflow-x-hidden">
      {/* Hero Section / Multi-Banner Slider */}
      <section className="relative h-[400px] sm:h-[450px] md:h-[550px] overflow-hidden sm:rounded-[40px] sm:mt-4 sm:mx-4 shadow-2xl shadow-blue-50">
        <AnimatePresence mode="wait">
          {banners.length > 0 ? (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <img 
                src={banners[currentSlide].image} 
                className="w-full h-full object-cover"
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
                    <span className="inline-block px-3 py-1 sm:px-4 sm:py-1 bg-primary text-white text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] rounded-full mb-4 sm:mb-6">
                      {banners[currentSlide].subtitle || 'Exclusive Offer'}
                    </span>
                    <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white leading-[1.1] mb-6 tracking-tighter drop-shadow-sm">
                      {banners[currentSlide].title}
                    </h1>
                    <div className="flex flex-wrap gap-4">
                      <Link 
                        to={banners[currentSlide].link || '/products'} 
                        className="bg-white text-gray-900 px-5 py-2.5 sm:px-8 sm:py-4 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-[9px] sm:text-[11px] hover:bg-primary hover:text-white transition-all transform hover:scale-105 shadow-xl flex items-center gap-2"
                      >
                        Explore Now <ArrowRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 bg-primary flex items-center px-8 md:px-20">
               <div className="max-w-2xl text-white space-y-6">
                 <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none">
                   UP TO <span className="text-secondary">80%</span> OFF ON ELECTRONICS
                 </h1>
                 <p className="text-lg text-white/80 max-w-lg">
                   Elevate your lifestyle with the latest tech and fashion.
                 </p>
                 <Link to="/products" className="inline-block bg-white text-primary px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-secondary hover:text-black transition-all">
                   Shop Now
                 </Link>
               </div>
            </div>
          )}
        </AnimatePresence>

        {banners.length > 1 && (
          <>
            <button 
              onClick={prevSlide}
              className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button 
              onClick={nextSlide}
              className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-gray-900 transition-all border border-white/20 z-10 hidden sm:block"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1 sm:h-1.5 transition-all rounded-full ${currentSlide === i ? 'w-8 sm:w-12 bg-primary' : 'w-2 sm:w-3 bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Categories */}
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

      {/* Featured Products */}
       <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Trending Now</h2>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-widest mt-1">Handpicked deals just for you</p>
          </div>
          <Link to="/products" className="bg-white border-2 border-gray-100 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
            See All
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
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

      {/* Features Banner */}
      <section className="bg-white border-y border-gray-100 py-10 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
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
  );
}

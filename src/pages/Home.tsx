import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight as ChevronRightIcon,
  Zap,
  TrendingUp,
  Tag,
  Clock,
  Crown
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
    <div className="bg-gray-100 min-h-screen pb-20 overflow-x-hidden">
      
      {/* 1. Category Navigation (Horizontal Scroll) */}
      <section className="bg-white py-3 mb-2">
        <div className="flex overflow-x-auto hide-scrollbar gap-4 px-3">
          {CATEGORIES.map((cat) => (
            <Link 
              key={cat.id} 
              to={`/products?category=${cat.id}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[64px]"
            >
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center p-1 border border-gray-100">
                <img src={cat.image} alt={cat.name} className="w-full h-full rounded-full object-cover" />
              </div>
              <p className="text-[11px] font-medium text-gray-800 text-center">{cat.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Hero Banner Slider */}
      <section className="relative w-full h-[180px] sm:h-[300px] md:h-[400px] bg-white mb-2">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                <div>
                  <h2 className="text-white font-black text-lg sm:text-2xl shadow-sm">{banners[currentSlide].title}</h2>
                  <p className="text-white/90 text-xs sm:text-sm font-medium">{banners[currentSlide].subtitle}</p>
                </div>
                <Link to={banners[currentSlide].link || '/products'} className="bg-primary text-white px-4 py-1.5 rounded-sm text-xs font-bold uppercase touch-target flex items-center justify-center">
                  Shop Now
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 bg-primary flex items-center justify-center">
               <div className="text-white text-center">
                 <h1 className="text-xl font-bold">ViBa Mart Offers</h1>
                 <p className="text-xs opacity-80">Loading banners...</p>
               </div>
            </div>
          )}
        </AnimatePresence>
        
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-1.5 rounded-full transition-all ${currentSlide === i ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Offer Banner Static */}
      <section className="bg-white p-2 mb-2">
        <div className="w-full bg-secondary/10 rounded-sm p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-full"><Zap className="w-4 h-4 text-secondary fill-secondary" /></div>
            <div>
              <p className="text-gray-900 font-bold text-xs">Extra 10% Off on HDFC Cards</p>
              <p className="text-gray-500 font-medium text-[10px]">T&C Apply</p>
            </div>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        </div>
      </section>

      {/* 3. Personalized Section */}
      {user && (
        <section className="bg-white p-3 mb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Recently Viewed</h2>
            <Link to="/products" className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center"><ChevronRightIcon className="w-3 h-3" /></Link>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
            {products.slice(0, 5).map(product => (
              <div key={product.id} className="bg-white min-w-[120px] max-w-[120px] flex-shrink-0 border border-gray-200 rounded-sm p-2">
                <div className="h-24 w-full bg-gray-50 rounded-sm mb-2 flex items-center justify-center relative overflow-hidden p-1">
                  <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                </div>
                <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-snug mb-1 h-8">{product.name}</p>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">₹{product.discountPrice || product.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Promotional Cards (2 Column Mobile Grid) */}
      <section className="grid grid-cols-2 gap-2 px-2 mb-2">
        <Link to="/products" className="bg-rose-50 rounded-md p-3 flex flex-col items-center justify-center gap-2 touch-target shadow-sm border border-rose-100 relative overflow-hidden">
           <div className="absolute -right-2 -top-2 w-12 h-12 bg-rose-100 rounded-full opacity-50"></div>
           <Tag className="w-6 h-6 text-rose-600 relative z-10" />
           <span className="text-xs font-bold text-rose-600 text-center relative z-10">Daily Deals</span>
           <span className="text-[9px] text-rose-500 font-medium">Up to 70% Off</span>
        </Link>
        <Link to="/products" className="bg-blue-50 rounded-md p-3 flex flex-col items-center justify-center gap-2 touch-target shadow-sm border border-blue-100 relative overflow-hidden">
           <div className="absolute -right-2 -top-2 w-12 h-12 bg-blue-100 rounded-full opacity-50"></div>
           <TrendingUp className="w-6 h-6 text-blue-600 relative z-10" />
           <span className="text-xs font-bold text-blue-600 text-center relative z-10">Trending</span>
           <span className="text-[9px] text-blue-500 font-medium">Top Sellers</span>
        </Link>
      </section>

      {/* 5. Flash Sale Section */}
      <section className="bg-blue-600 p-3 mb-2 text-white relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1 mb-1">
              Deal of the Day <Clock className="w-3.5 h-3.5 ml-1" />
            </h2>
            <div className="flex items-center gap-1 text-[11px] font-medium opacity-90">
              <span>Sale ends in</span>
              <span className="bg-black/20 px-1 py-0.5 rounded">{String(timeLeft.hours).padStart(2, '0')}h</span>
              <span className="bg-black/20 px-1 py-0.5 rounded">{String(timeLeft.minutes).padStart(2, '0')}m</span>
            </div>
          </div>
          <Link to="/products" className="bg-white text-blue-600 px-3 py-1.5 rounded-sm text-xs font-bold shadow-sm">
            View All
          </Link>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 relative z-10">
          {products.slice(5, 11).map(product => (
            <div key={product.id} className="min-w-[110px] max-w-[110px] flex-shrink-0">
               <div className="bg-white rounded-sm p-2 shadow-sm h-full flex flex-col">
                  <div className="aspect-square w-full bg-gray-50 rounded-sm mb-2 flex items-center justify-center p-1 relative">
                     {product.discountPrice && (
                       <span className="absolute top-0 left-0 bg-red-500 text-white text-[8px] font-bold px-1 rounded-sm shadow-sm z-10">
                         {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                       </span>
                     )}
                     <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  </div>
                  <p className="text-[10px] font-medium text-gray-800 line-clamp-1 mb-1">{product.name}</p>
                  <div className="text-xs font-bold text-gray-900 mt-auto">₹{product.discountPrice || product.price}</div>
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Membership Banner */}
      <section className="px-2 mb-2">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-md p-4 text-white shadow-md relative overflow-hidden">
           <div className="absolute right-0 bottom-0 opacity-20 pointer-events-none">
             <Crown className="w-24 h-24 text-secondary -mb-4 -mr-4" />
           </div>
           <div className="flex items-center gap-2 mb-2">
             <Crown className="w-5 h-5 text-secondary fill-secondary" />
             <h2 className="text-sm font-black italic tracking-wide">ViBa<span className="text-secondary">Plus</span></h2>
           </div>
           <p className="text-xs text-gray-300 font-medium max-w-[80%] mb-4">
             Get extra 5% cashback, free shipping, and early access to sales.
           </p>
           <button className="bg-secondary text-primary px-4 py-2 rounded-sm text-xs font-bold uppercase touch-target shadow-lg w-max">
             Join Now
           </button>
        </div>
      </section>

      {/* 5. Product Sections */}
      <ProductSliderSection title="Best of Electronics" products={electronics.length > 0 ? electronics : products} />
      <ProductSliderSection title="Fashion Picks" products={fashion.length > 0 ? fashion : products} />
      <ProductSliderSection title="Home Essentials" products={others.length > 0 ? others : products} />

    </div>
  );
}

// Helper Component for Horizontal Product Sliders
function ProductSliderSection({ title, products }: { title: string, products: Product[] }) {
  if (!products || products.length === 0) return null;
  
  return (
    <section className="bg-white p-3 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <Link to="/products" className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center">
          <ChevronRightIcon className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
        {products.map(product => (
          <div key={product.id} className="min-w-[130px] max-w-[130px] flex-shrink-0 border border-gray-200 rounded-sm p-2 bg-white flex flex-col h-full">
            <div className="aspect-square w-full bg-gray-50 rounded-sm mb-2 flex items-center justify-center p-1 relative overflow-hidden">
               <img src={product.images[0]} alt={product.name} className="max-h-full max-w-full object-contain mix-blend-multiply" />
            </div>
            <p className="text-[11px] font-medium text-gray-800 line-clamp-1 mb-0.5">{product.name}</p>
            <div className="mt-auto">
              <span className="text-xs font-bold text-gray-900">₹{product.discountPrice || product.price}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Tag, Sparkles, ArrowRight, Gift, Percent } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Banner, Product } from '../../shared/types';
import { getProductSlug } from '../../shared/utilities/slug';
import { motion } from 'motion/react';

export default function MobileOffersScreen() {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dealProducts, setDealProducts] = useState<Product[]>([]);

  useEffect(() => {
    const unsubBanners = onSnapshot(query(collection(db, 'banners'), orderBy('order', 'asc')), (snap) => {
      const now = Date.now();
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Banner))
        .filter(b => {
          if (b.active === false) return false;
          const p = b.platform || 'all';
          if (p !== 'all' && p !== 'mobile') return false;
          const start = b.startDate ? new Date(b.startDate).getTime() : 0;
          const end = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          return now >= start && now <= end;
        });
      setBanners(docs);
    });

    const unsubProducts = onSnapshot(query(collection(db, 'products')), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setDealProducts(docs.filter(p => (p.discountPrice && p.discountPrice < p.price) || (p.discountPercentage || 0) > 10));
    });

    return () => {
      unsubBanners();
      unsubProducts();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-36 sm:pb-40 font-sans select-none p-3 space-y-4">
      {/* Deals Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-yellow-500 to-amber-500 rounded-3xl p-5 text-white shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
            Flash Sale Deals
          </span>
          <h2 className="text-lg font-black tracking-tight mt-1">Mega Offers & Discounts</h2>
          <p className="text-xs text-rose-100 font-medium">Up to 70% OFF on Electronics & Fashion</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
          <Flame className="w-6 h-6 text-yellow-300 fill-yellow-300" />
        </div>
      </div>

      {/* Clickable Offer Banners */}
      {banners.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider px-1">Special Promotion Banners</h3>
          {banners.map((banner) => (
            <motion.div
              key={banner.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(banner.link || '/products')}
              className="relative rounded-2xl overflow-hidden shadow-md border border-yellow-100 h-44 cursor-pointer group"
            >
              <img src={banner.image} alt={banner.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-white">
                <span className="text-[9px] font-black uppercase bg-yellow-500 text-gray-950 px-2 py-0.5 rounded-full">
                  {banner.subtitle || 'Limited Offer'}
                </span>
                <h4 className="text-sm font-black mt-1 line-clamp-1">{banner.title}</h4>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Discounted Product Deals */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider px-1">Top Discounted Products</h3>
        <div className="grid grid-cols-2 gap-3">
          {dealProducts.slice(0, 10).map((product) => {
            const discountPct = product.price > 0 && product.discountPrice
              ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
              : (product.discountPercentage || 0);

            return (
              <motion.div
                key={product.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/products/${getProductSlug(product)}`)}
                className="bg-white rounded-2xl p-2.5 shadow-sm border border-yellow-100 flex flex-col justify-between cursor-pointer group"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2">
                  <img src={product.images?.[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                    {discountPct}% OFF
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight">{product.name}</h4>
                <div className="flex items-baseline gap-1 mt-2 pt-1 border-t border-gray-100">
                  <span className="text-sm font-black text-gray-900">₹{(product.discountPrice || product.price).toLocaleString()}</span>
                  <span className="text-[10px] text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

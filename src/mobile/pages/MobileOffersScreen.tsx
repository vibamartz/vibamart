import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { getProductSlug } from '../../shared/utilities/slug';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { motion } from 'motion/react';

export default function MobileOffersScreen() {
  const navigate = useNavigate();
  const [dealProducts, setDealProducts] = useState<Product[]>([]);

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, 'products')), async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      const rewardIds = await getRewardProductIds();
      const filtered = filterOutRewardProducts(docs, rewardIds);
      setDealProducts(filtered.filter(p => (p.discountPrice && p.discountPrice < p.price) || (p.discountPercentage || 0) > 10));
    });

    return () => {
      unsubProducts();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white pb-36 sm:pb-40 font-sans select-none p-3 space-y-4">
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
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                  <img src={product.images?.[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                    {discountPct}% OFF
                  </span>
                </div>
                <h4 className="text-xs font-bold text-gray-900 line-clamp-1 truncate leading-tight">{product.name}</h4>
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

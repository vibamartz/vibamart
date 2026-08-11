import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { useAuthStore, useCartStore } from '../../backend/store';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileWishlistScreen() {
  const { user } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.wishlist || user.wishlist.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const fetchWishlist = async () => {
      try {
        const docsSnap = await getDocs(query(collection(db, 'products')));
        const allProds = docsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        const wishProds = allProds.filter(p => user.wishlist?.includes(p.id));
        setProducts(wishProds);
      } catch (err) {
        console.error("Error fetching wishlist:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user]);

  const handleAddToCart = (product: Product) => {
    const isInCart = cartItems.some(i => i.productId === product.id);
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const res = addItem(product, 1);
    if (res.success) {
      toast.success("Added to Cart", { icon: '🛒' });
    } else {
      navigate('/cart');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center">
        <Heart className="w-12 h-12 text-rose-400 mb-3" />
        <h2 className="text-base font-black text-gray-900">Sign in to view your Wishlist</h2>
        <p className="text-xs text-gray-500 font-medium mt-1 mb-4">Save products you love and track price drops.</p>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase">Login</button>
      </div>
    );
  }

  if (products.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3 border border-rose-100">
          <Heart className="w-8 h-8" />
        </div>
        <h2 className="text-base font-black text-gray-900">Your Wishlist is Empty</h2>
        <p className="text-xs text-gray-500 font-medium mt-1 mb-6">Explore products and save your favorites here!</p>
        <button onClick={() => navigate('/products')} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase shadow-md flex items-center gap-2">
          Browse Products <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none p-3 space-y-3">
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-orange-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900">My Saved Wishlist ({products.length})</h2>
        <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => {
          const isInCart = cartItems.some(i => i.productId === product.id);
          return (
            <motion.div
              key={product.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/product/${product.id}`)}
              className="bg-white rounded-2xl p-2.5 shadow-sm border border-orange-100 flex flex-col justify-between cursor-pointer"
            >
              <div className="aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 mb-2">
                <img src={product.images?.[0] || 'https://via.placeholder.com/300'} alt={product.name} className="w-full h-full object-cover" />
              </div>
              <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight min-h-[32px]">{product.name}</h4>
              <div className="space-y-2 mt-2 pt-1 border-t border-gray-100">
                <span className="text-sm font-black text-gray-900 block">₹{(product.discountPrice || product.price).toLocaleString()}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                  className={`w-full py-1.5 rounded-xl text-[9px] font-black uppercase ${
                    isInCart ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-emerald-600 text-white shadow-sm'
                  }`}
                >
                  {isInCart ? 'Go to Cart' : 'Add to Cart'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2, ArrowRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { useAuthStore, useCartStore } from '../../backend/store';
import { getProductSlug } from '../../shared/utilities/slug';
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
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Heart className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Sign in to view your Wishlist</h3>
        <p className="text-xs text-gray-500 mb-4">Save items you love and buy them anytime.</p>
        <button onClick={() => navigate('/login')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
          Login Now
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-2 gap-3">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl h-56 animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Heart className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-bold text-gray-900">Your wishlist is empty</h3>
        <p className="text-xs text-gray-500 mb-4">Explore items and save your favorites here.</p>
        <button onClick={() => navigate('/products')} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider">
          Explore Products
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-28">
      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <Heart className="w-5 h-5 text-rose-500 fill-current" />
        My Wishlist ({products.length})
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => {
          const isInCart = cartItems.some(i => i.productId === product.id);
          return (
            <motion.div
              key={product.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/products/${getProductSlug(product)}`)}
              className="bg-white rounded-2xl p-2.5 shadow-sm border border-yellow-100 flex flex-col justify-between cursor-pointer"
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

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { Product } from '../types';
import ProductCard from '../components/ProductCard';
import { Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Wishlist() {
  const { user, loading } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user?.wishlist || user.wishlist.length === 0) {
        setProducts([]);
        setFetching(false);
        return;
      }

      try {
        // Firestore where in clause is limited to 10-30 IDs usually
        // For a simple app we assume wishlist isn't huge, or we chunk it
        const q = query(
          collection(db, 'products'),
          where(documentId(), 'in', user.wishlist)
        );
        const querySnapshot = await getDocs(q);
        const wishlistProducts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(wishlistProducts);
      } catch (err) {
        console.error("Error fetching wishlist products:", err);
      } finally {
        setFetching(false);
      }
    };

    if (!loading && user) {
      fetchWishlist();
    } else if (!loading && !user) {
        setFetching(false);
    }
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading your wishlist...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center">
            <Heart className="w-8 h-8 text-red-500 fill-red-500" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">My Wishlist</h1>
            <p className="text-gray-500 font-medium">{products.length} {products.length === 1 ? 'item' : 'items'} saved for later</p>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-20 text-center shadow-xl shadow-gray-100 border border-gray-100"
          >
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
                <Heart className="w-12 h-12 text-gray-200" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Your wishlist is empty</h2>
            <p className="text-gray-500 max-w-md mx-auto mb-10 text-lg leading-relaxed">
              Looks like you haven't added anything to your wishlist yet. Explore our collections and find something you love!
            </p>
            <Link 
              to="/products" 
              className="inline-flex items-center gap-3 bg-primary text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover transition-all transform hover:scale-105 shadow-2xl shadow-blue-200"
            >
              Start Shopping <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}

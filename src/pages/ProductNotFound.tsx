import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Search, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useCategoryStore } from '../store';

export default function ProductNotFound() {
  const { categories } = useCategoryStore();

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full text-center space-y-12">
        {/* Animated Error Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="bg-white rounded-[40px] p-8 sm:p-16 shadow-2xl border border-gray-100 relative overflow-hidden"
        >
          {/* Subtle backgrounds decoration */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-green-50 rounded-full blur-2xl opacity-70" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-amber-50 rounded-full blur-2xl opacity-70" />

          {/* Decorative Icon */}
          <div className="relative w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <ShoppingBag className="w-12 h-12 text-rose-500" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="absolute -top-1 -right-1 text-amber-500"
            >
              <Sparkles className="w-6 h-6" />
            </motion.div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
            Product Not Available
          </h1>
          <p className="text-gray-500 max-w-md mx-auto mb-10 text-base sm:text-lg leading-relaxed font-medium">
            We couldn't find the product you're looking for. It might have been deleted, sold out, or the link may be incorrect.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-green-100 transition-all hover:scale-105 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Go to Homepage
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-gray-200 transition-all hover:scale-105 active:scale-95"
            >
              <Search className="w-4 h-4" /> Browse All Products
            </Link>
          </div>
        </motion.div>

        {/* Categories Section */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">
                Or Continue Shopping by Category
              </h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  className="group flex flex-col items-center gap-3 p-4 bg-white hover:bg-green-50/20 rounded-3xl border border-gray-100 hover:border-primary/20 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-100 group-hover:border-primary p-0.5 bg-white transition-all shadow-sm">
                    <img src={cat.image} alt={cat.name} className="w-full h-full rounded-full object-cover" />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 group-hover:text-primary transition-colors tracking-wider uppercase text-center truncate w-full">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

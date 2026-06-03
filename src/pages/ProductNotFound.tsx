import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft, Home } from 'lucide-react';
import { motion } from 'motion/react';

export default function ProductNotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="bg-white p-12 sm:p-16 rounded-[40px] shadow-2xl max-w-lg w-full border border-gray-100/80 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-500/5 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

        <div className="bg-red-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShoppingBag className="w-12 h-12 text-red-500 animate-bounce" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-4 uppercase italic">
          Product Not Found
        </h1>
        <p className="text-gray-500 mb-10 text-base sm:text-lg font-medium leading-relaxed">
          The product you are looking for might have been deleted, had its name changed, or is temporarily unavailable.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch">
          <Link 
            to="/products" 
            className="flex-1 bg-primary text-white px-8 py-4.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary-hover active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Shop
          </Link>
          <Link 
            to="/" 
            className="flex-1 bg-gray-900 text-white px-8 py-4.5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black active:scale-95 transition-all shadow-xl shadow-gray-900/10 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Home Page
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

import React from 'react';
import { CheckCircle, Package, ArrowRight, Home, ShoppingBag, Truck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

export default function OrderSuccess() {
  const location = useLocation();
  const orderId = location.state?.orderId || "VBM-" + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  return (
    <div className="min-h-[85vh] bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl p-10 md:p-16 text-center border border-gray-100 flex flex-col items-center"
      >
        <div className="bg-blue-50 w-32 h-32 rounded-full flex items-center justify-center mb-10 relative">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-blue-600 p-6 rounded-full"
          >
            <CheckCircle className="w-16 h-16 text-white" />
          </motion.div>
          {/* Decorative rings */}
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full animate-ping opacity-25" />
          <div className="absolute inset-[-10px] border border-blue-50 rounded-full" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">Order Confirmed!</h1>
        <p className="text-gray-500 font-medium text-lg mb-10 max-w-sm">
          Yippee! Your order <span className="text-primary font-black">{orderId}</span> has been placed and is currently being processed.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mb-12">
           <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl transition-all cursor-default">
              <Truck className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Estimate Delivery</p>
              <p className="text-lg font-black text-gray-900">Usually 2-3 Days</p>
           </div>
           <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl transition-all cursor-default">
              <Package className="w-8 h-8 text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
              <p className="text-lg font-black text-gray-900">Order Confirmed</p>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full">
           <Link to={`/track-order/${orderId}`} className="flex-1 bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-gray-200 flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95">
              Track Order <ArrowRight className="w-4 h-4" />
           </Link>
           <Link to="/" className="flex-1 bg-white border-2 border-gray-100 text-gray-900 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:border-primary hover:text-primary transition-all active:scale-95 flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Back to Home
           </Link>
        </div>

        <p className="mt-12 text-[10px] font-black text-gray-300 uppercase tracking-widest max-w-xs leading-relaxed">
          Need help with your order? Our support team is available 24/7. Contact us at <span className="text-primary">support@vibamart.com</span>
        </p>
      </motion.div>
    </div>
  );
}

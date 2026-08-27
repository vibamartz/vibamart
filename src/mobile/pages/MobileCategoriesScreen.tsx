import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategoryStore } from '../../backend/store';
import { ChevronRight, Grid, Sparkles, ArrowRight, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileCategoriesScreen() {
  const { categories } = useCategoryStore();
  const navigate = useNavigate();

  const [activeCategoryId, setActiveCategoryId] = useState<string>(categories[0]?.id || 'all-deals');

  const selectedCategory = categories.find(c => c.id === activeCategoryId) || categories[0];

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-36 sm:pb-40 font-sans select-none flex flex-col">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-yellow-500 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full">
              Explore Collections
            </span>
            <h2 className="text-lg font-black tracking-tight text-white mt-1">
              All Categories & Departments
            </h2>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
            <Grid className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Left Sidebar + Right Content Grid */}
      <div className="flex-1 flex overflow-hidden min-h-[70vh]">
        {/* Left Sidebar (Categories) */}
        <div className="w-28 bg-white border-r border-yellow-100/80 overflow-y-auto hide-scrollbar py-2 pb-36 sm:pb-40 space-y-1.5 shrink-0">
          {categories.map((cat) => {
            const isActive = cat.id === activeCategoryId;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`w-full p-2.5 flex flex-col items-center justify-center text-center transition-all relative ${
                  isActive
                    ? 'bg-emerald-50/90 text-emerald-900 font-extrabold'
                    : 'text-gray-600 hover:bg-yellow-50/40 font-semibold'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="categoryActiveBar"
                    className="absolute left-0 top-1 bottom-1 w-1 bg-emerald-600 rounded-r-full"
                  />
                )}
                
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1 overflow-hidden transition-all ${
                  isActive ? 'bg-emerald-600 text-white shadow-md scale-105' : 'bg-gray-100 border border-gray-200/60'
                }`}>
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <Layers className="w-5 h-5" />
                  )}
                </div>

                <span className="text-[10px] leading-tight line-clamp-2 px-1">
                  {cat.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Right Content Area (Selected Category & Subcategories Grid) */}
        <div className="flex-1 overflow-y-auto p-3 pb-36 sm:pb-40 space-y-4">
          {selectedCategory && (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Category Header Card */}
                <div className="bg-white rounded-[22px] p-3.5 shadow-sm border border-yellow-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 border border-yellow-200 overflow-hidden shrink-0">
                      <img 
                        src={selectedCategory.image || 'https://via.placeholder.com/150'} 
                        alt={selectedCategory.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900">
                        {selectedCategory.name}
                      </h3>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {selectedCategory.subcategories?.length || 0} Subcategories Available
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/products?category=${selectedCategory.id}`)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 shrink-0"
                  >
                    All Items <ArrowRight className="w-3 h-3" />
                  </motion.button>
                </div>

                {/* Subcategories Grid */}
                {selectedCategory.subcategories && selectedCategory.subcategories.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider px-1">
                      Subcategories
                    </h4>

                    <div className="grid grid-cols-2 gap-2.5">
                      {selectedCategory.subcategories.map((sub) => (
                        <motion.div
                          key={sub.id}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => navigate(`/products?category=${selectedCategory.id}&subCategory=${sub.id}`)}
                          className="bg-white rounded-[20px] p-3 border border-yellow-100/90 shadow-sm flex flex-col items-center justify-center text-center cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
                        >
                          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-2 overflow-hidden group-hover:scale-105 transition-transform">
                            {sub.image ? (
                              <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                            ) : (
                              <Sparkles className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-900 group-hover:text-emerald-700 leading-tight">
                            {sub.name}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-[22px] p-6 text-center border border-yellow-100 space-y-2">
                    <p className="text-xs font-bold text-gray-500">
                      Explore all products in {selectedCategory.name}
                    </p>
                    <button
                      onClick={() => navigate(`/products?category=${selectedCategory.id}`)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
                    >
                      Browse {selectedCategory.name}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

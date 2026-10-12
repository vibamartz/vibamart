import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Mic, Camera, QrCode, ArrowLeft, X, History, TrendingUp, Sparkles, Tag, ChevronRight 
} from 'lucide-react';
import CameraSearchModal from '../../desktop/components/CameraSearchModal';
import { useSettingsStore, useCategoryStore } from '../../backend/store';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { AutocompleteItem, AutocompleteResponse } from '../../backend/search/types';
import { ViBaSearchEngine } from '../../backend/search/searchEngine';
import { getProductSlug, getCategorySlug } from '../../shared/utilities/slug';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import PermissionPromptModal from '../../shared/components/PermissionPromptModal';
import CategoryLogo from '../../shared/components/CategoryLogo';
import { ViBaPermissionManager } from '../../services/ViBaPermissionManager';
import { getRecentSearches, addRecentSearch, clearRecentSearches as clearSearchHistory, SEARCH_HISTORY_UPDATED_EVENT } from '../../shared/utilities/searchHistoryUtils';

export default function MobileSearchScreen() {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const { categories } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<AutocompleteItem[]>([]);
  const [spellingCorrection, setSpellingCorrection] = useState<string | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const trendingSearches = [
    "5G Mobiles", "Wireless Earbuds", "Running Shoes", "Smart TVs", "Summer Fashion", "Laptops", "Beauty Products"
  ];

  useEffect(() => {
    const loadRecent = () => {
      setRecentSearches(getRecentSearches(8));
    };
    loadRecent();
    window.addEventListener('storage', loadRecent);
    window.addEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);

    // Auto focus on mount
    setTimeout(() => searchInputRef.current?.focus(), 150);

    return () => {
      window.removeEventListener('storage', loadRecent);
      window.removeEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);
    };
  }, []);

  // Fetch live suggestions on typing with debouncing and resilient fallback
  useEffect(() => {
    const qStr = searchQuery.trim();
    if (qStr.length < 2) {
      setLiveSuggestions([]);
      setSpellingCorrection(undefined);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(qStr)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data: AutocompleteResponse = await res.json();
          setLiveSuggestions(data.suggestions || []);
          setSpellingCorrection(data.spellingCorrection);
          return;
        }
        throw new Error('API suggestions response error');
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        // Fallback: search client products with ViBaSearchEngine
        try {
          const snap = await getDocs(collection(db, 'products'));
          const rewardIds = await getRewardProductIds();
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          const searchRes = ViBaSearchEngine.executeSearch(docs, {
            query: qStr,
            limit: 6,
            rewardProductIds: Array.from(rewardIds)
          });
          const items: AutocompleteItem[] = searchRes.hits.slice(0, 6).map(h => ({
            id: h.product.id,
            type: 'product',
            title: h.product.name,
            subtitle: h.product.brand,
            image: h.product.primaryImage || h.product.images?.[0] || '',
            price: h.product.price,
            discountPrice: h.product.discountPrice,
            slug: getProductSlug(h.product),
            targetUrl: `/products/${getProductSlug(h.product)}`
          }));
          setLiveSuggestions(items);
          setSpellingCorrection(searchRes.didYouMean);
        } catch (fallbackErr) {
          console.warn('Fallback suggestions failed:', fallbackErr);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const handleSearchSubmit = async (e?: React.FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    const term = (customTerm || searchQuery).trim();
    if (term) {
      const updated = addRecentSearch(term, 8);
      setRecentSearches(updated);

      const cleanQ = cleanProductCode(term);
      try {
        const snap = await getDocs(collection(db, 'products'));
        const rewardIds = await getRewardProductIds();
        const prods = filterOutRewardProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)), rewardIds);
        const exactMatch = prods.find(p => 
          (p.productCode && cleanProductCode(p.productCode) === cleanQ) ||
          (p.productCode && p.productCode.toLowerCase() === term.toLowerCase()) ||
          p.id === term
        );

        if (exactMatch) {
          navigate(`/products/${getProductSlug(exactMatch)}`);
          return;
        }
      } catch (err) {
        console.error("Error checking product code on mobile search:", err);
      }

      navigate(`/products?q=${encodeURIComponent(term)}`);
    }
  };

  const clearRecentSearches = () => {
    clearSearchHistory();
    setRecentSearches([]);
  };

  const startVoiceSearch = () => {
    setIsListening(true);
    ViBaPermissionManager.startVoiceSearch(
      (transcript) => {
        setSearchQuery(transcript);
        toast.success(`Voice query: "${transcript}"`, { id: 'voice-search' });
        setIsListening(false);
        handleSearchSubmit(undefined, transcript);
      },
      (err) => {
        setIsListening(false);
        if (err === 'Not supported') {
          toast.error("Voice search is not supported on this browser.");
        } else {
          setShowMicPermissionModal(true);
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-white pb-36 sm:pb-40 font-sans select-none p-3 space-y-4">
      {/* Search Header Bar */}
      <div className="flex items-center gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search products, brands, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white h-[50px] rounded-2xl pl-10 pr-24 text-sm font-semibold text-gray-900 placeholder-gray-400 border border-yellow-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <Search className="w-4 h-4 text-emerald-600 absolute left-3.5 pointer-events-none" />

          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-20 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="absolute right-2 flex items-center gap-0.5 bg-white pl-1 rounded-r-2xl">
            {settings.enableVoiceSearch && (
              <button
                type="button"
                onClick={startVoiceSearch}
                className={`p-2 rounded-full transition-all ${
                  isListening ? 'text-rose-500 bg-rose-50 animate-pulse' : 'text-gray-400 hover:text-emerald-600'
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
            {settings.enableVisualSearch && (
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="p-2 text-gray-400 hover:text-emerald-600 rounded-full"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Did You Mean Spelling Suggestion */}
      {spellingCorrection && (
        <button
          type="button"
          onClick={() => {
            setSearchQuery(spellingCorrection);
            handleSearchSubmit(undefined, spellingCorrection);
          }}
          className="w-full bg-amber-50 border border-amber-200/80 rounded-2xl p-3 flex items-center gap-2 text-left shadow-sm cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-900">
            Did you mean <strong className="font-bold underline decoration-amber-400">{spellingCorrection}</strong>?
          </span>
        </button>
      )}

      {/* Live Matching Suggestions */}
      {liveSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-md border border-yellow-100 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
            Matching Suggestions
          </span>
          <div className="divide-y divide-gray-100">
            {liveSuggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(item.targetUrl)}
                className="py-2.5 px-1 flex items-center justify-between cursor-pointer hover:bg-yellow-50/60 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.type === 'product' ? (
                    item.image ? (
                      <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" 
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-gray-400" />
                      </div>
                    )
                  ) : item.type === 'category' ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <Tag className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                    {item.type === 'product' && (item.price || item.discountPrice) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-emerald-700 font-extrabold">
                          ₹{(item.discountPrice || item.price || 0).toLocaleString()}
                        </span>
                        {item.discountPrice && item.price && item.price > item.discountPrice && (
                          <span className="text-[9px] text-gray-400 line-through">
                            ₹{item.price.toLocaleString()}
                          </span>
                        )}
                        {item.productCode && (
                          <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                            {item.productCode}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-medium capitalize">
                        {item.subtitle || item.type}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-700 font-black text-xs uppercase tracking-wider">
              <History className="w-4 h-4 text-emerald-600" />
              <span>Recent Searches</span>
            </div>
            <button
              onClick={clearRecentSearches}
              className="text-[11px] font-bold text-rose-600 hover:underline"
            >
              Clear All
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term, index) => (
              <button
                key={index}
                onClick={() => handleSearchSubmit(undefined, term)}
                className="bg-gray-100 hover:bg-emerald-50 hover:text-emerald-800 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200/60 transition-all"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trending Searches */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center gap-1.5 text-gray-700 font-black text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 text-yellow-600" />
          <span>Trending Searches</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {trendingSearches.map((term, index) => (
            <button
              key={index}
              onClick={() => handleSearchSubmit(undefined, term)}
              className="bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 text-xs font-black px-3 py-1.5 rounded-full transition-all"
            >
              🔥 {term}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Categories Quick Links */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center gap-1.5 text-gray-700 font-black text-xs uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Browse by Category</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/category/${getCategorySlug(cat)}`)}
              className="p-2.5 bg-gray-50 border border-gray-200/70 rounded-xl flex items-center gap-2 hover:bg-emerald-50 transition-all text-left"
            >
              <CategoryLogo name={cat.name} icon={cat.icon} size="sm" />
              <span className="text-xs font-bold text-gray-800 truncate">{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Camera Search Modal */}
      <CameraSearchModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSearch={(queryStr) => {
          setSearchQuery(queryStr);
          handleSearchSubmit(undefined, queryStr);
        }}
      />

      {/* Microphone Permission Modal */}
      <PermissionPromptModal
        isOpen={showMicPermissionModal}
        type="microphone"
        onClose={() => setShowMicPermissionModal(false)}
        onAllowAccess={startVoiceSearch}
      />
    </div>
  );
}

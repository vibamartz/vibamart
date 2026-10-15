import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Mic, Camera, QrCode, ArrowLeft, X, History, TrendingUp, Sparkles, Tag, ChevronRight, Loader2 
} from 'lucide-react';
import CameraSearchModal from '../../desktop/components/CameraSearchModal';
import { useSettingsStore, useCategoryStore } from '../../backend/store';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { getProductSlug, getCategorySlug } from '../../shared/utilities/slug';
import { cleanProductCode } from '../../shared/utilities/productCode';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import PermissionPromptModal from '../../shared/components/PermissionPromptModal';
import CategoryLogo from '../../shared/components/CategoryLogo';
import { ViBaPermissionManager } from '../../services/ViBaPermissionManager';
import { getRecentSearches, addRecentSearch, clearRecentSearches as clearSearchHistory, SEARCH_HISTORY_UPDATED_EVENT } from '../../shared/utilities/searchHistoryUtils';
import { searchApiClient } from '../../services/searchApiClient';
import { SuggestionItem } from '../../backend/search/searchTypes';

export default function MobileSearchScreen() {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const { categories } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<SuggestionItem[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number>(-1);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadRecent = () => {
      setRecentSearches(getRecentSearches(8));
    };
    loadRecent();
    window.addEventListener('storage', loadRecent);
    window.addEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);

    // Fetch dynamic trending/popular searches from actual catalog data and search analytics
    searchApiClient.getPopular(8)
      .then(res => {
        const queries = (res.popular || res.suggestions || []).map(s => s.title);
        if (queries.length > 0) {
          setTrendingSearches(queries);
        }
      })
      .catch(() => {});

    // Auto focus on mount
    setTimeout(() => searchInputRef.current?.focus(), 150);

    return () => {
      window.removeEventListener('storage', loadRecent);
      window.removeEventListener(SEARCH_HISTORY_UPDATED_EVENT, loadRecent);
    };
  }, []);

  // Fetch live suggestions on typing via searchApiClient with debouncing and loading/error states
  useEffect(() => {
    const qStr = searchQuery.trim();
    setActiveSuggestionIndex(-1);
    setSuggestError(null);

    if (qStr.length < 2) {
      setLiveSuggestions([]);
      setIsSuggestLoading(false);
      return;
    }

    setIsSuggestLoading(true);
    let isCurrent = true;

    const timer = setTimeout(() => {
      searchApiClient.suggest(qStr, 8)
        .then(res => {
          if (isCurrent) {
            setLiveSuggestions(res.suggestions || []);
            setIsSuggestLoading(false);
          }
        })
        .catch(err => {
          if (isCurrent) {
            console.warn('Failed to fetch mobile suggestions:', err);
            setSuggestError('Failed to load live suggestions');
            setIsSuggestLoading(false);
          }
        });
    }, 200);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const selectSuggestion = (item: SuggestionItem) => {
    if (item.type === 'category') {
      navigate(`/products?category=${encodeURIComponent(item.title)}`);
    } else if (item.type === 'brand') {
      navigate(`/products?brand=${encodeURIComponent(item.title)}`);
    } else if (item.type === 'query') {
      handleSearchSubmit(undefined, item.title);
    } else {
      navigate(`/products/${item.slug || item.id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (liveSuggestions.length === 0) {
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev + 1 >= liveSuggestions.length ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => (prev - 1 < 0 ? liveSuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveSuggestionIndex(-1);
      searchInputRef.current?.blur();
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < liveSuggestions.length) {
        e.preventDefault();
        selectSuggestion(liveSuggestions[activeSuggestionIndex]);
      }
    }
  };

  const handleSearchSubmit = async (e?: React.FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    const term = (customTerm || searchQuery).trim();
    if (term) {
      const updated = addRecentSearch(term, 8);
      setRecentSearches(updated);

      try {
        const lookup = await searchApiClient.search({ q: term, limit: 1 });
        if (lookup.exactMatch && lookup.products.length > 0) {
          const exactMatch = lookup.products[0];
          navigate(`/products/${getProductSlug(exactMatch)}`);
          return;
        }
      } catch (err) {
        console.warn("Exact lookup check fallback on mobile search:", err);
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
            onKeyDown={handleKeyDown}
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

      {/* Suggestion Loading / Error States */}
      {searchQuery.trim().length >= 2 && isSuggestLoading && liveSuggestions.length === 0 && (
        <div className="flex items-center justify-center gap-2.5 py-4 bg-gray-50/70 rounded-2xl border border-gray-100 text-xs font-semibold text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Searching catalog suggestions...</span>
        </div>
      )}

      {searchQuery.trim().length >= 2 && !isSuggestLoading && suggestError && (
        <div className="py-3 px-4 text-center bg-rose-50/70 rounded-2xl border border-rose-100 text-rose-600 text-xs font-medium">
          {suggestError}. Tap search to browse all matching products.
        </div>
      )}

      {/* Live Matching Suggestions */}
      {liveSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-md border border-yellow-100 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
            Matching Suggestions
          </span>
          <div className="divide-y divide-gray-100">
            {liveSuggestions.map((item, idx) => {
              const isSelected = activeSuggestionIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => selectSuggestion(item)}
                  onMouseEnter={() => setActiveSuggestionIndex(idx)}
                  className={`py-2 px-2 flex items-center justify-between cursor-pointer rounded-xl transition-all ${
                    isSelected ? 'bg-emerald-50/90 ring-1 ring-emerald-500/30' : 'hover:bg-yellow-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        alt="" 
                        className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0" 
                      />
                    ) : item.type === 'category' ? (
                      <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                    ) : item.type === 'brand' ? (
                      <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-950 font-black' : 'text-gray-900'}`}>{item.title}</p>
                      {item.subtitle ? (
                        <p className="text-[10px] text-gray-400 truncate">{item.subtitle}</p>
                      ) : (item.discountPrice || item.price) ? (
                        <span className="text-[10px] text-emerald-700 font-extrabold">
                          ₹{(item.discountPrice || item.price)!.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-emerald-700 translate-x-0.5' : 'text-gray-400'}`} />
                </div>
              );
            })}
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

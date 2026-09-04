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
import { getProductSlug } from '../../shared/utilities/slug';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import PermissionPromptModal from '../../shared/components/PermissionPromptModal';

export default function MobileSearchScreen() {
  const navigate = useNavigate();
  const { settings } = useSettingsStore();
  const { categories } = useCategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<Product[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const trendingSearches = [
    "5G Mobiles", "Wireless Earbuds", "Running Shoes", "Smart TVs", "Summer Fashion", "Laptops", "Beauty Products"
  ];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      setRecentSearches(saved);
    } catch {
      setRecentSearches([]);
    }
    // Auto focus on mount
    setTimeout(() => searchInputRef.current?.focus(), 150);
  }, []);

  // Fetch live product suggestions on typing
  useEffect(() => {
    const qStr = searchQuery.trim().toLowerCase();
    if (qStr.length < 2) {
      setLiveSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'products'), limit(30)));
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        const filtered = docs.filter(p => 
          p.name.toLowerCase().includes(qStr) || 
          p.brand?.toLowerCase().includes(qStr) ||
          p.tags?.some(t => t.toLowerCase().includes(qStr))
        ).slice(0, 6);
        setLiveSuggestions(filtered);
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    const term = (customTerm || searchQuery).trim();
    if (term) {
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const updated = [term, ...existing.filter((s: string) => s !== term)].slice(0, 8);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
      navigate(`/products?q=${encodeURIComponent(term)}`);
    }
  };

  const clearRecentSearches = () => {
    localStorage.removeItem('viba_recent_searches');
    setRecentSearches([]);
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice search is not supported on this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.onstart = () => {
      setIsListening(true);
      toast('Listening for voice search...', { icon: '🎤', id: 'voice-search' });
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      toast.success(`Voice query: "${transcript}"`, { id: 'voice-search' });
      setIsListening(false);
      handleSearchSubmit(undefined, transcript);
    };
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
        setShowMicPermissionModal(true);
      }
    };
    recognition.onend = () => setIsListening(false);
    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
      setShowMicPermissionModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-36 sm:pb-40 font-sans select-none p-3 space-y-4">
      {/* Search Header Bar */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="p-2.5 bg-white text-gray-700 rounded-full border border-yellow-100 shadow-sm shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

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

      {/* Live Matching Suggestions */}
      {liveSuggestions.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-md border border-yellow-100 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">
            Matching Products ({liveSuggestions.length})
          </span>
          <div className="divide-y divide-gray-100">
            {liveSuggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/products/${getProductSlug(item)}`)}
                className="py-2 px-1 flex items-center justify-between cursor-pointer hover:bg-yellow-50/60 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src={item.images?.[0] || 'https://via.placeholder.com/60'} 
                    alt={item.name} 
                    className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0" 
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                    <span className="text-[10px] text-emerald-700 font-extrabold">
                      ₹{(item.discountPrice || item.price).toLocaleString()}
                    </span>
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
              onClick={() => navigate(`/products?category=${cat.id}`)}
              className="p-2.5 bg-gray-50 border border-gray-200/70 rounded-xl flex items-center gap-2 hover:bg-emerald-50 transition-all text-left"
            >
              <img src={cat.image || 'https://via.placeholder.com/40'} alt={cat.name} className="w-7 h-7 rounded-lg object-cover" />
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

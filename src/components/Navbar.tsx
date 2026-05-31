import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, ShoppingCart, User, Heart, Menu, X, LogOut, LayoutDashboard,
  Mic, Camera, TrendingUp, History, ArrowRight, Bell,
  Smartphone, Shirt, Laptop, Home as HomeIcon, Sparkles, Tv, Percent
} from 'lucide-react';
import { useAuthStore, useCartStore, useCategoryStore, useSettingsStore } from '../store';
import { auth, db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import CameraSearchModal from './CameraSearchModal';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { settings } = useSettingsStore();
  const { categories: CATEGORIES } = useCategoryStore();
  const navCategories = [
    {
      id: 'all-deals',
      name: 'All Deals',
      iconImage: '🔥',
      color: '#ef4444',
      icon: undefined as string | undefined
    },
    ...CATEGORIES.filter(c => c.id !== 'all-deals')
  ];
  const { user } = useAuthStore();
  const { items } = useCartStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCameraSearchOpen, setIsCameraSearchOpen] = useState(false);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  const getCategoryIcon = (cat: any) => {
    if (cat.name === 'Toys') return <span className="text-sm scale-110">🧸</span>;
    if (cat.name === 'Food & Health') return <span className="text-sm scale-110">🍎</span>;
    
    switch (cat.icon) {
      case 'smartphone': return <span className="text-sm scale-110">📱</span>;
      case 'shirt': return <span className="text-sm scale-110">👕</span>;
      case 'laptop': return <span className="text-sm scale-110">💻</span>;
      case 'home': return <span className="text-sm scale-110">🏠</span>;
      case 'sparkles': return <span className="text-sm scale-110">✨</span>;
      case 'tv': return <span className="text-sm scale-110">📺</span>;
      default: return <span className="text-sm scale-110">📦</span>;
    }
  };

  // Sync search query with URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (location.pathname === '/' || !q) {
      setSearchQuery('');
    } else {
      setSearchQuery(q);
    }
  }, [location]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    const loadRecent = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
        setRecentSearches(saved);
      } catch { setRecentSearches([]); }
    };
    loadRecent();
    window.addEventListener('storage', loadRecent);
    return () => window.removeEventListener('storage', loadRecent);
  }, [isSearchFocused]);

  const logSearch = async (queryStr: string, type: 'text' | 'voice' | 'visual') => {
    try {
      await addDoc(collection(db, 'searchAnalytics'), {
        query: queryStr,
        type,
        timestamp: new Date().toISOString(),
        userId: user?.uid || null
      });
    } catch (e) {
      console.error('Failed to log search analytics:', e);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      logSearch(query, 'text');
      // Save to recent searches
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const updated = [query, ...existing.filter((s: string) => s !== query)].slice(0, 10);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));

      navigate(`/products?q=${query}`);
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
      setIsMenuOpen(false);
    } else if (location.pathname === '/products') {
      const params = new URLSearchParams(location.search);
      if (params.get('q')) {
        params.delete('q');
        navigate(`/products?${params.toString()}`);
      }
      setIsMenuOpen(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (location.pathname === '/products') {
      const params = new URLSearchParams(location.search);
      if (params.get('q')) {
        params.delete('q');
        navigate(`/products?${params.toString()}`);
      }
    }
    searchInputRef.current?.focus();
  };

  const [isListening, setIsListening] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState<typeof CATEGORIES>([]);

  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = CATEGORIES.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.id.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 3);
      setSuggestedCategories(filtered);
    } else {
      setSuggestedCategories([]);
    }
  }, [searchQuery]);

  const startVoiceSearch = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast('Listening...', { icon: '🎤', id: 'voice-search' });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      toast.success(`Heard: "${transcript}"`, { id: 'voice-search' });
      logSearch(transcript, 'voice');
      navigate(`/products?q=${transcript}`);
      setIsSearchFocused(false);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        toast.error("Speech recognition error: " + event.error, { id: 'voice-search' });
      } else {
        toast.dismiss('voice-search');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const removeRecentSearch = (e: React.MouseEvent, search: string) => {
    e.stopPropagation();
    const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
    const updated = existing.filter((s: string) => s !== search);
    localStorage.setItem('viba_recent_searches', JSON.stringify(updated));
    setRecentSearches(updated);
  };


  const clearRecentHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('viba_recent_searches', JSON.stringify([]));
    setRecentSearches([]);
  };

  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 bg-primary shadow-md">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2 sm:pb-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo & Location */}
          <div className="flex flex-col min-w-0 flex-shrink-0">
            <Link to="/" className="hover:opacity-80 transition-opacity flex items-center">
               <Logo variant="dark" className="scale-75 sm:scale-100 origin-left -ml-2 sm:ml-0" />
            </Link>
            <button className="flex items-center gap-1 text-white/90 text-[10px] sm:text-xs mt-0.5 truncate hover:text-white group transition-colors">
              <span className="font-medium truncate max-w-[120px] sm:max-w-[200px]">Deliver to Bangalore - 560064</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform rotate-90" />
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-1 sm:gap-4">
             {user?.role === 'admin' && (
               <Link to="/admin" className="hidden sm:flex text-white hover:text-secondary transition-colors items-center gap-1 p-2 touch-target" aria-label="Admin">
                 <LayoutDashboard className="w-5 h-5" />
                 <span className="text-sm font-bold">Admin</span>
               </Link>
             )}
             <Link to="/profile?tab=waitlist" className="hidden sm:flex relative p-2 touch-target text-white hover:text-secondary transition-colors" aria-label="Notifications">
               <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-primary"></span>
             </Link>
             <Link to="/cart" className="hidden sm:flex relative p-2 touch-target text-white hover:text-secondary transition-colors items-center gap-2" aria-label="Cart">
               <div className="relative">
                 <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                 {cartCount > 0 && (
                   <span className="absolute -top-1.5 -right-2 bg-secondary text-primary text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-primary">
                     {cartCount}
                   </span>
                 )}
               </div>
               <span className="hidden sm:block text-sm font-bold">Cart</span>
             </Link>
             {user ? (
               <Link to="/profile" className="hidden sm:flex items-center gap-2 touch-target p-1 hover:bg-white/10 rounded-lg transition-colors ml-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-sm border border-secondary">
                     {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-bold text-white truncate max-w-[100px]">{user.displayName?.split(' ')[0]}</span>
               </Link>
             ) : (
               <Link to="/login" className="hidden sm:flex items-center text-sm font-bold text-white hover:text-secondary transition-colors px-2">
                 Login
               </Link>
             )}
          </div>
        </div>

        {/* Search Bar Row */}
        <div className="mt-2 sm:mt-3 relative w-full group">
           <form onSubmit={handleSearch} className="w-full relative flex items-center shadow-sm">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
             </div>
             <input
               ref={searchInputRef}
               type="text"
               placeholder="Search for Products, Brands and More"
               className="block w-full bg-white border-0 rounded-sm sm:rounded-lg py-2.5 sm:py-3 pl-10 pr-20 text-[13px] sm:text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-secondary transition-all shadow-inner"
               value={searchQuery}
               onFocus={() => setIsSearchFocused(true)}
               onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
             <div className="absolute right-1 flex items-center">
               {searchQuery && (
                 <button type="button" onClick={clearSearch} className="p-2 text-gray-400 hover:text-red-500 transition-colors touch-target">
                   <X className="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
               )}
               {settings.enableVoiceSearch && (
                 <button type="button" onClick={startVoiceSearch} className={`p-2 touch-target transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-primary'}`}>
                   <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
               )}
               {settings.enableVisualSearch && (
                 <button type="button" onClick={() => setIsCameraSearchOpen(true)} className="p-2 text-gray-400 hover:text-primary transition-colors touch-target">
                   <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                 </button>
               )}
             </div>
           </form>

           {/* Search Suggestions Dropdown */}
           <AnimatePresence>
              {isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden z-50 p-2 sm:p-4 max-h-[60vh] overflow-y-auto"
                >
                  <div className="flex flex-col gap-4">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2 px-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Searches</span>
                          <button onClick={clearRecentHistory} className="text-[10px] font-bold text-red-400 hover:text-red-600">Clear</button>
                        </div>
                        <div className="flex flex-col gap-1">
                          {recentSearches.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setSearchQuery(s);
                                navigate(`/products?q=${s}`);
                                setIsSearchFocused(false);
                              }}
                              className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <History className="w-4 h-4 text-gray-300" />
                                <span className="text-sm font-medium text-gray-700">{s}</span>
                              </div>
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Trending */}
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Trending</span>
                      </div>
                      <div className="flex flex-wrap gap-2 px-1">
                        {['Samsung Fold', 'Nike Jordan', 'Summer Collection', 'Smart Watches', 'Organic Skincare'].map((trend) => (
                          <button
                            key={trend}
                            onClick={() => {
                              setSearchQuery(trend);
                              navigate(`/products?q=${trend}`);
                              setIsSearchFocused(false);
                            }}
                            className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-xs font-medium text-gray-700 transition-colors border border-gray-100"
                          >
                            {trend}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
           </AnimatePresence>
        </div>
      </div>
      
      {/* Visual Search Modal */}
      {settings.enableVisualSearch && (
        <CameraSearchModal
          isOpen={isCameraSearchOpen}
          onClose={() => setIsCameraSearchOpen(false)}
          onSearch={(query) => {
            setSearchQuery(query);
            logSearch(query, 'visual');
            navigate(`/products?q=${encodeURIComponent(query)}`);
            setIsSearchFocused(false);
          }}
        />
      )}
    </nav>
  );
}

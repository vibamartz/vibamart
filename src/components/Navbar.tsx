import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search, ShoppingCart, User, Heart, Menu, X, LogOut, LayoutDashboard,
  Mic, Camera, TrendingUp, History, ArrowRight, Bell,
  Smartphone, Shirt, Laptop, Home as HomeIcon, Sparkles, Tv, Percent
} from 'lucide-react';
import { useAuthStore, useCartStore, useCategoryStore } from '../store';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import CameraSearchModal from './CameraSearchModal';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { categories: CATEGORIES } = useCategoryStore();
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      // Save to recent searches
      const existing = JSON.parse(localStorage.getItem('viba_recent_searches') || '[]');
      const updated = [query, ...existing.filter((s: string) => s !== query)].slice(0, 10);
      localStorage.setItem('viba_recent_searches', JSON.stringify(updated));

      navigate(`/products?q=${query}`);
      setIsSearchFocused(false);
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
    <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className={`${isMenuOpen ? 'hidden' : 'flex'} sm:flex transition-all duration-300`}>
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <Logo className="scale-75 sm:scale-100 origin-left" />
            </Link>
          </div>

          {/* Search Bar - Responsive and Wide */}
          <div className="flex flex-1 max-w-4xl mx-2 sm:mx-4 lg:mx-12 relative group items-center">
            <form onSubmit={handleSearch} className="w-full relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className={`h-4 w-4 transition-colors ${isSearchFocused ? 'text-primary' : 'text-gray-400'}`} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products, brands & more"
                className={`block w-full bg-white border rounded-full py-2.5 lg:py-3 pl-11 pr-12 sm:pr-24 text-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all duration-300 shadow-sm ${isSearchFocused ? 'border-primary shadow-md' : 'border-gray-200'
                  }`}
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-12 sm:right-[114px] p-1 text-gray-400 hover:text-red-500 transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="absolute right-12 hidden sm:flex items-center gap-2 pr-2 border-r border-gray-100 mr-2">
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={`p-1.5 transition-colors ${isListening ? 'text-rose-500 animate-pulse' : 'text-gray-400 hover:text-primary'}`}
                  title="Voice Search"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCameraSearchOpen(true)}
                  className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                  title="Visual Search"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <button
                type="submit"
                className="absolute right-1.5 p-2 bg-primary text-white rounded-full hover:bg-primary-hover transition-all duration-200 shadow-sm flex items-center justify-center active:scale-95"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Search Suggestions Dropdown */}
            <AnimatePresence>
              {isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 p-4"
                >
                  <div className="flex flex-col gap-5">
                    {/* Category Suggestions */}
                    {suggestedCategories.length > 0 && searchQuery.length > 0 && (
                      <div className="bg-gray-50/50 rounded-2xl p-3">
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suggested Categories</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                          {suggestedCategories.map(cat => (
                            <Link
                              key={cat.id}
                              to={`/products?category=${cat.id}`}
                              onClick={() => setIsSearchFocused(false)}
                              className="flex items-center justify-between p-2.5 hover:bg-white rounded-xl transition-all group/cat shadow-sm border border-transparent hover:border-gray-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg group-hover/cat:bg-primary/5 transition-colors">
                                  {getCategoryIcon(cat.icon || '')}
                                </div>
                                <span className="text-sm font-bold text-gray-700 group-hover/cat:text-primary">{cat.name}</span>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover/cat:text-primary transition-all -translate-x-1 group-hover/cat:translate-x-0 opacity-0 group-hover/cat:opacity-100" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3 px-2">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent Searches</span>
                          </div>
                          <button
                            onClick={clearRecentHistory}
                            className="text-[9px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest"
                          >
                            Clear All
                          </button>
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
                              className="flex items-center justify-between group/item p-3 hover:bg-gray-50 rounded-xl transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <History className="w-3.5 h-3.5 text-gray-300 group-hover/item:text-primary" />
                                <span className="text-sm font-medium text-gray-600 group-hover/item:text-gray-900">{s}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => removeRecentSearch(e, s)}
                                  className="p-1 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors opacity-0 group-hover/item:opacity-100"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <ArrowRight className="w-3 h-3 text-gray-300 opacity-0 group-hover/item:opacity-100 transition-all -translate-x-2 group-hover/item:translate-x-0" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 mb-3 px-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Trending Now</span>
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
                            className="px-4 py-2 bg-gray-50 hover:bg-blue-50 hover:text-primary rounded-full text-xs font-medium text-gray-600 transition-all border border-gray-100 active:scale-95"
                          >
                            {trend}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-2 mb-4 px-2">
                        <History className="w-4 h-4 text-gray-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Popular Categories</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {CATEGORIES.slice(0, 4).map(cat => (
                          <Link
                            key={cat.id}
                            to={`/products?category=${cat.id}`}
                            onClick={() => setIsSearchFocused(false)}
                            className="flex flex-col items-center gap-2 p-3 hover:bg-blue-50/50 rounded-2xl transition-all group border border-gray-50"
                          >
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm group-hover:scale-110 transition-transform">
                              <img src={cat.image} className="w-full h-full rounded-lg object-cover" alt="" />
                            </div>
                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest text-center group-hover:text-primary">{cat.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-6">
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-gray-600 hover:text-primary flex items-center gap-1 transition-colors">
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-sm font-medium">Admin</span>
              </Link>
            )}
            <Link to="/wishlist" className="text-gray-600 hover:text-primary transition-colors relative">
              <Heart className="w-6 h-6" />
            </Link>
            <Link to="/cart" className="text-gray-600 hover:text-primary transition-colors relative">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
            {user ? (
              <Link to="/profile" className="relative group">
                <div className="w-10 h-10 rounded-full border-2 border-gray-100 p-0.5 overflow-hidden transition-all group-hover:border-primary">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                      {user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors shadow-lg shadow-blue-500/20"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Actions (Always Visible) */}
          <div className="flex md:hidden items-center gap-1 sm:gap-3">
            <Link to="/profile?tab=waitlist" className="text-gray-600 p-2" aria-label="Waitlist">
              <Bell className="w-6 h-6" />
            </Link>
            <Link to="/cart" className="text-gray-600 relative p-2" aria-label="Cart">
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              className="p-2 text-gray-600 transition-transform active:scale-95"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle Menu"
            >
              {isMenuOpen ? <X className="w-7 h-7 text-primary" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Category Nav */}
      <div className="border-t border-gray-100 bg-white overflow-x-auto hide-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-11 gap-8 whitespace-nowrap overflow-x-auto hide-scrollbar text-[11px] font-black text-gray-500 uppercase tracking-widest">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.id}`}
                className="transition-colors h-full flex items-center gap-2 border-b-2 border-transparent pt-0.5 group"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = cat.color || '#3b82f6';
                  e.currentTarget.style.borderColor = cat.color || '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <span className="transition-colors flex items-center justify-center opacity-70 group-hover:opacity-100">
                  {cat.iconImage ? (
                    cat.iconImage.startsWith('http') || cat.iconImage.startsWith('data:') ? (
                      <img src={cat.iconImage} alt="" className="w-4 h-4 object-contain" />
                    ) : (
                      <span className="text-sm scale-110">{cat.iconImage}</span>
                    )
                  ) : cat.icon && !['smartphone','shirt','laptop','home','sparkles','tv'].includes(cat.icon) ? (
                    <span className="text-sm">{cat.icon}</span>
                  ) : (
                    getCategoryIcon(cat)
                  )}
                </span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[85%] max-w-sm bg-white z-[70] p-6 md:hidden shadow-2xl flex flex-col overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Navigation</span>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-primary transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-8">
                {/* Search in Drawer */}
                <form onSubmit={handleSearch} className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="What are you looking for?"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3.5 pl-11 pr-24 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="p-2 text-gray-400 hover:text-rose-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={startVoiceSearch}
                      className={`p-2 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-primary'}`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                {user && (
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg shadow-primary/20 overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                      ) : (
                        user.displayName?.[0]?.toUpperCase() || user.email[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <p className="font-black text-gray-900 truncate">{user.displayName || 'User'}</p>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">View Profile</p>
                    </div>
                  </Link>
                )}

                <div className="flex flex-col gap-4">
                  {[
                    { to: '/', label: 'Home', icon: HomeIcon },
                    { to: '/products', label: 'Store', icon: ShoppingCart },
                    { to: '/wishlist', label: 'Wishlist', icon: Heart, count: user?.wishlist?.filter(id => id && id.trim() !== '').length },
                    { to: '/track-order', label: 'Track Order', icon: History },
                    { to: '/faq', label: 'Help & Support', icon: Sparkles },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center group/nav justify-between p-4 rounded-2xl hover:bg-primary/5 transition-all"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover/nav:bg-primary group-hover/nav:text-white transition-all">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-black text-gray-700 group-hover/nav:text-gray-900">{item.label}</span>
                      </div>
                      {item.count ? (
                        <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-lg">{item.count}</span>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover/nav:text-primary transition-all -translate-x-2 group-hover/nav:translate-x-0 opacity-0 group-hover/nav:opacity-100" />
                      )}
                    </Link>
                  ))}
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4 ml-4">Categories</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CATEGORIES.map(cat => (
                      <Link
                        key={cat.id}
                        to={`/products?category=${cat.id}`}
                        className="flex flex-col gap-3 p-4 bg-gray-50 rounded-2xl transition-all group/cat border border-gray-50 hover:bg-white"
                        style={{ borderColor: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = cat.color || '#3b82f6';
                          e.currentTarget.style.backgroundColor = (cat.color || '#3b82f6') + '10';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-gray-400 shadow-sm transition-colors">
                          {cat.iconImage ? (
                            cat.iconImage.startsWith('http') || cat.iconImage.startsWith('data:') ? (
                              <img src={cat.iconImage} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <span className="text-lg">{cat.iconImage}</span>
                            )
                          ) : cat.icon && !['smartphone','shirt','laptop','home','sparkles','tv'].includes(cat.icon) ? (
                            <span className="text-lg">{cat.icon}</span>
                          ) : (
                            getCategoryIcon(cat)
                          )}
                        </div>
                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest" style={{ color: cat.color }}>{cat.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-8 flex flex-col gap-3">
                {!user ? (
                  <Link
                    to="/login"
                    className="w-full bg-primary text-white text-center py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In to Account
                  </Link>
                ) : (
                  <button
                    onClick={() => { auth.signOut(); setIsMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 text-rose-500 font-black uppercase tracking-widest text-[11px] py-4 border-2 border-rose-50 rounded-2xl hover:bg-rose-50 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </button>
                )}
                <p className="text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest mt-4">ViBa Mart v2.4.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CameraSearchModal
        isOpen={isCameraSearchOpen}
        onClose={() => setIsCameraSearchOpen(false)}
        onSearch={(query) => {
          setSearchQuery(query);
          navigate(`/products?q=${encodeURIComponent(query)}`);
          setIsSearchFocused(false);
        }}
      />
    </nav>
  );
}

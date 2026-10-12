import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Trash2, Edit2, Check, X, Sparkles, RefreshCw,
  TrendingUp, AlertTriangle, ArrowRight, Activity, Sliders, Play, CheckCircle2,
  Tag, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { SynonymEntry } from '../../backend/search/types';
import { synonymService, DEFAULT_SYNONYMS } from '../../backend/search/synonymService';
import { searchAnalyticsService } from '../../backend/search/searchAnalyticsService';
import { ViBaSearchEngine } from '../../backend/search/searchEngine';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product } from '../../shared/types';
import { useCategoryStore } from '../../backend/store';

export default function AdminSearchManagementView() {
  const { categories: CATEGORIES } = useCategoryStore();
  const [activeTab, setActiveTab] = useState<'synonyms' | 'sandbox' | 'analytics'>('synonyms');

  // Synonyms State
  const [synonyms, setSynonyms] = useState<SynonymEntry[]>([]);
  const [loadingSynonyms, setLoadingSynonyms] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [editingSynonym, setEditingSynonym] = useState<SynonymEntry | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newSynonymsStr, setNewSynonymsStr] = useState('');
  const [newIsBidirectional, setNewIsBidirectional] = useState(true);

  // Sandbox State
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [sandboxQuery, setSandboxQuery] = useState('phone');
  const [sandboxResults, setSandboxResults] = useState<any>(null);

  // Analytics State
  const [analyticsMetrics, setAnalyticsMetrics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Load Synonyms
  const loadSynonyms = async () => {
    setLoadingSynonyms(true);
    try {
      const data = await synonymService.getSynonyms(true);
      setSynonyms(data);
    } catch (err) {
      console.error('Failed to load synonyms:', err);
      toast.error('Could not load synonyms');
    } finally {
      setLoadingSynonyms(false);
    }
  };

  // Load Products for Sandbox
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc')));
      const prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setAllProducts(prods);
    } catch (err) {
      console.error('Failed to load products for sandbox:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load Analytics Metrics
  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const metrics = await searchAnalyticsService.getSearchMetrics();
      setAnalyticsMetrics(metrics);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    loadSynonyms();
    loadProducts();
    loadAnalytics();
  }, []);

  // Category map for search
  const categoryNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    CATEGORIES.forEach(c => {
      if (c && c.id && c.name) map[c.id] = c.name;
      c?.subcategories?.forEach(s => {
        if (s && s.id && s.name) map[s.id] = s.name;
        s?.subcategories?.forEach(n => {
          if (n && n.id && n.name) map[n.id] = n.name;
        });
      });
    });
    return map;
  }, [CATEGORIES]);

  // Run Sandbox Simulation
  const runSandboxSearch = () => {
    if (!sandboxQuery.trim()) return;
    const res = ViBaSearchEngine.executeSearch(
      allProducts,
      {
        query: sandboxQuery,
        limit: 10,
        enableFuzzy: true,
        enableSynonyms: true,
      },
      categoryNamesMap
    );
    setSandboxResults(res);
  };

  useEffect(() => {
    if (allProducts.length > 0 && sandboxQuery) {
      runSandboxSearch();
    }
  }, [allProducts, sandboxQuery]);

  // Handle Save Synonym
  const handleSaveNewSynonym = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim() || !newSynonymsStr.trim()) {
      toast.error('Please provide both term and synonyms.');
      return;
    }

    const synList = newSynonymsStr
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (synList.length === 0) {
      toast.error('Please enter at least one valid synonym.');
      return;
    }

    const toastId = toast.loading('Saving synonym...');
    try {
      await synonymService.saveSynonym({
        id: editingSynonym ? editingSynonym.id : undefined,
        term: newTerm.trim().toLowerCase(),
        synonyms: synList,
        isBidirectional: newIsBidirectional,
        isActive: true,
      });

      toast.success(editingSynonym ? 'Synonym updated!' : 'Synonym added!', { id: toastId });
      setIsAddingNew(false);
      setEditingSynonym(null);
      setNewTerm('');
      setNewSynonymsStr('');
      await loadSynonyms();
      if (sandboxQuery) runSandboxSearch();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save synonym', { id: toastId });
    }
  };

  // Handle Delete Synonym
  const handleDeleteSynonym = async (id: string, term: string) => {
    if (!window.confirm(`Delete synonym rule for "${term}"?`)) return;
    const toastId = toast.loading('Deleting synonym...');
    try {
      await synonymService.deleteSynonym(id);
      toast.success('Synonym deleted', { id: toastId });
      await loadSynonyms();
    } catch (err) {
      toast.error('Failed to delete', { id: toastId });
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (syn: SynonymEntry) => {
    try {
      await synonymService.toggleSynonymActive(syn.id, !syn.isActive);
      toast.success(`Synonym ${!syn.isActive ? 'activated' : 'deactivated'}`);
      await loadSynonyms();
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const filteredSynonyms = synonyms.filter(s => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.term.includes(q) || s.synonyms.some(item => item.includes(q));
  });

  return (
    <div className="space-y-6 pb-20 select-none">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            ViBa Core Search Engine
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight">Intelligent Search Engine & Synonyms</h1>
          <p className="text-gray-300 text-sm mt-1 max-w-2xl font-normal">
            Configure relevance ranking, manage e-commerce synonyms, simulate search queries in the sandbox, and track zero-result searches.
          </p>
        </div>

        {/* Quick Metrics Badges */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10">
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Active Synonyms</div>
            <div className="text-xl font-black text-white">{synonyms.filter(s => s.isActive).length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10">
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Indexed Products</div>
            <div className="text-xl font-black text-emerald-400">{allProducts.length}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10">
            <div className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Avg Latency</div>
            <div className="text-xl font-black text-blue-400">{analyticsMetrics?.avgLatencyMs || '< 25'} ms</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('synonyms')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'synonyms'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          Synonym Dictionary ({synonyms.length})
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'sandbox'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Play className="w-4 h-4" />
          Search Relevance Sandbox
        </button>

        <button
          onClick={() => { setActiveTab('analytics'); loadAnalytics(); }}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition-all ${
            activeTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Search Analytics & Unmet Demand
        </button>
      </div>

      {/* TAB 1: SYNONYMS MANAGEMENT */}
      {activeTab === 'synonyms' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search synonym rules (e.g. mobile, shoes)..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm font-medium outline-none focus:border-primary focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={loadSynonyms}
                className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-xl transition-all"
                title="Refresh Synonyms"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingSynonym(null);
                  setNewTerm('');
                  setNewSynonymsStr('');
                  setNewIsBidirectional(true);
                  setIsAddingNew(true);
                }}
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add Synonym Rule
              </button>
            </div>
          </div>

          {/* Add / Edit Synonym Modal */}
          <AnimatePresence>
            {isAddingNew && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-primary/20 shadow-lg p-6 space-y-4"
              >
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <h3 className="font-bold text-gray-900 text-base">
                    {editingSynonym ? 'Edit Synonym Rule' : 'New Synonym Rule'}
                  </h3>
                  <button onClick={() => setIsAddingNew(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveNewSynonym} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Primary Term
                      </label>
                      <input
                        type="text"
                        value={newTerm}
                        onChange={e => setNewTerm(e.target.value)}
                        placeholder="e.g. mobile"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-primary"
                        required
                      />
                      <span className="text-[11px] text-gray-400">The root term or keyword.</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Equivalent Synonyms (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={newSynonymsStr}
                        onChange={e => setNewSynonymsStr(e.target.value)}
                        placeholder="e.g. phone, smartphone, cellphone, handset"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-primary"
                        required
                      />
                      <span className="text-[11px] text-gray-400">Comma-separated alternative names or spellings.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={newIsBidirectional}
                        onChange={e => setNewIsBidirectional(e.target.checked)}
                        className="w-4 h-4 text-primary rounded"
                      />
                      Bidirectional Mapping (Any synonym mutually maps to all other synonyms)
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNew(false)}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs font-bold bg-primary text-white hover:bg-primary-hover rounded-xl shadow-sm"
                    >
                      {editingSynonym ? 'Update Rule' : 'Save Rule'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Synonym Rules Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/75 border-b border-gray-100 text-[11px] uppercase font-black tracking-wider text-gray-400">
                  <tr>
                    <th className="py-3 px-4">Primary Term</th>
                    <th className="py-3 px-4">Equivalent Synonyms</th>
                    <th className="py-3 px-4">Direction</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSynonyms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 text-xs italic">
                        {loadingSynonyms ? 'Loading synonym rules...' : 'No synonym rules found matching query.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSynonyms.map(syn => (
                      <tr key={syn.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-gray-900">{syn.term}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {syn.synonyms.map(s => (
                              <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            syn.isBidirectional ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {syn.isBidirectional ? '⇄ Mutual (Both Ways)' : '→ One-Way'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleActive(syn)}
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full transition-colors ${
                              syn.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                          >
                            {syn.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingSynonym(syn);
                                setNewTerm(syn.term);
                                setNewSynonymsStr(syn.synonyms.join(', '));
                                setNewIsBidirectional(syn.isBidirectional);
                                setIsAddingNew(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSynonym(syn.id, syn.term)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SEARCH RELEVANCE SANDBOX */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                Live Relevance Simulator
              </h3>
              <p className="text-gray-500 text-xs mt-1">
                Test how the 8-tier algorithm evaluates queries, matches SKUs, expands synonyms, tolerates typos, and calculates scores.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={sandboxQuery}
                  onChange={e => setSandboxQuery(e.target.value)}
                  placeholder="Enter a test query (e.g., 'samung', '8900 0996 1001', 'shoes', 'iphone 15')..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:bg-white"
                />
              </div>
              <button
                onClick={runSandboxSearch}
                className="px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover shadow-sm transition-all"
              >
                Execute Query
              </button>
            </div>

            {/* Quick Test Query Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Try quick queries:</span>
              {['8900 0996', 'mobile', 'samung', 'running shoes', 'laptop', 'earbuds', 'saree'].map(q => (
                <button
                  key={q}
                  onClick={() => setSandboxQuery(q)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-primary/10 hover:text-primary rounded-lg text-xs font-semibold text-gray-600 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Sandbox Search Output */}
          {sandboxResults && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">
                    Results: <span className="text-primary">{sandboxResults.totalHits} matching products</span>
                  </span>
                  <span className="text-xs text-gray-400">
                    Execution Latency: <strong className="text-gray-700">{sandboxResults.latencyMs} ms</strong>
                  </span>
                </div>

                {sandboxResults.didYouMean && (
                  <div className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border border-amber-200">
                    <span>Did you mean:</span>
                    <strong className="underline cursor-pointer" onClick={() => setSandboxQuery(sandboxResults.didYouMean)}>
                      "{sandboxResults.didYouMean}"
                    </strong>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {sandboxResults.hits.map((hit: any, index: number) => {
                  const b = hit.scoreBreakdown;
                  return (
                    <div
                      key={hit.product.id}
                      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:border-primary/30 transition-all flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-black text-xs flex items-center justify-center shrink-0">
                          #{index + 1}
                        </div>
                        {hit.product.images?.[0] ? (
                          <img
                            src={hit.product.images[0]}
                            alt=""
                            className="w-12 h-12 object-cover rounded-xl border border-gray-100"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                            <Tag className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{hit.product.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className="font-semibold text-gray-700">{hit.product.brand || 'Unbranded'}</span>
                            <span>•</span>
                            <span className="text-primary font-bold">₹{(hit.product.discountPrice || hit.product.price).toLocaleString()}</span>
                            <span>•</span>
                            <span>Stock: {hit.product.stock}</span>
                            {hit.product.productCode && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-gray-400">{hit.product.productCode}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown Pill */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <div className="bg-primary/10 text-primary font-black text-xs px-3 py-1.5 rounded-xl border border-primary/20">
                          Score: {Math.round(hit.score)}
                        </div>

                        {b.identifierScore > 0 && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            +1000 SKU/Code
                          </span>
                        )}
                        {b.exactTitleScore > 0 && (
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            +500 Title
                          </span>
                        )}
                        {b.phraseScore > 0 && (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            +{b.phraseScore} Phrase
                          </span>
                        )}
                        {b.brandScore > 0 && (
                          <span className="bg-purple-50 text-purple-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            +{b.brandScore} Brand
                          </span>
                        )}
                        {b.fuzzyScore > 0 && (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            +{b.fuzzyScore} Typo
                          </span>
                        )}
                        {b.appliedSynonyms?.length > 0 && (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                            Synonym Applied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SEARCH ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Total Captured Searches</span>
              <div className="text-2xl font-black text-gray-900 mt-1">{analyticsMetrics?.totalSearches || 0}</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Zero-Result Queries</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{analyticsMetrics?.zeroResultCount || 0}</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Zero-Result Rate</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{analyticsMetrics?.zeroResultRatePct || 0}%</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Average Search Latency</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{analyticsMetrics?.avgLatencyMs || 0} ms</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zero-Result Search Queries (Unmet Customer Demand Opportunities) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Top Zero-Result Queries (Catalog Improvement Opportunities)
                </h3>
                <p className="text-gray-400 text-xs mt-1">Queries entered by customers that returned 0 results. Use this to add new products or synonyms.</p>
              </div>

              <div className="divide-y divide-gray-50">
                {analyticsMetrics?.zeroResultQueries?.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs italic">
                    No zero-result searches recorded yet.
                  </div>
                ) : (
                  analyticsMetrics?.zeroResultQueries?.map((item: any) => (
                    <div key={item.query} className="py-2.5 flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-800">"{item.query}"</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-[11px]">{new Date(item.lastSearched).toLocaleDateString()}</span>
                        <span className="bg-rose-50 text-rose-600 font-black px-2 py-0.5 rounded-full text-[10px]">
                          {item.count} searches
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Popular Searches */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Most Popular Customer Search Terms
                </h3>
                <p className="text-gray-400 text-xs mt-1">Highest frequency search keywords across desktop and mobile.</p>
              </div>

              <div className="divide-y divide-gray-50">
                {analyticsMetrics?.popularQueries?.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs italic">
                    No search terms recorded yet.
                  </div>
                ) : (
                  analyticsMetrics?.popularQueries?.map((item: any, i: number) => (
                    <div key={item.query} className="py-2.5 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-400 w-4">#{i + 1}</span>
                        <span className="font-bold text-gray-800">{item.query}</span>
                      </div>
                      <span className="bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-full text-[10px]">
                        {item.count} searches
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

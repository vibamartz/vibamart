import React, { useState, useEffect } from 'react';
import {
  Search, RefreshCw, Zap, TrendingUp, AlertTriangle,
  Pin, Sparkles, Sliders, Database, Trash2, Plus,
  CheckCircle, ArrowUpRight, BarChart3, Clock, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { searchApiClient } from '../../services/searchApiClient';

interface PinnedRule {
  query: string;
  productIds: string[];
}

interface BoostedRule {
  query: string;
  brand?: string;
  category?: string;
  boostFactor: number;
}

interface CurationConfig {
  pinnedRules: PinnedRule[];
  boostedRules: BoostedRule[];
  customSynonyms: string[][];
}

interface AnalyticsSummary {
  totalSearches: number;
  avgLatencyMs: number;
  zeroResultCount: number;
  zeroResultRate: number;
  topQueries: { query: string; count: number }[];
  zeroResultQueries: { query: string; count: number; lastSearched: string }[];
  recentEvents: any[];
}

export default function AdminSearchManagementView() {
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'curation' | 'synonyms'>('analytics');
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [savingCuration, setSavingCuration] = useState(false);

  // Status & Telemetry
  const [status, setStatus] = useState<any>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  // Curation Config
  const [curation, setCuration] = useState<CurationConfig>({
    pinnedRules: [],
    boostedRules: [],
    customSynonyms: []
  });

  // Form states
  const [newPinQuery, setNewPinQuery] = useState('');
  const [newPinProductIds, setNewPinProductIds] = useState('');

  const [newBoostQuery, setNewBoostQuery] = useState('');
  const [newBoostBrand, setNewBoostBrand] = useState('');
  const [newBoostCategory, setNewBoostCategory] = useState('');
  const [newBoostMultiplier, setNewBoostMultiplier] = useState(1.5);

  const [newSynonymsLine, setNewSynonymsLine] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, analyticsRes, curationRes] = await Promise.allSettled([
        searchApiClient.getStatus(),
        searchApiClient.getAnalyticsSummary(),
        searchApiClient.getCurationConfig()
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value.summary || null);
        if (analyticsRes.value.status) setStatus(analyticsRes.value.status);
      }
      if (curationRes.status === 'fulfilled' && curationRes.value) {
        setCuration({
          pinnedRules: curationRes.value.pinnedRules || [],
          boostedRules: curationRes.value.boostedRules || [],
          customSynonyms: curationRes.value.customSynonyms || []
        });
      }
    } catch (err: any) {
      toast.error('Failed to load search data: ' + (err.message || 'Error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReindex = async () => {
    try {
      setReindexing(true);
      const res = await searchApiClient.triggerReindex();
      toast.success(res.message || 'Catalog successfully reindexed!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reindex catalog');
    } finally {
      setReindexing(false);
    }
  };

  const handleSaveCuration = async (updatedConfig: CurationConfig) => {
    try {
      setSavingCuration(true);
      await searchApiClient.saveCurationConfig(updatedConfig);
      setCuration(updatedConfig);
      toast.success('Search curation rules updated successfully!');
    } catch (err: any) {
      toast.error('Failed to save curation: ' + err.message);
    } finally {
      setSavingCuration(false);
    }
  };

  // Add Pinned Rule
  const handleAddPinRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinQuery.trim() || !newPinProductIds.trim()) {
      toast.error('Please enter both query and product IDs');
      return;
    }

    const ids = newPinProductIds.split(',').map(s => s.trim()).filter(Boolean);
    const updated: CurationConfig = {
      ...curation,
      pinnedRules: [
        ...curation.pinnedRules.filter(r => r.query.toLowerCase() !== newPinQuery.toLowerCase().trim()),
        { query: newPinQuery.trim(), productIds: ids }
      ]
    };
    handleSaveCuration(updated);
    setNewPinQuery('');
    setNewPinProductIds('');
  };

  const handleDeletePinRule = (queryToRemove: string) => {
    const updated = {
      ...curation,
      pinnedRules: curation.pinnedRules.filter(r => r.query !== queryToRemove)
    };
    handleSaveCuration(updated);
  };

  // Add Boost Rule
  const handleAddBoostRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoostQuery.trim() || (!newBoostBrand.trim() && !newBoostCategory.trim())) {
      toast.error('Please specify query and at least a brand or category to boost');
      return;
    }

    const updated: CurationConfig = {
      ...curation,
      boostedRules: [
        ...curation.boostedRules,
        {
          query: newBoostQuery.trim(),
          brand: newBoostBrand.trim() || undefined,
          category: newBoostCategory.trim() || undefined,
          boostFactor: Number(newBoostMultiplier) || 1.5
        }
      ]
    };
    handleSaveCuration(updated);
    setNewBoostQuery('');
    setNewBoostBrand('');
    setNewBoostCategory('');
    setNewBoostMultiplier(1.5);
  };

  const handleDeleteBoostRule = (index: number) => {
    const updated = {
      ...curation,
      boostedRules: curation.boostedRules.filter((_, i) => i !== index)
    };
    handleSaveCuration(updated);
  };

  // Add Synonym Group
  const handleAddSynonymGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const terms = newSynonymsLine.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (terms.length < 2) {
      toast.error('Please enter at least 2 comma-separated terms (e.g. shoes, footwear, kicks)');
      return;
    }

    const updated: CurationConfig = {
      ...curation,
      customSynonyms: [...curation.customSynonyms, terms]
    };
    handleSaveCuration(updated);
    setNewSynonymsLine('');
  };

  const handleDeleteSynonymGroup = (index: number) => {
    const updated = {
      ...curation,
      customSynonyms: curation.customSynonyms.filter((_, i) => i !== index)
    };
    handleSaveCuration(updated);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Intelligent Search Engine</h1>
              <p className="text-xs text-gray-500">
                In-memory inverted index, typo tolerance, merchandising curation, and real-time query telemetry.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Database className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Reindexing Catalog...' : 'Reindex Catalog'}
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Catalog Status */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Search Engine</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {status?.totalIndexed ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {status?.isIndexing ? 'Active sync in progress' : 'Index healthy & live'}
          </p>
        </div>

        {/* Cache Performance */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">LRU Cache</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {status?.cache?.hitRate ?? '0%'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {status?.cache?.size ?? 0} cached queries ({status?.cache?.hits ?? 0} hits)
          </p>
        </div>

        {/* Average Latency */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {analytics?.avgLatencyMs ? `${analytics.avgLatencyMs} ms` : '< 8 ms'}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Fast sub-millisecond retrieval
          </p>
        </div>

        {/* Zero Result Rate */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Zero-Result Rate</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-gray-900">
            {analytics?.zeroResultRate ?? 0}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {analytics?.zeroResultCount ?? 0} queries with 0 results
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wider transition-colors ${
            activeSubTab === 'analytics'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Search Analytics & Telemetry
        </button>
        <button
          onClick={() => setActiveSubTab('curation')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wider transition-colors ${
            activeSubTab === 'curation'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Merchandising & Curation Rules ({curation.pinnedRules.length + curation.boostedRules.length})
        </button>
        <button
          onClick={() => setActiveSubTab('synonyms')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-xs tracking-wider transition-colors ${
            activeSubTab === 'synonyms'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Synonyms Dictionary ({curation.customSynonyms.length})
        </button>
      </div>

      {/* Sub-Tab 1: Analytics */}
      {activeSubTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Popular Queries */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Top Searched Queries
              </h3>
              <span className="text-xs text-gray-400">Total: {analytics?.totalSearches ?? 0} searches</span>
            </div>

            {(!analytics?.topQueries || analytics.topQueries.length === 0) ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                No search queries recorded yet. Perform searches in store to view telemetry!
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {analytics.topQueries.map((item, idx) => (
                  <div key={item.query} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-gray-400">#{idx + 1}</span>
                      <span className="text-xs font-medium text-gray-800">{item.query}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-600 rounded-full">
                        {item.count} searches
                      </span>
                      <button
                        onClick={() => {
                          setNewPinQuery(item.query);
                          setActiveSubTab('curation');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        title="Pin products for this query"
                      >
                        Pin <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zero-Result Queries */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Zero-Result Queries (Discovery Gaps)
              </h3>
              <span className="text-xs text-gray-400">Need synonyms or catalog additions</span>
            </div>

            {(!analytics?.zeroResultQueries || analytics.zeroResultQueries.length === 0) ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Zero discovery gaps recorded! All shopper queries have yielded products or recovered suggestions.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {analytics.zeroResultQueries.map((item) => (
                  <div key={item.query} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-rose-700">{item.query}</div>
                      <div className="text-[10px] text-gray-400">
                        {item.lastSearched ? new Date(item.lastSearched).toLocaleTimeString() : 'Recent'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-600 rounded-full">
                        {item.count} misses
                      </span>
                      <button
                        onClick={() => {
                          setNewSynonymsLine(`${item.query}, `);
                          setActiveSubTab('synonyms');
                        }}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      >
                        Add Synonym <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Curation (Pinning & Boosting) */}
      {activeSubTab === 'curation' && (
        <div className="space-y-6">
          {/* Pinned Products Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Pin className="w-4 h-4 text-primary" />
                  Product Pinning (Promoted to Top)
                </h3>
                <p className="text-xs text-gray-500">
                  Force specific products to appear at the very top of search results when users search for a keyword.
                </p>
              </div>
            </div>

            {/* Add Pin Form */}
            <form onSubmit={handleAddPinRule} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Search Query</label>
                <input
                  type="text"
                  placeholder="e.g. shoes, iphone, summer sale"
                  value={newPinQuery}
                  onChange={(e) => setNewPinQuery(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Product IDs (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. prod_123, prod_456"
                  value={newPinProductIds}
                  onChange={(e) => setNewPinProductIds(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={savingCuration}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Pin
                </button>
              </div>
            </form>

            {/* List Pinned Rules */}
            {curation.pinnedRules.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">No pinned rules active. Add a rule above.</p>
            ) : (
              <div className="space-y-2">
                {curation.pinnedRules.map((rule) => (
                  <div key={rule.query} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-gray-900 bg-primary/10 text-primary px-2 py-0.5 rounded-md mr-2">
                        "{rule.query}"
                      </span>
                      <span className="text-xs text-gray-600">
                        Pins: {rule.productIds.join(', ')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeletePinRule(rule.query)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Category & Brand Boosting Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Brand & Category Boosting
              </h3>
              <p className="text-xs text-gray-500">
                Multiply the relevance score of specific brands or categories when users enter matching search terms.
              </p>
            </div>

            {/* Add Boost Form */}
            <form onSubmit={handleAddBoostRule} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Search Query</label>
                <input
                  type="text"
                  placeholder="e.g. running, wireless"
                  value={newBoostQuery}
                  onChange={(e) => setNewBoostQuery(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Boost Brand (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Nike, Apple"
                  value={newBoostBrand}
                  onChange={(e) => setNewBoostBrand(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Boost Category ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. electronics, footwear"
                  value={newBoostCategory}
                  onChange={(e) => setNewBoostCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  max="5.0"
                  value={newBoostMultiplier}
                  onChange={(e) => setNewBoostMultiplier(parseFloat(e.target.value))}
                  className="w-full text-xs px-2 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={savingCuration}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Boost
                </button>
              </div>
            </form>

            {/* List Boost Rules */}
            {curation.boostedRules.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 text-center">No boosted rules active. Add a boost above.</p>
            ) : (
              <div className="space-y-2">
                {curation.boostedRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
                        "{rule.query}"
                      </span>
                      {rule.brand && (
                        <span className="text-xs text-gray-600">
                          Brand: <strong>{rule.brand}</strong>
                        </span>
                      )}
                      {rule.category && (
                        <span className="text-xs text-gray-600">
                          Category: <strong>{rule.category}</strong>
                        </span>
                      )}
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {rule.boostFactor}x boost
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteBoostRule(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Custom Synonyms */}
      {activeSubTab === 'synonyms' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Custom Synonym Equivalencies
            </h3>
            <p className="text-xs text-gray-500">
              Map interchangeable terms together so shoppers searching for "mobile" also find "phone", "smartphone", or "cellphone".
            </p>
          </div>

          {/* Add Synonym Form */}
          <form onSubmit={handleAddSynonymGroup} className="flex flex-col sm:flex-row gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Comma-separated Equivalent Terms
              </label>
              <input
                type="text"
                placeholder="e.g. earphones, earbuds, headphones, airpods"
                value={newSynonymsLine}
                onChange={(e) => setNewSynonymsLine(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="sm:self-end">
              <button
                type="submit"
                disabled={savingCuration}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Synonym Group
              </button>
            </div>
          </form>

          {/* List Synonyms */}
          {curation.customSynonyms.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">
              No custom synonyms defined yet. Built-in ecommerce domain synonyms are already active.
            </p>
          ) : (
            <div className="space-y-2">
              {curation.customSynonyms.map((group, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <Layers className="w-3.5 h-3.5 text-gray-400 mr-1" />
                    {group.map((term, tIdx) => (
                      <span key={tIdx} className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                        {term}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDeleteSynonymGroup(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

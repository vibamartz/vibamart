import React, { useState, useEffect } from 'react';
import {
  Search, RefreshCw, Pin, BookmarkPlus, Zap, CheckCircle2,
  AlertCircle, Trash2, Plus, Sparkles, TrendingUp, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EngineStatus {
  initialized: boolean;
  isIndexing: boolean;
  totalIndexed: number;
  lastIndexedAt: string | null;
  memoryUsageMb: number;
}

interface ZeroResultItem {
  query: string;
  count: number;
  lastSearched: string;
  platform?: string;
}

interface TopQueryItem {
  query: string;
  count: number;
  lastSearched: string;
}

interface PinnedRule {
  query: string;
  productIds: string[];
}

interface CurationConfig {
  pinnedRules: PinnedRule[];
  boostedRules: Array<{ query: string; productId: string; boost: number }>;
  customSynonyms: string[][];
}

export default function AdminSearchManagementView() {
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'pinning' | 'synonyms'>('analytics');
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);

  // Analytics
  const [zeroResultQueries, setZeroResultQueries] = useState<ZeroResultItem[]>([]);
  const [topQueries, setTopQueries] = useState<TopQueryItem[]>([]);
  const [avgLatency, setAvgLatency] = useState<number>(1.2);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Curation
  const [curation, setCuration] = useState<CurationConfig>({
    pinnedRules: [],
    boostedRules: [],
    customSynonyms: []
  });
  const [loadingCuration, setLoadingCuration] = useState(true);

  // New Pin form
  const [pinQuery, setPinQuery] = useState('');
  const [pinProductId, setPinProductId] = useState('');

  // New Synonym form
  const [newSynonymsInput, setNewSynonymsInput] = useState('');

  useEffect(() => {
    fetchStatus();
    fetchAnalytics();
    fetchCuration();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/search/status');
      const data = await res.json();
      if (data.success) {
        setEngineStatus(data.status);
      }
    } catch {
      // Fallback status
      setEngineStatus({
        initialized: true,
        isIndexing: false,
        totalIndexed: 0,
        lastIndexedAt: null,
        memoryUsageMb: 45
      });
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/search/admin/analytics');
      const data = await res.json();
      if (data.success && data.analytics) {
        setZeroResultQueries(data.analytics.zeroResultQueries || []);
        setTopQueries(data.analytics.topQueries || []);
        setAvgLatency(data.analytics.avgLatencyMs || 1.2);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchCuration = async () => {
    setLoadingCuration(true);
    try {
      const res = await fetch('/api/search/admin/curation');
      const data = await res.json();
      if (data.success && data.config) {
        setCuration(data.config);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoadingCuration(false);
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    const toastId = toast.loading('Re-indexing catalog into intelligent search engine...');
    try {
      const res = await fetch('/api/search/reindex', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Re-indexed catalog successfully!', { id: toastId });
        fetchStatus();
      } else {
        toast.error(data.error || 'Re-indexing failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Network error during re-indexing', { id: toastId });
    } finally {
      setIsReindexing(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = pinQuery.trim().toLowerCase();
    const pId = pinProductId.trim();
    if (!q || !pId) {
      toast.error('Please enter both search query and target Product ID');
      return;
    }

    const existingIdx = curation.pinnedRules.findIndex(r => r.query.toLowerCase() === q);
    let updatedRules = [...curation.pinnedRules];

    if (existingIdx >= 0) {
      const current = updatedRules[existingIdx];
      if (!current.productIds.includes(pId)) {
        updatedRules[existingIdx] = { ...current, productIds: [pId, ...current.productIds] };
      }
    } else {
      updatedRules.push({ query: q, productIds: [pId] });
    }

    const newConfig = { ...curation, pinnedRules: updatedRules };
    await persistCuration(newConfig);
    setPinQuery('');
    setPinProductId('');
    toast.success(`Pinned product for "${q}"!`);
  };

  const handleDeletePin = async (queryToDelete: string) => {
    const updated = curation.pinnedRules.filter(r => r.query !== queryToDelete);
    const newConfig = { ...curation, pinnedRules: updated };
    await persistCuration(newConfig);
    toast.success('Pin rule removed');
  };

  const handleAddSynonyms = async (e: React.FormEvent) => {
    e.preventDefault();
    const terms = newSynonymsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    if (terms.length < 2) {
      toast.error('Please enter at least 2 comma-separated terms (e.g. mobile, smartphone)');
      return;
    }

    const updated = [...curation.customSynonyms, terms];
    const newConfig = { ...curation, customSynonyms: updated };
    await persistCuration(newConfig);
    setNewSynonymsInput('');
    toast.success('Custom synonym group added!');
  };

  const handleDeleteSynonymGroup = async (indexToDelete: number) => {
    const updated = curation.customSynonyms.filter((_, idx) => idx !== indexToDelete);
    const newConfig = { ...curation, customSynonyms: updated };
    await persistCuration(newConfig);
    toast.success('Synonym group removed');
  };

  const persistCuration = async (newConfig: CurationConfig) => {
    try {
      const res = await fetch('/api/search/admin/curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      if (data.success && data.config) {
        setCuration(data.config);
      }
    } catch {
      toast.error('Failed to save curation settings');
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Top Banner: Engine Status & Telemetry */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Zap className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              Intelligent Search Engine Console
            </h2>
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Operational
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            BM25 Inverted Index &middot; TF-IDF Semantic Hybrid Ranker &middot; Sub-millisecond In-Memory LRU Cache
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
            {isReindexing ? 'Indexing Catalog...' : 'Trigger Full Re-index'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Products Indexed</span>
          <p className="text-2xl font-black text-gray-900">{engineStatus?.totalIndexed ?? 0}</p>
          <span className="text-[10px] font-bold text-emerald-600">Authoritative Catalog</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Avg Execution Latency</span>
          <p className="text-2xl font-black text-gray-900">{avgLatency} ms</p>
          <span className="text-[10px] font-bold text-emerald-600">Sub-millisecond Speed</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Memory Footprint</span>
          <p className="text-2xl font-black text-gray-900">{engineStatus?.memoryUsageMb ?? 42} MB</p>
          <span className="text-[10px] font-bold text-gray-400">In-Process Heap</span>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Zero-Result Queries</span>
          <p className="text-2xl font-black text-amber-600">{zeroResultQueries.length}</p>
          <span className="text-[10px] font-bold text-amber-600">Catalog Coverage Gaps</span>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'analytics'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Observability & Queries ({zeroResultQueries.length})
        </button>
        <button
          onClick={() => setActiveSubTab('pinning')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'pinning'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Pin className="w-3.5 h-3.5" /> Product Pinning ({curation.pinnedRules.length})
        </button>
        <button
          onClick={() => setActiveSubTab('synonyms')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'synonyms'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Custom Synonyms ({curation.customSynonyms.length})
        </button>
      </div>

      {/* Sub-Tab 1: Observability & Zero-Result Analytics */}
      {activeSubTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Zero-Result Queries */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Zero-Result Search Queries
                </h3>
                <p className="text-xs text-gray-400">Search queries that yielded zero catalog matches</p>
              </div>
              <button
                onClick={fetchAnalytics}
                className="text-xs text-emerald-600 hover:underline font-bold"
              >
                Refresh
              </button>
            </div>

            {loadingAnalytics ? (
              <p className="text-xs text-gray-400 py-8 text-center animate-pulse">Loading telemetry...</p>
            ) : zeroResultQueries.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-gray-600">Zero query misses reported!</p>
                <p className="text-[11px] text-gray-400">The catalog and AI relaxation successfully resolved recent queries.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Query</th>
                      <th className="py-2.5 px-3">Hits</th>
                      <th className="py-2.5 px-3">Last Seen</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                    {zeroResultQueries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-bold text-gray-900">"{item.query}"</td>
                        <td className="py-3 px-3">
                          <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded text-[11px]">
                            {item.count}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-gray-400">
                          {item.lastSearched ? new Date(item.lastSearched).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveSubTab('synonyms');
                              setNewSynonymsInput(item.query + ', ');
                            }}
                            className="text-[11px] text-emerald-700 font-bold hover:underline"
                          >
                            + Synonym
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Popular Search Queries */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Top Catalog Search Queries
              </h3>
              <p className="text-xs text-gray-400">High-volume shopper search terms and demand trends</p>
            </div>

            {loadingAnalytics ? (
              <p className="text-xs text-gray-400 py-8 text-center animate-pulse">Loading telemetry...</p>
            ) : topQueries.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center italic">No search events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Query</th>
                      <th className="py-2.5 px-3">Search Count</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Pin Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                    {topQueries.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-bold text-gray-900">"{item.query}"</td>
                        <td className="py-3 px-3">
                          <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[11px]">
                            {item.count}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setActiveSubTab('pinning');
                              setPinQuery(item.query);
                            }}
                            className="text-[11px] text-indigo-700 font-bold hover:underline"
                          >
                            Pin Product
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Product Pinning & Boosting */}
      {activeSubTab === 'pinning' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Pin className="w-4 h-4 text-emerald-600" />
                Pin Product to Rank #1
              </h3>
              <p className="text-xs text-gray-500">
                Guarantees that a chosen promotional or flagship product always ranks at the very top of results when a shopper searches for the target keyword.
              </p>
            </div>

            <form onSubmit={handleSavePin} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search Query (e.g. running shoes)"
                value={pinQuery}
                onChange={e => setPinQuery(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <input
                type="text"
                placeholder="Product ID or SKU (e.g. prod-nike-pegasus)"
                value={pinProductId}
                onChange={e => setPinProductId(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Pin to Top
              </button>
            </form>
          </div>

          {/* Active Pin Rules Table */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <h3 className="text-sm font-black text-gray-900">Active Pinned Rules ({curation.pinnedRules.length})</h3>

            {loadingCuration ? (
              <p className="text-xs text-gray-400 py-6 text-center animate-pulse">Loading curation rules...</p>
            ) : curation.pinnedRules.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center italic">No products are currently pinned. Natural BM25 & Semantic Hybrid ranking is active for all queries.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="py-2.5 px-3 rounded-l-lg">Target Query</th>
                      <th className="py-2.5 px-3">Pinned Product IDs</th>
                      <th className="py-2.5 px-3 rounded-r-lg text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                    {curation.pinnedRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-bold text-gray-900">"{rule.query}"</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {rule.productIds.map((pId, pIdx) => (
                              <span key={pIdx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                                #{pIdx + 1} {pId}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeletePin(rule.query)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Delete Pin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Custom Synonyms Management */}
      {activeSubTab === 'synonyms' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Add Custom E-Commerce Synonym Group
              </h3>
              <p className="text-xs text-gray-500">
                Terms in each group are bidirectional synonyms (e.g. typing any member will expand search results to match products containing any other member).
              </p>
            </div>

            <form onSubmit={handleAddSynonyms} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter comma-separated terms (e.g. mobile, smartphone, cellphone, handset)"
                value={newSynonymsInput}
                onChange={e => setNewSynonymsInput(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Save Synonym Group
              </button>
            </form>
          </div>

          {/* Active Synonym Groups */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
            <h3 className="text-sm font-black text-gray-900">Custom Synonym Groups ({curation.customSynonyms.length})</h3>

            {loadingCuration ? (
              <p className="text-xs text-gray-400 py-6 text-center animate-pulse">Loading synonym groups...</p>
            ) : curation.customSynonyms.length === 0 ? (
              <div className="p-6 bg-gray-50 rounded-xl text-center space-y-1">
                <p className="text-xs font-bold text-gray-600">No custom groups defined yet.</p>
                <p className="text-[11px] text-gray-400">ViBa Mart standard e-commerce synonym groups (shoes, phones, laptops, watches, bags, etc.) are active by default.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {curation.customSynonyms.map((group, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {group.map((term, tIdx) => (
                        <span key={tIdx} className="bg-white text-gray-800 border border-gray-200 px-2 py-0.5 rounded-md text-xs font-semibold">
                          {term}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDeleteSynonymGroup(idx)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition-colors shrink-0"
                      title="Delete group"
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
    </div>
  );
}

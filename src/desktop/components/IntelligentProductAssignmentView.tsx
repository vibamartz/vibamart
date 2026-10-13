import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Category, VisualNestedSubcategory, FlatCategoryNode, IntelligentProductMatch } from '../../shared/types';
import { useVisualNestedSubcategoryStore } from '../../backend/store';
import { flattenCategoryHierarchy, searchCategoryHierarchy, isProductAssignedToNode } from '../../shared/utilities/categoryHierarchyUtils';
import { IntelligentProductMatcher } from '../../shared/utilities/intelligentProductMatcher';
import { assignProductsToCategoryNodes, removeProductFromCategoryNode, batchRemoveProductsFromCategoryNode } from '../../backend/services/productAssignmentService';
import toast from 'react-hot-toast';
import {
  Wand2, Search, Filter, CheckSquare, Square, Layers, ChevronRight,
  Package, Tag, Sparkles, Check, ArrowRight, RotateCcw,
  SlidersHorizontal, CheckCircle2, AlertCircle, Trash2, Eye, ShieldCheck,
  ChevronDown, ExternalLink, HelpCircle
} from 'lucide-react';

interface IntelligentProductAssignmentViewProps {
  initialTargetKey?: string;
  onNavigateBack?: () => void;
}

export default function IntelligentProductAssignmentView({
  initialTargetKey,
  onNavigateBack
}: IntelligentProductAssignmentViewProps) {
  // --- Data States ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { items: visualNestedItems } = useVisualNestedSubcategoryStore();
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // --- Category Explorer & Destination State ---
  const [selectedDestinationKeys, setSelectedDestinationKeys] = useState<string[]>(() =>
    initialTargetKey ? [initialTargetKey] : []
  );
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryLevelFilter, setCategoryLevelFilter] = useState<'all' | 'category' | 'subcategory' | 'nested_subcategory' | 'visual_nested_subcategory'>('all');

  // --- Inventory & Product Selector State ---
  const [activeCatalogTab, setActiveCatalogTab] = useState<'smart_suggestions' | 'catalog' | 'assigned'>('smart_suggestions');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [filterExistingCategory, setFilterExistingCategory] = useState('all');
  const [filterPriceRange, setFilterPriceRange] = useState<number>(50000);
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [exemplarProductId, setExemplarProductId] = useState<string | null>(null);

  // --- Assignment Options & Confirmation ---
  const [preserveExistingAssignments, setPreserveExistingAssignments] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedSummary, setLastSavedSummary] = useState<string | null>(null);

  // 1. Subscribe to Categories
  useEffect(() => {
    const q = collection(db, 'categories');
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setCategories(list);
      setLoadingCategories(false);
    }, (err) => {
      console.error('Failed to load categories:', err);
      toast.error('Failed to load categories');
      setLoadingCategories(false);
    });
    return () => unsub();
  }, []);

  // 2. Subscribe to Products
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(list);
      setLoadingProducts(false);
    }, (err) => {
      console.error('Failed to load products:', err);
      toast.error('Failed to load products');
      setLoadingProducts(false);
    });
    return () => unsub();
  }, []);

  // Flattened hierarchy nodes
  const flatNodes = useMemo(() => {
    return flattenCategoryHierarchy(categories, visualNestedItems, products);
  }, [categories, visualNestedItems, products]);

  // Set default destination if none selected
  useEffect(() => {
    if (selectedDestinationKeys.length === 0 && flatNodes.length > 0) {
      if (initialTargetKey && flatNodes.some(n => n.key === initialTargetKey)) {
        setSelectedDestinationKeys([initialTargetKey]);
      } else {
        // Default to first subcategory or category
        const defaultNode = flatNodes.find(n => n.level === 'subcategory') || flatNodes[0];
        if (defaultNode) {
          setSelectedDestinationKeys([defaultNode.key]);
        }
      }
    }
  }, [flatNodes, initialTargetKey, selectedDestinationKeys.length]);

  // Active primary destination node
  const activePrimaryDestinationNode = useMemo(() => {
    if (selectedDestinationKeys.length === 0) return null;
    return flatNodes.find(n => n.key === selectedDestinationKeys[0]) || null;
  }, [selectedDestinationKeys, flatNodes]);

  // Filtered Category Nodes for Explorer
  const filteredCategoryNodes = useMemo(() => {
    let list = flatNodes;
    if (categoryLevelFilter !== 'all') {
      list = list.filter(n => n.level === categoryLevelFilter);
    }
    if (categorySearchQuery.trim()) {
      list = searchCategoryHierarchy(list, categorySearchQuery);
    }
    return list;
  }, [flatNodes, categoryLevelFilter, categorySearchQuery]);

  // Products currently assigned to active destination
  const currentlyAssignedProducts = useMemo(() => {
    if (!activePrimaryDestinationNode) return [];
    return products.filter(p => isProductAssignedToNode(p, activePrimaryDestinationNode, visualNestedItems));
  }, [products, activePrimaryDestinationNode, visualNestedItems]);

  // Unique brands in inventory for filter dropdown
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.brand && p.brand.trim()) brands.add(p.brand.trim());
    });
    return Array.from(brands).sort();
  }, [products]);

  // Smart suggestions for the destination category
  const smartSuggestions = useMemo(() => {
    if (!activePrimaryDestinationNode) return [];

    return IntelligentProductMatcher.matchProductsForCategory(
      activePrimaryDestinationNode,
      products,
      {
        threshold: 25,
        userSearchQuery: productSearchQuery,
        exemplarProducts: currentlyAssignedProducts
      }
    );
  }, [activePrimaryDestinationNode, products, productSearchQuery, currentlyAssignedProducts]);

  // Filtered Catalog products for catalog tab
  const filteredCatalogProducts = useMemo(() => {
    return products.filter(p => {
      // Search query
      if (productSearchQuery.trim()) {
        const q = productSearchQuery.toLowerCase().trim();
        const str = [p.name, p.brand, p.sku, p.productCode, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
        if (!str.includes(q)) return false;
      }
      // Brand filter
      if (filterBrand !== 'all' && p.brand !== filterBrand) return false;
      // Stock status filter
      if (filterStockStatus === 'in_stock' && (p.stock <= 0 || p.status === 'out_of_stock')) return false;
      if (filterStockStatus === 'out_of_stock' && p.stock > 0 && p.status !== 'out_of_stock') return false;
      // Existing category filter
      if (filterExistingCategory !== 'all' && p.categoryId !== filterExistingCategory) return false;
      // Price range filter
      const price = p.discountPrice || p.price || 0;
      if (price > filterPriceRange) return false;
      // Assignment status filter
      if (activePrimaryDestinationNode) {
        const isAssigned = isProductAssignedToNode(p, activePrimaryDestinationNode, visualNestedItems);
        if (filterAssignmentStatus === 'assigned' && !isAssigned) return false;
        if (filterAssignmentStatus === 'unassigned' && isAssigned) return false;
      }

      return true;
    });
  }, [products, productSearchQuery, filterBrand, filterStockStatus, filterExistingCategory, filterPriceRange, filterAssignmentStatus, activePrimaryDestinationNode, visualNestedItems]);

  // Toggle selection of product ID
  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select all smart suggestions
  const handleSelectAllHighMatches = () => {
    const highMatchIds = smartSuggestions
      .filter(m => m.score >= 50 && !m.isAlreadyAssigned)
      .map(m => m.product.id);
    setSelectedProductIds(prev => Array.from(new Set([...prev, ...highMatchIds])));
    toast.success(`Selected ${highMatchIds.length} high-confidence matching products`);
  };

  const handleSelectAllFilteredCatalog = () => {
    const unassignedIds = filteredCatalogProducts
      .filter(p => !activePrimaryDestinationNode || !isProductAssignedToNode(p, activePrimaryDestinationNode, visualNestedItems))
      .map(p => p.id);
    setSelectedProductIds(prev => Array.from(new Set([...prev, ...unassignedIds])));
    toast.success(`Selected ${unassignedIds.length} catalog products`);
  };

  const handleClearSelectedProducts = () => {
    setSelectedProductIds([]);
  };

  // Handle single product quick assign
  const handleQuickAssignSingle = async (product: Product) => {
    if (!activePrimaryDestinationNode) return;
    const toastId = toast.loading(`Assigning "${product.name}"...`);
    try {
      await assignProductsToCategoryNodes(
        [product.id],
        [activePrimaryDestinationNode],
        { preserveExisting: preserveExistingAssignments }
      );
      toast.success(`Assigned "${product.name}" to ${activePrimaryDestinationNode.breadcrumb}!`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to assign product', { id: toastId });
    }
  };

  // Handle single product unassign
  const handleUnassignSingle = async (product: Product) => {
    if (!activePrimaryDestinationNode) return;
    const toastId = toast.loading(`Removing "${product.name}"...`);
    try {
      await removeProductFromCategoryNode(product, activePrimaryDestinationNode);
      toast.success(`Removed from ${activePrimaryDestinationNode.breadcrumb}. Product remains safely in inventory.`, { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to unassign product', { id: toastId });
    }
  };

  // Handle batch assignment execution
  const handleExecuteBatchAssignment = async () => {
    if (selectedProductIds.length === 0 || selectedDestinationKeys.length === 0) return;

    const targetNodes = selectedDestinationKeys
      .map(k => flatNodes.find(n => n.key === k))
      .filter(Boolean) as FlatCategoryNode[];

    if (targetNodes.length === 0) {
      toast.error('Please select at least one destination category.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(`Assigning ${selectedProductIds.length} product(s)...`);

    try {
      const res = await assignProductsToCategoryNodes(
        selectedProductIds,
        targetNodes,
        { preserveExisting: preserveExistingAssignments }
      );

      const destSummary = targetNodes.map(n => n.name).join(', ');
      const msg = `Successfully assigned ${selectedProductIds.length} product(s) to [${destSummary}]`;
      setLastSavedSummary(msg);
      toast.success(msg, { id: toastId });
      setSelectedProductIds([]);
      setShowConfirmModal(false);
    } catch (err: any) {
      console.error('Assignment error:', err);
      toast.error(err.message || 'Failed to assign products', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* Top Banner / Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -mb-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-bold uppercase tracking-wider">
              <Wand2 className="w-3.5 h-3.5 text-purple-300" />
              Smart Inventory Assignment
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Intelligent Product Assignment
            </h1>
            <p className="text-sm text-purple-200/80 leading-relaxed font-medium">
              Select existing inventory products and assign them to any category, subcategory, nested subcategory, or visual showcase card. Products are safely linked with full data integrity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
              >
                Back to Categories
              </button>
            )}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-5 py-3 border border-white/15 flex items-center gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-300 block">Inventory</span>
                <span className="text-lg font-black text-white">{products.length} Products</span>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-300 block">Categories</span>
                <span className="text-lg font-black text-white">{flatNodes.length} Levels</span>
              </div>
            </div>
          </div>
        </div>

        {lastSavedSummary && (
          <div className="mt-5 p-3.5 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{lastSavedSummary}</span>
            </div>
            <button
              type="button"
              onClick={() => setLastSavedSummary(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT PANEL: Category Hierarchy Destination ================= */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                1
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">Destination Category</h2>
                <p className="text-xs text-gray-500">Choose target category, subcategory, or showcase</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              {filteredCategoryNodes.length} Nodes
            </span>
          </div>

          {/* Search Category */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={categorySearchQuery}
              onChange={e => setCategorySearchQuery(e.target.value)}
              placeholder="Filter categories, subcategories, or showcases..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:bg-white focus:border-purple-500 outline-none transition-all"
            />
            {categorySearchQuery && (
              <button
                type="button"
                onClick={() => setCategorySearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Level Filter Chips */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            {[
              { id: 'all', label: 'All Levels' },
              { id: 'category', label: 'Main' },
              { id: 'subcategory', label: 'Subcategory' },
              { id: 'nested_subcategory', label: 'Nested' },
              { id: 'visual_nested_subcategory', label: 'Showcase' }
            ].map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCategoryLevelFilter(chip.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  categoryLevelFilter === chip.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Selected Destination Card */}
          {activePrimaryDestinationNode && (
            <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50/50 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md mb-1 ${
                    activePrimaryDestinationNode.level === 'visual_nested_subcategory'
                      ? 'bg-emerald-600 text-white'
                      : activePrimaryDestinationNode.level === 'nested_subcategory'
                      ? 'bg-indigo-600 text-white'
                      : activePrimaryDestinationNode.level === 'subcategory'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-white'
                  }`}>
                    {activePrimaryDestinationNode.levelLabel}
                  </span>
                  <h3 className="text-sm font-black text-gray-900 truncate">
                    {activePrimaryDestinationNode.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                    {activePrimaryDestinationNode.breadcrumb}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg block">
                    {currentlyAssignedProducts.length} Assigned
                  </span>
                </div>
              </div>

              {/* Assignment Mode Toggle */}
              <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-gray-800 block">Preserve Existing Categories</span>
                  <span className="text-[10px] text-gray-500 block">
                    {preserveExistingAssignments
                      ? 'Product will belong to this category while keeping its current categories intact.'
                      : 'Product primary category will be replaced with this destination.'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={preserveExistingAssignments}
                    onChange={e => setPreserveExistingAssignments(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* Dynamic Hierarchy Node Tree List */}
          <div className="border border-gray-200 rounded-2xl max-h-[500px] overflow-y-auto divide-y divide-gray-100 shadow-2xs">
            {filteredCategoryNodes.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 font-medium">
                No matching categories found.
              </div>
            ) : (
              filteredCategoryNodes.map(node => {
                const isSelected = selectedDestinationKeys.includes(node.key);
                return (
                  <div
                    key={node.key}
                    onClick={() => setSelectedDestinationKeys([node.key])}
                    className={`p-3 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50/80 border-l-4 border-l-purple-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="shrink-0">
                        <input
                          type="radio"
                          name="destinationCategory"
                          checked={isSelected}
                          onChange={() => setSelectedDestinationKeys([node.key])}
                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {node.name}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm ${
                            node.level === 'visual_nested_subcategory'
                              ? 'bg-emerald-100 text-emerald-800'
                              : node.level === 'nested_subcategory'
                              ? 'bg-indigo-100 text-indigo-800'
                              : node.level === 'subcategory'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {node.levelLabel}
                          </span>
                          {node.offerText && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                              {node.offerText}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {node.breadcrumb}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">
                        {node.assignedProductCount}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT PANEL: Product Selector & Smart Suggestions ================= */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                2
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">Select Inventory Products</h2>
                <p className="text-xs text-gray-500">Discover smart suggestions or browse entire catalog</p>
              </div>
            </div>

            {/* Selection Counter & Clear */}
            {selectedProductIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl border border-purple-200">
                  {selectedProductIds.length} Selected
                </span>
                <button
                  type="button"
                  onClick={handleClearSelectedProducts}
                  className="text-xs font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <button
              type="button"
              onClick={() => setActiveCatalogTab('smart_suggestions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCatalogTab === 'smart_suggestions'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Suggestions ({smartSuggestions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCatalogTab('catalog')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCatalogTab === 'catalog'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Full Catalog ({filteredCatalogProducts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCatalogTab('assigned')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCatalogTab === 'assigned'
                  ? 'bg-gray-800 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Currently Assigned ({currentlyAssignedProducts.length})</span>
            </button>
          </div>

          {/* Product Search & Advanced Filter Controls */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={e => setProductSearchQuery(e.target.value)}
                placeholder="Search products by title, SKU, brand, tags, or 12-digit code..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:bg-white focus:border-indigo-500 outline-none transition-all"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Catalog Filter Dropdowns (Visible in Catalog Tab) */}
            {activeCatalogTab === 'catalog' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Brand</label>
                  <select
                    value={filterBrand}
                    onChange={e => setFilterBrand(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="all">All Brands ({uniqueBrands.length})</option>
                    {uniqueBrands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Stock Status</label>
                  <select
                    value={filterStockStatus}
                    onChange={e => setFilterStockStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="all">All Inventory</option>
                    <option value="in_stock">In Stock Only</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Current Category</label>
                  <select
                    value={filterExistingCategory}
                    onChange={e => setFilterExistingCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Assignment</label>
                  <select
                    value={filterAssignmentStatus}
                    onChange={e => setFilterAssignmentStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  >
                    <option value="all">All Products</option>
                    <option value="unassigned">Unassigned Only</option>
                    <option value="assigned">Already Assigned</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Buttons per Tab */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {activeCatalogTab === 'smart_suggestions' && (
              <>
                <span className="text-gray-500 font-medium">
                  Automatically scored based on category keywords, tags, specifications & exemplar items.
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllHighMatches}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold cursor-pointer transition-colors"
                >
                  Select High Matches (&ge;50%)
                </button>
              </>
            )}

            {activeCatalogTab === 'catalog' && (
              <>
                <span className="text-gray-500 font-medium">
                  Showing <strong>{filteredCatalogProducts.length}</strong> catalog products.
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllFilteredCatalog}
                  className="px-3 py-1.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold cursor-pointer transition-colors"
                >
                  Select All Filtered Unassigned
                </button>
              </>
            )}

            {activeCatalogTab === 'assigned' && (
              <span className="text-gray-500 font-medium">
                Products currently assigned to <strong>{activePrimaryDestinationNode?.name || 'this category'}</strong>. You can unassign any product with 1 click.
              </span>
            )}
          </div>

          {/* ================= TAB 1: SMART SUGGESTIONS LIST ================= */}
          {activeCatalogTab === 'smart_suggestions' && (
            <div className="border border-gray-200 rounded-2xl max-h-[550px] overflow-y-auto divide-y divide-gray-100 shadow-2xs">
              {smartSuggestions.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 font-medium space-y-2">
                  <p>No intelligent suggestions found with current threshold.</p>
                  <p className="text-[11px] text-gray-400">Try switching to the "Full Catalog" tab to browse and assign products manually.</p>
                </div>
              ) : (
                smartSuggestions.map(match => {
                  const p = match.product;
                  const isSelected = selectedProductIds.includes(p.id);
                  const isAlready = match.isAlreadyAssigned;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 transition-colors flex items-center justify-between gap-3 ${
                        isAlready ? 'bg-emerald-50/20' : isSelected ? 'bg-purple-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          disabled={isAlready}
                          checked={isSelected || isAlready}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 disabled:opacity-40 cursor-pointer"
                        />
                        <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                          {(p.images?.[0] || p.primaryImage) ? (
                            <img src={p.images?.[0] || p.primaryImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 truncate">
                              {p.name}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              match.score >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : match.score >= 50
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {match.score}% Match • {match.confidence.toUpperCase()}
                            </span>
                            {p.stock <= 0 && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                                Out of Stock
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                            <span>₹{p.discountPrice || p.price}</span>
                            {p.sku && <span>• SKU: {p.sku}</span>}
                            {p.brand && <span>• {p.brand}</span>}
                            <span>• Stock: {p.stock}</span>
                          </div>

                          {/* Matching Reasons */}
                          <div className="text-[10px] text-purple-700 mt-1 font-medium truncate">
                            Reason: {match.reasons[0] || 'Aligned with category parameters'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isAlready ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-xl">
                            Assigned
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickAssignSingle(p)}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ================= TAB 2: FULL CATALOG LIST ================= */}
          {activeCatalogTab === 'catalog' && (
            <div className="border border-gray-200 rounded-2xl max-h-[550px] overflow-y-auto divide-y divide-gray-100 shadow-2xs">
              {filteredCatalogProducts.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 font-medium">
                  No catalog products match current filters.
                </div>
              ) : (
                filteredCatalogProducts.map(p => {
                  const isSelected = selectedProductIds.includes(p.id);
                  const isAlready = activePrimaryDestinationNode
                    ? isProductAssignedToNode(p, activePrimaryDestinationNode, visualNestedItems)
                    : false;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 transition-colors flex items-center justify-between gap-3 ${
                        isAlready ? 'bg-emerald-50/20' : isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          disabled={isAlready}
                          checked={isSelected || isAlready}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer"
                        />
                        <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                          {(p.images?.[0] || p.primaryImage) ? (
                            <img src={p.images?.[0] || p.primaryImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 truncate">
                              {p.name}
                            </span>
                            {p.stock <= 0 && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">
                                Out of Stock
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                            ₹{p.discountPrice || p.price} {p.sku ? `• SKU: ${p.sku}` : ''} {p.brand ? `• ${p.brand}` : ''} • Stock: {p.stock}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAlready ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-xl">
                            Assigned
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickAssignSingle(p)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            Assign
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ================= TAB 3: CURRENTLY ASSIGNED PRODUCTS ================= */}
          {activeCatalogTab === 'assigned' && (
            <div className="border border-gray-200 rounded-2xl max-h-[550px] overflow-y-auto divide-y divide-gray-100 shadow-2xs">
              {currentlyAssignedProducts.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 font-medium">
                  No products currently assigned to this category. Select products from Smart Suggestions or Catalog to assign them.
                </div>
              ) : (
                currentlyAssignedProducts.map(p => (
                  <div
                    key={p.id}
                    className="p-3.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                        {(p.images?.[0] || p.primaryImage) ? (
                          <img src={p.images?.[0] || p.primaryImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          ₹{p.discountPrice || p.price} {p.sku ? `• SKU: ${p.sku}` : ''} {p.brand ? `• ${p.brand}` : ''} • Stock: {p.stock}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUnassignSingle(p)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= FLOATING ACTION DOCK (When Products Selected) ================= */}
      {selectedProductIds.length > 0 && activePrimaryDestinationNode && (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-8 sm:max-w-xl z-50 bg-gray-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-3xl shadow-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5">
          <div className="min-w-0 space-y-1 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-500 text-white">
                {selectedProductIds.length} Products Selected
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-purple-300" />
              <span className="text-xs font-bold text-purple-200 truncate max-w-[200px]">
                {activePrimaryDestinationNode.name}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              Destination: {activePrimaryDestinationNode.breadcrumb}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearSelectedProducts}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              Review & Assign ({selectedProductIds.length})
            </button>
          </div>
        </div>
      )}

      {/* ================= CONFIRMATION MODAL ================= */}
      {showConfirmModal && activePrimaryDestinationNode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">Confirm Product Assignment</h3>
                  <p className="text-xs text-gray-500">Verify destination and selected products</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Destination Summary Box */}
            <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-2">
              <span className="text-[10px] font-black uppercase text-purple-700 block">Target Destination</span>
              <div className="text-sm font-black text-gray-900">{activePrimaryDestinationNode.name}</div>
              <div className="text-xs text-gray-500 font-medium">{activePrimaryDestinationNode.breadcrumb}</div>
              <div className="text-[11px] text-purple-800 font-bold pt-1">
                Level: {activePrimaryDestinationNode.levelLabel}
              </div>
            </div>

            {/* Assignment Mode Explanation */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
              <div className="font-bold text-gray-800">
                Mode: {preserveExistingAssignments ? 'Preserve Existing Assignments' : 'Replace Primary Category'}
              </div>
              <p className="text-[11px] text-gray-500">
                {preserveExistingAssignments
                  ? 'Products will be linked to this destination while preserving their current categories. Existing inventory, variants, SKU, and prices remain intact.'
                  : 'Product primary category will be set to this destination. Pricing, stock, and descriptions remain untouched.'}
              </p>
            </div>

            {/* Selected Products Preview List */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-gray-700">
                Selected Products ({selectedProductIds.length}):
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl p-2 text-xs">
                {selectedProductIds.map(id => {
                  const prod = products.find(p => p.id === id);
                  if (!prod) return null;
                  return (
                    <div key={id} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-800">{prod.name}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">₹{prod.discountPrice || prod.price}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleExecuteBatchAssignment}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-purple-200 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Assigning...</span>
                  </>
                ) : (
                  <span>Confirm & Deploy ({selectedProductIds.length})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

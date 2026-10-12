import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, FlatCategoryNode, Category, VisualNestedSubcategory, IntelligentProductMatch, MatchConfidence } from '../../shared/types';
import { useCategoryStore, useVisualNestedSubcategoryStore } from '../../backend/store';
import { flattenCategoryHierarchy, filterCategoryNodes, isProductAssignedToNode } from '../../shared/utilities/categoryHierarchyUtils';
import { IntelligentProductMatcher } from '../../shared/utilities/intelligentProductMatcher';
import { assignProductsToHierarchyNode, unassignProductsFromHierarchyNode } from '../../backend/services/intelligentProductAssignmentService';
import { formatProductCode } from '../../shared/utilities/productCode';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wand2, Sparkles, Search, Filter, Layers, CheckSquare, Square,
  Check, X, AlertCircle, ChevronDown, ChevronRight, CornerDownRight,
  Package, ShoppingBag, ShieldCheck, Tag, ArrowRight, RefreshCw,
  Eye, CheckCircle2, Sliders, ExternalLink, Info, HelpCircle
} from 'lucide-react';
import CategoryLogo from '../../shared/components/CategoryLogo';

interface IntelligentProductAssignmentViewProps {
  initialTargetKey?: string;
  onNavigateBack?: () => void;
}

export default function IntelligentProductAssignmentView({
  initialTargetKey,
  onNavigateBack
}: IntelligentProductAssignmentViewProps) {
  const { categories, loading: categoriesLoading } = useCategoryStore();
  const { items: visualItems, loading: visualLoading } = useVisualNestedSubcategoryStore();

  // All catalog products from Firestore
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Target category selection
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryLevelFilter, setCategoryLevelFilter] = useState<string>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Matching & Filtering options
  const [activeTab, setActiveTab] = useState<'suggestions' | 'assigned' | 'all_catalog'>('suggestions');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [threshold, setThreshold] = useState<number>(40);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [filterAlreadyAssigned, setFilterAlreadyAssigned] = useState<boolean>(false);
  const [preserveExistingAssignments, setPreserveExistingAssignments] = useState<boolean>(true);
  const [expandedReasonProductId, setExpandedReasonProductId] = useState<string | null>(null);

  // Selected products for bulk action
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isExecutingAssignment, setIsExecutingAssignment] = useState(false);
  const [isExecutingUnassignment, setIsExecutingUnassignment] = useState(false);

  // Real-time products subscription
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setAllProducts(prods);
        setLoadingProducts(false);
      },
      (error) => {
        console.error('Failed to load products in intelligent assignment:', error);
        toast.error('Failed to load inventory products.');
        setLoadingProducts(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute unified flattened category hierarchy
  const allCategoryNodes = useMemo(() => {
    return flattenCategoryHierarchy(categories, visualItems, allProducts);
  }, [categories, visualItems, allProducts]);

  // Set default target category on mount or prop update
  useEffect(() => {
    if (allCategoryNodes.length > 0) {
      if (initialTargetKey) {
        const found = allCategoryNodes.find(n => n.key === initialTargetKey || n.id === initialTargetKey);
        if (found) {
          setSelectedNodeKey(found.key);
          return;
        }
      }
      if (!selectedNodeKey) {
        // Default to first subcategory or category
        const defaultSub = allCategoryNodes.find(n => n.level === 'subcategory') || allCategoryNodes[0];
        if (defaultSub) setSelectedNodeKey(defaultSub.key);
      }
    }
  }, [allCategoryNodes, initialTargetKey]);

  // Current selected target node
  const activeTargetNode = useMemo<FlatCategoryNode | undefined>(() => {
    return allCategoryNodes.find(n => n.key === selectedNodeKey) || allCategoryNodes[0];
  }, [allCategoryNodes, selectedNodeKey]);

  // Products currently assigned to active target category
  const assignedProducts = useMemo(() => {
    if (!activeTargetNode) return [];
    return allProducts.filter(p => isProductAssignedToNode(p, activeTargetNode));
  }, [allProducts, activeTargetNode]);

  // Intelligent matching calculation
  const matchingResults = useMemo<IntelligentProductMatch[]>(() => {
    if (!activeTargetNode || allProducts.length === 0) return [];

    return IntelligentProductMatcher.matchProductsForCategory(
      activeTargetNode,
      allProducts,
      {
        threshold,
        userSearchQuery: productSearchQuery,
        onlyInStock,
        filterAlreadyAssigned,
        exemplarProducts: assignedProducts
      }
    );
  }, [activeTargetNode, allProducts, threshold, productSearchQuery, onlyInStock, filterAlreadyAssigned, assignedProducts]);

  // Filtered category nodes for category picker dropdown
  const filteredCategoryNodes = useMemo(() => {
    return filterCategoryNodes(allCategoryNodes, categorySearchQuery, categoryLevelFilter);
  }, [allCategoryNodes, categorySearchQuery, categoryLevelFilter]);

  // Filtered assigned products list
  const filteredAssignedProducts = useMemo(() => {
    let list = assignedProducts;
    if (onlyInStock) {
      list = list.filter(p => p.stock !== undefined && p.stock > 0);
    }
    const cleanQ = productSearchQuery.trim().toLowerCase();
    if (cleanQ) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(cleanQ) ||
        (p.brand && p.brand.toLowerCase().includes(cleanQ)) ||
        (p.sku && p.sku.toLowerCase().includes(cleanQ)) ||
        (p.productCode && p.productCode.toLowerCase().includes(cleanQ))
      );
    }
    return list;
  }, [assignedProducts, onlyInStock, productSearchQuery]);

  // Filtered catalog list for "Browse All Inventory"
  const filteredCatalogProducts = useMemo(() => {
    let list = allProducts;
    if (onlyInStock) {
      list = list.filter(p => p.stock !== undefined && p.stock > 0);
    }
    if (filterAlreadyAssigned && activeTargetNode) {
      list = list.filter(p => !isProductAssignedToNode(p, activeTargetNode));
    }
    const cleanQ = productSearchQuery.trim().toLowerCase();
    if (cleanQ) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(cleanQ) ||
        (p.brand && p.brand.toLowerCase().includes(cleanQ)) ||
        (p.sku && p.sku.toLowerCase().includes(cleanQ)) ||
        (p.productCode && p.productCode.toLowerCase().includes(cleanQ))
      );
    }
    return list;
  }, [allProducts, onlyInStock, filterAlreadyAssigned, activeTargetNode, productSearchQuery]);

  // Handlers for selection
  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectAllVisibleMatches = () => {
    if (!activeTargetNode) return;
    const visibleUnassigned = matchingResults
      .filter(m => !m.isAlreadyAssigned)
      .map(m => m.product.id);

    const allSelected = visibleUnassigned.length > 0 && visibleUnassigned.every(id => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !visibleUnassigned.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleUnassigned])));
    }
  };

  const handleSelectAllVisibleAssigned = () => {
    const visibleIds = filteredAssignedProducts.map(p => p.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Perform bulk assignment
  const handleConfirmAssignment = async () => {
    if (!activeTargetNode || selectedProductIds.length === 0) return;

    setIsExecutingAssignment(true);
    try {
      const res = await assignProductsToHierarchyNode(
        activeTargetNode,
        selectedProductIds,
        { preserveExisting: preserveExistingAssignments }
      );

      if (res.success) {
        toast.success(res.message);
        setSelectedProductIds([]);
        setIsPreviewModalOpen(false);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Error assigning products:', err);
      toast.error(err?.message ? `Assignment failed: ${err.message}` : 'Assignment failed.');
    } finally {
      setIsExecutingAssignment(false);
    }
  };

  // Perform single product assignment
  const handleSingleAssign = async (product: Product) => {
    if (!activeTargetNode) return;
    try {
      const res = await assignProductsToHierarchyNode(
        activeTargetNode,
        [product.id],
        { preserveExisting: preserveExistingAssignments }
      );
      if (res.success) {
        toast.success(`Assigned "${product.name}" to ${activeTargetNode.name}`);
        setSelectedProductIds(prev => prev.filter(id => id !== product.id));
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Failed to assign product:', err);
      toast.error('Failed to assign product.');
    }
  };

  // Perform unassignment
  const handleSingleUnassign = async (product: Product) => {
    if (!activeTargetNode) return;
    if (!window.confirm(`Unassign "${product.name}" from ${activeTargetNode.name}? The product will remain intact in inventory.`)) {
      return;
    }
    try {
      const res = await unassignProductsFromHierarchyNode(activeTargetNode, [product.id]);
      if (res.success) {
        toast.success(res.message);
        setSelectedProductIds(prev => prev.filter(id => id !== product.id));
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Failed to unassign product:', err);
      toast.error('Failed to unassign product.');
    }
  };

  const handleBulkUnassign = async () => {
    if (!activeTargetNode || selectedProductIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to unassign ${selectedProductIds.length} products from "${activeTargetNode.breadcrumb}"? Original inventory records remain safe.`)) {
      return;
    }
    setIsExecutingUnassignment(true);
    try {
      const res = await unassignProductsFromHierarchyNode(activeTargetNode, selectedProductIds);
      if (res.success) {
        toast.success(res.message);
        setSelectedProductIds([]);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      console.error('Failed to bulk unassign products:', err);
      toast.error('Failed to unassign products.');
    } finally {
      setIsExecutingUnassignment(false);
    }
  };

  // Helper for confidence badge colors
  const getConfidenceBadge = (confidence: MatchConfidence, score: number) => {
    switch (confidence) {
      case 'strong':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            {score}% Strong Match
          </span>
        );
      case 'good':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {score}% Good Match
          </span>
        );
      case 'fair':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            {score}% Suggested
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
            {score}% Match
          </span>
        );
    }
  };

  // Helper for level indicator badge
  const getLevelBadge = (level: FlatCategoryNode['level']) => {
    switch (level) {
      case 'category':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">Main Category</span>;
      case 'subcategory':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200">Subcategory</span>;
      case 'nested_subcategory':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">Nested Subcategory</span>;
      case 'visual_nested_subcategory':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">Visual Showcase</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-gray-50 text-gray-700 border border-gray-200">Level 4+</span>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase bg-white/10 backdrop-blur-md text-purple-200 border border-white/10 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-purple-300" />
                Intelligent Matching Engine
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Non-Destructive Safe Sync
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Intelligent Inventory Product Assignment
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">
              Automatically identify and assign relevant inventory products to any Main Category, Subcategory,
              Nested Subcategory, or Visual Nested Subcategory using semantic NLP, synonym detection, and safety guards.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 min-w-[120px] text-center">
              <div className="text-xl sm:text-2xl font-black text-white">
                {allProducts.length}
              </div>
              <div className="text-[11px] font-medium text-purple-200">
                Catalog Inventory
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 min-w-[120px] text-center">
              <div className="text-xl sm:text-2xl font-black text-emerald-300">
                {allCategoryNodes.length}
              </div>
              <div className="text-[11px] font-medium text-purple-200">
                Category Levels
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 min-w-[120px] text-center">
              <div className="text-xl sm:text-2xl font-black text-amber-300">
                {assignedProducts.length}
              </div>
              <div className="text-[11px] font-medium text-purple-200">
                Target Assigned
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Target Category Selector Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              1. Select Target Category Level
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose the target category where matching products will be assigned. Supports all dynamic database hierarchy levels.
            </p>
          </div>

          {activeTargetNode && (
            <div className="flex items-center gap-2">
              {getLevelBadge(activeTargetNode.level)}
              <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-xl">
                {activeTargetNode.assignedProductCount} Assigned Products
              </span>
            </div>
          )}
        </div>

        {/* Current Target Selector Trigger */}
        <div className="relative">
          <div
            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
            className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border-2 border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50/70 hover:border-indigo-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                {activeTargetNode?.image ? (
                  <img src={activeTargetNode.image} alt={activeTargetNode.name} className="w-full h-full object-cover" />
                ) : (
                  <CategoryLogo name={activeTargetNode?.name || 'Category'} icon={activeTargetNode?.icon} size="md" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-black text-indigo-900 tracking-wide uppercase flex items-center gap-2">
                  <span>Target: {activeTargetNode?.levelLabel}</span>
                  <span className="text-[10px] font-mono text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                    ID: {activeTargetNode?.id}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-bold text-gray-900 truncate mt-0.5">
                  {activeTargetNode?.breadcrumb || 'Select a Category'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-indigo-600 group-hover:text-indigo-800 transition-colors shrink-0">
              <span className="text-xs font-bold hidden sm:inline">Change Category</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Searchable Dropdown Popup */}
          <AnimatePresence>
            {isCategoryDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute z-50 top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden divide-y divide-gray-100 max-h-96 flex flex-col"
              >
                {/* Search & Level Filter Header */}
                <div className="p-3 bg-gray-50 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search categories, subcategories, or visual showcases..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                  </div>

                  <select
                    value={categoryLevelFilter}
                    onChange={(e) => setCategoryLevelFilter(e.target.value)}
                    className="px-3 py-2 bg-white rounded-xl border border-gray-200 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Category Levels</option>
                    <option value="category">Main Categories (Level 1)</option>
                    <option value="subcategory">Subcategories (Level 2)</option>
                    <option value="nested_subcategory">Nested Subcategories (Level 3)</option>
                    <option value="visual_nested_subcategory">Visual Nested Subcategories</option>
                  </select>
                </div>

                {/* Categories List */}
                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                  {filteredCategoryNodes.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No categories found matching "{categorySearchQuery}".
                    </div>
                  ) : (
                    filteredCategoryNodes.map(node => {
                      const isSelected = node.key === selectedNodeKey;
                      return (
                        <button
                          key={node.key}
                          type="button"
                          onClick={() => {
                            setSelectedNodeKey(node.key);
                            setIsCategoryDropdownOpen(false);
                            setSelectedProductIds([]);
                          }}
                          className={`w-full text-left p-3.5 hover:bg-indigo-50/60 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {node.image ? (
                                <img src={node.image} alt={node.name} className="w-full h-full object-cover" />
                              ) : (
                                <CategoryLogo name={node.name} icon={node.icon} size="sm" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900 truncate">
                                  {node.name}
                                </span>
                                {getLevelBadge(node.level)}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                                {node.breadcrumb}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {node.assignedProductCount} products
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Intelligent Workspace */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-200 bg-gray-50/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('suggestions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'suggestions'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>Smart Match Suggestions</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'suggestions' ? 'bg-purple-800 text-purple-100' : 'bg-gray-200 text-gray-700'
              }`}>
                {matchingResults.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assigned')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'assigned'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Currently Assigned</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'assigned' ? 'bg-indigo-800 text-indigo-100' : 'bg-gray-200 text-gray-700'
              }`}>
                {assignedProducts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all_catalog')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeTab === 'all_catalog'
                  ? 'bg-gray-800 text-white shadow-md shadow-gray-400'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>All Catalog Inventory</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'all_catalog' ? 'bg-gray-900 text-gray-200' : 'bg-gray-200 text-gray-700'
              }`}>
                {allProducts.length}
              </span>
            </button>
          </div>

          {/* Non-Destructive Multi-Category Safety Options */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
              <input
                type="checkbox"
                checked={preserveExistingAssignments}
                onChange={(e) => setPreserveExistingAssignments(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span title="Keeps current category links intact and safely adds this target category">
                Preserve Existing Assignments
              </span>
            </label>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-white space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by title, SKU, brand, or code..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50/50"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Threshold & Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'suggestions' && (
                <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                  <span className="text-[11px] font-bold text-gray-500 pl-2">Relevance:</span>
                  <button
                    type="button"
                    onClick={() => setThreshold(40)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      threshold === 40 ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All (≥40%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setThreshold(60)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      threshold === 60 ? 'bg-white text-blue-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Good (≥60%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setThreshold(80)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      threshold === 80 ? 'bg-white text-emerald-800 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Strong (≥80%)
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOnlyInStock(!onlyInStock)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  onlyInStock
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                In Stock Only
              </button>

              {activeTab !== 'assigned' && (
                <button
                  type="button"
                  onClick={() => setFilterAlreadyAssigned(!filterAlreadyAssigned)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    filterAlreadyAssigned
                      ? 'bg-purple-50 text-purple-800 border-purple-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Unassigned Only
                </button>
              )}
            </div>
          </div>

          {/* Action Toolbar (Select All, Bulk Assign Button) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              {activeTab === 'suggestions' ? (
                <button
                  type="button"
                  onClick={handleSelectAllVisibleMatches}
                  className="flex items-center gap-1.5 text-xs font-black text-gray-700 hover:text-gray-900 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                  <span>Toggle Select All Visible Unassigned</span>
                </button>
              ) : activeTab === 'assigned' ? (
                <button
                  type="button"
                  onClick={handleSelectAllVisibleAssigned}
                  className="flex items-center gap-1.5 text-xs font-black text-gray-700 hover:text-gray-900 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span>Toggle Select All Assigned</span>
                </button>
              ) : (
                <span className="text-xs text-gray-500">
                  Select catalog products to assign to this category
                </span>
              )}

              {selectedProductIds.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                  {selectedProductIds.length} Selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'assigned' && selectedProductIds.length > 0 && (
                <button
                  type="button"
                  disabled={isExecutingUnassignment}
                  onClick={handleBulkUnassign}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Unassign Selected ({selectedProductIds.length})</span>
                </button>
              )}

              {activeTab !== 'assigned' && (
                <button
                  type="button"
                  disabled={selectedProductIds.length === 0}
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-black shadow-md shadow-purple-200 transition-all cursor-pointer"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Preview & Assign Selected ({selectedProductIds.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {loadingProducts ? (
            <div className="text-center py-20 text-gray-500 font-bold text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading inventory catalog products...
            </div>
          ) : activeTab === 'suggestions' ? (
            /* TAB 1: Smart Match Suggestions */
            <div>
              {matchingResults.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 border border-purple-100">
                    <Wand2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 mb-1">
                    No Matching Inventory Products Found Above {threshold}% Relevance
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                    Try lowering the relevance threshold to 40%, clearing search filters, or switch to "All Catalog Inventory" to manually browse and assign products.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setThreshold(40)}
                      className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-black"
                    >
                      Set Threshold to 40%
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('all_catalog')}
                      className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black"
                    >
                      Browse All Catalog
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                    <span>
                      Showing <strong>{matchingResults.length}</strong> intelligent suggestions for{' '}
                      <strong>{activeTargetNode?.name}</strong>
                    </span>
                    <span className="text-[11px] text-purple-700 font-bold">
                      Safe assignment does not duplicate products
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-2xs">
                    {matchingResults.map(match => {
                      const { product, score, confidence, reasons, isAlreadyAssigned } = match;
                      const isSelected = selectedProductIds.includes(product.id);
                      const isReasonsExpanded = expandedReasonProductId === product.id;

                      return (
                        <div
                          key={product.id}
                          className={`p-4 bg-white hover:bg-purple-50/30 transition-colors flex flex-col gap-3 ${
                            isAlreadyAssigned ? 'bg-gray-50/60 opacity-90' : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            {/* Product Info & Checkbox */}
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              <input
                                type="checkbox"
                                disabled={isAlreadyAssigned}
                                checked={isSelected || isAlreadyAssigned}
                                onChange={() => handleToggleSelectProduct(product.id)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 disabled:opacity-40 cursor-pointer mt-1 sm:mt-0"
                              />

                              <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                                {product.images && product.images.length > 0 ? (
                                  <img
                                    src={product.images[0]}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    <Package className="w-6 h-6" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                                    {product.name}
                                  </h4>
                                  {product.brand && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                      {product.brand}
                                    </span>
                                  )}
                                  {product.productCode && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                      {formatProductCode(product.productCode)}
                                    </span>
                                  )}
                                  {isAlreadyAssigned && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                      Already Assigned
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-500">
                                  <span>
                                    Price: <strong className="text-gray-900">₹{product.discountPrice || product.price}</strong>
                                    {product.mrp && product.mrp > (product.discountPrice || product.price) && (
                                      <span className="line-through text-gray-400 ml-1">₹{product.mrp}</span>
                                    )}
                                  </span>
                                  <span>
                                    Stock:{' '}
                                    <strong className={(product.stock || 0) > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                      {product.stock || 0} units
                                    </strong>
                                  </span>
                                  {product.categoryId && (
                                    <span className="text-gray-400">
                                      Current Cat: <strong>{product.categoryId}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Match Score & Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <div className="flex items-center gap-2">
                                {getConfidenceBadge(confidence, score)}
                                <button
                                  type="button"
                                  onClick={() => setExpandedReasonProductId(isReasonsExpanded ? null : product.id)}
                                  className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
                                >
                                  {isReasonsExpanded ? 'Hide Reasons' : `${reasons.length} Reasons`}
                                </button>
                              </div>

                              <div>
                                {isAlreadyAssigned ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSingleUnassign(product)}
                                    className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Unassign
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSingleAssign(product)}
                                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                                  >
                                    Assign Now
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expandable Reasons Drawer */}
                          <AnimatePresence>
                            {isReasonsExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-purple-50/70 p-3 rounded-xl border border-purple-100 text-xs text-purple-900 space-y-1.5"
                              >
                                <div className="font-bold flex items-center gap-1.5 text-purple-950 text-[11px] uppercase tracking-wider">
                                  <Info className="w-3.5 h-3.5 text-purple-700" />
                                  Intelligent Matching Breakdown:
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-[11px] text-purple-800">
                                  {reasons.map((reason, idx) => (
                                    <li key={idx}>{reason}</li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'assigned' ? (
            /* TAB 2: Currently Assigned Products */
            <div>
              {filteredAssignedProducts.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                    <Package className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 mb-1">
                    No Products Assigned to "{activeTargetNode?.name}"
                  </h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                    Use the "Smart Match Suggestions" tab to identify and assign similar inventory products.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('suggestions')}
                    className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-200 transition-all cursor-pointer"
                  >
                    View Smart Match Suggestions
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                    <span>
                      Showing <strong>{filteredAssignedProducts.length}</strong> products assigned to{' '}
                      <strong>{activeTargetNode?.breadcrumb}</strong>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold">
                      Directly visible on storefront category page
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-2xs">
                    {filteredAssignedProducts.map(product => {
                      const isSelected = selectedProductIds.includes(product.id);
                      return (
                        <div
                          key={product.id}
                          className="p-4 bg-white hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectProduct(product.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />

                            <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                              {product.images && product.images.length > 0 ? (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <Package className="w-6 h-6" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                                {product.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                {product.brand && <span className="font-bold text-gray-700">{product.brand}</span>}
                                {product.sku && <span className="font-mono text-gray-500">SKU: {product.sku}</span>}
                                <span>₹{product.discountPrice || product.price}</span>
                                <span className={(product.stock || 0) > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                                  Stock: {product.stock || 0}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={() => handleSingleUnassign(product)}
                              className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                            >
                              Remove Assignment
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 3: Browse All Inventory */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                <span>
                  Showing <strong>{filteredCatalogProducts.length}</strong> catalog inventory products
                </span>
                <span className="text-[11px] text-gray-500">
                  Select any product to assign to <strong>{activeTargetNode?.name}</strong>
                </span>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-2xs">
                {filteredCatalogProducts.map(product => {
                  const isAssigned = isProductAssignedToNode(product, activeTargetNode!);
                  const isSelected = selectedProductIds.includes(product.id);

                  return (
                    <div
                      key={product.id}
                      className={`p-4 bg-white hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-4 ${
                        isAssigned ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <input
                          type="checkbox"
                          disabled={isAssigned}
                          checked={isSelected || isAssigned}
                          onChange={() => handleToggleSelectProduct(product.id)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 disabled:opacity-40 cursor-pointer"
                        />

                        <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                          {product.images && product.images.length > 0 ? (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">
                              {product.name}
                            </h4>
                            {isAssigned && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Assigned
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                            {product.brand && <span className="font-bold text-gray-700">{product.brand}</span>}
                            <span>₹{product.discountPrice || product.price}</span>
                            <span>Stock: {product.stock || 0}</span>
                            {product.categoryId && <span>Cat: {product.categoryId}</span>}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isAssigned ? (
                          <span className="text-xs font-bold text-emerald-700">Assigned</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSingleAssign(product)}
                            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer"
                          >
                            Assign Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Confirmation Modal */}
      <AnimatePresence>
        {isPreviewModalOpen && activeTargetNode && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isExecutingAssignment && setIsPreviewModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-purple-600" />
                    Preview & Confirm Assignment
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review selected products before applying changes to the database.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  disabled={isExecutingAssignment}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Target Summary Box */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
                  <div className="text-[11px] font-black uppercase text-purple-800 tracking-wider">
                    Target Category Destination
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-2">
                    {getLevelBadge(activeTargetNode.level)}
                    <span>{activeTargetNode.breadcrumb}</span>
                  </div>
                  <div className="text-xs text-purple-700/80 mt-1">
                    {preserveExistingAssignments
                      ? '✓ Non-destructive mode enabled: Existing category assignments will be preserved and target category added.'
                      : '⚠ Replace mode: Primary category for selected products will be set to this target.'}
                  </div>
                </div>

                {/* Selected Products List */}
                <div>
                  <div className="text-xs font-black text-gray-900 uppercase tracking-wider mb-2">
                    Selected Products ({selectedProductIds.length})
                  </div>

                  <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                    {selectedProductIds.map(pid => {
                      const prod = allProducts.find(p => p.id === pid);
                      if (!prod) return null;

                      return (
                        <div key={pid} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                              {prod.images && prod.images[0] ? (
                                <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-gray-900 truncate">{prod.name}</span>
                          </div>

                          <span className="font-bold text-gray-600 shrink-0">
                            ₹{prod.discountPrice || prod.price}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isExecutingAssignment}
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isExecutingAssignment}
                  onClick={handleConfirmAssignment}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-200 transition-all cursor-pointer flex items-center gap-2"
                >
                  {isExecutingAssignment && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Confirm & Assign {selectedProductIds.length} Products</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

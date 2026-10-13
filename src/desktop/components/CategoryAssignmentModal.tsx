import React, { useState, useMemo } from 'react';
import {
  X, Check, Search, Sparkles, Layers, ChevronRight,
  FolderTree, AlertCircle, Plus, Info, ShieldCheck, CheckCircle2,
  Tag, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Product, FlatCategoryNode, CategoryHierarchyLevel } from '../../shared/types';
import { useCategoryStore, useVisualNestedSubcategoryStore } from '../../backend/store';
import { buildFlatCategoryHierarchy, searchCategoryHierarchy } from '../../shared/utilities/categoryHierarchyUtils';
import { IntelligentProductMatcher } from '../../shared/utilities/intelligentProductMatcher';
import { assignProductsToCategoryNodes } from '../../backend/services/productAssignmentService';

interface CategoryAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  allProducts: Product[];
  onAssignmentSuccess?: () => void;
  onAddProductToSelection?: (product: Product) => void;
  onRemoveProductFromSelection?: (productId: string) => void;
}

export default function CategoryAssignmentModal({
  isOpen,
  onClose,
  selectedProducts,
  allProducts,
  onAssignmentSuccess,
  onAddProductToSelection,
  onRemoveProductFromSelection
}: CategoryAssignmentModalProps) {
  const { categories } = useCategoryStore();
  const { items: visualItems } = useVisualNestedSubcategoryStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | CategoryHierarchyLevel>('all');
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>([]);
  const [preserveExisting, setPreserveExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'similar'>('categories');

  // Build the complete dynamic hierarchy
  const allCategoryNodes = useMemo(() => {
    return buildFlatCategoryHierarchy(categories, visualItems, allProducts);
  }, [categories, visualItems, allProducts]);

  // Filter category hierarchy by search query and level
  const filteredCategoryNodes = useMemo(() => {
    let list = searchCategoryHierarchy(allCategoryNodes, searchQuery);
    if (levelFilter !== 'all') {
      list = list.filter(node => node.level === levelFilter);
    }
    return list;
  }, [allCategoryNodes, searchQuery, levelFilter]);

  // Compute similar product suggestions
  const similarProductMatches = useMemo(() => {
    if (selectedProducts.length === 0) return [];
    return IntelligentProductMatcher.matchSimilarProductsForSelection(
      selectedProducts,
      allProducts,
      { threshold: 25, maxResults: 15 }
    );
  }, [selectedProducts, allProducts]);

  // Selected target nodes objects
  const selectedTargetNodes = useMemo(() => {
    return allCategoryNodes.filter(n => selectedCategoryKeys.includes(n.key));
  }, [allCategoryNodes, selectedCategoryKeys]);

  if (!isOpen) return null;

  const toggleCategorySelection = (key: string) => {
    setSelectedCategoryKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAllFiltered = () => {
    const keysToAdd = filteredCategoryNodes.map(n => n.key);
    setSelectedCategoryKeys(prev => Array.from(new Set([...prev, ...keysToAdd])));
  };

  const handleClearSelectedCategories = () => {
    setSelectedCategoryKeys([]);
  };

  const handleConfirmAssignment = async () => {
    if (selectedProducts.length === 0) {
      toast.error('No products selected for assignment.');
      return;
    }
    if (selectedTargetNodes.length === 0) {
      toast.error('Please select at least one destination category.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `Assigning ${selectedProducts.length} product(s) to ${selectedTargetNodes.length} category destination(s)...`
    );

    try {
      const productIds = selectedProducts.map(p => p.id);
      const res = await assignProductsToCategoryNodes(productIds, selectedTargetNodes, {
        preserveExisting
      });

      toast.success(res.message, { id: toastId });
      setSelectedCategoryKeys([]);
      onAssignmentSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Assignment failed:', err);
      toast.error(err.message || 'Failed to complete category assignment', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLevelBadge = (level: CategoryHierarchyLevel) => {
    switch (level) {
      case 'category':
        return { label: 'Main Category', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'subcategory':
        return { label: 'Subcategory', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'nested_subcategory':
        return { label: 'Nested Subcategory', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'visual_nested_subcategory':
        return { label: 'Visual Showcase', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'deep_subcategory':
      default:
        return { label: 'Deep Category', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <FolderTree className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  Assign to Categories
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                    {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''} Selected
                  </span>
                </h3>
                <p className="text-xs text-gray-500">
                  Assign inventory products across category levels without duplicating catalog records.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Selected Products Preview Bar */}
          <div className="bg-gray-50/70 px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none flex-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 shrink-0">Selected:</span>
              {selectedProducts.slice(0, 6).map(prod => (
                <div
                  key={prod.id}
                  className="flex items-center gap-1.5 bg-white border border-gray-200/80 rounded-lg pl-1.5 pr-2 py-1 shrink-0 text-xs shadow-xs"
                >
                  <img
                    src={prod.images?.[0] || 'https://via.placeholder.com/40'}
                    alt=""
                    className="w-5 h-5 rounded object-contain bg-gray-50"
                  />
                  <span className="font-semibold text-gray-800 max-w-[120px] truncate">{prod.name}</span>
                  {onRemoveProductFromSelection && selectedProducts.length > 1 && (
                    <button
                      onClick={() => onRemoveProductFromSelection(prod.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                      title="Remove from current selection"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {selectedProducts.length > 6 && (
                <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-lg px-2 py-1 shrink-0">
                  +{selectedProducts.length - 6} more
                </span>
              )}
            </div>

            {/* Navigation Tabs between Categories & Similar Suggestions */}
            <div className="flex items-center gap-1 bg-gray-200/60 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('categories')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'categories'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-primary" />
                Categories ({selectedCategoryKeys.length})
              </button>
              <button
                onClick={() => setActiveTab('similar')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'similar'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Similar Products ({similarProductMatches.length})
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {activeTab === 'categories' ? (
              <>
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search categories by name, breadcrumb or keyword..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium outline-none focus:border-primary focus:bg-white transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Level Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {(
                      [
                        { id: 'all', label: 'All Levels' },
                        { id: 'category', label: 'Main' },
                        { id: 'subcategory', label: 'Sub' },
                        { id: 'nested_subcategory', label: 'Nested' },
                        { id: 'visual_nested_subcategory', label: 'Showcase' }
                      ] as const
                    ).map(f => (
                      <button
                        key={f.id}
                        onClick={() => setLevelFilter(f.id as any)}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all ${
                          levelFilter === f.id
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assignment Mode Controls */}
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-900 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preserveExisting}
                          onChange={e => setPreserveExisting(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer"
                        />
                        Preserve Existing Category Assignments
                      </label>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {preserveExisting
                          ? 'Recommended: Products will be added to the selected categories while retaining all their current assignments.'
                          : 'Replaces previous categories with the newly selected destinations.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {filteredCategoryNodes.length > 0 && (
                      <button
                        onClick={handleSelectAllFiltered}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        Select Filtered ({filteredCategoryNodes.length})
                      </button>
                    )}
                    {selectedCategoryKeys.length > 0 && (
                      <button
                        onClick={handleClearSelectedCategories}
                        className="text-[11px] font-bold text-rose-500 hover:underline ml-2"
                      >
                        Clear Selected
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories List */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 max-h-[360px] overflow-y-auto bg-white">
                  {filteredCategoryNodes.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-xs">
                      No categories found matching your search.
                    </div>
                  ) : (
                    filteredCategoryNodes.map(node => {
                      const isSelected = selectedCategoryKeys.includes(node.key);
                      const badge = getLevelBadge(node.level);

                      return (
                        <div
                          key={node.key}
                          onClick={() => toggleCategorySelection(node.key)}
                          className={`p-3.5 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Controlled by row onClick
                              className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${badge.bg}`}>
                                  {node.level === 'visual_nested_subcategory' && <Sparkles className="w-2.5 h-2.5 inline mr-1" />}
                                  {badge.label}
                                </span>
                                <span className="text-xs font-bold text-gray-900 truncate">
                                  {node.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                {node.breadcrumb}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {node.assignedProductCount} live
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Similar Products Tab */
              <div className="space-y-4">
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900">Similar Product Recommendations</h4>
                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                      Based on product title keywords, brand, specifications, and existing category tags.
                      Suggested products are never automatically assigned; review and click <strong>“+ Add”</strong> to include them in your bulk assignment.
                    </p>
                  </div>
                </div>

                {similarProductMatches.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded-2xl">
                    No similar products found in inventory for the selected item(s).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {similarProductMatches.map(match => {
                      const p = match.product;
                      return (
                        <div
                          key={p.id}
                          className="border border-gray-100 rounded-2xl p-3 bg-white hover:border-gray-200 transition-all flex flex-col justify-between shadow-xs"
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={p.images?.[0] || 'https://via.placeholder.com/80'}
                              alt=""
                              className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                                  {match.score}% Match
                                </span>
                                {p.brand && (
                                  <span className="text-[9px] font-bold text-gray-500 uppercase">
                                    {p.brand}
                                  </span>
                                )}
                              </div>
                              <h5 className="text-xs font-bold text-gray-900 truncate mt-1">
                                {p.name}
                              </h5>
                              <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">
                                {match.reasons[0] || 'Similar catalog characteristics'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-black text-gray-900">
                              ₹{(p.discountPrice || p.price || 0).toLocaleString()}
                            </span>
                            <button
                              onClick={() => {
                                onAddProductToSelection?.(p);
                                toast.success(`Added "${p.name}" to selection`);
                              }}
                              className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white px-3 py-1 rounded-lg transition-all"
                            >
                              <Plus className="w-3 h-3" /> Add to Selection
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-bold text-gray-900">{selectedProducts.length}</span> product(s) →{' '}
              <span className="font-bold text-primary">{selectedTargetNodes.length}</span> category destination(s)
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-xs text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={isSubmitting || selectedTargetNodes.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  'Assigning...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirm Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

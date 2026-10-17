import React, { useState, useMemo } from 'react';
import { InventoryBrandSection, Product } from '../../shared/types';
import { useInventoryBrandSectionStore } from '../../backend/store';
import toast from 'react-hot-toast';
import {
  Tag, Plus, Edit2, Trash2, Check, X, Search, CheckSquare, Square,
  FolderTree, AlertTriangle, ChevronDown, Layers, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatProductCode } from '../../shared/utilities/productCode';

interface BrandSectionsBarProps {
  products: Product[];
  activeSectionId: string; // 'all' | 'unassigned' | sectionId
  onSelectSection: (sectionId: string) => void;
  onCreateNewProductForSection: (sectionId: string) => void;
  onOpenAssignModal?: (productIds: string[]) => void;
}

export default function BrandSectionsBar({
  products,
  activeSectionId,
  onSelectSection,
  onCreateNewProductForSection,
  onOpenAssignModal
}: BrandSectionsBarProps) {
  const { sections, loading, addSection, renameSection, deleteSection, bulkAssignProducts } = useInventoryBrandSectionStore();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  const [renamingSection, setRenamingSection] = useState<InventoryBrandSection | null>(null);
  const [renamedName, setRenamedName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const [deletingSection, setDeletingSection] = useState<InventoryBrandSection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Option B: Select Existing Products modal
  const [isSelectExistingModalOpen, setIsSelectExistingModalOpen] = useState(false);
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  const [isSavingExistingAssignment, setIsSavingExistingAssignment] = useState(false);

  // Add Product dropdown in active section banner
  const [isAddProductDropdownOpen, setIsAddProductDropdownOpen] = useState(false);

  // Compute product counts per section and unassigned
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    const validSectionIds = new Set(sections.map(s => s.id));

    products.forEach(p => {
      if (p.inventorySectionId && validSectionIds.has(p.inventorySectionId)) {
        counts[p.inventorySectionId] = (counts[p.inventorySectionId] || 0) + 1;
      } else {
        unassigned++;
      }
    });

    return { counts, unassigned };
  }, [products, sections]);

  const activeSection = useMemo(() => {
    return sections.find(s => s.id === activeSectionId) || null;
  }, [sections, activeSectionId]);

  // Handle Add Section
  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSectionName.trim();
    if (!trimmed) {
      toast.error('Please enter a valid brand section name');
      return;
    }

    setIsAddingSection(true);
    const toastId = toast.loading(`Creating brand section "${trimmed}"...`);
    try {
      const created = await addSection(trimmed);
      toast.success(`Brand section "${created.name}" created`, { id: toastId });
      setNewSectionName('');
      setIsAddModalOpen(false);
      onSelectSection(created.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create brand section', { id: toastId });
    } finally {
      setIsAddingSection(false);
    }
  };

  // Handle Rename Section
  const handleRenameSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingSection) return;
    const trimmed = renamedName.trim();
    if (!trimmed) {
      toast.error('Section name cannot be empty');
      return;
    }

    if (trimmed.toLowerCase() === renamingSection.name.toLowerCase()) {
      setRenamingSection(null);
      return;
    }

    setIsRenaming(true);
    const toastId = toast.loading(`Renaming section to "${trimmed}"...`);
    try {
      await renameSection(renamingSection.id, trimmed);
      toast.success(`Renamed section to "${trimmed}"`, { id: toastId });
      setRenamingSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename brand section', { id: toastId });
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle Delete Section
  const handleDeleteSection = async () => {
    if (!deletingSection) return;
    setIsDeleting(true);
    const toastId = toast.loading(`Deleting section "${deletingSection.name}"...`);
    try {
      const result = await deleteSection(deletingSection.id, products);
      toast.success(
        `Deleted section "${deletingSection.name}". ${result.unassignedCount} product(s) safely unassigned.`,
        { id: toastId }
      );
      if (activeSectionId === deletingSection.id) {
        onSelectSection('all');
      }
      setDeletingSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete brand section', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter products for Option B modal (Select Existing Products)
  const filteredExistingProducts = useMemo(() => {
    const q = existingSearchQuery.toLowerCase().trim();
    return products.filter(p => {
      if (!q) return true;
      const nameMatch = p.name.toLowerCase().includes(q);
      const idMatch = p.id.toLowerCase().includes(q);
      const codeMatch = p.productCode && p.productCode.toLowerCase().includes(q);
      const skuMatch = p.sku && p.sku.toLowerCase().includes(q);
      return nameMatch || idMatch || codeMatch || skuMatch;
    });
  }, [products, existingSearchQuery]);

  // Open Option B modal
  const handleOpenSelectExistingModal = () => {
    setIsAddProductDropdownOpen(false);
    setExistingSearchQuery('');
    // Pre-select products already in this section
    const currentSectionProductIds = products
      .filter(p => p.inventorySectionId === activeSectionId)
      .map(p => p.id);
    setSelectedExistingIds(currentSectionProductIds);
    setIsSelectExistingModalOpen(true);
  };

  // Save Option B assignments
  const handleSaveExistingAssignments = async () => {
    if (!activeSection) return;
    setIsSavingExistingAssignment(true);
    const toastId = toast.loading(`Assigning products to "${activeSection.name}"...`);
    try {
      await bulkAssignProducts(selectedExistingIds, activeSection.id);
      toast.success(
        `Successfully assigned ${selectedExistingIds.length} product(s) to ${activeSection.name}`,
        { id: toastId }
      );
      setIsSelectExistingModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign products', { id: toastId });
    } finally {
      setIsSavingExistingAssignment(false);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
      {/* Brand Sections Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
              <Tag className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Brand Sections</h3>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              Inventory Only
            </span>
            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
              ({sections.length} sections)
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Internal product organization for admin inventory. Does not alter storefront brands or customer visibility.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setNewSectionName('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Brand</span>
          </button>
        </div>
      </div>

      {/* Brand Section Pills / Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        {/* All Products Tab */}
        <button
          type="button"
          onClick={() => onSelectSection('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSectionId === 'all'
              ? 'bg-gray-900 text-white shadow-sm'
              : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-900'
          }`}
        >
          <span>All Products</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeSectionId === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {products.length}
          </span>
        </button>

        {/* Dynamic Brand Sections */}
        {sections.map(section => {
          const isSelected = activeSectionId === section.id;
          const count = sectionCounts.counts[section.id] || 0;

          return (
            <div
              key={section.id}
              className={`group inline-flex items-center rounded-xl text-xs font-bold transition-all border ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-indigo-50/70 text-indigo-900 border-indigo-100 hover:bg-indigo-100/70'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSection(section.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer"
                title={`Open ${section.name} section (${count} products)`}
              >
                <span>{section.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-indigo-200/70 text-indigo-800'
                }`}>
                  {count}
                </span>
              </button>

              {/* Quick Rename & Delete controls */}
              <div className="flex items-center pr-1.5 gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingSection(section);
                    setRenamedName(section.name);
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isSelected ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-indigo-400 hover:text-indigo-700 hover:bg-indigo-200/50'
                  }`}
                  title={`Rename "${section.name}"`}
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingSection(section);
                  }}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isSelected ? 'text-white/70 hover:text-rose-200 hover:bg-white/10' : 'text-indigo-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title={`Delete "${section.name}"`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Unassigned Products Tab */}
        <button
          type="button"
          onClick={() => onSelectSection('unassigned')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSectionId === 'unassigned'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/70'
          }`}
          title="Products not assigned to any internal brand section"
        >
          <FolderTree className="w-3 h-3" />
          <span>Unassigned Products</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeSectionId === 'unassigned' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
          }`}>
            {sectionCounts.unassigned}
          </span>
        </button>
      </div>

      {/* Active Section Context Bar */}
      {activeSection && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-900">
              Active Brand Section:
            </span>
            <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-xs font-black rounded-lg">
              {activeSection.name}
            </span>
            <span className="text-xs text-indigo-700 font-medium">
              • Showing {sectionCounts.counts[activeSection.id] || 0} product(s)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Add Product Dropdown with Option A & Option B */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAddProductDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isAddProductDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isAddProductDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 space-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddProductDropdownOpen(false);
                        onCreateNewProductForSection(activeSection.id);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-gray-800 transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-emerald-600" /> Option A: Create New Product
                      </span>
                      <span className="text-[10px] text-gray-500 pl-5">
                        Create product & assign to {activeSection.name}
                      </span>
                    </button>

                    <div className="border-t border-gray-100 my-1" />

                    <button
                      type="button"
                      onClick={handleOpenSelectExistingModal}
                      className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-gray-800 transition-colors flex flex-col cursor-pointer"
                    >
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" /> Option B: Select Existing Products
                      </span>
                      <span className="text-[10px] text-gray-500 pl-5">
                        Search & assign catalog products to {activeSection.name}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => {
                setRenamingSection(activeSection);
                setRenamedName(activeSection.name);
              }}
              className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3 text-gray-500" />
              <span>Rename</span>
            </button>

            <button
              type="button"
              onClick={() => setDeletingSection(activeSection)}
              className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3 text-rose-600" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSection('all')}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>View All</span>
            </button>
          </div>
        </div>
      )}

      {/* Unassigned Active Banner */}
      {activeSectionId === 'unassigned' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-amber-50/80 border border-amber-200 p-3 rounded-xl gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Showing <strong>{sectionCounts.unassigned} Unassigned Product(s)</strong> without an internal brand section.</span>
          </div>
          <button
            type="button"
            onClick={() => onSelectSection('all')}
            className="self-end sm:self-auto px-2.5 py-1 bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            Clear Filter (View All)
          </button>
        </div>
      )}

      {/* MODAL 1: Add Brand Section Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Tag className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Add Brand Section</h3>
                    <p className="text-[11px] text-gray-500">Internal inventory section for product organization</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSection} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                    Section Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="e.g. Shopsy, DeoDap, Warehouse-A..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                  />
                  <p className="text-[10px] text-gray-400">
                    This section name will only be visible in the Admin Dashboard Inventory.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingSection || !newSectionName.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {isAddingSection ? 'Creating...' : 'Create Section'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Rename Brand Section Modal */}
      <AnimatePresence>
        {renamingSection && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Edit2 className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Rename Brand Section</h3>
                    <p className="text-[11px] text-gray-500">ID ({renamingSection.id}) & assignments are preserved</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRenamingSection(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRenameSection} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-600">
                    New Section Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={renamedName}
                    onChange={(e) => setRenamedName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-gray-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                  />
                  <p className="text-[10px] text-gray-400">
                    All existing product assignments will remain linked using the section's unique ID.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRenamingSection(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming || !renamedName.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {isRenaming ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Delete Section Confirmation Modal */}
      <AnimatePresence>
        {deletingSection && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Delete Brand Section?</h3>
                  <p className="text-xs text-gray-500">
                    Section: <strong className="text-gray-900">{deletingSection.name}</strong>
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold">Important Data Safety Guarantee:</p>
                <p>
                  Assigned products will <strong>NEVER be deleted</strong>. Deleting this section safely clears its internal assignment, and all {sectionCounts.counts[deletingSection.id] || 0} product(s) will remain in general inventory as <strong>Unassigned Products</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSection(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSection}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-rose-600/20"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Section'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Option B — Select Existing Products Modal */}
      <AnimatePresence>
        {isSelectExistingModalOpen && activeSection && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Layers className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Assign Products to "{activeSection.name}"
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Select catalog products to organize under this internal brand section
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSelectExistingModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Bulk Select Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={existingSearchQuery}
                    onChange={(e) => setExistingSearchQuery(e.target.value)}
                    placeholder="Search by name, SKU, or Product Code..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-7 py-2 text-xs font-semibold outline-none focus:bg-white focus:border-indigo-600 transition-all"
                  />
                  {existingSearchQuery && (
                    <button
                      onClick={() => setExistingSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const allFilteredIds = filteredExistingProducts.map(p => p.id);
                    const allSelected = allFilteredIds.every(id => selectedExistingIds.includes(id));
                    if (allSelected) {
                      setSelectedExistingIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                    } else {
                      setSelectedExistingIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                    }
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 shrink-0 cursor-pointer"
                >
                  {filteredExistingProducts.every(p => selectedExistingIds.includes(p.id)) && filteredExistingProducts.length > 0
                    ? 'Deselect Filtered'
                    : 'Select Filtered'}
                </button>
              </div>

              {/* Products List */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-96 pr-1">
                {filteredExistingProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No products found matching your search.
                  </div>
                ) : (
                  filteredExistingProducts.map(product => {
                    const isChecked = selectedExistingIds.includes(product.id);
                    const currentSec = sections.find(s => s.id === product.inventorySectionId);

                    return (
                      <div
                        key={product.id}
                        onClick={() => {
                          setSelectedExistingIds(prev =>
                            prev.includes(product.id)
                              ? prev.filter(id => id !== product.id)
                              : [...prev, product.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors ${
                          isChecked ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button type="button" className="text-indigo-600 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300" />
                            )}
                          </button>

                          <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                            {product.primaryImage || product.images?.[0] ? (
                              <img
                                src={product.primaryImage || product.images[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Tag className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {product.name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              {product.productCode && (
                                <span className="font-mono bg-gray-100 px-1 rounded text-gray-600">
                                  {formatProductCode(product.productCode)}
                                </span>
                              )}
                              <span>Stock: {product.stock}</span>
                            </div>
                          </div>
                        </div>

                        {/* Current section badge */}
                        <div className="shrink-0 text-right">
                          {currentSec ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              currentSec.id === activeSection.id
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {currentSec.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 shrink-0">
                <span className="text-xs font-semibold text-gray-600">
                  Selected: <strong>{selectedExistingIds.length}</strong> product(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSelectExistingModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveExistingAssignments}
                    disabled={isSavingExistingAssignment}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {isSavingExistingAssignment ? 'Saving...' : `Assign (${selectedExistingIds.length})`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

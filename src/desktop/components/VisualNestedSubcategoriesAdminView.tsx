import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles, Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter,
  GripVertical, Image as ImageIcon, Upload, X, Save, Check, RefreshCw,
  Layers, ChevronDown, ChevronRight, Tag, ArrowUpDown, Smartphone, Monitor, Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { VisualNestedSubcategory, Category, SubCategory } from '../../shared/types';
import { useVisualNestedSubcategoryStore, useCategoryStore } from '../../backend/store';
import { createSlug } from '../../shared/utilities/slug';
import { compressDataUrl } from '../../backend/services/categoryStorageService';
import VisualNestedSubcategoryCard from '../../shared/components/VisualNestedSubcategoryCard';

export default function VisualNestedSubcategoriesAdminView() {
  const { items, loading, addItem, updateItem, deleteItem, deleteAllItems, toggleActive, reorderItems } = useVisualNestedSubcategoryStore();
  const { categories } = useCategoryStore();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Form State
  const [formData, setFormData] = useState<Partial<VisualNestedSubcategory>>({
    name: '',
    slug: '',
    seoSlug: '',
    image: '',
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    order: 1,
    isActive: true,
    offerText: 'Under ₹299',
    offerBgColor: '#047857',
    offerTextColor: '#ffffff',
    seoTitle: ''
  });

  // Drag and Drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Subcategories available for filter
  const filterAvailableSubCategories = useMemo(() => {
    if (selectedCategoryFilter === 'all') return [];
    const cat = categories.find(c => c.id === selectedCategoryFilter);
    return cat?.subcategories || [];
  }, [selectedCategoryFilter, categories]);

  // Subcategories available in modal form based on selected parent category
  const formAvailableSubCategories = useMemo(() => {
    if (!formData.categoryId) return [];
    const cat = categories.find(c => c.id === formData.categoryId);
    return cat?.subcategories || [];
  }, [formData.categoryId, categories]);

  // Existing nested subcategories inside currently selected parent subcategory
  const formAvailableNestedSubCategories = useMemo(() => {
    if (!formData.categoryId || !formData.subCategoryId) return [];
    const cat = categories.find(c => c.id === formData.categoryId);
    const sub = cat?.subcategories?.find(s => s.id === formData.subCategoryId);
    return sub?.subcategories || [];
  }, [formData.categoryId, formData.subCategoryId, categories]);

  // All existing nested subcategories across the entire catalog
  const allCatalogNestedSubcategories = useMemo(() => {
    const list: { catId: string; catName: string; subId: string; subName: string; nested: SubCategory }[] = [];
    categories.forEach(c => {
      c.subcategories?.forEach(s => {
        s.subcategories?.forEach(n => {
          list.push({
            catId: c.id,
            catName: c.name,
            subId: s.id,
            subName: s.name,
            nested: n
          });
        });
      });
    });
    return list;
  }, [categories]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name ? item.name.toLowerCase().includes(q) : false;
        const matchOffer = item.offerText ? item.offerText.toLowerCase().includes(q) : false;
        const matchSlug = item.slug ? item.slug.toLowerCase().includes(q) : false;
        const matchCat = item.categoryName?.toLowerCase().includes(q);
        const matchSub = item.subCategoryName?.toLowerCase().includes(q);
        if (!matchName && !matchOffer && !matchSlug && !matchCat && !matchSub) return false;
      }

      // 2. Category Filter
      if (selectedCategoryFilter !== 'all' && item.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // 3. SubCategory Filter
      if (selectedSubCategoryFilter !== 'all' && item.subCategoryId !== selectedSubCategoryFilter) {
        return false;
      }

      // 4. Status Filter
      if (statusFilter === 'active' && item.isActive === false) return false;
      if (statusFilter === 'inactive' && item.isActive !== false) return false;

      return true;
    });
  }, [items, searchQuery, selectedCategoryFilter, selectedSubCategoryFilter, statusFilter]);

  // Drag and Drop ordering handlers
  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = async (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const updated = [...filteredItems];
      const draggedItem = updated[dragItem.current];
      updated.splice(dragItem.current, 1);
      updated.splice(dragOverItem.current, 0, draggedItem);
      
      try {
        await reorderItems(updated);
        toast.success('Visual nested subcategories reordered successfully');
      } catch (err) {
        console.error('Failed to reorder:', err);
        toast.error('Failed to save order');
      }
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Open Modal Handlers
  const handleOpenAdd = () => {
    const defaultCat = categories[0]?.id || '';
    const defaultCatObj = categories[0];
    const defaultSub = defaultCatObj?.subcategories?.[0]?.id || '';
    const defaultSubObj = defaultCatObj?.subcategories?.[0];

    setEditingId(null);
    setFormData({
      name: '',
      slug: '',
      seoSlug: '',
      image: '',
      categoryId: defaultCat,
      categoryName: defaultCatObj?.name || '',
      subCategoryId: defaultSub,
      subCategoryName: defaultSubObj?.name || '',
      order: items.length + 1,
      isActive: true,
      offerText: 'Under ₹299',
      offerBgColor: '#047857',
      offerTextColor: '#ffffff',
      seoTitle: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: VisualNestedSubcategory) => {
    setEditingId(item.id);
    setFormData({
      ...item,
      offerText: item.offerText || 'Under ₹299',
      offerBgColor: item.offerBgColor || '#047857',
      offerTextColor: item.offerTextColor || '#ffffff',
    });
    setIsModalOpen(true);
  };

  // Handle Form Category change
  const handleFormCategoryChange = (catId: string) => {
    const catObj = categories.find(c => c.id === catId);
    const firstSub = catObj?.subcategories?.[0];
    setFormData(prev => ({
      ...prev,
      categoryId: catId,
      categoryName: catObj?.name || '',
      subCategoryId: firstSub?.id || '',
      subCategoryName: firstSub?.name || ''
    }));
  };

  // Handle Form SubCategory change
  const handleFormSubCategoryChange = (subId: string) => {
    const subObj = formAvailableSubCategories.find(s => s.id === subId);
    setFormData(prev => ({
      ...prev,
      subCategoryId: subId,
      subCategoryName: subObj?.name || ''
    }));
  };

  // Quick select an existing nested subcategory within currently selected subcategory
  const handleSelectExistingNested = (nestedId: string) => {
    if (!nestedId) return;
    const selected = formAvailableNestedSubCategories.find(n => n.id === nestedId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        name: selected.name,
        slug: selected.slug || createSlug(selected.name),
        seoSlug: (selected as any).seoSlug || selected.slug || createSlug(selected.name),
        image: selected.image || prev.image || '',
        seoTitle: `${selected.name} | ViBa Mart`
      }));
      toast.success(`Selected existing "${selected.name}"`);
    }
  };

  // Quick select any existing nested subcategory across the entire catalog
  const handleSelectCatalogNested = (compositeKey: string) => {
    if (!compositeKey) return;
    const found = allCatalogNestedSubcategories.find(item => `${item.catId}:::${item.subId}:::${item.nested.id}` === compositeKey);
    if (found) {
      setFormData(prev => ({
        ...prev,
        categoryId: found.catId,
        categoryName: found.catName,
        subCategoryId: found.subId,
        subCategoryName: found.subName,
        name: found.nested.name,
        slug: found.nested.slug || createSlug(found.nested.name),
        seoSlug: (found.nested as any).seoSlug || found.nested.slug || createSlug(found.nested.name),
        image: found.nested.image || prev.image || '',
        seoTitle: `${found.nested.name} | ViBa Mart`
      }));
      toast.success(`Linked "${found.nested.name}" (${found.catName} › ${found.subName})`);
    }
  };

  // Name change auto-generates slug and SEO metadata
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const slug = createSlug(val);
    setFormData(prev => ({
      ...prev,
      name: val,
      slug: prev.slug && editingId ? prev.slug : slug,
      seoSlug: prev.seoSlug && editingId ? prev.seoSlug : slug,
      seoTitle: prev.seoTitle && editingId ? prev.seoTitle : `${val} | ViBa Mart`
    }));
  };

  // Handle Image file upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10 MB limit');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawResult = reader.result as string;
        try {
          const compressed = await compressDataUrl(rawResult, 800, 1000, 0.85);
          setFormData(prev => ({ ...prev, image: compressed }));
        } catch {
          setFormData(prev => ({ ...prev, image: rawResult }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId) {
      toast.error('Please select a target parent category.');
      return;
    }
    if (!formData.subCategoryId) {
      toast.error('Please select a target parent subcategory.');
      return;
    }
    if (!formData.image) {
      toast.error('Please upload or provide an image for the visual card.');
      return;
    }

    setIsSaving(true);
    try {
      const cardName = formData.name ? formData.name.trim() : '';
      const fallbackSlug = cardName 
        ? createSlug(cardName) 
        : (formData.slug || (formData.offerText ? createSlug(formData.offerText) : `card-${Date.now().toString().slice(-4)}`));

      if (editingId) {
        await updateItem(editingId, {
          name: cardName,
          slug: formData.slug || fallbackSlug,
          seoSlug: formData.seoSlug || formData.slug || fallbackSlug,
          image: formData.image,
          categoryId: formData.categoryId,
          categoryName: formData.categoryName,
          subCategoryId: formData.subCategoryId,
          subCategoryName: formData.subCategoryName,
          order: Number(formData.order) || 1,
          isActive: formData.isActive !== false,
          offerText: formData.offerText || 'Under ₹299',
          offerBgColor: formData.offerBgColor || '#047857',
          offerTextColor: formData.offerTextColor || '#ffffff',
          seoTitle: formData.seoTitle?.trim() || ''
        });
        toast.success('Visual nested subcategory updated successfully!');
      } else {
        await addItem({
          name: cardName,
          slug: formData.slug || fallbackSlug,
          seoSlug: formData.seoSlug || formData.slug || fallbackSlug,
          image: formData.image || '',
          categoryId: formData.categoryId || '',
          categoryName: formData.categoryName,
          subCategoryId: formData.subCategoryId || '',
          subCategoryName: formData.subCategoryName,
          order: Number(formData.order) || (items.length + 1),
          isActive: formData.isActive !== false,
          offerText: formData.offerText || 'Under ₹299',
          offerBgColor: formData.offerBgColor || '#047857',
          offerTextColor: formData.offerTextColor || '#ffffff',
          seoTitle: formData.seoTitle?.trim() || ''
        });
        toast.success('Visual nested subcategory created successfully!');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err?.message ? `Failed to save: ${err.message}` : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handler
  const handleDelete = async (item: VisualNestedSubcategory) => {
    const displayName = item.name || item.offerText || 'this card';
    if (!window.confirm(`Are you sure you want to delete visual card "${displayName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteItem(item.id, item.categoryId, item.subCategoryId);
      toast.success(`Deleted "${displayName}" successfully`);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete visual nested subcategory');
    }
  };

  // Delete All Cards Handler (Removes all auto-generated & existing cards)
  const handleDeleteAll = async () => {
    if (items.length === 0) {
      toast.error('No visual cards to remove.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${items.length} visual nested subcategory cards? This will completely clear all auto-generated and existing cards.`)) {
      return;
    }
    setIsDeletingAll(true);
    try {
      await deleteAllItems();
      toast.success('All visual nested subcategory cards have been removed!');
    } catch (err) {
      console.error('Delete all error:', err);
      toast.error('Failed to delete all items');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Mock item for live preview in modal
  const previewItem: VisualNestedSubcategory = useMemo(() => ({
    id: editingId || 'preview-id',
    name: formData.name || '',
    slug: formData.slug || 'sample-nested-subcategory',
    seoSlug: formData.seoSlug || 'sample-nested-subcategory',
    image: formData.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop',
    categoryId: formData.categoryId || 'cat',
    categoryName: formData.categoryName || 'Category',
    subCategoryId: formData.subCategoryId || 'sub',
    subCategoryName: formData.subCategoryName || 'Subcategory',
    order: Number(formData.order) || 1,
    isActive: formData.isActive !== false,
    offerText: formData.offerText || 'Under ₹299',
    offerBgColor: formData.offerBgColor || '#047857',
    offerTextColor: formData.offerTextColor || '#ffffff'
  }), [formData, editingId]);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Visual Nested Subcategories
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Manually create and apply visual showcase cards for any category and subcategory.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800">
              Total: <strong>{items.length}</strong> | Active: <strong>{items.filter(i => i.isActive).length}</strong>
            </span>
          </div>

          {items.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-2xl font-bold text-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Permanently remove all auto-generated and existing visual cards"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeletingAll ? 'Removing All...' : 'Remove All Cards'}</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-200 active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Create Visual Subcategory</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filters & Search */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          {/* Parent Category Filter Dropdown */}
          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setSelectedSubCategoryFilter('all');
              }}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-700 cursor-pointer"
            >
              <option value="all">All Parent Categories ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Parent Subcategory Filter Dropdown */}
          <div>
            <select
              value={selectedSubCategoryFilter}
              onChange={(e) => setSelectedSubCategoryFilter(e.target.value)}
              disabled={selectedCategoryFilter === 'all' || filterAvailableSubCategories.length === 0}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-700 cursor-pointer disabled:opacity-50"
            >
              <option value="all">
                {selectedCategoryFilter === 'all' ? 'Select Category First' : `All Subcategories (${filterAvailableSubCategories.length})`}
              </option>
              {filterAvailableSubCategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-700 cursor-pointer"
            >
              <option value="all">All Status (Active & Inactive)</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {(searchQuery || selectedCategoryFilter !== 'all' || selectedSubCategoryFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {filteredItems.length} of {items.length} visual nested subcategories</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('all');
                setSelectedSubCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="text-emerald-700 font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Visual Nested Subcategories Table / List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-3 p-4 border-b border-gray-100 bg-gray-50 text-[11px] font-black text-gray-500 uppercase tracking-wider">
          <div className="col-span-1 text-center">Order</div>
          <div className="col-span-1 text-center">Card</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Parent Hierarchy</div>
          <div className="col-span-2">Slug / URL</div>
          <div className="col-span-2 text-right pr-4">Actions</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 font-bold">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            Loading visual nested subcategories...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-800">No Visual Nested Subcategories Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchQuery || selectedCategoryFilter !== 'all'
                ? 'No items matched your search/filter criteria. Try changing filters.'
                : 'Click "Create Visual Subcategory" above to manually add your first visual showcase card.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnter={(e) => handleDragEnter(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className="grid grid-cols-12 gap-3 p-3.5 items-center hover:bg-emerald-50/30 transition-colors bg-white cursor-move group"
              >
                {/* Order & Drag Handle */}
                <div className="col-span-1 flex items-center justify-center gap-1 text-gray-400 group-hover:text-emerald-600">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-mono font-bold text-gray-500">{item.order || index + 1}</span>
                </div>

                {/* Card Thumbnail */}
                <div className="col-span-1 flex justify-center">
                  <div className="w-12 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm shrink-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Name & Offer Badge */}
                <div className="col-span-3 min-w-0 pr-2 space-y-1">
                  <h4 className="text-sm font-black text-gray-900 truncate">
                    {item.name ? item.name : <span className="text-gray-400 font-normal italic text-xs">No name below card</span>}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight truncate max-w-full"
                      style={{
                        backgroundColor: item.offerBgColor || '#047857',
                        color: item.offerTextColor || '#ffffff'
                      }}
                    >
                      {item.offerText || item.badgeText || 'Under ₹299'}
                    </span>
                  </div>
                </div>

                {/* Parent Hierarchy */}
                <div className="col-span-3 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 truncate">
                    <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-800">
                      {item.categoryName || item.categoryId}
                    </span>
                    <span className="text-gray-400">›</span>
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.subCategoryName || item.subCategoryId}
                    </span>
                  </div>
                </div>

                {/* Slug / Route */}
                <div className="col-span-2 text-xs font-mono text-gray-500 truncate">
                  /{item.seoSlug || item.slug}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 pr-2">
                  <button
                    onClick={() => toggleActive(item.id, !item.isActive)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      item.isActive
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                    }`}
                    title={item.isActive ? 'Active (Visible on store)' : 'Inactive (Hidden)'}
                  >
                    {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                    title="Edit Visual Nested Subcategory"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create & Edit Modal with Live Card Preview */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-4xl w-full relative z-10 shadow-2xl border border-gray-100 overflow-hidden my-8 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">
                      {editingId ? 'Edit Visual Nested Subcategory' : 'Create Visual Nested Subcategory'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Manually configure card details, parent hierarchy, imagery, and display.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Two Columns (Form + Live Preview) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto">
                {/* Form Column */}
                <form onSubmit={handleSave} className="lg:col-span-7 p-6 space-y-4 border-r border-gray-100">
                  
                  {/* Quick Select from existing nested subcategories across the catalog */}
                  {!editingId && allCatalogNestedSubcategories.length > 0 && (
                    <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
                      <label className="block text-[11px] font-black text-emerald-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                        Quick Select Any Existing Nested Subcategory
                      </label>
                      <select
                        onChange={(e) => handleSelectCatalogNested(e.target.value)}
                        defaultValue=""
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Choose from existing catalog nested subcategories --</option>
                        {allCatalogNestedSubcategories.map(item => (
                          <option key={`${item.catId}-${item.subId}-${item.nested.id}`} value={`${item.catId}:::${item.subId}:::${item.nested.id}`}>
                            {item.catName} › {item.subName} › {item.nested.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Parent Category & Parent SubCategory (Dynamic Cascading Selection) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        Target Parent Category *
                      </label>
                      <select
                        required
                        value={formData.categoryId || ''}
                        onChange={(e) => handleFormCategoryChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="" disabled>Select Parent Category</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        Target Parent Subcategory *
                      </label>
                      <select
                        required
                        value={formData.subCategoryId || ''}
                        onChange={(e) => handleFormSubCategoryChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="" disabled>Select Subcategory</option>
                        {formAvailableSubCategories.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick Select within selected subcategory (if available) */}
                  {formAvailableNestedSubCategories.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-black text-gray-600 uppercase tracking-wider mb-1">
                        Select Existing Nested Subcategory in this Subcategory (Optional)
                      </label>
                      <select
                        onChange={(e) => handleSelectExistingNested(e.target.value)}
                        defaultValue=""
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Or type/customize name below --</option>
                        {formAvailableNestedSubCategories.map(n => (
                          <option key={n.id} value={n.id}>{n.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Name Input (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                        Category / Brand Name (Optional)
                      </label>
                      <span className="text-[10px] font-bold text-gray-400">
                        Optional (displayed below card)
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Graphic T-Shirts (or leave blank to hide name below card)"
                      value={formData.name || ''}
                      onChange={handleNameChange}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Image Upload & URL */}
                  <div>
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                      Visual Card Image *
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black rounded-2xl cursor-pointer transition-colors border border-emerald-200 shadow-sm">
                          <Upload className="w-4 h-4" />
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-xs text-gray-400 font-bold">OR</span>
                        <input
                          type="text"
                          placeholder="Paste image URL (https://...)"
                          value={formData.image || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                          className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Offer / Price Strip Configuration */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-gray-50 rounded-2xl border border-emerald-100/80 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-emerald-700" />
                          Offer / Price Text (Bottom Strip) *
                        </label>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                          Colored bottom strip
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Under ₹299, Min 50% Off, Starting ₹199"
                        value={formData.offerText || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, offerText: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-2xl text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                      />

                      {/* Quick Presets for Offer Text */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[
                          'Under ₹299',
                          'Under ₹499',
                          'Under ₹999',
                          'Starting ₹199',
                          'Min 50% Off',
                          'Min 70% Off',
                          'Flat 40% Off',
                          'Best Deals'
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, offerText: preset }))}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              formData.offerText === preset
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-gray-700 hover:bg-emerald-100/60 border border-gray-200'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Strip Colors (Background & Text) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-100/70">
                      {/* Background Color */}
                      <div>
                        <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Strip Background Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.offerBgColor || '#047857'}
                            onChange={(e) => setFormData(prev => ({ ...prev, offerBgColor: e.target.value }))}
                            className="w-9 h-9 rounded-xl border border-gray-200 p-0.5 cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={formData.offerBgColor || '#047857'}
                            onChange={(e) => setFormData(prev => ({ ...prev, offerBgColor: e.target.value }))}
                            placeholder="#047857"
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        {/* Preset color swatches */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[
                            { name: 'Emerald', color: '#047857' },
                            { name: 'Teal', color: '#0f766e' },
                            { name: 'Crimson', color: '#dc2626' },
                            { name: 'Royal Blue', color: '#1d4ed8' },
                            { name: 'Purple', color: '#7c3aed' },
                            { name: 'Amber', color: '#d97706' },
                            { name: 'Rose', color: '#be123c' },
                            { name: 'Dark Slate', color: '#0f172a' }
                          ].map(swatch => (
                            <button
                              key={swatch.color}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, offerBgColor: swatch.color }))}
                              title={swatch.name}
                              className={`w-6 h-6 rounded-lg transition-transform hover:scale-110 cursor-pointer border ${
                                formData.offerBgColor === swatch.color ? 'ring-2 ring-emerald-500 scale-110' : 'border-black/10'
                              }`}
                              style={{ backgroundColor: swatch.color }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Text Color */}
                      <div>
                        <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                          Strip Text Color
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={formData.offerTextColor || '#ffffff'}
                            onChange={(e) => setFormData(prev => ({ ...prev, offerTextColor: e.target.value }))}
                            className="w-9 h-9 rounded-xl border border-gray-200 p-0.5 cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={formData.offerTextColor || '#ffffff'}
                            onChange={(e) => setFormData(prev => ({ ...prev, offerTextColor: e.target.value }))}
                            placeholder="#ffffff"
                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        {/* Preset text color swatches */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[
                            { name: 'White', color: '#ffffff' },
                            { name: 'Yellow', color: '#fef08a' },
                            { name: 'Light Cyan', color: '#cffafe' },
                            { name: 'Light Green', color: '#bbf7d0' },
                            { name: 'Black', color: '#000000' }
                          ].map(swatch => (
                            <button
                              key={swatch.color}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, offerTextColor: swatch.color }))}
                              title={swatch.name}
                              className={`w-6 h-6 rounded-lg transition-transform hover:scale-110 cursor-pointer border ${
                                formData.offerTextColor === swatch.color ? 'ring-2 ring-emerald-500 scale-110' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: swatch.color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Display Order & URL Slug */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.order || 1}
                        onChange={(e) => setFormData(prev => ({ ...prev, order: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                        URL Slug
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. graphic-t-shirts"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value, seoSlug: e.target.value }))}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Active / Inactive Status Switch */}
                  <div className="pt-2 flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <span className="text-xs font-black text-gray-900 block">Status: {formData.isActive !== false ? 'Active' : 'Inactive'}</span>
                      <span className="text-[11px] text-gray-500">
                        {formData.isActive !== false ? 'Card will appear on matching category pages' : 'Card will be hidden from customer storefront'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, isActive: prev.isActive === false ? true : false }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        formData.isActive !== false ? 'bg-emerald-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.isActive !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <button type="submit" className="hidden" />
                </form>

                {/* Live Card Preview Column */}
                <div className="lg:col-span-5 p-6 bg-gradient-to-b from-gray-50 to-emerald-50/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-black uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Live Card Preview
                      </span>

                      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('desktop')}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            previewDevice === 'desktop' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                          }`}
                          title="Desktop View"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('mobile')}
                          className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            previewDevice === 'mobile' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'
                          }`}
                          title="Mobile View"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-center p-2">
                      <div className={previewDevice === 'mobile' ? 'w-44' : 'w-56'}>
                        <VisualNestedSubcategoryCard
                          item={previewItem}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200/60 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-md shadow-emerald-200 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? 'Saving...' : 'Save Visual Subcategory'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

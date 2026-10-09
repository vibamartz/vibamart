import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles, Plus, Edit2, Trash2, Eye, EyeOff, Search, Filter,
  GripVertical, Image as ImageIcon, Upload, X, Save, Check, RefreshCw,
  Layers, ChevronDown, ChevronRight, Tag, ArrowUpDown, Smartphone, Monitor, Link2,
  Shapes, Frame, Type, Sliders, Palette, CheckCircle2, GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { VisualNestedSubcategory, Category, SubCategory } from '../../shared/types';
import { useVisualNestedSubcategoryStore, useCategoryStore } from '../../backend/store';
import { createSlug } from '../../shared/utilities/slug';
import { compressDataUrl } from '../../backend/services/categoryStorageService';
import VisualNestedSubcategoryCard from '../../shared/components/VisualNestedSubcategoryCard';
import { FRAME_SHAPES, getFrameConfig, VisualFrameDefs } from '../../shared/components/visualFrames';

interface FlatParentOption {
  key: string;
  catId: string;
  catName: string;
  subId: string;
  subName: string;
  nestedId?: string;
  nestedName?: string;
  parentTargetId: string;
  parentTargetName: string;
  parentTargetType: 'subcategory' | 'nested_subcategory';
  parentPathIds: string[];
  parentPathNames: string[];
  level: number;
  label: string;
  item: SubCategory;
}

export default function VisualNestedSubcategoriesAdminView() {
  const { items, loading, addItem, updateItem, deleteItem, deleteAllItems, toggleActive, reorderItems } = useVisualNestedSubcategoryStore();
  const { categories } = useCategoryStore();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeFrameTab, setActiveFrameTab] = useState<'all' | 'Standard Shapes' | 'Architectural & Scalloped Frames' | 'Traditional & Heritage'>('all');

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
    nestedSubCategoryId: '',
    nestedSubCategoryName: '',
    parentTargetId: '',
    parentTargetName: '',
    parentTargetType: 'subcategory',
    parentPathIds: [],
    parentPathNames: [],
    targetUrl: '',
    order: 1,
    isActive: true,
    frameShape: 'portrait-3-4',
    showOfferStrip: true,
    offerText: 'Under ₹299',
    offerBgColor: '#047857',
    offerTextColor: '#ffffff',
    offerFontSize: '11px',
    offerFontWeight: '900',
    seoTitle: ''
  });

  // Drag and Drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // All catalog parent hierarchy nodes (subcategories, nested subcategories, and deeper)
  const allCatalogParentOptions = useMemo(() => {
    const list: FlatParentOption[] = [];
    if (!Array.isArray(categories)) return list;

    categories.forEach(cat => {
      cat.subcategories?.forEach(sub => {
        // Level 1 Subcategory option
        list.push({
          key: `${cat.id}:::${sub.id}:::root`,
          catId: cat.id,
          catName: cat.name,
          subId: sub.id,
          subName: sub.name,
          parentTargetId: sub.id,
          parentTargetName: sub.name,
          parentTargetType: 'subcategory',
          parentPathIds: [cat.id, sub.id],
          parentPathNames: [cat.name, sub.name],
          level: 1,
          label: `${cat.name} › ${sub.name}`,
          item: sub
        });

        // Level 2 Nested Subcategories
        sub.subcategories?.forEach(nested => {
          list.push({
            key: `${cat.id}:::${sub.id}:::${nested.id}`,
            catId: cat.id,
            catName: cat.name,
            subId: sub.id,
            subName: sub.name,
            nestedId: nested.id,
            nestedName: nested.name,
            parentTargetId: nested.id,
            parentTargetName: nested.name,
            parentTargetType: 'nested_subcategory',
            parentPathIds: [cat.id, sub.id, nested.id],
            parentPathNames: [cat.name, sub.name, nested.name],
            level: 2,
            label: `${cat.name} › ${sub.name} › ${nested.name}`,
            item: nested
          });

          // Level 3 Deeper Subcategories (if any exist)
          nested.subcategories?.forEach(deep => {
            list.push({
              key: `${cat.id}:::${sub.id}:::${nested.id}:::${deep.id}`,
              catId: cat.id,
              catName: cat.name,
              subId: sub.id,
              subName: sub.name,
              nestedId: deep.id,
              nestedName: deep.name,
              parentTargetId: deep.id,
              parentTargetName: deep.name,
              parentTargetType: 'nested_subcategory',
              parentPathIds: [cat.id, sub.id, nested.id, deep.id],
              parentPathNames: [cat.name, sub.name, nested.name, deep.name],
              level: 3,
              label: `${cat.name} › ${sub.name} › ${nested.name} › ${deep.name}`,
              item: deep
            });
          });
        });
      });
    });

    return list;
  }, [categories]);

  // Subcategories available for filter
  const filterAvailableSubCategories = useMemo(() => {
    if (selectedCategoryFilter === 'all') return [];
    return allCatalogParentOptions.filter(p => p.catId === selectedCategoryFilter);
  }, [selectedCategoryFilter, allCatalogParentOptions]);

  // Subcategories available in modal form based on selected parent category
  const formAvailableSubCategories = useMemo(() => {
    if (!formData.categoryId) return [];
    const cat = categories.find(c => c.id === formData.categoryId);
    return cat?.subcategories || [];
  }, [formData.categoryId, categories]);

  // Nested subcategories available inside currently selected parent subcategory
  const formAvailableNestedSubCategories = useMemo(() => {
    if (!formData.categoryId || !formData.subCategoryId) return [];
    const cat = categories.find(c => c.id === formData.categoryId);
    const sub = cat?.subcategories?.find(s => s.id === formData.subCategoryId);
    return sub?.subcategories || [];
  }, [formData.categoryId, formData.subCategoryId, categories]);

  // Filtered Items for Admin View
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
        const matchNested = item.nestedSubCategoryName?.toLowerCase().includes(q);
        const matchTarget = item.parentTargetName?.toLowerCase().includes(q);
        const matchShape = item.frameShape?.toLowerCase().includes(q);
        if (!matchName && !matchOffer && !matchSlug && !matchCat && !matchSub && !matchNested && !matchTarget && !matchShape) return false;
      }

      // 2. Category Filter
      if (selectedCategoryFilter !== 'all' && item.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // 3. SubCategory / Target Parent Filter
      if (selectedSubCategoryFilter !== 'all') {
        const isMatch = 
          item.parentTargetId === selectedSubCategoryFilter ||
          item.nestedSubCategoryId === selectedSubCategoryFilter ||
          item.subCategoryId === selectedSubCategoryFilter;
        if (!isMatch) return false;
      }

      // 4. Status Filter
      if (statusFilter === 'active' && item.isActive === false) return false;
      if (statusFilter === 'inactive' && item.isActive !== false) return false;

      // 5. Shape Filter
      if (selectedShapeFilter !== 'all') {
        const itemShape = item.frameShape || 'portrait-3-4';
        if (itemShape !== selectedShapeFilter) return false;
      }

      return true;
    });
  }, [items, searchQuery, selectedCategoryFilter, selectedSubCategoryFilter, statusFilter, selectedShapeFilter]);

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
      nestedSubCategoryId: '',
      nestedSubCategoryName: '',
      parentTargetId: defaultSub,
      parentTargetName: defaultSubObj?.name || '',
      parentTargetType: 'subcategory',
      parentPathIds: [defaultCat, defaultSub].filter(Boolean),
      parentPathNames: [defaultCatObj?.name, defaultSubObj?.name].filter(Boolean) as string[],
      targetUrl: '',
      order: items.length + 1,
      isActive: true,
      frameShape: 'portrait-3-4',
      showOfferStrip: true,
      offerText: 'Under ₹299',
      offerBgColor: '#047857',
      offerTextColor: '#ffffff',
      offerFontSize: '11px',
      offerFontWeight: '900',
      seoTitle: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: VisualNestedSubcategory) => {
    setEditingId(item.id);
    setFormData({
      ...item,
      parentTargetId: item.parentTargetId || item.nestedSubCategoryId || item.subCategoryId,
      parentTargetName: item.parentTargetName || item.nestedSubCategoryName || item.subCategoryName || '',
      parentTargetType: item.parentTargetType || (item.nestedSubCategoryId ? 'nested_subcategory' : 'subcategory'),
      frameShape: item.frameShape || 'portrait-3-4',
      showOfferStrip: item.showOfferStrip !== undefined ? item.showOfferStrip : Boolean(item.offerText),
      offerText: item.offerText || 'Under ₹299',
      offerBgColor: item.offerBgColor || '#047857',
      offerTextColor: item.offerTextColor || '#ffffff',
      offerFontSize: item.offerFontSize || '11px',
      offerFontWeight: item.offerFontWeight || '900',
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
      subCategoryName: firstSub?.name || '',
      nestedSubCategoryId: '',
      nestedSubCategoryName: '',
      parentTargetId: firstSub?.id || '',
      parentTargetName: firstSub?.name || '',
      parentTargetType: 'subcategory',
      parentPathIds: [catId, firstSub?.id].filter(Boolean) as string[],
      parentPathNames: [catObj?.name, firstSub?.name].filter(Boolean) as string[]
    }));
  };

  // Handle Form SubCategory change
  const handleFormSubCategoryChange = (subId: string) => {
    const subObj = formAvailableSubCategories.find(s => s.id === subId);
    setFormData(prev => ({
      ...prev,
      subCategoryId: subId,
      subCategoryName: subObj?.name || '',
      nestedSubCategoryId: '',
      nestedSubCategoryName: '',
      parentTargetId: subId,
      parentTargetName: subObj?.name || '',
      parentTargetType: 'subcategory',
      parentPathIds: [prev.categoryId || '', subId].filter(Boolean),
      parentPathNames: [prev.categoryName || '', subObj?.name || ''].filter(Boolean)
    }));
  };

  // Handle Target Placement Level change (Directly under Subcategory vs. Under a specific Nested Subcategory)
  const handleFormPlacementChange = (targetValue: string) => {
    if (targetValue === 'direct_sub') {
      const subObj = formAvailableSubCategories.find(s => s.id === formData.subCategoryId);
      setFormData(prev => ({
        ...prev,
        nestedSubCategoryId: '',
        nestedSubCategoryName: '',
        parentTargetId: prev.subCategoryId || '',
        parentTargetName: subObj?.name || prev.subCategoryName || '',
        parentTargetType: 'subcategory',
        parentPathIds: [prev.categoryId || '', prev.subCategoryId || ''].filter(Boolean),
        parentPathNames: [prev.categoryName || '', subObj?.name || prev.subCategoryName || ''].filter(Boolean)
      }));
      return;
    }

    // A specific nested subcategory was selected
    const nestedObj = formAvailableNestedSubCategories.find(n => n.id === targetValue);
    if (nestedObj) {
      setFormData(prev => ({
        ...prev,
        nestedSubCategoryId: nestedObj.id,
        nestedSubCategoryName: nestedObj.name,
        parentTargetId: nestedObj.id,
        parentTargetName: nestedObj.name,
        parentTargetType: 'nested_subcategory',
        parentPathIds: [prev.categoryId || '', prev.subCategoryId || '', nestedObj.id].filter(Boolean),
        parentPathNames: [prev.categoryName || '', prev.subCategoryName || '', nestedObj.name].filter(Boolean)
      }));
    }
  };

  // Quick select ANY existing subcategory or nested subcategory across the entire catalog
  const handleQuickSelectParentNode = (compositeKey: string) => {
    if (!compositeKey) return;
    const found = allCatalogParentOptions.find(item => item.key === compositeKey);
    if (found) {
      setFormData(prev => ({
        ...prev,
        categoryId: found.catId,
        categoryName: found.catName,
        subCategoryId: found.subId,
        subCategoryName: found.subName,
        nestedSubCategoryId: found.nestedId || '',
        nestedSubCategoryName: found.nestedName || '',
        parentTargetId: found.parentTargetId,
        parentTargetName: found.parentTargetName,
        parentTargetType: found.parentTargetType,
        parentPathIds: found.parentPathIds,
        parentPathNames: found.parentPathNames,
        name: prev.name || found.item.name || '',
        slug: prev.slug || found.item.slug || createSlug(found.item.name),
        seoSlug: prev.seoSlug || (found.item as any).seoSlug || found.item.slug || createSlug(found.item.name),
        image: prev.image || found.item.image || '',
        seoTitle: `${found.item.name} | ViBa Mart`
      }));
      toast.success(`Target set to: ${found.label}`);
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
          const compressed = await compressDataUrl(rawResult, 900, 1200, 0.88);
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

      const effectiveTargetId = formData.parentTargetId || formData.nestedSubCategoryId || formData.subCategoryId || '';
      const effectiveTargetName = formData.parentTargetName || formData.nestedSubCategoryName || formData.subCategoryName || '';
      const effectiveTargetType = formData.parentTargetType || (formData.nestedSubCategoryId ? 'nested_subcategory' : 'subcategory');

      const payload: Partial<VisualNestedSubcategory> = {
        name: cardName,
        slug: formData.slug || fallbackSlug,
        seoSlug: formData.seoSlug || formData.slug || fallbackSlug,
        image: formData.image,
        categoryId: formData.categoryId,
        categoryName: formData.categoryName,
        subCategoryId: formData.subCategoryId,
        subCategoryName: formData.subCategoryName,
        nestedSubCategoryId: formData.nestedSubCategoryId || '',
        nestedSubCategoryName: formData.nestedSubCategoryName || '',
        parentTargetId: effectiveTargetId,
        parentTargetName: effectiveTargetName,
        parentTargetType: effectiveTargetType,
        parentPathIds: formData.parentPathIds || [formData.categoryId, formData.subCategoryId, ...(formData.nestedSubCategoryId ? [formData.nestedSubCategoryId] : [])].filter(Boolean) as string[],
        parentPathNames: formData.parentPathNames || [formData.categoryName, formData.subCategoryName, ...(formData.nestedSubCategoryName ? [formData.nestedSubCategoryName] : [])].filter(Boolean) as string[],
        targetUrl: formData.targetUrl || '',
        order: Number(formData.order) || 1,
        isActive: formData.isActive !== false,
        frameShape: formData.frameShape || 'portrait-3-4',
        showOfferStrip: formData.showOfferStrip !== undefined ? formData.showOfferStrip : true,
        offerText: formData.offerText || 'Under ₹299',
        offerBgColor: formData.offerBgColor || '#047857',
        offerTextColor: formData.offerTextColor || '#ffffff',
        offerFontSize: formData.offerFontSize || '11px',
        offerFontWeight: formData.offerFontWeight || '900',
        seoTitle: formData.seoTitle?.trim() || ''
      };

      if (editingId) {
        await updateItem(editingId, payload);
        toast.success('Visual nested subcategory updated successfully!');
      } else {
        await addItem(payload as any);
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

  // Delete All Cards Handler
  const handleDeleteAll = async () => {
    if (items.length === 0) {
      toast.error('No visual cards to remove.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete all ${items.length} visual nested subcategory cards? This will completely clear all cards.`)) {
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

  // Filter frame shapes based on active tab in modal
  const filteredFrameShapes = useMemo(() => {
    if (activeFrameTab === 'all') return FRAME_SHAPES;
    return FRAME_SHAPES.filter(f => f.category === activeFrameTab);
  }, [activeFrameTab]);

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
    nestedSubCategoryId: formData.nestedSubCategoryId || '',
    nestedSubCategoryName: formData.nestedSubCategoryName || '',
    parentTargetId: formData.parentTargetId || formData.subCategoryId || 'sub',
    parentTargetName: formData.parentTargetName || formData.subCategoryName || 'Subcategory',
    parentTargetType: formData.parentTargetType || 'subcategory',
    order: Number(formData.order) || 1,
    isActive: formData.isActive !== false,
    frameShape: formData.frameShape || 'portrait-3-4',
    showOfferStrip: formData.showOfferStrip !== undefined ? formData.showOfferStrip : true,
    offerText: formData.offerText || 'Under ₹299',
    offerBgColor: formData.offerBgColor || '#047857',
    offerTextColor: formData.offerTextColor || '#ffffff',
    offerFontSize: formData.offerFontSize || '11px',
    offerFontWeight: formData.offerFontWeight || '900'
  }), [formData, editingId]);

  return (
    <div className="space-y-6">
      {/* Global SVG clipPath definitions */}
      <VisualFrameDefs />

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
            Configure visual showcase cards under any Subcategory or Nested Subcategory across the catalog hierarchy.
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
              title="Permanently remove all visual cards"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, parent, frame..."
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

          {/* Target Subcategory / Nested Subcategory Filter Dropdown */}
          <div>
            <select
              value={selectedSubCategoryFilter}
              onChange={(e) => setSelectedSubCategoryFilter(e.target.value)}
              disabled={selectedCategoryFilter === 'all' || filterAvailableSubCategories.length === 0}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-700 cursor-pointer disabled:opacity-50"
            >
              <option value="all">
                {selectedCategoryFilter === 'all' ? 'Select Category First' : `All Target Parents (${filterAvailableSubCategories.length})`}
              </option>
              {filterAvailableSubCategories.map(p => (
                <option key={p.key} value={p.parentTargetId}>
                  {p.level === 2 ? '↳ ' : ''}{p.parentTargetName} ({p.parentTargetType === 'nested_subcategory' ? 'Nested' : 'Subcategory'})
                </option>
              ))}
            </select>
          </div>

          {/* Shape / Frame Filter */}
          <div>
            <select
              value={selectedShapeFilter}
              onChange={(e) => setSelectedShapeFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-700 cursor-pointer"
            >
              <option value="all">All Frame Shapes ({FRAME_SHAPES.length})</option>
              {FRAME_SHAPES.map(shape => (
                <option key={shape.id} value={shape.id}>{shape.name}</option>
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

        {(searchQuery || selectedCategoryFilter !== 'all' || selectedSubCategoryFilter !== 'all' || statusFilter !== 'all' || selectedShapeFilter !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {filteredItems.length} of {items.length} visual nested subcategories</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('all');
                setSelectedSubCategoryFilter('all');
                setSelectedShapeFilter('all');
                setStatusFilter('all');
              }}
              className="text-emerald-700 font-bold hover:underline cursor-pointer"
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
          <div className="col-span-1 text-center">Shape Preview</div>
          <div className="col-span-3">Name & Offer Strip</div>
          <div className="col-span-3">Parent Hierarchy & Target</div>
          <div className="col-span-2">Frame / Ratio</div>
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
              {searchQuery || selectedCategoryFilter !== 'all' || selectedShapeFilter !== 'all'
                ? 'No items matched your search/filter criteria. Try changing filters.'
                : 'Click "Create Visual Subcategory" above to add your first visual showcase card.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredItems.map((item, index) => {
              const frameConfig = getFrameConfig(item.frameShape);
              const isOfferOn = item.showOfferStrip !== false && Boolean(item.offerText || item.badgeText);
              const isNestedTarget = Boolean(item.nestedSubCategoryId || item.parentTargetType === 'nested_subcategory');

              const breadcrumb = item.parentPathNames && item.parentPathNames.length > 0
                ? item.parentPathNames.join(' › ')
                : `${item.categoryName || item.categoryId} › ${item.subCategoryName || item.subCategoryId}${item.nestedSubCategoryName ? ` › ${item.nestedSubCategoryName}` : ''}`;
              
              return (
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

                  {/* Card Thumbnail with true Frame Shape applied */}
                  <div className="col-span-1 flex justify-center">
                    <div 
                      className={`w-11 h-13 overflow-hidden bg-gray-100 shadow-xs shrink-0 flex items-center justify-center ${
                        !frameConfig.clipPathId ? (frameConfig.borderRadius || 'rounded-xl') : ''
                      }`}
                      style={{
                        clipPath: frameConfig.clipPathId ? `url(#${frameConfig.clipPathId})` : undefined,
                        WebkitClipPath: frameConfig.clipPathId ? `url(#${frameConfig.clipPathId})` : undefined,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name || 'thumbnail'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Name & Offer Badge */}
                  <div className="col-span-3 min-w-0 pr-2 space-y-1">
                    <h4 className="text-sm font-black text-gray-900 truncate">
                      {item.name ? item.name : <span className="text-gray-400 font-normal italic text-xs">No name below card</span>}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isOfferOn ? (
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[10px] uppercase tracking-tight truncate max-w-full"
                          style={{
                            backgroundColor: item.offerBgColor || '#047857',
                            color: item.offerTextColor || '#ffffff',
                            fontWeight: item.offerFontWeight || '900',
                            fontSize: item.offerFontSize || '10px'
                          }}
                        >
                          {item.offerText || item.badgeText || 'Under ₹299'}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-500">
                          Offer Strip: Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Parent Hierarchy & Target Badge */}
                  <div className="col-span-3 min-w-0 space-y-1">
                    <div className="text-xs font-bold text-gray-800 truncate" title={breadcrumb}>
                      {breadcrumb}
                    </div>
                    <div>
                      {isNestedTarget ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <GitBranch className="w-3 h-3" />
                          Nested Subcategory Target
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Layers className="w-3 h-3" />
                          Subcategory Target
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Frame / Ratio Badge */}
                  <div className="col-span-2 min-w-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold truncate">
                      <Frame className="w-3 h-3 shrink-0" />
                      <span className="truncate">{frameConfig.name}</span>
                    </span>
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
              );
            })}
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
              className="bg-white rounded-3xl max-w-5xl w-full relative z-10 shadow-2xl border border-gray-100 overflow-hidden my-6 max-h-[92vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">
                      {editingId ? 'Edit Visual Nested Subcategory' : 'Create Visual Nested Subcategory'}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Place visual showcase cards under any Subcategory or Nested Subcategory.
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
                <form onSubmit={handleSave} className="lg:col-span-7 p-6 space-y-5 border-r border-gray-100">
                  
                  {/* Quick Select from any existing subcategory or nested subcategory across the entire catalog */}
                  {!editingId && allCatalogParentOptions.length > 0 && (
                    <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80">
                      <label className="block text-[11px] font-black text-emerald-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                        Quick Select Target Parent (Subcategory or Nested Subcategory)
                      </label>
                      <select
                        onChange={(e) => handleQuickSelectParentNode(e.target.value)}
                        defaultValue=""
                        className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Choose from existing catalog subcategories & nested items --</option>
                        {allCatalogParentOptions.map(item => (
                          <option key={item.key} value={item.key}>
                            {item.label} ({item.level === 2 ? 'Nested Subcategory' : item.level === 3 ? 'Deep Subcategory' : 'Subcategory'})
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

                  {/* Placement Level & Specific Target Selector */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <label className="block text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-emerald-600" />
                      Placement Level & Target Parent Item *
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Choose whether this visual card appears directly when clicking the Subcategory or inside a specific Nested Subcategory.
                    </p>

                    <select
                      value={formData.nestedSubCategoryId || 'direct_sub'}
                      onChange={(e) => handleFormPlacementChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="direct_sub">
                        Directly under {formData.subCategoryName || 'Subcategory'} (Level 1 Subcategory)
                      </option>
                      {formAvailableNestedSubCategories.map(n => (
                        <option key={n.id} value={n.id}>
                          Under {formData.subCategoryName} › {n.name} (Level 2 Nested Subcategory)
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-600">
                      <span className="font-bold">Active Placement:</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black">
                        {formData.parentTargetName || formData.subCategoryName || 'Subcategory'}
                      </span>
                      <span className="text-gray-400">
                        ({formData.nestedSubCategoryId ? 'Nested Subcategory' : 'Subcategory'})
                      </span>
                    </div>
                  </div>

                  {/* Name Input (Optional) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
                        Category / Brand Name (Optional)
                      </label>
                      <span className="text-[10px] font-bold text-gray-400">
                        Displayed below the card
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Graphic T-Shirts (or leave blank to hide text below card)"
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

                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* FRAME / SHAPE SELECTION SECTION */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  <div className="p-4 bg-gradient-to-br from-indigo-50/40 via-white to-gray-50 rounded-2xl border border-indigo-100/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Shapes className="w-4 h-4 text-indigo-600" />
                        Image / Frame Shape (Optional)
                      </label>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                        {getFrameConfig(formData.frameShape).name}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-500 font-medium">
                      Select any frame or image ratio. The image automatically adapts without distortion.
                    </p>

                    {/* Frame Category Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
                      {[
                        { id: 'all', label: 'All Frames' },
                        { id: 'Standard Shapes', label: 'Standard Ratios' },
                        { id: 'Architectural & Scalloped Frames', label: 'Arch & Scallop Frames' },
                        { id: 'Traditional & Heritage', label: 'Heritage & Temple' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveFrameTab(tab.id as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            activeFrameTab === tab.id
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Frame Shapes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {filteredFrameShapes.map(shape => {
                        const isSelected = (formData.frameShape || 'portrait-3-4') === shape.id;
                        return (
                          <button
                            key={shape.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, frameShape: shape.id }))}
                            className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                              isSelected
                                ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span className="text-xs font-black text-gray-900 leading-tight">
                                {shape.name}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500 line-clamp-1">
                              {shape.description}
                            </span>
                            <span className="mt-1 inline-block text-[9px] font-mono font-bold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded w-fit">
                              {shape.aspectRatio}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* OFFER STRIP CONFIGURATION (OPTIONAL & CUSTOMIZABLE) */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  <div className="p-4 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-gray-50 rounded-2xl border border-emerald-100/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-700" />
                        <div>
                          <label className="block text-xs font-black text-emerald-950 uppercase tracking-wider">
                            Bottom Offer / Price Strip
                          </label>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {formData.showOfferStrip !== false ? 'Offer strip is enabled' : 'Disabled (Shows clean image & name only)'}
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, showOfferStrip: prev.showOfferStrip === false ? true : false }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                          formData.showOfferStrip !== false ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.showOfferStrip !== false ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {formData.showOfferStrip !== false ? (
                      <div className="space-y-3 pt-2 border-t border-emerald-100/70">
                        {/* Offer Text */}
                        <div>
                          <label className="block text-[11px] font-black text-emerald-950 uppercase tracking-wider mb-1.5">
                            Offer / Price Text
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Under ₹299, Min 50% Off, Starting ₹199"
                            value={formData.offerText || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, offerText: e.target.value }))}
                            className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-2xl text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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

                        {/* Font Size & Weight Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                              Font Size
                            </label>
                            <div className="flex items-center gap-1.5">
                              {[
                                { label: 'Small', value: '10px' },
                                { label: 'Regular', value: '11px' },
                                { label: 'Medium', value: '12px' },
                                { label: 'Large', value: '14px' }
                              ].map(sz => (
                                <button
                                  key={sz.value}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, offerFontSize: sz.value }))}
                                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                    (formData.offerFontSize || '11px') === sz.value
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-white text-gray-700 hover:bg-emerald-100/50 border border-gray-200'
                                  }`}
                                >
                                  {sz.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-black text-gray-700 uppercase tracking-wider mb-1.5">
                              Font Weight
                            </label>
                            <div className="flex items-center gap-1.5">
                              {[
                                { label: 'Normal', value: '400' },
                                { label: 'Medium', value: '500' },
                                { label: 'Bold', value: '700' },
                                { label: 'Black', value: '900' }
                              ].map(wt => (
                                <button
                                  key={wt.value}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, offerFontWeight: wt.value }))}
                                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                    (formData.offerFontWeight || '900') === wt.value
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-white text-gray-700 hover:bg-emerald-100/50 border border-gray-200'
                                  }`}
                                >
                                  {wt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white rounded-xl border border-gray-200 text-xs text-gray-500 text-center font-medium">
                        Offer strip is disabled. Only the shaped image and category name (if provided) will display.
                      </div>
                    )}
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

                    <div className="mt-4 p-3 bg-white/80 rounded-2xl border border-gray-200/70 text-center space-y-1">
                      <p className="text-[11px] font-bold text-gray-600">
                        Frame: <span className="text-indigo-700">{getFrameConfig(formData.frameShape).name}</span> ({getFrameConfig(formData.frameShape).aspectRatio})
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Target Parent: <span className="text-emerald-800 font-bold">{formData.parentTargetName || formData.subCategoryName || 'Subcategory'}</span>
                      </p>
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

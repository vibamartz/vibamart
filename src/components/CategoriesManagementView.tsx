import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category, SubCategory } from '../types';
import { GripVertical, Edit2, Trash2, Eye, EyeOff, Plus, Image as ImageIcon, X, Save, RotateCcw, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';

export default function CategoriesManagementView() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Expanded State
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  const [expandedSubs, setExpandedSubs] = useState<string[]>([]);

  const toggleCat = (id: string) => setExpandedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleSub = (catId: string, subId: string) => {
    const id = `${catId}-${subId}`;
    setExpandedSubs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'subcategory' | 'nested'>('category');
  const [activeParentCatId, setActiveParentCatId] = useState<string | null>(null);
  const [activeSubCatId, setActiveSubCatId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    image: '',
    seoSlug: '',
    seoTitle: '',
    seoDescription: '',
    isVisible: true
  });
  const [isSaving, setIsSaving] = useState(false);

  // Drag and Drop refs (Top level only)
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    const q = collection(db, 'categories');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const catsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Category));
      
      catsData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      
      setCategories(catsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Drag and Drop Logic (Categories only) ---
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
      const newCategories = [...categories];
      const draggedItemContent = newCategories[dragItem.current];
      
      newCategories.splice(dragItem.current, 1);
      newCategories.splice(dragOverItem.current, 0, draggedItemContent);
      
      setCategories(newCategories);
      
      const batch = writeBatch(db);
      newCategories.forEach((cat, index) => {
        const catRef = doc(db, 'categories', cat.id);
        batch.update(catRef, { order: index });
      });

      try {
        await batch.commit();
        toast.success("Categories reordered successfully");
      } catch (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to save new order");
      }
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // --- Form Handlers ---
  const handleOpenAddModal = (type: 'category' | 'subcategory' | 'nested', catId: string | null = null, subId: string | null = null) => {
    setModalType(type);
    setActiveParentCatId(catId);
    setActiveSubCatId(subId);
    setEditingId(null);
    setFormData({
      name: '',
      image: '',
      seoSlug: '',
      seoTitle: '',
      seoDescription: '',
      isVisible: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (type: 'category' | 'subcategory' | 'nested', data: any, catId: string | null = null, subId: string | null = null) => {
    setModalType(type);
    setActiveParentCatId(catId);
    setActiveSubCatId(subId);
    setEditingId(data.id);
    setFormData({
      name: data.name || '',
      image: data.image || '',
      seoSlug: data.seoSlug || '',
      seoTitle: data.seoTitle || '',
      seoDescription: data.seoDescription || '',
      isVisible: data.isVisible ?? true,
    });
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB max
        toast.error('Image size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generateId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || Date.now().toString();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (modalType === 'category') {
        const catId = editingId || generateId(formData.name);
        const catRef = doc(db, 'categories', catId);
        
        if (editingId) {
          await updateDoc(catRef, { ...formData });
        } else {
          await setDoc(catRef, {
            id: catId,
            ...formData,
            order: categories.length,
            subcategories: []
          });
        }
      } else if (modalType === 'subcategory' && activeParentCatId) {
        const parentCat = categories.find(c => c.id === activeParentCatId);
        if (!parentCat) throw new Error("Parent not found");
        
        const subId = editingId || generateId(formData.name);
        let updatedSubs = [...(parentCat.subcategories || [])];
        
        if (editingId) {
          updatedSubs = updatedSubs.map(s => s.id === subId ? { ...s, name: formData.name!, image: formData.image || '' } : s);
        } else {
          updatedSubs.push({ id: subId, name: formData.name!, image: formData.image || '', subcategories: [] });
          setExpandedCats(prev => prev.includes(activeParentCatId) ? prev : [...prev, activeParentCatId]);
        }
        
        await updateDoc(doc(db, 'categories', activeParentCatId), { subcategories: updatedSubs });
      } else if (modalType === 'nested' && activeParentCatId && activeSubCatId) {
        const parentCat = categories.find(c => c.id === activeParentCatId);
        if (!parentCat) throw new Error("Parent not found");
        
        const nestedId = editingId || generateId(formData.name);
        const updatedSubs = (parentCat.subcategories || []).map(sub => {
          if (sub.id === activeSubCatId) {
            let updatedNested = [...(sub.subcategories || [])];
            if (editingId) {
              updatedNested = updatedNested.map(n => n.id === nestedId ? { ...n, name: formData.name!, image: formData.image || '' } : n);
            } else {
              updatedNested.push({ id: nestedId, name: formData.name!, image: formData.image || '' });
              const expandId = `${activeParentCatId}-${activeSubCatId}`;
              setExpandedSubs(prev => prev.includes(expandId) ? prev : [...prev, expandId]);
            }
            return { ...sub, subcategories: updatedNested };
          }
          return sub;
        });
        
        await updateDoc(doc(db, 'categories', activeParentCatId), { subcategories: updatedSubs });
      }

      toast.success('Saved successfully');
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: 'category' | 'subcategory' | 'nested', name: string, catId: string, subId?: string, nestedId?: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    
    try {
      if (type === 'category') {
        await deleteDoc(doc(db, 'categories', catId));
      } else if (type === 'subcategory' && subId) {
        const parentCat = categories.find(c => c.id === catId);
        if (parentCat) {
          const updatedSubs = (parentCat.subcategories || []).filter(s => s.id !== subId);
          await updateDoc(doc(db, 'categories', catId), { subcategories: updatedSubs });
        }
      } else if (type === 'nested' && subId && nestedId) {
        const parentCat = categories.find(c => c.id === catId);
        if (parentCat) {
          const updatedSubs = (parentCat.subcategories || []).map(sub => {
            if (sub.id === subId) {
              return { ...sub, subcategories: (sub.subcategories || []).filter(n => n.id !== nestedId) };
            }
            return sub;
          });
          await updateDoc(doc(db, 'categories', catId), { subcategories: updatedSubs });
        }
      }
      toast.success('Deleted successfully');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const handleToggleVisibility = async (category: Category) => {
    try {
      const newVisibility = !(category.isVisible ?? true);
      const catRef = doc(db, 'categories', category.id);
      await updateDoc(catRef, { isVisible: newVisibility });
      toast.success(`Category is now ${newVisibility ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm("This will restore any missing default categories. Continue?")) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let added = 0;
      INITIAL_CATEGORIES.forEach((cat) => {
        const exists = categories.some(c => c.id === cat.id);
        if (!exists) {
          const catRef = doc(db, 'categories', cat.id);
          batch.set(catRef, cat);
          added++;
        }
      });
      if (added > 0) {
        await batch.commit();
        toast.success(`Restored ${added} default categories!`);
      } else {
        toast.success("All default categories are already present.");
      }
    } catch (error) {
      console.error("Restore error:", error);
      toast.error("Failed to restore default categories.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (modalType === 'category' && !editingId && formData.seoSlug === formData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) {
       setFormData(prev => ({
         ...prev,
         name: newName,
         seoSlug: newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
       }));
    } else {
       setFormData(prev => ({ ...prev, name: newName }));
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Category Management</h2>
          <p className="text-sm text-gray-500">Organize and manage your categories and subcategories.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRestoreDefaults}
            disabled={isSaving}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className={`w-5 h-5 ${isSaving ? 'animate-spin' : ''}`} />
            Restore Defaults
          </button>
          <button
            onClick={() => handleOpenAddModal('category')}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Category
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <div className="col-span-1 text-center">Order</div>
          <div className="col-span-1">Image</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Details</div>
          <div className="col-span-3 text-right pr-4">Actions</div>
        </div>
        
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-medium">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-medium">No categories found. Click "Add Category" to create one.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {categories.map((category, index) => {
              const isCatExpanded = expandedCats.includes(category.id);
              return (
                <React.Fragment key={category.id}>
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50/80 transition-colors bg-white cursor-move group"
                  >
                    <div className="col-span-1 flex justify-center text-gray-400 group-hover:text-indigo-500 transition-colors">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="col-span-1 flex items-center">
                      {category.image ? (
                        <img src={category.image} alt={category.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 bg-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                          <ImageIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="col-span-4 font-bold text-gray-900 truncate pr-4 flex items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); toggleCat(category.id); }} className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400">
                        {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      {category.name}
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{category.subcategories?.length || 0} subs</span>
                    </div>
                    <div className="col-span-3 text-sm text-gray-500 font-mono text-xs truncate pr-4">
                      /{category.seoSlug}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-2 pr-2">
                      <button
                        onClick={() => handleToggleVisibility(category)}
                        className={`p-2 rounded-xl transition-colors ${category.isVisible ?? true ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                        title={category.isVisible ?? true ? 'Visible' : 'Hidden'}
                      >
                        {category.isVisible ?? true ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleOpenAddModal('subcategory', category.id)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors" title="Add Subcategory">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleOpenEditModal('category', category)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors" title="Edit Category">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete('category', category.name, category.id)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors" title="Delete Category">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories (Level 2) */}
                  {isCatExpanded && category.subcategories && category.subcategories.length > 0 && (
                    <div className="bg-gray-50/50 border-t border-b border-gray-100">
                      {category.subcategories.map((sub) => {
                        const isSubExpanded = expandedSubs.includes(`${category.id}-${sub.id}`);
                        return (
                          <React.Fragment key={sub.id}>
                            <div className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-gray-100/80 transition-colors pl-8 border-b border-gray-100/50 last:border-0">
                              <div className="col-span-1 text-gray-300 flex justify-center"><CornerDownRight className="w-4 h-4" /></div>
                              <div className="col-span-1 flex items-center">
                                {sub.image ? (
                                  <img src={sub.image} alt={sub.name} className="w-8 h-8 rounded-md object-cover border border-gray-200 bg-white" />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200"><ImageIcon className="w-4 h-4 text-gray-400" /></div>
                                )}
                              </div>
                              <div className="col-span-6 font-bold text-gray-700 truncate pr-4 flex items-center gap-3">
                                <button onClick={() => toggleSub(category.id, sub.id)} className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400">
                                  {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {sub.name}
                                <span className="text-[10px] font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{sub.subcategories?.length || 0} nested</span>
                              </div>
                              <div className="col-span-4 flex items-center justify-end gap-2 pr-2">
                                <button onClick={() => handleOpenAddModal('nested', category.id, sub.id)} className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Add Nested Subcategory"><Plus className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleOpenEditModal('subcategory', sub, category.id)} className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Edit Subcategory"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDelete('subcategory', sub.name, category.id, sub.id)} className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors" title="Delete Subcategory"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>

                            {/* Nested Subcategories (Level 3) */}
                            {isSubExpanded && sub.subcategories && sub.subcategories.length > 0 && (
                              <div className="bg-indigo-50/30">
                                {sub.subcategories.map(nested => (
                                  <div key={nested.id} className="grid grid-cols-12 gap-4 p-2 items-center hover:bg-indigo-50/50 transition-colors pl-16 border-b border-gray-100/50 last:border-0">
                                    <div className="col-span-1 text-gray-300 flex justify-center"><CornerDownRight className="w-3 h-3" /></div>
                                    <div className="col-span-1 flex items-center">
                                      {nested.image ? (
                                        <img src={nested.image} alt={nested.name} className="w-6 h-6 rounded border border-gray-200 bg-white object-cover" />
                                      ) : (
                                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center border border-gray-200"><ImageIcon className="w-3 h-3 text-gray-400" /></div>
                                      )}
                                    </div>
                                    <div className="col-span-6 font-medium text-gray-600 text-sm truncate pr-4">
                                      {nested.name}
                                    </div>
                                    <div className="col-span-4 flex items-center justify-end gap-1.5 pr-2">
                                      <button onClick={() => handleOpenEditModal('nested', nested, category.id, sub.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors" title="Edit Nested Subcategory"><Edit2 className="w-3 h-3" /></button>
                                      <button onClick={() => handleDelete('nested', nested.name, category.id, sub.id, nested.id)} className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors" title="Delete Nested Subcategory"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSaving && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Edit' : 'Add'} {modalType === 'category' ? 'Category' : modalType === 'subcategory' ? 'Subcategory' : 'Nested Subcategory'}
                </h3>
                <button
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="category-form" onSubmit={handleSave} className="space-y-6">
                  
                  {/* Basic Info */}
                  <div className={`grid grid-cols-1 ${modalType === 'category' ? 'md:grid-cols-2' : ''} gap-6`}>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Name <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleNameChange}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        placeholder="e.g. Electronics"
                      />
                    </div>
                    
                    {modalType === 'category' && (
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">Visibility</label>
                        <div className="flex items-center h-[46px]">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.isVisible}
                              onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            <span className="ml-3 text-sm font-medium text-gray-700">
                              {formData.isVisible ? 'Visible on storefront' : 'Hidden'}
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">Image</label>
                    <div className="flex items-start gap-6">
                      <div className="shrink-0">
                        {formData.image ? (
                          <div className="relative group">
                            <img src={formData.image} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-indigo-100 shadow-sm" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                              <label className="cursor-pointer p-2 bg-white rounded-full hover:bg-gray-100 transition-colors">
                                <Edit2 className="w-4 h-4 text-gray-900" />
                                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-300 transition-colors cursor-pointer group">
                            <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-2" />
                            <span className="text-[10px] font-bold text-gray-500">Upload</span>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                          </label>
                        )}
                      </div>
                      <div className="flex-1 text-sm text-gray-500 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <p className="font-bold text-blue-800 mb-1">Image Guidelines</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-600/80">
                          <li>Recommended size: 400x400px (1:1 ratio)</li>
                          <li>Max file size: 2MB</li>
                          <li>Supported formats: JPEG, PNG, WebP</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* SEO Section (Only for Categories) */}
                  {modalType === 'category' && (
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-5">
                      <h4 className="font-bold text-gray-900 flex items-center gap-2">
                        Search Engine Optimization
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] uppercase px-2 py-0.5 rounded-full font-black tracking-wider">SEO</span>
                      </h4>
                      
                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">URL Slug</label>
                        <div className="flex items-center">
                          <span className="bg-gray-200 text-gray-500 px-4 py-2.5 rounded-l-xl border border-r-0 border-gray-200 text-sm font-mono">
                            /category/
                          </span>
                          <input
                            type="text"
                            value={formData.seoSlug}
                            onChange={(e) => setFormData({ ...formData, seoSlug: e.target.value })}
                            className="flex-1 bg-white border border-gray-200 rounded-r-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono text-sm"
                            placeholder="electronics"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Keep it short and descriptive. Use dashes (-) for spaces.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">SEO Title</label>
                        <input
                          type="text"
                          value={formData.seoTitle}
                          onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                          maxLength={60}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                          placeholder="e.g. Buy Premium Electronics Online"
                        />
                        <div className="flex justify-between mt-1">
                          <p className="text-[11px] text-gray-400">Title shown in search engine results.</p>
                          <p className="text-[11px] font-medium text-gray-400">{formData.seoTitle?.length || 0}/60</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-bold text-gray-700">SEO Description</label>
                        <textarea
                          value={formData.seoDescription}
                          onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                          maxLength={160}
                          rows={3}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none custom-scrollbar"
                          placeholder="e.g. Discover the latest and greatest in consumer electronics..."
                        />
                        <div className="flex justify-between mt-1">
                          <p className="text-[11px] text-gray-400">Description shown in search engine results.</p>
                          <p className="text-[11px] font-medium text-gray-400">{formData.seoDescription?.length || 0}/160</p>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="category-form"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

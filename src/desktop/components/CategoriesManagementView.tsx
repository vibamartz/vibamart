import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Category, SubCategory } from '../../shared/types';
import { GripVertical, Edit2, Trash2, Eye, EyeOff, Plus, Image as ImageIcon, X, Save, RotateCcw, ChevronDown, ChevronRight, CornerDownRight, Sparkles, Wand2, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES as INITIAL_CATEGORIES } from '../../shared/constants';
import CategoryLogo from '../../shared/components/CategoryLogo';
import { generateCategoryLogo, isDuplicateCategory } from '../../shared/utilities/categoryLogoGenerator';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import {
  mergeCategoryTreeWithDefaults,
  recordDeletedCategoryId,
  removeDeletedCategoryId,
  clearLocalDeletedCategoryIds
} from '../../shared/utilities/categoryHierarchyUtils';
import { useCategoryStore } from '../../backend/store';
import { sanitizeAndUploadCategoryDoc, migrateCategoryDocIfNeeded, compressDataUrl } from '../../backend/services/categoryStorageService';
import { useVisualNestedSubcategoryStore } from '../../backend/store';
import { createSlug } from '../../shared/utilities/slug';
import VisualNestedSubcategoriesAdminView from './VisualNestedSubcategoriesAdminView';

interface CategoriesManagementViewProps {
  onNavigateToVisualNested?: () => void;
}

export default function CategoriesManagementView({ onNavigateToVisualNested }: CategoriesManagementViewProps = {}) {
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('viba_categories_cache') || localStorage.getItem('viba_cached_categories');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return mergeCategoryTreeWithDefaults(parsed);
          }
        }
      } catch {}
    }
    return mergeCategoryTreeWithDefaults([]);
  });
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'visual_nested'>('categories');

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
      const deletedMetaDoc = snapshot.docs.find(d => d.id === '_deleted_metadata');
      const externalDeletedIds = (deletedMetaDoc?.data()?.deletedIds as string[]) || [];

      const catsData = snapshot.docs
        .filter(d => d.id !== '_deleted_metadata')
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Category));

      const merged = mergeCategoryTreeWithDefaults(catsData, externalDeletedIds);
      setCategories(merged);
      useCategoryStore.getState().setCategories(merged);
      try {
        const json = JSON.stringify(merged);
        localStorage.setItem('viba_categories_cache', json);
        localStorage.setItem('viba_cached_categories', json);
      } catch {}
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
  // --- Form Handlers ---
  const handleOpenAddModal = (type: 'category' | 'subcategory' | 'nested', catId: string | null = null, subId: string | null = null) => {
    if (type === 'subcategory' && catId) {
      const parentCat = categories.find(c => c.id === catId);
      if (parentCat && (parentCat.subcategories || []).length >= 30) {
        toast.error('Maximum limit of 30 subcategories per category reached.');
        return;
      }
    }
    if (type === 'nested' && catId && subId) {
      const parentCat = categories.find(c => c.id === catId);
      const parentSub = parentCat?.subcategories?.find(s => s.id === subId);
      if (parentSub && (parentSub.subcategories || []).length >= 30) {
        toast.error('Maximum limit of 30 nested subcategories per subcategory reached.');
        return;
      }
    }

    setModalType(type);
    setActiveParentCatId(catId);
    setActiveSubCatId(subId);
    setEditingId(null);
    setFormData({
      name: '',
      image: '',
      icon: '',
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
      icon: data.icon || '',
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
      if (file.size > 10 * 1024 * 1024) { // 10MB max
        toast.error('File size exceeds 10 MB limit');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawResult = reader.result as string;
        try {
          const compressed = await compressDataUrl(rawResult, 600, 600, 0.8);
          setFormData(prev => ({ ...prev, image: compressed }));
        } catch {
          setFormData(prev => ({ ...prev, image: rawResult }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoGenerateLogo = (nameToUse?: string) => {
    const targetName = nameToUse || formData.name;
    if (!targetName) return;
    const generated = generateCategoryLogo(targetName, categories);
    setFormData(prev => ({
      ...prev,
      image: generated.image,
      icon: generated.icon,
    }));
  };

  const generateId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || Date.now().toString();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('Name is required.');
      return;
    }

    // Check duplicate category name/slug (Requirement 3)
    if (modalType === 'category' && isDuplicateCategory(formData.name, categories, editingId || undefined)) {
      toast.error(`A category named "${formData.name.trim()}" already exists. Duplicate categories are not allowed.`);
      return;
    }

    // Ensure category/subcategory logo is present (Auto-generate if missing)
    let finalLogo = formData.image;
    let finalIcon = formData.icon;
    if (!finalLogo) {
      const generated = generateCategoryLogo(formData.name, categories);
      finalLogo = generated.image;
      finalIcon = generated.icon;
    }

    setIsSaving(true);
    try {
      let savedCatId = '';
      let savedSubId = '';
      let savedNestedId = '';
      let nextCategories = [...categories];

      if (modalType === 'category') {
        const catId = editingId || generateId(formData.name);
        savedCatId = catId;
        const catRef = doc(db, 'categories', catId);

        const existingCat = editingId ? categories.find(c => c.id === catId) : null;
        const rawPayload: any = {
          ...existingCat,
          id: catId,
          name: formData.name!.trim(),
          slug: formData.seoSlug?.trim() || existingCat?.slug || createSlug(formData.name!),
          seoSlug: formData.seoSlug?.trim() || existingCat?.seoSlug || createSlug(formData.name!),
          seoTitle: formData.seoTitle?.trim() || '',
          seoDescription: formData.seoDescription?.trim() || '',
          isVisible: formData.isVisible ?? true,
          order: existingCat?.order ?? categories.length,
          subcategories: existingCat?.subcategories ?? [],
        };

        // Requirement: Do not store Main Category icons or image URLs in the database
        delete rawPayload.image;
        delete rawPayload.iconImage;
        delete rawPayload.icon;
        delete rawPayload.iconName;

        const sanitizedPayload = await sanitizeAndUploadCategoryDoc(rawPayload);
        await setDoc(catRef, sanitizedPayload, { merge: true });

        if (existingCat) {
          nextCategories = categories.map(c => c.id === catId ? { ...c, ...sanitizedPayload } : c);
        } else {
          nextCategories.push(sanitizedPayload as Category);
        }
      } else if (modalType === 'subcategory' && activeParentCatId) {
        const parentCat = categories.find(c => c.id === activeParentCatId);
        if (!parentCat) throw new Error("Parent category not found");

        if (!editingId && (parentCat.subcategories || []).length >= 30) {
          toast.error('Maximum limit of 30 subcategories per category reached.');
          setIsSaving(false);
          return;
        }

        const subId = editingId || generateId(formData.name);
        savedSubId = subId;
        let updatedSubs = [...(parentCat.subcategories || [])];

        const subPayload = {
          id: subId,
          name: formData.name!.trim(),
          image: finalLogo || formData.image || '',
          icon: finalIcon || formData.icon || '',
          isVisible: formData.isVisible ?? true,
        };

        if (editingId) {
          updatedSubs = updatedSubs.map(s => s.id === subId ? { ...s, ...subPayload } : s);
        } else {
          updatedSubs.push({ ...subPayload, subcategories: [] });
          setExpandedCats(prev => prev.includes(activeParentCatId) ? prev : [...prev, activeParentCatId]);
        }

        const catRef = doc(db, 'categories', activeParentCatId);
        const updatedCat = {
          ...parentCat,
          subcategories: updatedSubs
        };
        const sanitizedPayload = await sanitizeAndUploadCategoryDoc(updatedCat);
        await setDoc(catRef, sanitizedPayload, { merge: true });

        nextCategories = categories.map(c => c.id === activeParentCatId ? (sanitizedPayload as Category) : c);
      } else if (modalType === 'nested' && activeParentCatId && activeSubCatId) {
        const parentCat = categories.find(c => c.id === activeParentCatId);
        if (!parentCat) throw new Error("Parent category not found");

        const parentSub = parentCat.subcategories?.find(s => s.id === activeSubCatId);
        if (!editingId && (parentSub?.subcategories || []).length >= 30) {
          toast.error('Maximum limit of 30 nested subcategories per subcategory reached.');
          setIsSaving(false);
          return;
        }

        const nestedId = editingId || generateId(formData.name);
        savedNestedId = nestedId;
        const updatedSubs = (parentCat.subcategories || []).map(sub => {
          if (sub.id === activeSubCatId) {
            let updatedNested = [...(sub.subcategories || [])];
            const nestedPayload = {
              id: nestedId,
              name: formData.name!.trim(),
              image: finalLogo || formData.image || '',
              icon: finalIcon || formData.icon || '',
              isVisible: formData.isVisible ?? true,
            };
            if (editingId) {
              updatedNested = updatedNested.map(n => n.id === nestedId ? { ...n, ...nestedPayload } : n);
            } else {
              updatedNested.push(nestedPayload);
              const expandId = `${activeParentCatId}-${activeSubCatId}`;
              setExpandedSubs(prev => prev.includes(expandId) ? prev : [...prev, expandId]);
            }
            return { ...sub, subcategories: updatedNested };
          }
          return sub;
        });

        const catRef = doc(db, 'categories', activeParentCatId);
        const updatedCat = {
          ...parentCat,
          subcategories: updatedSubs
        };
        const sanitizedPayload = await sanitizeAndUploadCategoryDoc(updatedCat);
        await setDoc(catRef, sanitizedPayload, { merge: true });

        nextCategories = categories.map(c => c.id === activeParentCatId ? (sanitizedPayload as Category) : c);
      }

      // If an item was previously blacklisted/deleted, un-blacklist it now
      const idsToUnblacklist = [savedCatId, savedSubId, savedNestedId, formData.seoSlug, createSlug(formData.name!)].filter(Boolean);
      idsToUnblacklist.forEach(id => removeDeletedCategoryId(id));
      try {
        const metaDocRef = doc(db, 'categories', '_deleted_metadata');
        await setDoc(metaDocRef, { deletedIds: arrayRemove(...idsToUnblacklist) }, { merge: true });
      } catch {}

      // Optimistically update local and global category store immediately
      setCategories(nextCategories);
      useCategoryStore.getState().setCategories(nextCategories);
      try {
        const json = JSON.stringify(nextCategories);
        localStorage.setItem('viba_categories_cache', json);
        localStorage.setItem('viba_cached_categories', json);
      } catch {}

      toast.success('Saved successfully.');
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving category/subcategory:', error);
      toast.error('Unable to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (type: 'category' | 'subcategory' | 'nested', name: string, catId: string, subId?: string, nestedId?: string) => {
    const typeLabel = type === 'category' ? 'Category' : type === 'subcategory' ? 'Subcategory' : 'Nested Subcategory';
    if (!window.confirm(`Are you sure you want to delete the ${typeLabel} "${name}"?\n\nThis will permanently delete this ${typeLabel.toLowerCase()} and cannot be undone.`)) {
      return;
    }

    try {
      const idsToDelete: string[] = [];
      let nextCategories = [...categories];

      if (type === 'category') {
        const cat = categories.find(c => c.id === catId);
        idsToDelete.push(catId);
        if (cat?.slug) idsToDelete.push(cat.slug);
        if (cat?.seoSlug) idsToDelete.push(cat.seoSlug);
        if (cat?.name) idsToDelete.push(createSlug(cat.name));

        (cat?.subcategories || []).forEach(s => {
          if (s.id) idsToDelete.push(s.id);
          if (s.slug) idsToDelete.push(s.slug);
          if (s.name) idsToDelete.push(createSlug(s.name));
          (s.subcategories || []).forEach(n => {
            if (n.id) idsToDelete.push(n.id);
            if (n.slug) idsToDelete.push(n.slug);
            if (n.name) idsToDelete.push(createSlug(n.name));
          });
        });

        await deleteDoc(doc(db, 'categories', catId));
        nextCategories = categories.filter(c => c.id !== catId);
      } else if (type === 'subcategory' && subId) {
        const parentCat = categories.find(c => c.id === catId);
        if (parentCat) {
          const sub = parentCat.subcategories?.find(s => s.id === subId);
          idsToDelete.push(subId);
          if (sub?.slug) idsToDelete.push(sub.slug);
          if (sub?.name) idsToDelete.push(createSlug(sub.name));

          (sub?.subcategories || []).forEach(n => {
            if (n.id) idsToDelete.push(n.id);
            if (n.slug) idsToDelete.push(n.slug);
            if (n.name) idsToDelete.push(createSlug(n.name));
          });

          const updatedSubs = (parentCat.subcategories || []).filter(s => s.id !== subId);
          const updatedCat = { ...parentCat, subcategories: updatedSubs };
          const sanitizedPayload = await sanitizeAndUploadCategoryDoc(updatedCat);
          await setDoc(doc(db, 'categories', catId), sanitizedPayload, { merge: true });

          nextCategories = categories.map(c => c.id === catId ? (sanitizedPayload as Category) : c);
        }
      } else if (type === 'nested' && subId && nestedId) {
        const parentCat = categories.find(c => c.id === catId);
        if (parentCat) {
          const parentSub = parentCat.subcategories?.find(s => s.id === subId);
          const nested = parentSub?.subcategories?.find(n => n.id === nestedId);
          idsToDelete.push(nestedId);
          if (nested?.slug) idsToDelete.push(nested.slug);
          if (nested?.name) idsToDelete.push(createSlug(nested.name));

          const updatedSubs = (parentCat.subcategories || []).map(sub => {
            if (sub.id === subId) {
              return {
                ...sub,
                subcategories: (sub.subcategories || []).filter(n => n.id !== nestedId)
              };
            }
            return sub;
          });
          const updatedCat = { ...parentCat, subcategories: updatedSubs };
          const sanitizedPayload = await sanitizeAndUploadCategoryDoc(updatedCat);
          await setDoc(doc(db, 'categories', catId), sanitizedPayload, { merge: true });

          nextCategories = categories.map(c => c.id === catId ? (sanitizedPayload as Category) : c);
        }
      }

      // Record deleted IDs in localStorage and in Firestore _deleted_metadata
      const validIds = idsToDelete.filter(Boolean);
      validIds.forEach(id => recordDeletedCategoryId(id));
      try {
        const metaDocRef = doc(db, 'categories', '_deleted_metadata');
        await setDoc(metaDocRef, { deletedIds: arrayUnion(...validIds) }, { merge: true });
      } catch (err) {
        console.warn('Could not update _deleted_metadata in Firestore:', err);
      }

      // Optimistically update local state and global category store immediately
      setCategories(nextCategories);
      useCategoryStore.getState().setCategories(nextCategories);
      try {
        const json = JSON.stringify(nextCategories);
        localStorage.setItem('viba_categories_cache', json);
        localStorage.setItem('viba_cached_categories', json);
      } catch {}

      toast.success(`${typeLabel} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(`Failed to delete ${typeLabel.toLowerCase()}.`);
    }
  };

  const handleToggleVisibility = async (category: Category) => {
    const newVisibility = !(category.isVisible ?? true);
    const updatedCats = categories.map(c => c.id === category.id ? { ...c, isVisible: newVisibility } : c);
    setCategories(updatedCats);
    useCategoryStore.getState().setCategories(updatedCats);
    try {
      const catRef = doc(db, 'categories', category.id);
      await updateDoc(catRef, { isVisible: newVisibility });
      toast.success(`Category is now ${newVisibility ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
      setCategories(categories);
      useCategoryStore.getState().setCategories(categories);
    }
  };

  const handleToggleSubVisibility = async (catId: string, subId: string) => {
    const parentCat = categories.find(c => c.id === catId);
    if (!parentCat) return;
    let newVis = true;
    const updatedSubs = (parentCat.subcategories || []).map(s => {
      if (s.id === subId) {
        newVis = !(s.isVisible ?? true);
        return { ...s, isVisible: newVis };
      }
      return s;
    });
    const updatedCats = categories.map(c => c.id === catId ? { ...c, subcategories: updatedSubs } : c);
    setCategories(updatedCats);
    useCategoryStore.getState().setCategories(updatedCats);
    try {
      await updateDoc(doc(db, 'categories', catId), { subcategories: updatedSubs });
      toast.success(`Subcategory is now ${newVis ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling subcategory visibility:', error);
      toast.error('Failed to update subcategory visibility');
      setCategories(categories);
      useCategoryStore.getState().setCategories(categories);
    }
  };

  const handleToggleNestedVisibility = async (catId: string, subId: string, nestedId: string) => {
    const parentCat = categories.find(c => c.id === catId);
    if (!parentCat) return;
    let newVis = true;
    const updatedSubs = (parentCat.subcategories || []).map(sub => {
      if (sub.id === subId) {
        const updatedNested = (sub.subcategories || []).map(n => {
          if (n.id === nestedId) {
            newVis = !(n.isVisible ?? true);
            return { ...n, isVisible: newVis };
          }
          return n;
        });
        return { ...sub, subcategories: updatedNested };
      }
      return sub;
    });
    const updatedCats = categories.map(c => c.id === catId ? { ...c, subcategories: updatedSubs } : c);
    setCategories(updatedCats);
    useCategoryStore.getState().setCategories(updatedCats);
    try {
      await updateDoc(doc(db, 'categories', catId), { subcategories: updatedSubs });
      toast.success(`Nested subcategory is now ${newVis ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling nested subcategory visibility:', error);
      toast.error('Failed to update nested subcategory visibility');
      setCategories(categories);
      useCategoryStore.getState().setCategories(categories);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm("This will safely restore ALL missing default subcategories and nested subcategories with their original uploaded images while preserving all custom categories and data. Continue?")) return;
    setIsSaving(true);
    const toastId = toast.loading('Restoring all subcategories and nested subcategories...');
    try {
      clearLocalDeletedCategoryIds();
      try {
        await deleteDoc(doc(db, 'categories', '_deleted_metadata'));
      } catch {}

      const mergedAll = mergeCategoryTreeWithDefaults(categories, []);
      const batch = writeBatch(db);
      let updatedCount = 0;
      let addedCount = 0;

      mergedAll.forEach((cat) => {
        if (cat.id === 'all-deals' || cat.slug === 'all-deals') return;
        const catRef = doc(db, 'categories', cat.id);
        const existsInState = categories.some(c => c.id === cat.id);

        const payload: any = cleanForFirestore({
          id: cat.id,
          name: cat.name,
          slug: cat.slug || createSlug(cat.name),
          seoSlug: cat.seoSlug || cat.slug || createSlug(cat.name),
          order: typeof cat.order === 'number' ? cat.order : categories.length,
          isVisible: cat.isVisible ?? true,
          subcategories: cat.subcategories || []
        });

        // Main Category icon logos must remain defined in source code, NOT in the database
        delete payload.image;
        delete payload.iconImage;
        delete payload.icon;
        delete payload.iconName;

        if (existsInState) {
          batch.update(catRef, { subcategories: payload.subcategories });
          updatedCount++;
        } else {
          batch.set(catRef, payload);
          addedCount++;
        }
      });

      await batch.commit();
      setCategories(mergedAll);
      useCategoryStore.getState().setCategories(mergedAll);
      try {
        const json = JSON.stringify(mergedAll);
        localStorage.setItem('viba_categories_cache', json);
        localStorage.setItem('viba_cached_categories', json);
      } catch {}
      toast.success(`Successfully restored all subcategories and nested subcategories with original images!`, { id: toastId });
    } catch (error: any) {
      console.error("Restore error:", error);
      toast.error(`Failed to restore categories: ${error?.message || error}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    if (modalType === 'category' && !editingId) {
      let autoImage = formData.image;
      let autoIcon = formData.icon;
      if (!formData.image && newName.length >= 3) {
        const autoGen = generateCategoryLogo(newName, categories);
        autoImage = autoGen.image;
        autoIcon = autoGen.icon;
      }
      setFormData(prev => ({
        ...prev,
        name: newName,
        seoSlug: slug,
        image: autoImage || prev.image,
        icon: autoIcon || prev.icon,
      }));
    } else {
      // For subcategories and nested subcategories:
      // Never overwrite the user's uploaded or selected photo when typing the name
      setFormData(prev => ({
        ...prev,
        name: newName,
      }));
    }
  };

  const handleAddNestedToVisual = async (cat: Category, sub: SubCategory, nested: SubCategory) => {
    try {
      const existing = useVisualNestedSubcategoryStore.getState().items.find(
        i => i.categoryId === cat.id && i.subCategoryId === sub.id && (i.name?.toLowerCase() === nested.name.toLowerCase() || i.slug === nested.slug)
      );
      if (existing) {
        toast.success(`"${nested.name}" is already in Visual Nested Subcategories`);
        if (onNavigateToVisualNested) onNavigateToVisualNested();
        else setActiveSubTab('visual_nested');
        return;
      }
      await useVisualNestedSubcategoryStore.getState().addItem({
        name: nested.name,
        slug: nested.slug || createSlug(nested.name),
        seoSlug: (nested as any).seoSlug || nested.slug || createSlug(nested.name),
        image: nested.image || sub.image || cat.image || '',
        categoryId: cat.id,
        categoryName: cat.name,
        subCategoryId: sub.id,
        subCategoryName: sub.name,
        nestedSubCategoryId: nested.id,
        nestedSubCategoryName: nested.name,
        parentTargetId: sub.id,
        parentTargetName: sub.name,
        parentTargetType: 'subcategory',
        parentPathIds: [cat.id, sub.id, nested.id],
        parentPathNames: [cat.name, sub.name, nested.name],
        order: useVisualNestedSubcategoryStore.getState().items.length + 1,
        isActive: true,
        frameShape: 'portrait-3-4',
        showOfferStrip: true,
        offerText: 'Under ₹299',
        offerBgColor: '#047857',
        offerTextColor: '#ffffff',
        offerFontSize: '11px',
        offerFontWeight: '900',
        seoTitle: `${nested.name} | ViBa Mart`
      });
      toast.success(`Added "${nested.name}" to Visual Nested Subcategories!`);
      if (onNavigateToVisualNested) onNavigateToVisualNested();
      else setActiveSubTab('visual_nested');
    } catch (err: any) {
      console.error('Failed to add to visual nested:', err);
      toast.error('Failed to add to Visual Nested Subcategories');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Tab Switcher */}
      <div className="flex items-center gap-2 bg-gray-100/80 p-1.5 rounded-2xl w-fit border border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSubTab('categories')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeSubTab === 'categories'
              ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50'
              : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Categories & Subcategories Tree</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onNavigateToVisualNested) {
              onNavigateToVisualNested();
            } else {
              setActiveSubTab('visual_nested');
            }
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${activeSubTab === 'visual_nested'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'text-gray-500 hover:text-gray-800'
            }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Visual Nested Subcategories</span>
        </button>
      </div>

      {activeSubTab === 'visual_nested' ? (
        <VisualNestedSubcategoriesAdminView />
      ) : (
        <>
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
            <div className="overflow-x-auto min-w-full">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1 text-center">Order</div>
                  <div className="col-span-1">Logo</div>
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
                          <CategoryLogo name={category.name} icon={category.icon} size="sm" />
                        </div>
                        <div className="col-span-4 font-bold text-gray-900 truncate pr-4 flex items-center gap-3">
                          <button onClick={(e) => { e.stopPropagation(); toggleCat(category.id); }} className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400">
                            {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          {category.name}
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{category.subcategories?.length || 0}/30 subs</span>
                        </div>
                        <div className="col-span-3 text-xs text-gray-400 font-mono truncate pr-4">
                          {category.id}
                        </div>
                        <div className="col-span-3 flex items-center justify-end gap-1.5 pr-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleVisibility(category); }}
                            className={`min-w-[34px] min-h-[34px] flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer touch-manipulation active:scale-95 ${category.isVisible ?? true ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                            title={category.isVisible ?? true ? 'Hide Category' : 'Show Category'}
                          >
                            {category.isVisible ?? true ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenAddModal('subcategory', category.id); }}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer touch-manipulation active:scale-95"
                            title="Add Subcategory"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal('category', category); }}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer touch-manipulation active:scale-95"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete('category', category.name, category.id); }}
                            className="min-w-[34px] min-h-[34px] flex items-center justify-center p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all cursor-pointer touch-manipulation active:scale-95"
                            title="Delete Category"
                          >
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
                                    <CategoryLogo name={sub.name} image={sub.image} icon={sub.icon} size="sm" />
                                  </div>
                                  <div className="col-span-6 font-bold text-gray-700 truncate pr-4 flex items-center gap-3">
                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleSub(category.id, sub.id); }} className="p-1 hover:bg-gray-200 rounded-md transition-colors text-gray-400">
                                      {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                    {sub.name}
                                    <span className="text-[10px] font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{sub.subcategories?.length || 0}/30 nested</span>
                                  </div>
                                  <div className="col-span-4 flex items-center justify-end gap-1.5 pr-2">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleToggleSubVisibility(category.id, sub.id); }}
                                      className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95 ${sub.isVisible ?? true ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`}
                                      title={sub.isVisible ?? true ? 'Hide Subcategory' : 'Show Subcategory'}
                                    >
                                      {sub.isVisible ?? true ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenAddModal('nested', category.id, sub.id); }}
                                      className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                      title="Add Nested Subcategory"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal('subcategory', sub, category.id); }}
                                      className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                      title="Edit Subcategory"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDelete('subcategory', sub.name, category.id, sub.id); }}
                                      className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                      title="Delete Subcategory"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Nested Subcategories (Level 3) */}
                                {isSubExpanded && sub.subcategories && sub.subcategories.length > 0 && (
                                  <div className="bg-indigo-50/30">
                                    {sub.subcategories.map(nested => (
                                      <div key={nested.id} className="grid grid-cols-12 gap-4 p-2 items-center hover:bg-indigo-50/50 transition-colors pl-16 border-b border-gray-100/50 last:border-0">
                                        <div className="col-span-1 text-gray-300 flex justify-center"><CornerDownRight className="w-3 h-3" /></div>
                                        <div className="col-span-1 flex items-center">
                                          <CategoryLogo name={nested.name} image={nested.image} icon={nested.icon} size="sm" />
                                        </div>
                                        <div className="col-span-6 font-medium text-gray-600 text-sm truncate pr-4">
                                          {nested.name}
                                        </div>
                                        <div className="col-span-4 flex items-center justify-end gap-1.5 pr-2">
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleAddNestedToVisual(category, sub, nested); }}
                                            className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                            title="Add to Visual Nested Subcategories"
                                          >
                                            <Sparkles className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleToggleNestedVisibility(category.id, sub.id, nested.id); }}
                                            className={`min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95 ${nested.isVisible ?? true ? 'text-emerald-600 hover:bg-emerald-100' : 'text-gray-400 hover:bg-gray-200'}`}
                                            title={nested.isVisible ?? true ? 'Hide Nested Subcategory' : 'Show Nested Subcategory'}
                                          >
                                            {nested.isVisible ?? true ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal('nested', nested, category.id, sub.id); }}
                                            className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                            title="Edit Nested Subcategory"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete('nested', nested.name, category.id, sub.id, nested.id); }}
                                            className="min-w-[32px] min-h-[32px] flex items-center justify-center p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer touch-manipulation active:scale-95"
                                            title="Delete Nested Subcategory"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
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
            </div>
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

                        <div className="space-y-1.5">
                          <label className="text-sm font-bold text-gray-700">Visibility</label>
                          <div className="flex items-center h-[46px]">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.isVisible ?? true}
                                onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                              <span className="ml-3 text-sm font-medium text-gray-700">
                                {formData.isVisible ?? true ? 'Visible on storefront' : 'Hidden'}
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Image & Logo Section */}
                      {modalType === 'category' ? (
                        <div className="space-y-1.5">
                          <label className="text-sm font-bold text-gray-700">Category Icon Logo</label>
                          <div className="flex items-center gap-6 p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100">
                            <div className="shrink-0">
                              <CategoryLogo name={formData.name || 'Category'} size="lg" />
                            </div>
                            <div className="flex-1 text-sm text-emerald-950">
                              <p className="font-bold text-emerald-900 mb-0.5">Source-Code Defined Icon Logo</p>
                              <p className="text-xs text-emerald-800/80 leading-relaxed">
                                Main Category icon logos are defined and maintained directly in the source code. Icons update automatically based on the category name.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-700">
                              {modalType === 'subcategory' ? 'Subcategory Photo / Image' : 'Nested Subcategory Photo / Image'}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateLogo()}
                              className="text-xs font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all border border-emerald-200"
                            >
                              <Wand2 className="w-3.5 h-3.5" /> Auto-Generate Unique Logo
                            </button>
                          </div>
                          <div className="flex items-start gap-6">
                            <div className="shrink-0">
                              {formData.image ? (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="relative group">
                                    <CategoryLogo name={formData.name || 'Category'} image={formData.image} icon={formData.icon} size="lg" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2">
                                      <label className="cursor-pointer p-2 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-md" title="Upload Custom Photo">
                                        <Edit2 className="w-4 h-4 text-gray-900" />
                                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleAutoGenerateLogo()}
                                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors text-emerald-600 shadow-md"
                                        title="Auto-Regenerate Unique Logo"
                                      >
                                        <Wand2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <label className="cursor-pointer text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-indigo-200">
                                      <Edit2 className="w-3 h-3" />
                                      <span>Replace</span>
                                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                                      className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 border border-rose-200"
                                      title="Remove Photo"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <label className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-300 transition-colors cursor-pointer group">
                                    <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-2" />
                                    <span className="text-[10px] font-bold text-gray-500">Upload</span>
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleAutoGenerateLogo()}
                                    className="flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors group"
                                  >
                                    <Wand2 className="w-6 h-6 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-tighter">Auto-Gen</span>
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 text-sm text-gray-500 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                              <p className="font-bold text-emerald-900 mb-1">Photo & Logo Guidelines</p>
                              <ul className="list-disc list-inside space-y-1 text-emerald-800/80 text-xs">
                                <li>Upload custom photo (JPG, PNG, WEBP) up to 10 MB.</li>
                                <li>Guarantees visual consistency across Mobile and Desktop.</li>
                                <li>You can edit, replace, remove, or provide an image URL below.</li>
                              </ul>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="text-xs font-bold text-gray-700 block mb-1">
                              {modalType === 'subcategory' ? 'Subcategory Photo URL / Image Link' : 'Nested Subcategory Photo URL / Image Link'}
                            </label>
                            <input
                              type="text"
                              value={formData.image || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                              placeholder="https://example.com/photo.webp or image link"
                              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none font-mono"
                            />
                          </div>
                        </div>
                      )}

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
        </>
      )}

    </motion.div>
  );
}

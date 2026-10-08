import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { VisualNestedSubcategory, Category, SubCategory } from '../../shared/types';
import { CATEGORIES } from '../../shared/constants';
import { createSlug, getCategorySlug, getSubcategorySlug } from '../../shared/utilities/slug';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import { compressDataUrl, uploadCategoryImageToStorage } from './categoryStorageService';

export const VISUAL_NESTED_SUBCATEGORIES_COLLECTION = 'visual_nested_subcategories';

/**
 * No automatic creation or auto-generation of visual nested subcategories.
 * Admin must manually create and apply every visual nested subcategory.
 */
export function getDefaultVisualNestedSubcategories(): VisualNestedSubcategory[] {
  return [];
}

export async function seedVisualNestedSubcategoriesIfEmpty(): Promise<void> {
  // Explicitly disabled: no automatic seeding or creation of visual nested subcategories.
}

/**
 * Create a new Visual Nested Subcategory (Manual Admin action only)
 */
export async function createVisualNestedSubcategory(
  data: Omit<VisualNestedSubcategory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<VisualNestedSubcategory> {
  const generatedId = `vns-${data.categoryId}-${data.subCategoryId}-${createSlug(data.name)}-${Date.now().toString().slice(-4)}`;
  
  let finalImage = data.image || '';
  if (finalImage.startsWith('data:') || finalImage.startsWith('blob:')) {
    try {
      finalImage = await uploadCategoryImageToStorage(finalImage, 'visual-nested', createSlug(data.name));
    } catch {
      finalImage = await compressDataUrl(finalImage, 800, 800, 0.85);
    }
  }

  const newItem: VisualNestedSubcategory = {
    ...data,
    id: generatedId,
    slug: data.slug || createSlug(data.name),
    seoSlug: data.seoSlug || data.slug || createSlug(data.name),
    image: finalImage,
    isActive: data.isActive !== false,
    isVisible: data.isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, generatedId);
  await setDoc(docRef, cleanForFirestore(newItem));

  return newItem;
}

/**
 * Update an existing Visual Nested Subcategory
 */
export async function updateVisualNestedSubcategory(
  id: string,
  updates: Partial<VisualNestedSubcategory>
): Promise<void> {
  let finalImage = updates.image;
  if (finalImage && (finalImage.startsWith('data:') || finalImage.startsWith('blob:'))) {
    try {
      finalImage = await uploadCategoryImageToStorage(finalImage, 'visual-nested', createSlug(updates.name || id));
    } catch {
      finalImage = await compressDataUrl(finalImage, 800, 800, 0.85);
    }
  }

  const payload: Partial<VisualNestedSubcategory> = {
    ...updates,
    ...(finalImage ? { image: finalImage } : {}),
    ...(typeof updates.isActive === 'boolean' ? { isVisible: updates.isActive } : {}),
    updatedAt: new Date().toISOString()
  };

  const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, id);
  await updateDoc(docRef, cleanForFirestore(payload));
}

/**
 * Delete a Visual Nested Subcategory
 */
export async function deleteVisualNestedSubcategory(
  id: string,
  _categoryId?: string,
  _subCategoryId?: string
): Promise<void> {
  const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Reorder visual nested subcategories
 */
export async function reorderVisualNestedSubcategoriesInDb(
  items: VisualNestedSubcategory[]
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach((item, index) => {
    const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, item.id);
    batch.update(docRef, { order: index + 1, updatedAt: new Date().toISOString() });
  });
  await batch.commit();
}

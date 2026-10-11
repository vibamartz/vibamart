import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
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
  const nameSlug = data.name && data.name.trim() ? createSlug(data.name.trim()) : `card-${Date.now().toString().slice(-4)}`;
  const parentIdPart = data.parentTargetId || data.nestedSubCategoryId || data.subCategoryId || data.categoryId || 'general';
  const generatedId = `vns-${parentIdPart}-${nameSlug}-${Date.now().toString().slice(-4)}`;
  
  let finalImage = data.image || '';
  if (finalImage.startsWith('data:') || finalImage.startsWith('blob:')) {
    try {
      finalImage = await uploadCategoryImageToStorage(finalImage, 'visual-nested', nameSlug);
    } catch {
      finalImage = await compressDataUrl(finalImage, 800, 800, 0.85);
    }
  }

  const newItem: VisualNestedSubcategory = {
    ...data,
    name: data.name?.trim() || '',
    id: generatedId,
    slug: data.slug || nameSlug,
    seoSlug: data.seoSlug || data.slug || nameSlug,
    image: finalImage,
    isActive: data.isActive !== false,
    isVisible: data.isActive !== false,
    parentTargetId: data.parentTargetId || data.nestedSubCategoryId || data.subCategoryId,
    productIds: Array.isArray(data.productIds) ? data.productIds : [],
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
      const nameSlug = updates.name && updates.name.trim() ? createSlug(updates.name.trim()) : id;
      finalImage = await uploadCategoryImageToStorage(finalImage, 'visual-nested', nameSlug);
    } catch {
      finalImage = await compressDataUrl(finalImage, 800, 800, 0.85);
    }
  }

  const payload: Partial<VisualNestedSubcategory> = {
    ...updates,
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(finalImage ? { image: finalImage } : {}),
    ...(typeof updates.isActive === 'boolean' ? { isVisible: updates.isActive } : {}),
    ...(updates.productIds !== undefined ? { productIds: updates.productIds } : {}),
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
 * Delete all visual nested subcategories
 */
export async function deleteAllVisualNestedSubcategories(): Promise<void> {
  const colRef = collection(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION);
  const snapshot = await getDocs(colRef);
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
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

/**
 * Assign an existing product to a Visual Nested Subcategory
 */
export async function assignProductToVisualNestedSubcategory(
  visualId: string,
  productId: string
): Promise<void> {
  const visualRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, visualId);
  await updateDoc(visualRef, {
    productIds: arrayUnion(productId),
    updatedAt: new Date().toISOString()
  });

  try {
    const prodRef = doc(db, 'products', productId);
    await updateDoc(prodRef, {
      visualNestedSubcategoryIds: arrayUnion(visualId),
      visualNestedSubcategoryId: visualId,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn(`Could not sync visual subcategory on product ${productId}:`, err);
  }
}

/**
 * Remove an assigned product from a Visual Nested Subcategory
 */
export async function removeProductFromVisualNestedSubcategory(
  visualId: string,
  productId: string
): Promise<void> {
  const visualRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, visualId);
  await updateDoc(visualRef, {
    productIds: arrayRemove(productId),
    updatedAt: new Date().toISOString()
  });

  try {
    const prodRef = doc(db, 'products', productId);
    await updateDoc(prodRef, {
      visualNestedSubcategoryIds: arrayRemove(visualId),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn(`Could not remove visual subcategory link on product ${productId}:`, err);
  }
}

/**
 * Reassign an assigned product from one Visual Nested Subcategory to another
 */
export async function reassignProductVisualNestedSubcategory(
  fromVisualId: string,
  toVisualId: string,
  productId: string
): Promise<void> {
  // Remove from previous
  const fromRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, fromVisualId);
  await updateDoc(fromRef, {
    productIds: arrayRemove(productId),
    updatedAt: new Date().toISOString()
  });

  // Add to target
  const toRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, toVisualId);
  await updateDoc(toRef, {
    productIds: arrayUnion(productId),
    updatedAt: new Date().toISOString()
  });

  try {
    const prodRef = doc(db, 'products', productId);
    await updateDoc(prodRef, {
      visualNestedSubcategoryIds: arrayRemove(fromVisualId),
      updatedAt: new Date().toISOString()
    });
    await updateDoc(prodRef, {
      visualNestedSubcategoryIds: arrayUnion(toVisualId),
      visualNestedSubcategoryId: toVisualId,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn(`Could not reassign visual subcategory on product ${productId}:`, err);
  }
}

/**
 * Assign multiple products in batch to a Visual Nested Subcategory
 */
export async function assignMultipleProductsToVisualNestedSubcategory(
  visualId: string,
  productIds: string[]
): Promise<void> {
  if (!productIds || productIds.length === 0) return;

  const visualRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, visualId);
  await updateDoc(visualRef, {
    productIds: arrayUnion(...productIds),
    updatedAt: new Date().toISOString()
  });

  // Update products
  for (const pid of productIds) {
    try {
      const prodRef = doc(db, 'products', pid);
      await updateDoc(prodRef, {
        visualNestedSubcategoryIds: arrayUnion(visualId),
        visualNestedSubcategoryId: visualId,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn(`Could not sync visual subcategory on product ${pid}:`, err);
    }
  }
}


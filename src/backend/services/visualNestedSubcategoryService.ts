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
 * Create a new Visual Nested Subcategory
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

  // Sync with parent category subcategories tree in Firestore
  await syncCategoryDocWithVisualItem(newItem, 'add');

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

  // Sync with parent category subcategories tree in Firestore
  const updatedDocSnap = await getDoc(docRef);
  if (updatedDocSnap.exists()) {
    const fullItem = updatedDocSnap.data() as VisualNestedSubcategory;
    await syncCategoryDocWithVisualItem(fullItem, 'update');
  }
}

/**
 * Delete a Visual Nested Subcategory
 */
export async function deleteVisualNestedSubcategory(
  id: string,
  categoryId?: string,
  subCategoryId?: string
): Promise<void> {
  const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, id);
  
  // Fetch details if categoryId or subCategoryId not provided
  let targetCatId = categoryId;
  let targetSubId = subCategoryId;
  if (!targetCatId || !targetSubId) {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as VisualNestedSubcategory;
      targetCatId = data.categoryId;
      targetSubId = data.subCategoryId;
    }
  }

  await deleteDoc(docRef);

  if (targetCatId && targetSubId) {
    await syncCategoryDocWithVisualItem({ id, categoryId: targetCatId, subCategoryId: targetSubId } as any, 'delete');
  }
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
 * Helper to sync changes with the Category's recursive subcategories array
 */
async function syncCategoryDocWithVisualItem(
  item: VisualNestedSubcategory,
  action: 'add' | 'update' | 'delete'
): Promise<void> {
  try {
    if (!item.categoryId || !item.subCategoryId) return;
    const catRef = doc(db, 'categories', item.categoryId);
    const catSnap = await getDoc(catRef);
    if (!catSnap.exists()) return;

    const catData = catSnap.data() as Category;
    if (!catData.subcategories) return;

    const updatedSubs = catData.subcategories.map(sub => {
      if (sub.id === item.subCategoryId) {
        let nestedList = [...(sub.subcategories || [])];
        if (action === 'delete') {
          nestedList = nestedList.filter(n => n.id !== item.id && n.slug !== item.slug);
        } else if (action === 'add' || action === 'update') {
          const nestedPayload: SubCategory = {
            id: item.id,
            name: item.name,
            slug: item.slug,
            image: item.image,
            description: item.description,
            badgeText: item.badgeText,
            order: item.order,
            isActive: item.isActive,
            isVisible: item.isActive
          };
          const existingIdx = nestedList.findIndex(n => n.id === item.id || n.slug === item.slug);
          if (existingIdx >= 0) {
            nestedList[existingIdx] = { ...nestedList[existingIdx], ...nestedPayload };
          } else {
            nestedList.push(nestedPayload);
          }
        }
        return { ...sub, subcategories: nestedList };
      }
      return sub;
    });

    await updateDoc(catRef, { subcategories: updatedSubs });
  } catch (err) {
    console.warn('[VisualNestedSubcategories] Sync with category doc skipped/failed:', err);
  }
}

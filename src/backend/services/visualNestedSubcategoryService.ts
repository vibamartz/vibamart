import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { VisualNestedSubcategory, Category, SubCategory } from '../../shared/types';
import { CATEGORIES } from '../../shared/constants';
import { createSlug, getCategorySlug, getSubcategorySlug } from '../../shared/utilities/slug';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import { compressDataUrl, uploadCategoryImageToStorage } from './categoryStorageService';

export const VISUAL_NESTED_SUBCATEGORIES_COLLECTION = 'visual_nested_subcategories';

/**
 * Builds default seed visual nested subcategories from initial category constants
 */
export function getDefaultVisualNestedSubcategories(): VisualNestedSubcategory[] {
  const list: VisualNestedSubcategory[] = [];
  let orderCounter = 1;

  CATEGORIES.forEach(cat => {
    if (!cat.subcategories || cat.subcategories.length === 0) return;
    cat.subcategories.forEach(sub => {
      if (!sub.subcategories || sub.subcategories.length === 0) return;
      sub.subcategories.forEach(nested => {
        list.push({
          id: nested.id || `vns-${cat.id}-${sub.id}-${createSlug(nested.name)}`,
          name: nested.name,
          slug: nested.slug || createSlug(nested.name),
          seoSlug: nested.slug || createSlug(nested.name),
          description: nested.description || `Explore ${nested.name} in ${sub.name}`,
          image: nested.image || sub.image || cat.image || '',
          categoryId: cat.id,
          categoryName: cat.name,
          subCategoryId: sub.id,
          subCategoryName: sub.name,
          order: orderCounter++,
          isActive: nested.isVisible !== false,
          isVisible: nested.isVisible !== false,
          badgeText: (nested as any).badgeText || (orderCounter % 3 === 0 ? 'Trending' : orderCounter % 4 === 0 ? 'Popular' : undefined),
          seoTitle: `${nested.name} - ${sub.name} | ViBa Mart`,
          seoDescription: `Shop the latest ${nested.name} in ${sub.name} online at ViBa Mart with fast delivery and best discounts.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
    });
  });

  return list;
}

/**
 * Seed visual nested subcategories if collection is empty
 */
export async function seedVisualNestedSubcategoriesIfEmpty(): Promise<void> {
  try {
    const colRef = collection(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      const defaults = getDefaultVisualNestedSubcategories();
      if (defaults.length > 0) {
        const batch = writeBatch(db);
        defaults.forEach(item => {
          const docRef = doc(db, VISUAL_NESTED_SUBCATEGORIES_COLLECTION, item.id);
          batch.set(docRef, cleanForFirestore(item));
        });
        await batch.commit();
        console.log(`[VisualNestedSubcategories] Seeded ${defaults.length} initial items`);
      }
    }
  } catch (err) {
    console.warn('[VisualNestedSubcategories] Seeding check error:', err);
  }
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

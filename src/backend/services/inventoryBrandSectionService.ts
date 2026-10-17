import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { InventoryBrandSection, Product } from '../../shared/types';
import { logAdminAction, AdminAction } from './adminLogService';

export const INVENTORY_BRAND_SECTIONS_COLLECTION = 'inventory_brand_sections';

/**
 * Default internal brand sections initialized once if the collection is empty.
 * These are editable example names with stable unique IDs.
 */
export const DEFAULT_BRAND_SECTIONS: Omit<InventoryBrandSection, 'createdAt' | 'updatedAt'>[] = [
  { id: 'section_shopsy', name: 'Shopsy', order: 1 },
  { id: 'section_deodap', name: 'DeoDap', order: 2 },
  { id: 'section_brand3', name: 'Brand 3', order: 3 }
];

/**
 * Seed default internal brand sections if persistent storage is empty.
 * Guarantees no recreation on every reload or deployment.
 */
export async function seedInventoryBrandSectionsIfEmpty(): Promise<void> {
  try {
    const colRef = collection(db, INVENTORY_BRAND_SECTIONS_COLLECTION);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      const now = new Date().toISOString();
      const batch = writeBatch(db);

      for (const def of DEFAULT_BRAND_SECTIONS) {
        const docRef = doc(db, INVENTORY_BRAND_SECTIONS_COLLECTION, def.id);
        const sectionData: InventoryBrandSection = {
          id: def.id,
          name: def.name,
          order: def.order,
          createdAt: now,
          updatedAt: now
        };
        batch.set(docRef, sectionData);
      }

      await batch.commit();
      console.log('[inventoryBrandSectionService] Initialized default brand sections once.');
    }
  } catch (error) {
    console.warn('[inventoryBrandSectionService] Seeding check error (might be offline or mock mode):', error);
  }
}

/**
 * Create a new Brand Section with a stable unique ID.
 * Validates name and prevents duplicates.
 */
export async function createInventoryBrandSection(
  name: string,
  existingSections: InventoryBrandSection[] = []
): Promise<InventoryBrandSection> {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('Section name cannot be empty.');
  }

  // Prevent duplicate section names (case-insensitive)
  const isDuplicate = existingSections.some(
    s => s.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`A brand section named "${trimmed}" already exists.`);
  }

  const generatedId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const maxOrder = existingSections.reduce((max, s) => Math.max(max, s.order ?? 0), 0);

  const newSection: InventoryBrandSection = {
    id: generatedId,
    name: trimmed,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  };

  const docRef = doc(db, INVENTORY_BRAND_SECTIONS_COLLECTION, generatedId);
  await setDoc(docRef, newSection);

  await logAdminAction(
    AdminAction.SETTINGS_UPDATE,
    `Created internal brand section: ${trimmed}`,
    generatedId,
    INVENTORY_BRAND_SECTIONS_COLLECTION
  );

  return newSection;
}

/**
 * Rename an existing Brand Section without altering its stable unique ID or product assignments.
 */
export async function renameInventoryBrandSection(
  id: string,
  newName: string,
  existingSections: InventoryBrandSection[] = []
): Promise<void> {
  const trimmed = (newName || '').trim();
  if (!trimmed) {
    throw new Error('Section name cannot be empty.');
  }

  // Prevent duplicate section names across other sections
  const isDuplicate = existingSections.some(
    s => s.id !== id && s.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`Another brand section named "${trimmed}" already exists.`);
  }

  const docRef = doc(db, INVENTORY_BRAND_SECTIONS_COLLECTION, id);
  const now = new Date().toISOString();

  await updateDoc(docRef, {
    name: trimmed,
    updatedAt: now
  });

  await logAdminAction(
    AdminAction.SETTINGS_UPDATE,
    `Renamed internal brand section ${id} to: ${trimmed}`,
    id,
    INVENTORY_BRAND_SECTIONS_COLLECTION
  );
}

/**
 * Delete a Brand Section after user confirmation.
 * Safely unassigns all affected products so they appear under Unassigned Products.
 * NEVER deletes product records.
 */
export async function deleteInventoryBrandSection(
  id: string,
  allProducts: Product[] = []
): Promise<{ unassignedCount: number }> {
  // Find all products currently assigned to this section
  const affectedProducts = allProducts.filter(p => p.inventorySectionId === id);

  // Unassign products in batches of up to 400 (Firestore max 500)
  if (affectedProducts.length > 0) {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < affectedProducts.length; i += CHUNK_SIZE) {
      const chunk = affectedProducts.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      for (const prod of chunk) {
        const prodRef = doc(db, 'products', prod.id);
        batch.update(prodRef, {
          inventorySectionId: null,
          updatedAt: now
        });
      }

      await batch.commit();
    }
  }

  // Delete the section document itself
  const docRef = doc(db, INVENTORY_BRAND_SECTIONS_COLLECTION, id);
  await deleteDoc(docRef);

  await logAdminAction(
    AdminAction.SETTINGS_UPDATE,
    `Deleted internal brand section ${id} and unassigned ${affectedProducts.length} product(s)`,
    id,
    INVENTORY_BRAND_SECTIONS_COLLECTION
  );

  return { unassignedCount: affectedProducts.length };
}

/**
 * Assign a single product to a Brand Section (or null to unassign).
 * Preserves the original product record and ID.
 */
export async function assignProductToBrandSection(
  productId: string,
  sectionId: string | null
): Promise<void> {
  const prodRef = doc(db, 'products', productId);
  const now = new Date().toISOString();

  await updateDoc(prodRef, {
    inventorySectionId: sectionId || null,
    updatedAt: now
  });
}

/**
 * Bulk assign multiple products to a Brand Section (or null to unassign).
 */
export async function bulkAssignProductsToBrandSection(
  productIds: string[],
  sectionId: string | null
): Promise<void> {
  if (!productIds || productIds.length === 0) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const pid of chunk) {
      const prodRef = doc(db, 'products', pid);
      batch.update(prodRef, {
        inventorySectionId: sectionId || null,
        updatedAt: now
      });
    }

    await batch.commit();
  }

  await logAdminAction(
    AdminAction.SETTINGS_UPDATE,
    `Bulk assigned ${productIds.length} product(s) to internal brand section: ${sectionId || 'Unassigned'}`,
    sectionId || 'none',
    'products'
  );
}

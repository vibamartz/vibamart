import { collection, doc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { FlatCategoryNode, ProductAssignmentOptions } from '../../shared/types';
import { logAdminAction, AdminAction } from './adminLogService';

const VISUAL_COLLECTION = 'visual_nested_subcategories';

export interface AssignmentResult {
  success: boolean;
  assignedCount: number;
  unassignedCount?: number;
  message: string;
}

/**
 * Assign one or more inventory products to a target category node safely in batch
 */
export async function assignProductsToHierarchyNode(
  node: FlatCategoryNode,
  productIds: string[],
  options: ProductAssignmentOptions = { preserveExisting: true }
): Promise<AssignmentResult> {
  if (!node || !productIds || productIds.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      message: 'No products or category specified for assignment.'
    };
  }

  const { preserveExisting = true, isPrimary = false } = options;
  const now = new Date().toISOString();

  // Firestore allows up to 500 operations per writeBatch
  const BATCH_SIZE = 400;
  let processedCount = 0;

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const chunk = productIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const pid of chunk) {
      const prodRef = doc(db, 'products', pid);
      const updates: Record<string, any> = {
        updatedAt: now
      };

      switch (node.level) {
        case 'category': {
          updates.categories = arrayUnion(node.id);
          if (!preserveExisting || isPrimary) {
            updates.categoryId = node.id;
          }
          break;
        }

        case 'subcategory': {
          if (node.pathIds[0]) {
            updates.categories = arrayUnion(node.pathIds[0]);
          }
          updates.subCategoryIds = arrayUnion(node.id);
          if (!preserveExisting || isPrimary) {
            updates.subCategoryId = node.id;
            if (node.pathIds[0]) updates.categoryId = node.pathIds[0];
          }
          break;
        }

        case 'nested_subcategory':
        case 'deep_subcategory': {
          if (node.pathIds[0]) {
            updates.categories = arrayUnion(node.pathIds[0]);
          }
          if (node.pathIds[1]) {
            updates.subCategoryIds = arrayUnion(node.pathIds[1]);
          }
          updates.nestedSubCategoryIds = arrayUnion(node.id);
          if (!preserveExisting || isPrimary) {
            updates.nestedSubCategoryId = node.id;
            if (node.pathIds[1]) updates.subCategoryId = node.pathIds[1];
            if (node.pathIds[0]) updates.categoryId = node.pathIds[0];
          }
          break;
        }

        case 'visual_nested_subcategory': {
          updates.visualNestedSubcategoryIds = arrayUnion(node.id);
          updates.visualNestedSubcategoryId = node.id;
          if (node.pathIds[0]) {
            updates.categories = arrayUnion(node.pathIds[0]);
          }
          if (node.pathIds[1]) {
            updates.subCategoryIds = arrayUnion(node.pathIds[1]);
          }
          if (node.pathIds[2]) {
            updates.nestedSubCategoryIds = arrayUnion(node.pathIds[2]);
          }
          break;
        }
      }

      batch.update(prodRef, updates);
    }

    // If target is visual nested subcategory, also update visual doc in this batch
    if (node.level === 'visual_nested_subcategory') {
      const visualRef = doc(db, VISUAL_COLLECTION, node.id);
      batch.update(visualRef, {
        productIds: arrayUnion(...chunk),
        updatedAt: now
      });
    }

    await batch.commit();
    processedCount += chunk.length;
  }

  // Log action
  try {
    await logAdminAction(
      AdminAction.PRODUCT_UPDATE,
      `Assigned ${processedCount} products to ${node.levelLabel}: "${node.breadcrumb}"`
    );
  } catch (err) {
    console.warn('Failed to log admin assignment action:', err);
  }

  return {
    success: true,
    assignedCount: processedCount,
    message: `Successfully assigned ${processedCount} product${processedCount === 1 ? '' : 's'} to ${node.breadcrumb}.`
  };
}

/**
 * Remove an assignment from one or more products without deleting inventory items
 */
export async function unassignProductsFromHierarchyNode(
  node: FlatCategoryNode,
  productIds: string[]
): Promise<AssignmentResult> {
  if (!node || !productIds || productIds.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      message: 'No products or category specified for unassignment.'
    };
  }

  const now = new Date().toISOString();
  const BATCH_SIZE = 400;
  let processedCount = 0;

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const chunk = productIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const pid of chunk) {
      const prodRef = doc(db, 'products', pid);
      const updates: Record<string, any> = {
        updatedAt: now
      };

      switch (node.level) {
        case 'category': {
          updates.categories = arrayRemove(node.id);
          break;
        }

        case 'subcategory': {
          updates.subCategoryIds = arrayRemove(node.id);
          break;
        }

        case 'nested_subcategory':
        case 'deep_subcategory': {
          updates.nestedSubCategoryIds = arrayRemove(node.id);
          break;
        }

        case 'visual_nested_subcategory': {
          updates.visualNestedSubcategoryIds = arrayRemove(node.id);
          break;
        }
      }

      batch.update(prodRef, updates);
    }

    // If target is visual nested subcategory, remove from visual doc
    if (node.level === 'visual_nested_subcategory') {
      const visualRef = doc(db, VISUAL_COLLECTION, node.id);
      batch.update(visualRef, {
        productIds: arrayRemove(...chunk),
        updatedAt: now
      });
    }

    await batch.commit();
    processedCount += chunk.length;
  }

  // Log action
  try {
    await logAdminAction(
      AdminAction.PRODUCT_UPDATE,
      `Unassigned ${processedCount} products from ${node.levelLabel}: "${node.breadcrumb}"`
    );
  } catch (err) {
    console.warn('Failed to log admin unassign action:', err);
  }

  return {
    success: true,
    assignedCount: processedCount,
    unassignedCount: processedCount,
    message: `Successfully unassigned ${processedCount} product${processedCount === 1 ? '' : 's'} from ${node.breadcrumb}. Inventory records remain intact.`
  };
}

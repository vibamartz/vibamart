import { doc, writeBatch, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { Product, FlatCategoryNode, ProductAssignmentOptions, ProductAssignmentResult } from '../../shared/types';
import { logAdminAction, AdminAction } from './adminLogService';
import {
  assignMultipleProductsToVisualNestedSubcategory,
  removeProductFromVisualNestedSubcategory
} from './visualNestedSubcategoryService';

/**
 * Execute batch product assignment to target category nodes while strictly preserving
 * existing product records, SKU, pricing, variants, and inventory.
 */
export async function assignProductsToCategoryNodes(
  productIds: string[],
  targetNodes: FlatCategoryNode[],
  options: ProductAssignmentOptions = { preserveExisting: true }
): Promise<ProductAssignmentResult> {
  if (!productIds || productIds.length === 0) {
    throw new Error('No products selected for assignment.');
  }
  if (!targetNodes || targetNodes.length === 0) {
    throw new Error('No target destination category selected.');
  }

  const preserveExisting = options.preserveExisting !== false;
  const now = new Date().toISOString();

  // Split visual nodes from standard hierarchy nodes
  const standardNodes = targetNodes.filter(n => n.level !== 'visual_nested_subcategory');
  const visualNodes = targetNodes.filter(n => n.level === 'visual_nested_subcategory');

  // 1. Assign to Visual Nested Subcategories if any
  for (const visualNode of visualNodes) {
    try {
      await assignMultipleProductsToVisualNestedSubcategory(visualNode.id, productIds);
    } catch (err) {
      console.error(`Failed to assign products to visual showcase ${visualNode.id}:`, err);
    }
  }

  // 2. Assign to standard hierarchy nodes (Category, Subcategory, Nested Subcategory)
  if (standardNodes.length > 0) {
    // Process in batches of 100 to stay well within Firestore limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batchChunk = productIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const pid of batchChunk) {
        const prodRef = doc(db, 'products', pid);
        const updates: Record<string, any> = {
          updatedAt: now
        };

        for (const targetNode of standardNodes) {
          if (targetNode.level === 'category') {
            const catId = targetNode.id;
            updates.categories = arrayUnion(catId);
            if (!preserveExisting) {
              updates.categoryId = catId;
            }
          } else if (targetNode.level === 'subcategory') {
            const catId = targetNode.pathIds[0] || targetNode.parentTargetId || '';
            const subId = targetNode.id;
            if (catId) {
              updates.categories = arrayUnion(catId);
            }
            updates.subCategoryIds = arrayUnion(subId);
            if (!preserveExisting) {
              if (catId) updates.categoryId = catId;
              updates.subCategoryId = subId;
            }
          } else if (targetNode.level === 'nested_subcategory' || targetNode.level === 'deep_subcategory') {
            const catId = targetNode.pathIds[0] || '';
            const subId = targetNode.pathIds[1] || targetNode.parentTargetId || '';
            const nestedId = targetNode.id;

            if (catId) updates.categories = arrayUnion(catId);
            if (subId) updates.subCategoryIds = arrayUnion(subId);
            updates.nestedSubCategoryIds = arrayUnion(nestedId);

            if (!preserveExisting) {
              if (catId) updates.categoryId = catId;
              if (subId) updates.subCategoryId = subId;
              updates.nestedSubCategoryId = nestedId;
            }
          }
        }

        batch.update(prodRef, updates);
      }

      await batch.commit();
    }
  }

  // Log action for audit trail
  const nodeNames = targetNodes.map(n => n.name).join(', ');
  await logAdminAction(
    AdminAction.PRODUCT_UPDATE,
    `Smart Product Assignment: Assigned ${productIds.length} products to [${nodeNames}] (preserveExisting: ${preserveExisting})`,
    targetNodes[0].id,
    'products'
  );

  return {
    success: true,
    assignedProductCount: productIds.length,
    targetNodeKeys: targetNodes.map(n => n.key),
    message: `Successfully assigned ${productIds.length} product(s) to ${targetNodes.length} destination(s).`
  };
}

/**
 * Remove a single product assignment from a target category node
 */
export async function removeProductFromCategoryNode(
  product: Product,
  targetNode: FlatCategoryNode
): Promise<void> {
  const prodRef = doc(db, 'products', product.id);
  const now = new Date().toISOString();

  if (targetNode.level === 'visual_nested_subcategory') {
    await removeProductFromVisualNestedSubcategory(targetNode.id, product.id);
    return;
  }

  const updates: Record<string, any> = {
    updatedAt: now
  };

  if (targetNode.level === 'category') {
    updates.categories = arrayRemove(targetNode.id);
    if (product.categoryId === targetNode.id) {
      // If primary category matched, clear or fall back to first remaining category
      const remainingCats = (product.categories || []).filter(c => c !== targetNode.id);
      updates.categoryId = remainingCats[0] || '';
    }
  } else if (targetNode.level === 'subcategory') {
    updates.subCategoryIds = arrayRemove(targetNode.id);
    if (product.subCategoryId === targetNode.id) {
      const remainingSubs = (product.subCategoryIds || []).filter(s => s !== targetNode.id);
      updates.subCategoryId = remainingSubs[0] || '';
    }
  } else if (targetNode.level === 'nested_subcategory' || targetNode.level === 'deep_subcategory') {
    updates.nestedSubCategoryIds = arrayRemove(targetNode.id);
    if (product.nestedSubCategoryId === targetNode.id) {
      const remainingNested = (product.nestedSubCategoryIds || []).filter(n => n !== targetNode.id);
      updates.nestedSubCategoryId = remainingNested[0] || '';
    }
  }

  const batch = writeBatch(db);
  batch.update(prodRef, updates);
  await batch.commit();

  await logAdminAction(
    AdminAction.PRODUCT_UPDATE,
    `Smart Product Assignment: Removed product "${product.name}" from ${targetNode.breadcrumb}`,
    product.id,
    'products'
  );
}

/**
 * Batch remove multiple products from a category node
 */
export async function batchRemoveProductsFromCategoryNode(
  products: Product[],
  targetNode: FlatCategoryNode
): Promise<void> {
  if (!products || products.length === 0) return;

  if (targetNode.level === 'visual_nested_subcategory') {
    for (const p of products) {
      await removeProductFromVisualNestedSubcategory(targetNode.id, p.id);
    }
    return;
  }

  const now = new Date().toISOString();
  const BATCH_SIZE = 100;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const product of chunk) {
      const prodRef = doc(db, 'products', product.id);
      const updates: Record<string, any> = { updatedAt: now };

      if (targetNode.level === 'category') {
        updates.categories = arrayRemove(targetNode.id);
        if (product.categoryId === targetNode.id) {
          const remaining = (product.categories || []).filter(c => c !== targetNode.id);
          updates.categoryId = remaining[0] || '';
        }
      } else if (targetNode.level === 'subcategory') {
        updates.subCategoryIds = arrayRemove(targetNode.id);
        if (product.subCategoryId === targetNode.id) {
          const remaining = (product.subCategoryIds || []).filter(s => s !== targetNode.id);
          updates.subCategoryId = remaining[0] || '';
        }
      } else if (targetNode.level === 'nested_subcategory' || targetNode.level === 'deep_subcategory') {
        updates.nestedSubCategoryIds = arrayRemove(targetNode.id);
        if (product.nestedSubCategoryId === targetNode.id) {
          const remaining = (product.nestedSubCategoryIds || []).filter(n => n !== targetNode.id);
          updates.nestedSubCategoryId = remaining[0] || '';
        }
      }

      batch.update(prodRef, updates);
    }

    await batch.commit();
  }

  await logAdminAction(
    AdminAction.PRODUCT_UPDATE,
    `Smart Product Assignment: Batch unassigned ${products.length} products from ${targetNode.breadcrumb}`,
    targetNode.id,
    'products'
  );
}

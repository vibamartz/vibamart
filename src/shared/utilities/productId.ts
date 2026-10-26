import { collection, doc, getDocs, updateDoc, Firestore } from 'firebase/firestore';
import { Product } from '../types';

export const PRODUCT_ID_PREFIX = 'prod_';

/**
 * Strips and normalizes a product ID candidate string.
 */
export function cleanProductId(id?: string | null): string {
  if (!id || typeof id !== 'string') return '';
  return id.trim();
}

/**
 * Checks whether a candidate product ID is unique across all existing products or product IDs.
 * Never allows blank/empty IDs or duplicate IDs.
 */
export function isProductIdUnique(
  candidateId: string,
  existingProductsOrIds: Array<Product | string> = [],
  excludeProductId?: string
): boolean {
  const cleanCandidate = cleanProductId(candidateId);
  if (!cleanCandidate) return false;

  const cleanExclude = cleanProductId(excludeProductId);

  for (const item of existingProductsOrIds) {
    if (typeof item === 'string') {
      const cleanItem = cleanProductId(item);
      if (cleanExclude && cleanItem === cleanExclude) continue;
      if (cleanItem === cleanCandidate) return false;
    } else if (item && typeof item === 'object') {
      const pId = cleanProductId(item.id);
      if (cleanExclude && pId === cleanExclude) continue;
      if (pId === cleanCandidate) return false;
    }
  }

  return true;
}

/**
 * Generates a guaranteed unique product ID in format "prod_<timestamp>_<entropy>".
 * Verifies against all existing products / IDs to prevent collision.
 * Never assigns the same ID to multiple products.
 */
export function generateUniqueProductId(
  existingProductsOrIds: Array<Product | string> = [],
  options?: { prefix?: string }
): string {
  const prefix = options?.prefix || PRODUCT_ID_PREFIX;
  const usedIds = new Set<string>();

  for (const item of existingProductsOrIds) {
    if (typeof item === 'string') {
      const clean = cleanProductId(item);
      if (clean) usedIds.add(clean);
    } else if (item && typeof item === 'object') {
      const cleanId = cleanProductId(item.id);
      if (cleanId) usedIds.add(cleanId);
    }
  }

  // Attempt high-entropy generation
  for (let attempt = 0; attempt < 10000; attempt++) {
    const timestamp = Date.now();
    const entropy = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
    const candidate = `${prefix}${timestamp}_${entropy}`;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  // Fallback with performance timer / counter
  const highRes = typeof performance !== 'undefined' && performance.now
    ? Math.floor(performance.now() * 1000)
    : Math.floor(Math.random() * 1000000);
  return `${prefix}${Date.now()}_${highRes}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Normalizes a Firestore document snapshot into a Product object.
 * Guarantees that the document's unique ID is canonical and never overridden by a duplicate internal data.id.
 */
export function normalizeProductDoc(docSnap: { id: string; data: () => any }): Product {
  const rawData = docSnap.data() || {};
  return {
    ...rawData,
    // Canonical Firestore document ID always takes precedence to guarantee uniqueness
    id: docSnap.id || rawData.id || generateUniqueProductId(),
  } as Product;
}

/**
 * Identifies duplicate product IDs in a list of products.
 * Returns a Map from duplicate ID to all products that share it.
 */
export function identifyDuplicateProductIds(products: Product[]): Map<string, Product[]> {
  const idMap = new Map<string, Product[]>();

  for (const p of products) {
    if (!p) continue;
    const cleanId = cleanProductId(p.id);
    const key = cleanId || '__MISSING_ID__';
    const list = idMap.get(key) || [];
    list.push(p);
    idMap.set(key, list);
  }

  const duplicates = new Map<string, Product[]>();
  for (const [id, prods] of idMap.entries()) {
    if (prods.length > 1 || id === '__MISSING_ID__') {
      duplicates.set(id, prods);
    }
  }

  return duplicates;
}

export interface ProductIdFixDetail {
  productName: string;
  originalId: string;
  newId: string;
  variantsUpdatedCount: number;
}

/**
 * In-memory resolver that identifies and fixes duplicate product IDs.
 * Retains original ID for the first occurrence; assigns newly generated unique IDs to subsequent duplicates.
 * Preserves all product data and related functionality.
 */
export function fixDuplicateProductIds(products: Product[]): {
  fixedProducts: Product[];
  duplicatesFound: number;
  fixes: ProductIdFixDetail[];
} {
  const seenIds = new Set<string>();
  const fixedProducts: Product[] = [];
  const fixes: ProductIdFixDetail[] = [];
  let duplicatesFound = 0;

  const allExistingIds: string[] = [];

  for (const p of products) {
    if (!p) continue;
    const cleanId = cleanProductId(p.id);
    const isDuplicate = !cleanId || seenIds.has(cleanId);

    if (isDuplicate) {
      duplicatesFound++;
      const newUniqueId = generateUniqueProductId([...allExistingIds, ...seenIds]);
      seenIds.add(newUniqueId);
      allExistingIds.push(newUniqueId);

      // Re-link variants to new product ID if variants exist
      let variantsUpdatedCount = 0;
      const updatedVariants = (p.variants || []).map(v => {
        variantsUpdatedCount++;
        return {
          ...v,
          productId: newUniqueId,
        };
      });

      const fixedProd: Product = {
        ...p,
        id: newUniqueId,
        variants: updatedVariants.length > 0 ? updatedVariants : p.variants,
      };

      fixes.push({
        productName: p.name || 'Unnamed Product',
        originalId: cleanId || '(missing/empty)',
        newId: newUniqueId,
        variantsUpdatedCount,
      });

      fixedProducts.push(fixedProd);
    } else {
      seenIds.add(cleanId);
      allExistingIds.push(cleanId);
      fixedProducts.push(p);
    }
  }

  return {
    fixedProducts,
    duplicatesFound,
    fixes,
  };
}

/**
 * Scans Firestore 'products' collection, identifies duplicate or mismatched product IDs,
 * and fixes them in Firestore without affecting product data or related functionality.
 */
export async function repairDuplicateProductIdsInFirestore(
  db: Firestore,
  options?: {
    onProgress?: (scanned: number, total: number, message: string) => void;
  }
): Promise<{
  scanned: number;
  duplicatesFound: number;
  fixed: number;
  fixes: Array<{ docId: string; oldId: string; newId: string; name: string }>;
}> {
  const colRef = collection(db, 'products');
  const snap = await getDocs(colRef);
  const total = snap.size;
  let scanned = 0;
  let duplicatesFound = 0;
  let fixed = 0;
  const fixes: Array<{ docId: string; oldId: string; newId: string; name: string }> = [];

  const seenIds = new Map<string, string>(); // internalId -> docId
  const allDocIds = new Set<string>(snap.docs.map(d => d.id));

  for (const docSnap of snap.docs) {
    scanned++;
    const docId = docSnap.id;
    const data = docSnap.data() || {};
    const dataId = cleanProductId(data.id);
    const name = data.name || 'Unnamed Product';

    let needsFix = false;
    let targetUniqueId = docId;

    if (!dataId) {
      // Missing internal ID -> align with unique docId
      needsFix = true;
      targetUniqueId = docId;
    } else if (dataId !== docId) {
      // Inconsistent internal ID vs document ID
      // If docId is not used by any other document's internal ID, align internal ID to docId
      if (seenIds.has(docId)) {
        targetUniqueId = generateUniqueProductId(Array.from(allDocIds));
      } else {
        targetUniqueId = docId;
      }
      needsFix = true;
    } else if (seenIds.has(dataId)) {
      // Duplicate internal ID across multiple documents!
      needsFix = true;
      targetUniqueId = generateUniqueProductId(Array.from(allDocIds));
    }

    if (needsFix) {
      duplicatesFound++;
      allDocIds.add(targetUniqueId);
      seenIds.set(targetUniqueId, docId);

      // Preserve all product data and update variants' productId
      const rawVariants = data.variants || [];
      const updatedVariants = rawVariants.map((v: any) => ({
        ...v,
        productId: targetUniqueId,
      }));

      try {
        await updateDoc(doc(db, 'products', docId), {
          id: targetUniqueId,
          variants: updatedVariants,
          updatedAt: new Date().toISOString(),
        });
        fixed++;
        fixes.push({
          docId,
          oldId: dataId || '(empty)',
          newId: targetUniqueId,
          name,
        });
      } catch (err) {
        console.error(`Failed to repair duplicate product ID for document ${docId}:`, err);
      }
    } else {
      seenIds.set(dataId, docId);
    }

    if (options?.onProgress) {
      options.onProgress(scanned, total, `Inspecting product ${scanned}/${total}...`);
    }
  }

  return {
    scanned,
    duplicatesFound,
    fixed,
    fixes,
  };
}

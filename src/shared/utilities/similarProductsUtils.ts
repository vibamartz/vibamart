import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Category, SubCategory } from '../types';
import { getRewardProductIds } from './rewardUtils';
import { cleanProductCode } from './productCode';
import { getProductSlug, getCategorySlug, createSlug } from './slug';
import { useCategoryStore } from '../../backend/store';

export interface FetchSimilarProductsOptions {
  product?: Product | null;
  currentProductId?: string;
  categoryId?: string;
  subCategoryId?: string;
  nestedSubCategoryId?: string;
  maxLimit?: number;
  categories?: Category[];
}

/**
 * Checks if a product is inactive, deleted, draft, or out of stock.
 * Returns true if product is unavailable and must be excluded.
 */
export function isProductUnavailableOrOutOfStock(p: Product, rewardIds: Set<string> | string[] = new Set()): boolean {
  if (!p) return true;

  // 1. Reward products are excluded
  const isReward = rewardIds instanceof Set ? rewardIds.has(p.id) : Array.isArray(rewardIds) && rewardIds.includes(p.id);
  if (isReward) return true;

  // 2. Inactive / invisible / draft checks
  if (p.isVisible === false) return true;
  if ((p as any).isActive === false) return true;
  if (p.status === 'inactive' || p.status === 'draft') return true;

  // 3. Deleted checks
  if ((p as any).status === 'deleted') return true;
  if ((p as any).isDeleted === true || (p as any).deleted === true || (p as any).isTrash === true) return true;

  // 4. Out of stock checks
  if (p.status === 'out_of_stock') return true;
  if (p.inStock === false) return true;

  // If variants exist, check whether at least one active variant is in stock
  if (Array.isArray(p.variants) && p.variants.length > 0) {
    const hasAvailableVariant = p.variants.some(v =>
      !v.disabled &&
      v.status !== 'disabled' &&
      v.status !== 'out_of_stock' &&
      v.inStock !== false &&
      (v.stock === undefined || v.stock === null || v.stock > 0)
    );
    if (!hasAvailableVariant) return true;
  } else {
    // If no variants, check product-level stock
    if (typeof p.stock === 'number' && p.stock <= 0) return true;
  }

  return false;
}

/**
 * Checks if a candidate product is the currently viewed product.
 */
export function isCurrentlyViewedProduct(
  candidate: Product,
  currentProduct?: Product | null,
  currentProductId?: string
): boolean {
  if (!candidate) return true;

  const targetId = currentProduct?.id || currentProductId;
  if (targetId && (candidate.id === targetId || (candidate as any)._id === targetId)) {
    return true;
  }

  const currentCode = currentProduct?.productCode;
  if (currentCode && candidate.productCode) {
    if (cleanProductCode(candidate.productCode) === cleanProductCode(currentCode)) {
      return true;
    }
  }

  if (targetId && candidate.productCode && cleanProductCode(candidate.productCode) === cleanProductCode(targetId)) {
    return true;
  }

  const currentSlug = currentProduct ? getProductSlug(currentProduct) : '';
  const candSlug = getProductSlug(candidate);
  if (currentSlug && candSlug && currentSlug.toLowerCase() === candSlug.toLowerCase()) {
    return true;
  }

  if (currentProduct?.name && candidate.name) {
    if (currentProduct.name.trim().toLowerCase() === candidate.name.trim().toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether candidate product strictly belongs to the admin-assigned category.
 * Prevents any unrelated products from other categories from slipping through.
 */
export function isProductInTargetCategory(
  p: Product,
  validCatSet: Set<string>,
  catObj?: Category
): boolean {
  if (!p || validCatSet.size === 0) return false;

  const candCatValues = [
    p.categoryId,
    ...(Array.isArray(p.categories) ? p.categories : []),
    (p as any).category,
    (p as any).categorySlug
  ].filter(Boolean).map(v => String(v).trim().toLowerCase());

  if (candCatValues.length > 0) {
    return candCatValues.some(v => validCatSet.has(v));
  }

  // If candidate product has no categoryId assigned, verify against this category's descendant subcategories
  if (catObj && Array.isArray(catObj.subcategories)) {
    const subIds = new Set<string>();
    catObj.subcategories.forEach(s => {
      if (s.id) subIds.add(String(s.id).toLowerCase());
      if (s.slug) subIds.add(String(s.slug).toLowerCase());
    });
    const pSubVal = String(p.subCategoryId || '').trim().toLowerCase();
    if (pSubVal && subIds.has(pSubVal)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether candidate product matches the target subcategory.
 */
export function isProductInTargetSubcategory(
  p: Product,
  validSubSet: Set<string>
): boolean {
  if (!p) return false;
  if (validSubSet.size === 0) return true;

  const candSubValues = [
    p.subCategoryId,
    ...(Array.isArray(p.subCategoryIds) ? p.subCategoryIds : []),
    (p as any).subCategory,
    (p as any).subCategorySlug
  ].filter(Boolean).map(v => String(v).trim().toLowerCase());

  return candSubValues.some(v => validSubSet.has(v));
}

/**
 * Checks whether candidate product matches the target nested subcategory.
 */
export function isProductInTargetNestedSubcategory(
  p: Product,
  validNestedSet: Set<string>
): boolean {
  if (!p || validNestedSet.size === 0) return false;

  const candNestedValues = [
    p.nestedSubCategoryId,
    ...(Array.isArray(p.nestedSubCategoryIds) ? p.nestedSubCategoryIds : []),
    (p as any).nestedSubCategory,
    (p as any).nestedSubCategorySlug
  ].filter(Boolean).map(v => String(v).trim().toLowerCase());

  return candNestedValues.some(v => validNestedSet.has(v));
}

/**
 * Fetches and filters similar products according to requirements:
 * 1. Matches admin-assigned category and subcategory.
 * 2. Strictly excludes unrelated products from other categories.
 * 3. Excludes currently viewed product and duplicate products.
 * 4. Excludes inactive, deleted, and out-of-stock products.
 * 5. Returns relevant products sorted by relevance and rating.
 */
export async function fetchSimilarProducts(options: FetchSimilarProductsOptions): Promise<Product[]> {
  const {
    product,
    currentProductId,
    categoryId,
    subCategoryId,
    nestedSubCategoryId,
    maxLimit = 10,
    categories: propCategories
  } = options;

  const effectiveCatId = (product?.categoryId || categoryId || '').trim();
  const effectiveSubId = (product?.subCategoryId || subCategoryId || '').trim();
  const effectiveNestedId = (product?.nestedSubCategoryId || nestedSubCategoryId || '').trim();
  const currentProdId = product?.id || currentProductId;

  if (!effectiveCatId) {
    return [];
  }

  const allCategories = propCategories || useCategoryStore.getState().categories || [];

  // 1. Locate Category Object
  const targetCatLower = effectiveCatId.toLowerCase();
  const catObj = allCategories.find(c => {
    if (!c) return false;
    return (
      String(c.id || '').toLowerCase() === targetCatLower ||
      String(c.slug || '').toLowerCase() === targetCatLower ||
      String((c as any).seoSlug || '').toLowerCase() === targetCatLower ||
      String(getCategorySlug(c) || '').toLowerCase() === targetCatLower ||
      String(c.name || '').toLowerCase() === targetCatLower
    );
  });

  // 2. Build Set of all valid category identifiers (strictly target category)
  const validCatSet = new Set<string>();
  if (targetCatLower) validCatSet.add(targetCatLower);
  if (product?.categoryId) validCatSet.add(product.categoryId.trim().toLowerCase());
  if (Array.isArray(product?.categories)) {
    product.categories.forEach(c => c && validCatSet.add(String(c).trim().toLowerCase()));
  }
  if (catObj) {
    if (catObj.id) validCatSet.add(String(catObj.id).trim().toLowerCase());
    if (catObj.slug) validCatSet.add(String(catObj.slug).trim().toLowerCase());
    if ((catObj as any).seoSlug) validCatSet.add(String((catObj as any).seoSlug).trim().toLowerCase());
    const compSlug = getCategorySlug(catObj);
    if (compSlug) validCatSet.add(String(compSlug).trim().toLowerCase());
    if (catObj.name) {
      validCatSet.add(String(catObj.name).trim().toLowerCase());
      validCatSet.add(createSlug(catObj.name).trim().toLowerCase());
    }
  }

  // 3. Build Set of all valid subcategory identifiers if subcategory is assigned
  const validSubSet = new Set<string>();
  if (effectiveSubId) validSubSet.add(effectiveSubId.toLowerCase());
  if (product?.subCategoryId) validSubSet.add(product.subCategoryId.trim().toLowerCase());
  if (Array.isArray(product?.subCategoryIds)) {
    product.subCategoryIds.forEach(s => s && validSubSet.add(String(s).trim().toLowerCase()));
  }

  let matchedSubObj: SubCategory | undefined;
  if (catObj && Array.isArray(catObj.subcategories)) {
    matchedSubObj = catObj.subcategories.find(s => {
      if (!s) return false;
      const sId = String(s.id || '').toLowerCase();
      const sSlug = String(s.slug || '').toLowerCase();
      const sName = String(s.name || '').toLowerCase();
      const sNameSlug = s.name ? createSlug(s.name).toLowerCase() : '';
      return (
        validSubSet.has(sId) ||
        validSubSet.has(sSlug) ||
        validSubSet.has(sName) ||
        validSubSet.has(sNameSlug)
      );
    });

    if (matchedSubObj) {
      if (matchedSubObj.id) validSubSet.add(String(matchedSubObj.id).trim().toLowerCase());
      if (matchedSubObj.slug) validSubSet.add(String(matchedSubObj.slug).trim().toLowerCase());
      if ((matchedSubObj as any).seoSlug) validSubSet.add(String((matchedSubObj as any).seoSlug).trim().toLowerCase());
      if (matchedSubObj.name) {
        validSubSet.add(String(matchedSubObj.name).trim().toLowerCase());
        validSubSet.add(createSlug(matchedSubObj.name).trim().toLowerCase());
      }
    }
  }

  // 4. Build Set of all valid nested subcategory identifiers if assigned
  const validNestedSet = new Set<string>();
  if (effectiveNestedId) validNestedSet.add(effectiveNestedId.toLowerCase());
  if (product?.nestedSubCategoryId) validNestedSet.add(product.nestedSubCategoryId.trim().toLowerCase());
  if (Array.isArray(product?.nestedSubCategoryIds)) {
    product.nestedSubCategoryIds.forEach(n => n && validNestedSet.add(String(n).trim().toLowerCase()));
  }

  // 5. Query Firestore
  const queryPromises: Promise<any>[] = [];
  const queriedKeys = new Set<string>();

  const addQuery = (field: string, val: string, op: '==' | 'array-contains' = '==') => {
    const key = `${field}:${op}:${val}`;
    if (!val || queriedKeys.has(key)) return;
    queriedKeys.add(key);
    queryPromises.push(
      getDocs(query(collection(db, 'products'), where(field, op, val), limit(50))).catch(() => null)
    );
  };

  // Queries for target category
  if (catObj?.id) {
    addQuery('categoryId', catObj.id);
    addQuery('categories', catObj.id, 'array-contains');
  }
  if (catObj?.slug && catObj.slug !== catObj.id) {
    addQuery('categoryId', catObj.slug);
    addQuery('categories', catObj.slug, 'array-contains');
  }
  if (effectiveCatId && effectiveCatId !== catObj?.id && effectiveCatId !== catObj?.slug) {
    addQuery('categoryId', effectiveCatId);
  }

  // Queries for subcategory
  if (matchedSubObj?.id) {
    addQuery('subCategoryId', matchedSubObj.id);
    addQuery('subCategoryIds', matchedSubObj.id, 'array-contains');
  }
  if (matchedSubObj?.slug && matchedSubObj.slug !== matchedSubObj.id) {
    addQuery('subCategoryId', matchedSubObj.slug);
  }
  if (effectiveSubId && effectiveSubId !== matchedSubObj?.id && effectiveSubId !== matchedSubObj?.slug) {
    addQuery('subCategoryId', effectiveSubId);
  }

  const [snaps, rewardIds] = await Promise.all([
    Promise.all(queryPromises),
    getRewardProductIds().catch(() => new Set<string>())
  ]);

  const candidateMap = new Map<string, Product>();
  snaps.forEach(snap => {
    if (snap?.docs) {
      snap.docs.forEach((d: any) => {
        candidateMap.set(d.id, { id: d.id, ...d.data() } as Product);
      });
    }
  });

  // Fallback scan if initial targeted queries returned empty
  if (candidateMap.size === 0) {
    try {
      const allSnap = await getDocs(query(collection(db, 'products'), limit(100)));
      allSnap.docs.forEach(d => {
        candidateMap.set(d.id, { id: d.id, ...d.data() } as Product);
      });
    } catch (e) {
      console.warn('Fallback similar products query error:', e);
    }
  }

  const rawCandidates = Array.from(candidateMap.values());

  // 6. Strict filtering & deduplication
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const seenSlugs = new Set<string>();

  const filteredCandidates: Product[] = [];

  for (const p of rawCandidates) {
    if (!p) continue;

    // Exclude currently viewed product (Requirement 3)
    if (isCurrentlyViewedProduct(p, product, currentProdId)) continue;

    // Exclude inactive, deleted, or out of stock products (Requirement 4)
    if (isProductUnavailableOrOutOfStock(p, rewardIds)) continue;

    // Exclude unrelated products from other categories (Requirement 1 & 2)
    if (!isProductInTargetCategory(p, validCatSet, catObj)) continue;

    // Exclude duplicate products (Requirement 3)
    const pid = p.id;
    const pCode = p.productCode ? cleanProductCode(p.productCode) : '';
    const pSlug = getProductSlug(p)?.toLowerCase();

    if (pid && seenIds.has(pid)) continue;
    if (pCode && seenCodes.has(pCode)) continue;
    if (pSlug && seenSlugs.has(pSlug)) continue;

    if (pid) seenIds.add(pid);
    if (pCode) seenCodes.add(pCode);
    if (pSlug) seenSlugs.add(pSlug);

    filteredCandidates.push(p);
  }

  // 7. Relevance sorting by subcategory and nested subcategory (Requirement 1 & 7)
  let finalProducts: Product[] = [];

  if (validSubSet.size > 0) {
    // Admin assigned a subcategory: filter by subcategory
    const sameSub = filteredCandidates.filter(p => isProductInTargetSubcategory(p, validSubSet));

    // Sort: nested subcategory matches first, then by rating
    sameSub.sort((a, b) => {
      const aNested = isProductInTargetNestedSubcategory(a, validNestedSet);
      const bNested = isProductInTargetNestedSubcategory(b, validNestedSet);
      if (aNested && !bNested) return -1;
      if (!aNested && bNested) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

    finalProducts = sameSub;
  } else {
    // Admin did not assign a subcategory: show products from the same category
    filteredCandidates.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    finalProducts = filteredCandidates;
  }

  return finalProducts.slice(0, maxLimit);
}

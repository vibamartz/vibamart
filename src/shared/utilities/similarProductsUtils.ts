import { Product, Category } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, createSlug } from './slug';
import { cleanProductCode } from './productCode';
import { isProductAssignedToCategory } from './productCategoryFilter';

/**
 * Checks if a candidate product is an eligible similar product for the currentProduct.
 * 
 * Rules:
 * 1. Must match admin-assigned category and subcategory.
 * 2. Unrelated products from other categories or subcategories are strictly excluded.
 * 3. Currently viewed product and duplicates are excluded.
 * 4. Inactive, deleted, and out-of-stock products are excluded.
 * 5. Reward products are excluded.
 */
export function isProductEligibleSimilar(
  candidate: Product,
  currentProduct: Product,
  categories: Category[] = [],
  rewardProductIds: Set<string> | string[] = []
): boolean {
  if (!candidate || !currentProduct) return false;

  // 1. Exclude the currently viewed product
  const candId = String(candidate.id || '').trim();
  const currId = String(currentProduct.id || '').trim();
  if (candId && currId && candId === currId) return false;

  const candCode = candidate.productCode ? cleanProductCode(candidate.productCode) : '';
  const currCode = currentProduct.productCode ? cleanProductCode(currentProduct.productCode) : '';
  if (candCode && currCode && candCode === currCode) return false;

  const candSlug = getProductSlug(candidate);
  const currSlug = getProductSlug(currentProduct);
  if (candSlug && currSlug && candSlug === currSlug) return false;

  // 2. Exclude inactive or non-active products (draft, inactive, out_of_stock, etc.)
  if ((candidate.status as string) !== 'active') return false;
  if (candidate.isVisible === false) return false;

  // 3. Exclude deleted products
  if ((candidate as any).isDeleted === true || (candidate as any).deleted === true) return false;

  // 4. Exclude reward products
  if (rewardProductIds) {
    if (rewardProductIds instanceof Set) {
      if (rewardProductIds.has(candidate.id)) return false;
    } else if (Array.isArray(rewardProductIds)) {
      if (rewardProductIds.includes(candidate.id)) return false;
    }
  }

  // 5. Exclude out-of-stock products
  if (candidate.inStock === false) return false;

  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;
  const hasVariantStock = hasVariants && candidate.variants!.some(v => (typeof v.stock === 'number' ? v.stock > 0 : true));
  const isDirectStockZero = typeof candidate.stock === 'number' && candidate.stock <= 0;

  if (isDirectStockZero && (!hasVariants || !hasVariantStock)) {
    return false;
  }

  // 6. Category & Subcategory Matching
  // Determine admin-assigned category and subcategory of current product
  const targetCat = currentProduct.categoryId || (Array.isArray(currentProduct.categories) && currentProduct.categories[0]) || '';
  const targetSub = currentProduct.subCategoryId || (Array.isArray(currentProduct.subCategoryIds) && currentProduct.subCategoryIds[0]) || '';

  if (!targetCat) return false;

  // Check category match
  const candCatIds = new Set<string>();
  if (candidate.categoryId) candCatIds.add(String(candidate.categoryId).toLowerCase());
  if (Array.isArray(candidate.categories)) {
    candidate.categories.forEach(c => c && candCatIds.add(String(c).toLowerCase()));
  }
  if ((candidate as any).category) candCatIds.add(String((candidate as any).category).toLowerCase());

  const matchesCategory =
    candCatIds.has(String(targetCat).toLowerCase()) ||
    isProductAssignedToCategory(candidate, targetCat, categories);

  if (!matchesCategory) return false;

  // If the current product has an admin-assigned subcategory:
  // Candidate MUST belong to that subcategory. Do not display unrelated products from other subcategories.
  if (targetSub && targetSub.trim()) {
    const candSubIds = new Set<string>();
    if (candidate.subCategoryId) candSubIds.add(String(candidate.subCategoryId).toLowerCase());
    if (Array.isArray(candidate.subCategoryIds)) {
      candidate.subCategoryIds.forEach(s => s && candSubIds.add(String(s).toLowerCase()));
    }
    if ((candidate as any).subCategory) candSubIds.add(String((candidate as any).subCategory).toLowerCase());

    const matchesSub =
      candSubIds.has(String(targetSub).toLowerCase()) ||
      isProductAssignedToCategory(candidate, targetCat, categories, targetSub);

    if (!matchesSub) return false;
  }

  return true;
}

/**
 * Filters a list of products to eligible similar products, excluding current product,
 * inactive/deleted/out-of-stock items, and removing duplicates.
 */
export function filterSimilarProducts(
  allProducts: Product[],
  currentProduct: Product,
  categories: Category[] = [],
  rewardProductIds: Set<string> | string[] = []
): Product[] {
  if (!allProducts || !currentProduct) return [];

  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const eligibleProducts: Product[] = [];

  for (const p of allProducts) {
    if (!p || !p.id) continue;
    if (seenIds.has(p.id)) continue;

    const slug = getProductSlug(p);
    if (slug && seenSlugs.has(slug)) continue;

    if (isProductEligibleSimilar(p, currentProduct, categories, rewardProductIds)) {
      seenIds.add(p.id);
      if (slug) seenSlugs.add(slug);
      eligibleProducts.push(p);
    }
  }

  return eligibleProducts;
}

/**
 * Resolves the "See All" URL for the current product's category and subcategory.
 */
export function getSimilarProductsSeeAllUrl(
  currentProduct: Product,
  categories: Category[] = []
): string {
  if (!currentProduct) return '/products';

  const targetCat = currentProduct.categoryId || (Array.isArray(currentProduct.categories) && currentProduct.categories[0]) || '';
  const targetSub = currentProduct.subCategoryId || (Array.isArray(currentProduct.subCategoryIds) && currentProduct.subCategoryIds[0]) || '';

  if (!targetCat) return '/products';

  const targetCatLower = String(targetCat).toLowerCase();
  const categoryObj = categories.find(c => {
    if (!c) return false;
    return (
      String(c.id).toLowerCase() === targetCatLower ||
      String(c.slug || '').toLowerCase() === targetCatLower ||
      String((c as any).seoSlug || '').toLowerCase() === targetCatLower ||
      String(c.name || '').toLowerCase() === targetCatLower ||
      createSlug(c.name).toLowerCase() === targetCatLower
    );
  });

  const catSlug = categoryObj ? getCategorySlug(categoryObj) : createSlug(targetCat);

  if (targetSub && targetSub.trim()) {
    const targetSubLower = String(targetSub).toLowerCase();
    const subCategoryObj = categoryObj?.subcategories?.find(s => {
      if (!s) return false;
      return (
        String(s.id).toLowerCase() === targetSubLower ||
        String(s.slug || '').toLowerCase() === targetSubLower ||
        String((s as any).seoSlug || '').toLowerCase() === targetSubLower ||
        String(s.name || '').toLowerCase() === targetSubLower ||
        createSlug(s.name).toLowerCase() === targetSubLower
      );
    }) || categories.flatMap(c => c?.subcategories || []).find(s => {
      if (!s) return false;
      return (
        String(s.id).toLowerCase() === targetSubLower ||
        String(s.slug || '').toLowerCase() === targetSubLower ||
        String((s as any).seoSlug || '').toLowerCase() === targetSubLower ||
        String(s.name || '').toLowerCase() === targetSubLower ||
        createSlug(s.name).toLowerCase() === targetSubLower
      );
    });

    const subSlug = subCategoryObj ? getSubcategorySlug(subCategoryObj) : createSlug(targetSub);
    if (catSlug && subSlug) {
      return `/categories/${catSlug}/${subSlug}`;
    }
  }

  if (catSlug) {
    return `/categories/${catSlug}`;
  }

  return '/products';
}

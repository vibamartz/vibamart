import { Product, Category } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, createSlug } from './slug';
import { cleanProductCode } from './productCode';
import { isProductAssignedToCategory } from './productCategoryFilter';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../constants';

/**
 * Checks if a candidate product is an eligible similar product for the currentProduct.
 * 
 * Rules:
 * 1. Must match admin-assigned category and subcategory.
 * 2. Unrelated products from other categories or subcategories are strictly excluded.
 * 3. Currently viewed product and duplicate products are excluded.
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

  // 1. Exclude the currently viewed product (by id, productCode, slug)
  const candId = String(candidate.id || '').trim();
  const currId = String(currentProduct.id || '').trim();
  if (candId && currId && candId === currId) return false;

  const candCode = candidate.productCode ? cleanProductCode(candidate.productCode) : '';
  const currCode = currentProduct.productCode ? cleanProductCode(currentProduct.productCode) : '';
  if (candCode && currCode && candCode === currCode) return false;

  const candSlug = getProductSlug(candidate);
  const currSlug = getProductSlug(currentProduct);
  if (candSlug && currSlug && candSlug === currSlug) return false;

  // 2. Exclude inactive products
  if (candidate.status === 'inactive' || candidate.status === 'draft') return false;
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
  if (candidate.status === 'out_of_stock' || candidate.inStock === false) return false;

  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;
  const hasVariantStock = hasVariants && candidate.variants!.some(v => (typeof v.stock === 'number' ? v.stock > 0 : true));
  const isDirectStockZero = typeof candidate.stock === 'number' && candidate.stock <= 0;

  if (isDirectStockZero && (!hasVariants || !hasVariantStock)) {
    return false;
  }

  // 6. Category & Subcategory Matching
  const allCategories = (Array.isArray(categories) && categories.length > 0) ? categories : DEFAULT_CATEGORIES;

  const targetCat = currentProduct.categoryId || (Array.isArray(currentProduct.categories) && currentProduct.categories[0]) || (currentProduct as any).category || '';
  const targetSub = currentProduct.subCategoryId || (Array.isArray(currentProduct.subCategoryIds) && currentProduct.subCategoryIds[0]) || (currentProduct as any).subCategory || '';

  if (!targetCat) return false;

  const targetCatStr = String(targetCat).toLowerCase().trim();
  const categoryObj = allCategories.find(c => {
    if (!c) return false;
    return (
      String(c.id).toLowerCase() === targetCatStr ||
      String(c.slug || '').toLowerCase() === targetCatStr ||
      String((c as any).seoSlug || '').toLowerCase() === targetCatStr ||
      String(c.name || '').toLowerCase() === targetCatStr ||
      createSlug(c.name).toLowerCase() === targetCatStr
    );
  });

  // Collect all valid representations for the target category
  const validCatKeys = new Set<string>();
  if (targetCatStr) validCatKeys.add(targetCatStr);
  if (categoryObj) {
    if (categoryObj.id) validCatKeys.add(String(categoryObj.id).toLowerCase().trim());
    if (categoryObj.slug) validCatKeys.add(String(categoryObj.slug).toLowerCase().trim());
    if ((categoryObj as any).seoSlug) validCatKeys.add(String((categoryObj as any).seoSlug).toLowerCase().trim());
    if (categoryObj.name) {
      validCatKeys.add(String(categoryObj.name).toLowerCase().trim());
      validCatKeys.add(createSlug(categoryObj.name).toLowerCase().trim());
    }
  }

  // Candidate category identifiers
  const candCatKeys = new Set<string>();
  if (candidate.categoryId) candCatKeys.add(String(candidate.categoryId).toLowerCase().trim());
  if (Array.isArray(candidate.categories)) {
    candidate.categories.forEach(c => c && candCatKeys.add(String(c).toLowerCase().trim()));
  }
  if ((candidate as any).category) candCatKeys.add(String((candidate as any).category).toLowerCase().trim());
  if ((candidate as any).categorySlug) candCatKeys.add(String((candidate as any).categorySlug).toLowerCase().trim());

  const matchesCategory =
    Array.from(validCatKeys).some(k => candCatKeys.has(k)) ||
    isProductAssignedToCategory(candidate, targetCat, allCategories);

  if (!matchesCategory) return false;

  // Subcategory Matching (Requirement 1 & 2):
  // If the current product has an admin-assigned subcategory:
  // Candidate MUST belong to that subcategory. Do not display unrelated products from other subcategories.
  const targetSubStr = String(targetSub || '').toLowerCase().trim();
  if (targetSubStr) {
    const subCategoryObj = categoryObj?.subcategories?.find(s => {
      if (!s) return false;
      return (
        String(s.id).toLowerCase() === targetSubStr ||
        String(s.slug || '').toLowerCase() === targetSubStr ||
        String((s as any).seoSlug || '').toLowerCase() === targetSubStr ||
        String(s.name || '').toLowerCase() === targetSubStr ||
        createSlug(s.name).toLowerCase() === targetSubStr
      );
    }) || allCategories.flatMap(c => c?.subcategories || []).find(s => {
      if (!s) return false;
      return (
        String(s.id).toLowerCase() === targetSubStr ||
        String(s.slug || '').toLowerCase() === targetSubStr ||
        String((s as any).seoSlug || '').toLowerCase() === targetSubStr ||
        String(s.name || '').toLowerCase() === targetSubStr ||
        createSlug(s.name).toLowerCase() === targetSubStr
      );
    });

    const validSubKeys = new Set<string>();
    validSubKeys.add(targetSubStr);
    const descendantNestedIds = new Set<string>();

    if (subCategoryObj) {
      if (subCategoryObj.id) validSubKeys.add(String(subCategoryObj.id).toLowerCase().trim());
      if (subCategoryObj.slug) validSubKeys.add(String(subCategoryObj.slug).toLowerCase().trim());
      if ((subCategoryObj as any).seoSlug) validSubKeys.add(String((subCategoryObj as any).seoSlug).toLowerCase().trim());
      if (subCategoryObj.name) {
        validSubKeys.add(String(subCategoryObj.name).toLowerCase().trim());
        validSubKeys.add(createSlug(subCategoryObj.name).toLowerCase().trim());
      }
      if (Array.isArray(subCategoryObj.subcategories)) {
        for (const nested of subCategoryObj.subcategories) {
          if (!nested) continue;
          if (nested.id) descendantNestedIds.add(String(nested.id).toLowerCase().trim());
          if (nested.slug) descendantNestedIds.add(String(nested.slug).toLowerCase().trim());
          if (nested.name) {
            descendantNestedIds.add(String(nested.name).toLowerCase().trim());
            descendantNestedIds.add(createSlug(nested.name).toLowerCase().trim());
          }
        }
      }
    }

    // Candidate subcategory identifiers
    const candSubKeys = new Set<string>();
    if (candidate.subCategoryId) candSubKeys.add(String(candidate.subCategoryId).toLowerCase().trim());
    if (Array.isArray(candidate.subCategoryIds)) {
      candidate.subCategoryIds.forEach(s => s && candSubKeys.add(String(s).toLowerCase().trim()));
    }
    if ((candidate as any).subCategory) candSubKeys.add(String((candidate as any).subCategory).toLowerCase().trim());
    if ((candidate as any).subCategorySlug) candSubKeys.add(String((candidate as any).subCategorySlug).toLowerCase().trim());

    const candNestedKeys = new Set<string>();
    if (candidate.nestedSubCategoryId) candNestedKeys.add(String(candidate.nestedSubCategoryId).toLowerCase().trim());
    if (Array.isArray(candidate.nestedSubCategoryIds)) {
      candidate.nestedSubCategoryIds.forEach(n => n && candNestedKeys.add(String(n).toLowerCase().trim()));
    }

    const matchesSub =
      Array.from(validSubKeys).some(k => candSubKeys.has(k)) ||
      Array.from(descendantNestedIds).some(k => candNestedKeys.has(k) || candSubKeys.has(k)) ||
      isProductAssignedToCategory(candidate, targetCat, allCategories, targetSub);

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

  const allCategories = (Array.isArray(categories) && categories.length > 0) ? categories : DEFAULT_CATEGORIES;

  const targetCat = currentProduct.categoryId || (Array.isArray(currentProduct.categories) && currentProduct.categories[0]) || (currentProduct as any).category || '';
  const targetSub = currentProduct.subCategoryId || (Array.isArray(currentProduct.subCategoryIds) && currentProduct.subCategoryIds[0]) || (currentProduct as any).subCategory || '';

  if (!targetCat) return '/products';

  const targetCatLower = String(targetCat).toLowerCase().trim();
  const categoryObj = allCategories.find(c => {
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
    const targetSubLower = String(targetSub).toLowerCase().trim();
    const subCategoryObj = categoryObj?.subcategories?.find(s => {
      if (!s) return false;
      return (
        String(s.id).toLowerCase() === targetSubLower ||
        String(s.slug || '').toLowerCase() === targetSubLower ||
        String((s as any).seoSlug || '').toLowerCase() === targetSubLower ||
        String(s.name || '').toLowerCase() === targetSubLower ||
        createSlug(s.name).toLowerCase() === targetSubLower
      );
    }) || allCategories.flatMap(c => c?.subcategories || []).find(s => {
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

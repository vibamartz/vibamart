import { Product, Category } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, createSlug } from './slug';
import { cleanProductCode } from './productCode';
import { isProductAssignedToCategory } from './productCategoryFilter';

/**
 * Universal validator to check if candidate product is an eligible similar product for current product.
 * Strictly adheres to:
 * 1. Admin-assigned category and subcategory relevance.
 * 2. Unrelated products from other categories or other subcategories are excluded.
 * 3. Excludes current product (by ID, document ID, productCode, or slug).
 * 4. Excludes inactive, draft, storefront-hidden, deleted, and out-of-stock products.
 */
export function isProductEligibleSimilar(
  candidate: Product,
  currentProduct: Product | { id: string; slug?: string; productCode?: string; categoryId?: string; subCategoryId?: string; categories?: string[]; subCategoryIds?: string[] },
  categories: Category[] = [],
  rewardIds: Set<string> = new Set()
): boolean {
  if (!candidate || !candidate.id) return false;
  if (!currentProduct) return false;

  const currentId = String(currentProduct.id || '').trim();
  const currentSlug = (currentProduct as any).slug || getProductSlug(currentProduct);
  const currentCode = (currentProduct as any).productCode ? cleanProductCode((currentProduct as any).productCode) : '';

  // 1. Exclude the currently viewed product
  const candidateId = String(candidate.id || '').trim();
  const candidateDocId = String((candidate as any)._id || candidate.id || '').trim();
  const candidateCode = (candidate as any).productCode ? cleanProductCode((candidate as any).productCode) : '';
  const candidateSlug = getProductSlug(candidate);

  if (
    (currentId && (candidateId === currentId || candidateDocId === currentId)) ||
    (currentCode && candidateCode && (candidateCode === currentCode || cleanProductCode(candidateCode) === cleanProductCode(currentCode))) ||
    (currentSlug && candidateSlug && candidateSlug === currentSlug)
  ) {
    return false;
  }

  // 2. Exclude reward products
  if (
    rewardIds.has(candidate.id) ||
    ((candidate as any)._id && rewardIds.has((candidate as any)._id)) ||
    (candidate as any).isRewardProduct ||
    (candidate as any).isReward
  ) {
    return false;
  }

  // 3. Exclude deleted products
  if ((candidate as any).isDeleted || (candidate as any).deleted || (candidate as any).is_deleted) {
    return false;
  }

  // 4. Exclude inactive or storefront-hidden products
  if (candidate.status !== 'active' || candidate.isVisible === false) {
    return false;
  }

  // 5. Exclude out-of-stock products
  if (candidate.inStock === false || candidate.status === 'out_of_stock') {
    return false;
  }
  const stockNum = typeof candidate.stock === 'number' ? candidate.stock : Number(candidate.stock ?? 0);
  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;
  const hasInStockVariant = hasVariants && candidate.variants!.some(
    v => (typeof v.stock === 'number' ? v.stock > 0 : (v.stock === undefined || v.stock === null)) &&
         v.inStock !== false &&
         !(v as any).disabled
  );
  if (hasVariants) {
    if (!hasInStockVariant) {
      return false;
    }
  } else {
    if (stockNum <= 0) {
      return false;
    }
  }

  // 6. Category & Subcategory matching (Admin-assigned)
  const currentCatId = currentProduct.categoryId || (Array.isArray((currentProduct as any).categories) && (currentProduct as any).categories[0]) || '';
  const currentCatIds = [currentCatId, ...((currentProduct as any).categories || [])]
    .map(c => String(c || '').trim())
    .filter(Boolean);

  if (currentCatIds.length === 0) {
    return false;
  }

  const currentSubId = currentProduct.subCategoryId || (Array.isArray((currentProduct as any).subCategoryIds) && (currentProduct as any).subCategoryIds[0]) || '';
  const currentSubIds = [currentSubId, ...((currentProduct as any).subCategoryIds || [])]
    .map(s => String(s || '').trim())
    .filter(Boolean);

  // Must belong to at least one category of current product
  const candCatIds = [
    candidate.categoryId,
    ...((candidate as any).categories || []),
    (candidate as any).category
  ].map(c => String(c || '').trim().toLowerCase()).filter(Boolean);

  let matchesCat = false;
  for (const cat of currentCatIds) {
    const catLower = cat.toLowerCase();
    if (candCatIds.includes(catLower) || isProductAssignedToCategory(candidate, cat, categories)) {
      matchesCat = true;
      break;
    }
  }
  if (!matchesCat) {
    return false;
  }

  // If current product has admin-assigned subcategory, candidate MUST belong to that subcategory!
  if (currentSubIds.length > 0) {
    const candSubIds = [
      candidate.subCategoryId,
      ...((candidate as any).subCategoryIds || []),
      (candidate as any).subCategory
    ].map(s => String(s || '').trim().toLowerCase()).filter(Boolean);

    let matchesSub = false;
    for (const cat of currentCatIds) {
      for (const sub of currentSubIds) {
        const subLower = sub.toLowerCase();
        if (candSubIds.includes(subLower) || isProductAssignedToCategory(candidate, cat, categories, sub)) {
          matchesSub = true;
          break;
        }
      }
      if (matchesSub) break;
    }
    if (!matchesSub) {
      return false;
    }
  }

  return true;
}

/**
 * Returns the correct View All / Click to See All URL for the current product's similar products.
 * Resolves to /categories/:categorySlug/:subcategorySlug if product has a subcategory,
 * or /categories/:categorySlug if product has only a category,
 * or /products?category=... if slugs cannot be resolved.
 */
export function getSimilarProductsSeeAllLink(
  product: Product | { categoryId?: string; subCategoryId?: string; categories?: string[]; subCategoryIds?: string[] } | null | undefined,
  categories: Category[] = []
): string {
  if (!product) return '/products';

  const currentCatId = product.categoryId || (Array.isArray((product as any).categories) && (product as any).categories[0]) || '';
  const currentSubId = product.subCategoryId || (Array.isArray((product as any).subCategoryIds) && (product as any).subCategoryIds[0]) || '';

  if (!currentCatId && !currentSubId) return '/products';

  const catLower = currentCatId.toLowerCase();
  const catObj = categories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    const cname = String(c.name || '').toLowerCase();
    const cnameSlug = c.name ? createSlug(c.name).toLowerCase() : '';
    const compSlug = String(getCategorySlug(c) || '').toLowerCase();
    return (
      cid === catLower ||
      cslug === catLower ||
      cseo === catLower ||
      compSlug === catLower ||
      cname === catLower ||
      cnameSlug === catLower
    );
  });

  const catSlug = catObj ? getCategorySlug(catObj) : (currentCatId ? createSlug(currentCatId) : '');

  if (currentSubId) {
    const subLower = currentSubId.toLowerCase();
    let subObj = catObj?.subcategories?.find(s => {
      if (!s) return false;
      const sid = String(s.id || '').toLowerCase();
      const sslug = String(s.slug || '').toLowerCase();
      const sseo = String((s as any).seoSlug || '').toLowerCase();
      const sname = String(s.name || '').toLowerCase();
      const snameSlug = s.name ? createSlug(s.name).toLowerCase() : '';
      const compSlug = String(getSubcategorySlug(s) || '').toLowerCase();
      return (
        sid === subLower ||
        sslug === subLower ||
        sseo === subLower ||
        compSlug === subLower ||
        sname === subLower ||
        snameSlug === subLower
      );
    });

    if (!subObj) {
      for (const cat of categories) {
        if (!cat || !Array.isArray(cat.subcategories)) continue;
        const found = cat.subcategories.find(s => {
          if (!s) return false;
          const sid = String(s.id || '').toLowerCase();
          const sslug = String(s.slug || '').toLowerCase();
          const sseo = String((s as any).seoSlug || '').toLowerCase();
          const sname = String(s.name || '').toLowerCase();
          const snameSlug = s.name ? createSlug(s.name).toLowerCase() : '';
          const compSlug = String(getSubcategorySlug(s) || '').toLowerCase();
          return (
            sid === subLower ||
            sslug === subLower ||
            sseo === subLower ||
            compSlug === subLower ||
            sname === subLower ||
            snameSlug === subLower
          );
        });
        if (found) {
          subObj = found;
          break;
        }
      }
    }

    const subSlug = subObj ? getSubcategorySlug(subObj) : createSlug(currentSubId);
    if (catSlug && subSlug) {
      return `/categories/${catSlug}/${subSlug}`;
    }
  }

  if (catSlug) {
    return `/categories/${catSlug}`;
  }

  if (currentCatId) {
    return `/products?category=${encodeURIComponent(currentCatId)}${currentSubId ? `&subCategory=${encodeURIComponent(currentSubId)}` : ''}`;
  }

  return '/products';
}

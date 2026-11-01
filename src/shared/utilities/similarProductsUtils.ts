import { Product, Category } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, createSlug } from './slug';
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

  const currentId = currentProduct.id;
  const currentSlug = (currentProduct as any).slug || getProductSlug(currentProduct);
  const currentCode = (currentProduct as any).productCode;

  // 1. Exclude the currently viewed product
  const candidateId = candidate.id;
  const candidateDocId = (candidate as any)._id || candidate.id;
  const candidateCode = (candidate as any).productCode;
  const candidateSlug = getProductSlug(candidate);

  if (
    candidateId === currentId ||
    candidateDocId === currentId ||
    (currentCode && candidateCode && candidateCode === currentCode) ||
    (currentSlug && candidateSlug && candidateSlug === currentSlug)
  ) {
    return false;
  }

  // 2. Exclude reward products
  if (rewardIds.has(candidate.id)) {
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
  if (candidate.inStock === false) {
    return false;
  }
  const stockNum = Number(candidate.stock ?? 0);
  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;
  const hasInStockVariant = hasVariants && candidate.variants!.some(
    v => (v.stock ?? 0) > 0 && v.inStock !== false && !v.disabled
  );
  if (stockNum <= 0 && !hasInStockVariant) {
    return false;
  }

  // 6. Category & Subcategory matching (Admin-assigned)
  const currentCatId = currentProduct.categoryId || '';
  const currentCatIds = [currentCatId, ...((currentProduct as any).categories || [])]
    .map(c => String(c || '').trim())
    .filter(Boolean);

  const currentSubId = currentProduct.subCategoryId || '';
  const currentSubIds = [currentSubId, ...((currentProduct as any).subCategoryIds || [])]
    .map(s => String(s || '').trim())
    .filter(Boolean);

  // Must belong to at least one category of current product
  let matchesCat = false;
  for (const cat of currentCatIds) {
    if (isProductAssignedToCategory(candidate, cat, categories)) {
      matchesCat = true;
      break;
    }
  }
  if (!matchesCat) {
    return false;
  }

  // If current product has admin-assigned subcategory, candidate MUST belong to that subcategory!
  if (currentSubIds.length > 0) {
    let matchesSub = false;
    for (const cat of currentCatIds) {
      for (const sub of currentSubIds) {
        if (isProductAssignedToCategory(candidate, cat, categories, sub)) {
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

  const currentCatId = product.categoryId || (product.categories && product.categories[0]) || '';
  const currentSubId = product.subCategoryId || (product.subCategoryIds && product.subCategoryIds[0]) || '';

  if (!currentCatId && !currentSubId) return '/products';

  const catObj = categories.find(c =>
    c && (
      String(c.id).toLowerCase() === currentCatId.toLowerCase() ||
      String(c.slug || '').toLowerCase() === currentCatId.toLowerCase() ||
      String((c as any).seoSlug || '').toLowerCase() === currentCatId.toLowerCase()
    )
  );

  const catSlug = catObj ? getCategorySlug(catObj) : (currentCatId ? createSlug(currentCatId) : '');

  if (currentSubId) {
    let subObj = catObj?.subcategories?.find(s =>
      s && (
        String(s.id).toLowerCase() === currentSubId.toLowerCase() ||
        String(s.slug || '').toLowerCase() === currentSubId.toLowerCase() ||
        String((s as any).seoSlug || '').toLowerCase() === currentSubId.toLowerCase()
      )
    );
    if (!subObj) {
      for (const cat of categories) {
        const found = cat.subcategories?.find(s =>
          s && (
            String(s.id).toLowerCase() === currentSubId.toLowerCase() ||
            String(s.slug || '').toLowerCase() === currentSubId.toLowerCase() ||
            String((s as any).seoSlug || '').toLowerCase() === currentSubId.toLowerCase()
          )
        );
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

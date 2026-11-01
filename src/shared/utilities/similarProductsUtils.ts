import { Product, Category, SubCategory } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, createSlug } from './slug';
import { cleanProductCode } from './productCode';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../constants';
import { isProductAssignedToCategory } from './productCategoryFilter';

/**
 * Universal validator to check if candidate product is an eligible similar product for current product.
 * Strictly adheres to:
 * 1. Admin-assigned category and subcategory relevance.
 * 2. Unrelated products from other categories or subcategories are excluded.
 * 3. Excludes current product (by ID, document ID, productCode, or slug).
 * 4. Excludes inactive, deleted, and out-of-stock products.
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
  const currentDocId = String((currentProduct as any)._id || currentProduct.id || '').trim();
  const currentSlug = String((currentProduct as any).slug || getProductSlug(currentProduct) || '').trim().toLowerCase();
  const currentCode = (currentProduct as any).productCode ? cleanProductCode((currentProduct as any).productCode) : '';

  const candidateId = String(candidate.id || '').trim();
  const candidateDocId = String((candidate as any)._id || candidate.id || '').trim();
  const candidateSlug = String(candidate.slug || getProductSlug(candidate) || '').trim().toLowerCase();
  const candidateCode = candidate.productCode ? cleanProductCode(candidate.productCode) : '';

  // 1. Exclude the currently viewed product
  if (
    (currentId && (candidateId === currentId || candidateDocId === currentId)) ||
    (currentDocId && (candidateId === currentDocId || candidateDocId === currentDocId)) ||
    (currentCode && candidateCode && candidateCode === currentCode) ||
    (currentSlug && candidateSlug && candidateSlug === currentSlug)
  ) {
    return false;
  }

  // 2. Exclude reward products
  if (rewardIds.has(candidate.id) || (candidateDocId && rewardIds.has(candidateDocId))) {
    return false;
  }

  // 3. Exclude deleted products
  if (
    (candidate as any).isDeleted === true ||
    (candidate as any).deleted === true ||
    (candidate as any).is_deleted === true ||
    (candidate as any).status === 'deleted'
  ) {
    return false;
  }

  // 4. Exclude inactive, draft, or storefront-hidden products
  if (
    candidate.status !== 'active' ||
    candidate.isVisible === false ||
    (candidate as any).visibility === 'hidden'
  ) {
    return false;
  }

  // 5. Exclude out-of-stock products
  if (
    candidate.inStock === false ||
    (candidate as any).status === 'out_of_stock' ||
    (candidate as any).stockStatus === 'out_of_stock'
  ) {
    return false;
  }

  const stockNum = Number(candidate.stock ?? (candidate as any).stockQuantity ?? 0);
  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;

  if (hasVariants) {
    // If product has variants, at least one active variant must have stock > 0
    const hasInStockVariant = candidate.variants!.some(
      v => (v.stock ?? 0) > 0 && v.inStock !== false && !v.disabled && v.status !== 'disabled'
    );
    if (!hasInStockVariant) {
      return false;
    }
  } else {
    // If no variants, base product stock must be > 0
    if (stockNum <= 0) {
      return false;
    }
  }

  // 6. Admin-assigned Category & Subcategory matching (Strict isolation)
  const effectiveCategories = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  // Extract current product's category identifiers (exclude generic/all)
  const rawCurrentCatIds: string[] = [
    currentProduct.categoryId || '',
    ...((currentProduct as any).categories || []),
    (currentProduct as any).category || '',
    (currentProduct as any).categorySlug || ''
  ]
    .map(c => String(c || '').trim())
    .filter(c => c && c.toLowerCase() !== 'all' && c.toLowerCase() !== 'for-you' && c.toLowerCase() !== 'all-deals' && c.toLowerCase() !== 'categories');

  // If current product has no admin-assigned category, do not display products from arbitrary categories
  if (rawCurrentCatIds.length === 0) {
    return false;
  }

  // Extract current product's subcategory identifiers
  const rawCurrentSubIds: string[] = [
    currentProduct.subCategoryId || '',
    ...((currentProduct as any).subCategoryIds || []),
    (currentProduct as any).subCategory || '',
    (currentProduct as any).subCategorySlug || ''
  ]
    .map(s => String(s || '').trim())
    .filter(s => s && s.toLowerCase() !== 'all');

  // Resolve all valid category identifiers (id, slug, seoSlug, computed slug, name, nameSlug)
  const matchedCategoryObjects: Category[] = [];
  const validCatIdsAndSlugs = new Set<string>();

  for (const rawCat of rawCurrentCatIds) {
    const rawLower = rawCat.toLowerCase();
    validCatIdsAndSlugs.add(rawLower);
    const rawSlug = createSlug(rawCat).toLowerCase();
    if (rawSlug) validCatIdsAndSlugs.add(rawSlug);

    const found = effectiveCategories.find(c => {
      if (!c) return false;
      const cid = String(c.id || '').toLowerCase();
      const cslug = String(c.slug || '').toLowerCase();
      const cseo = String((c as any).seoSlug || '').toLowerCase();
      const cname = String(c.name || '').toLowerCase();
      const cnameslug = c.name ? createSlug(c.name).toLowerCase() : '';
      return cid === rawLower || cslug === rawLower || cseo === rawLower || cname === rawLower || cnameslug === rawLower;
    });

    if (found) {
      matchedCategoryObjects.push(found);
      if (found.id) validCatIdsAndSlugs.add(String(found.id).toLowerCase());
      if (found.slug) validCatIdsAndSlugs.add(String(found.slug).toLowerCase());
      if ((found as any).seoSlug) validCatIdsAndSlugs.add(String((found as any).seoSlug).toLowerCase());
      const compSlug = getCategorySlug(found);
      if (compSlug) validCatIdsAndSlugs.add(compSlug.toLowerCase());
      if (found.name) {
        validCatIdsAndSlugs.add(String(found.name).toLowerCase());
        validCatIdsAndSlugs.add(createSlug(found.name).toLowerCase());
      }
    }
  }

  // Extract candidate product's category identifiers
  const candidateCatIdentifiers = new Set<string>();
  if (candidate.categoryId) {
    const cId = String(candidate.categoryId).trim().toLowerCase();
    if (cId) {
      candidateCatIdentifiers.add(cId);
      const cSlug = createSlug(cId).toLowerCase();
      if (cSlug) candidateCatIdentifiers.add(cSlug);
    }
  }
  if (Array.isArray(candidate.categories)) {
    for (const c of candidate.categories) {
      if (c) {
        const cTrim = String(c).trim().toLowerCase();
        if (cTrim) {
          candidateCatIdentifiers.add(cTrim);
          const cSlug = createSlug(cTrim).toLowerCase();
          if (cSlug) candidateCatIdentifiers.add(cSlug);
        }
      }
    }
  }
  if ((candidate as any).category) {
    const cTrim = String((candidate as any).category).trim().toLowerCase();
    if (cTrim) {
      candidateCatIdentifiers.add(cTrim);
      const cSlug = createSlug(cTrim).toLowerCase();
      if (cSlug) candidateCatIdentifiers.add(cSlug);
    }
  }
  if ((candidate as any).categorySlug) {
    const cTrim = String((candidate as any).categorySlug).trim().toLowerCase();
    if (cTrim) candidateCatIdentifiers.add(cTrim);
  }

  // Check Category Match: Candidate MUST belong to current product's category
  let matchesCategory =
    Array.from(candidateCatIdentifiers).some(id => validCatIdsAndSlugs.has(id)) ||
    rawCurrentCatIds.some(cat => isProductAssignedToCategory(candidate, cat, effectiveCategories));

  if (!matchesCategory) {
    return false;
  }

  // Check Subcategory Match: If current product has admin-assigned subcategory, candidate MUST belong to that subcategory!
  if (rawCurrentSubIds.length > 0) {
    const validSubIdsAndSlugs = new Set<string>();

    for (const rawSub of rawCurrentSubIds) {
      const rawLower = rawSub.toLowerCase();
      validSubIdsAndSlugs.add(rawLower);
      const rawSlug = createSlug(rawSub).toLowerCase();
      if (rawSlug) validSubIdsAndSlugs.add(rawSlug);

      const searchCats = matchedCategoryObjects.length > 0 ? matchedCategoryObjects : effectiveCategories;
      for (const cat of searchCats) {
        if (!cat || !Array.isArray(cat.subcategories)) continue;
        for (const sub of cat.subcategories) {
          if (!sub) continue;
          const sid = String(sub.id || '').toLowerCase();
          const sslug = String(sub.slug || '').toLowerCase();
          const sseo = String((sub as any).seoSlug || '').toLowerCase();
          const sname = String(sub.name || '').toLowerCase();
          const snameslug = sub.name ? createSlug(sub.name).toLowerCase() : '';

          if (
            sid === rawLower ||
            sslug === rawLower ||
            sseo === rawLower ||
            sname === rawLower ||
            snameslug === rawLower ||
            sid === rawSlug ||
            sslug === rawSlug
          ) {
            if (sub.id) validSubIdsAndSlugs.add(String(sub.id).toLowerCase());
            if (sub.slug) validSubIdsAndSlugs.add(String(sub.slug).toLowerCase());
            if ((sub as any).seoSlug) validSubIdsAndSlugs.add(String((sub as any).seoSlug).toLowerCase());
            const compSlug = getSubcategorySlug(sub);
            if (compSlug) validSubIdsAndSlugs.add(compSlug.toLowerCase());
            if (sub.name) {
              validSubIdsAndSlugs.add(String(sub.name).toLowerCase());
              validSubIdsAndSlugs.add(createSlug(sub.name).toLowerCase());
            }

            if (Array.isArray(sub.subcategories)) {
              for (const nested of sub.subcategories) {
                if (nested) {
                  if (nested.id) validSubIdsAndSlugs.add(String(nested.id).toLowerCase());
                  if (nested.slug) validSubIdsAndSlugs.add(String(nested.slug).toLowerCase());
                  if ((nested as any).seoSlug) validSubIdsAndSlugs.add(String((nested as any).seoSlug).toLowerCase());
                  if (nested.name) {
                    validSubIdsAndSlugs.add(String(nested.name).toLowerCase());
                    validSubIdsAndSlugs.add(createSlug(nested.name).toLowerCase());
                  }
                }
              }
            }
          }
        }
      }
    }

    const candidateSubIdentifiers = new Set<string>();
    if (candidate.subCategoryId) {
      const sId = String(candidate.subCategoryId).trim().toLowerCase();
      if (sId) {
        candidateSubIdentifiers.add(sId);
        const sSlug = createSlug(sId).toLowerCase();
        if (sSlug) candidateSubIdentifiers.add(sSlug);
      }
    }
    if (Array.isArray(candidate.subCategoryIds)) {
      for (const s of candidate.subCategoryIds) {
        if (s) {
          const sTrim = String(s).trim().toLowerCase();
          if (sTrim) {
            candidateSubIdentifiers.add(sTrim);
            const sSlug = createSlug(sTrim).toLowerCase();
            if (sSlug) candidateSubIdentifiers.add(sSlug);
          }
        }
      }
    }
    if ((candidate as any).subCategory) {
      const sTrim = String((candidate as any).subCategory).trim().toLowerCase();
      if (sTrim) {
        candidateSubIdentifiers.add(sTrim);
        const sSlug = createSlug(sTrim).toLowerCase();
        if (sSlug) candidateSubIdentifiers.add(sSlug);
      }
    }
    if ((candidate as any).subCategorySlug) {
      const sTrim = String((candidate as any).subCategorySlug).trim().toLowerCase();
      if (sTrim) candidateSubIdentifiers.add(sTrim);
    }
    if (candidate.nestedSubCategoryId) {
      const nId = String(candidate.nestedSubCategoryId).trim().toLowerCase();
      if (nId) {
        candidateSubIdentifiers.add(nId);
        const nSlug = createSlug(nId).toLowerCase();
        if (nSlug) candidateSubIdentifiers.add(nSlug);
      }
    }
    if (Array.isArray(candidate.nestedSubCategoryIds)) {
      for (const n of candidate.nestedSubCategoryIds) {
        if (n) {
          const nTrim = String(n).trim().toLowerCase();
          if (nTrim) {
            candidateSubIdentifiers.add(nTrim);
            const nSlug = createSlug(nTrim).toLowerCase();
            if (nSlug) candidateSubIdentifiers.add(nSlug);
          }
        }
      }
    }

    const matchesSubCategory =
      Array.from(candidateSubIdentifiers).some(id => validSubIdsAndSlugs.has(id)) ||
      rawCurrentCatIds.some(cat =>
        rawCurrentSubIds.some(sub => isProductAssignedToCategory(candidate, cat, effectiveCategories, sub))
      );

    if (!matchesSubCategory) {
      return false;
    }
  }

  return true;
}

/**
 * Returns the correct View All / Click to See All URL for the current product's similar products.
 * Resolves to /categories/:categorySlug/:subcategorySlug if product has a subcategory,
 * or /categories/:categorySlug if product has only a category,
 * never shows products from other categories.
 */
export function getSimilarProductsSeeAllLink(
  product: Product | { categoryId?: string; subCategoryId?: string; categories?: string[]; subCategoryIds?: string[] } | null | undefined,
  categories: Category[] = []
): string {
  if (!product) return '/products';

  const effectiveCategories = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const currentCatId = String(product.categoryId || (product.categories && product.categories[0]) || (product as any).category || '').trim();
  const currentSubId = String(product.subCategoryId || (product.subCategoryIds && product.subCategoryIds[0]) || (product as any).subCategory || '').trim();

  if (!currentCatId && !currentSubId) return '/products';

  const catObj = effectiveCategories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    const cname = String(c.name || '').toLowerCase();
    const cnameslug = c.name ? createSlug(c.name).toLowerCase() : '';
    const target = currentCatId.toLowerCase();
    return cid === target || cslug === target || cseo === target || cname === target || cnameslug === target;
  });

  const catSlug = catObj ? getCategorySlug(catObj) : (currentCatId ? createSlug(currentCatId) : '');

  if (currentSubId) {
    let subObj: SubCategory | undefined;
    const searchCats = catObj ? [catObj] : effectiveCategories;
    for (const cat of searchCats) {
      if (!cat || !Array.isArray(cat.subcategories)) continue;
      const found = cat.subcategories.find(s => {
        if (!s) return false;
        const sid = String(s.id || '').toLowerCase();
        const sslug = String(s.slug || '').toLowerCase();
        const sseo = String((s as any).seoSlug || '').toLowerCase();
        const sname = String(s.name || '').toLowerCase();
        const snameslug = s.name ? createSlug(s.name).toLowerCase() : '';
        const target = currentSubId.toLowerCase();
        return sid === target || sslug === target || sseo === target || sname === target || snameslug === target;
      });
      if (found) {
        subObj = found;
        break;
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

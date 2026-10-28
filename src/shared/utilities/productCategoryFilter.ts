import { Product, Category } from '../types';
import { getCategorySlug, createSlug } from './slug';

/**
 * Universal category and subcategory assignment checker for a product.
 * Returns true if the product belongs to target category and/or subcategory explicitly by admin-assigned IDs.
 * Does NOT match products based on similar names, keywords, brands, or product types.
 */
export function isProductAssignedToCategory(
  product: Product,
  targetCategorySlugOrId: string,
  categories: Category[] = [],
  targetSubCategorySlugOrId?: string,
  targetNestedSubCategorySlugOrId?: string
): boolean {
  if (!product) return false;
  const targetCat = (targetCategorySlugOrId || '').trim();
  const targetCatLower = targetCat.toLowerCase();
  const targetSub = (targetSubCategorySlugOrId || '').trim();
  const targetSubLower = targetSub.toLowerCase();
  const targetNested = (targetNestedSubCategorySlugOrId || '').trim();
  const targetNestedLower = targetNested.toLowerCase();

  const isAllCat = !targetCat || targetCatLower === 'for-you' || targetCatLower === 'all' || targetCatLower === 'all-deals' || targetCatLower === 'categories' || targetCatLower === '';
  const isAllSub = !targetSub || targetSubLower === 'all' || targetSubLower === '';
  const isAllNested = !targetNested || targetNestedLower === 'all' || targetNestedLower === '';

  // 'for-you', 'all', 'all-deals' or empty with no subcategory filter means show all
  if (isAllCat && isAllSub && isAllNested) {
    return true;
  }

  // Extract all admin-assigned IDs for the product (normalized to lowercase)
  const pCatIds = new Set<string>();
  if (product.categoryId) pCatIds.add(String(product.categoryId).toLowerCase());
  if (Array.isArray(product.categories)) {
    product.categories.forEach(c => c && pCatIds.add(String(c).toLowerCase()));
  }
  if ((product as any).category) pCatIds.add(String((product as any).category).toLowerCase());
  if ((product as any).categorySlug) pCatIds.add(String((product as any).categorySlug).toLowerCase());

  const pSubIds = new Set<string>();
  if (product.subCategoryId) pSubIds.add(String(product.subCategoryId).toLowerCase());
  if (Array.isArray(product.subCategoryIds)) {
    product.subCategoryIds.forEach(s => s && pSubIds.add(String(s).toLowerCase()));
  }

  const pNestedIds = new Set<string>();
  if (product.nestedSubCategoryId) pNestedIds.add(String(product.nestedSubCategoryId).toLowerCase());
  if (Array.isArray(product.nestedSubCategoryIds)) {
    product.nestedSubCategoryIds.forEach(n => n && pNestedIds.add(String(n).toLowerCase()));
  }

  // 1. Locate root category object if targetCat is specified
  const categoryObj = !isAllCat ? categories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    const computedSlug = String(getCategorySlug(c) || '').toLowerCase();
    const nameSlug = c.name ? createSlug(c.name).toLowerCase() : '';
    const cname = String(c.name || '').toLowerCase();
    return (
      cid === targetCatLower ||
      cslug === targetCatLower ||
      cseo === targetCatLower ||
      computedSlug === targetCatLower ||
      nameSlug === targetCatLower ||
      cname === targetCatLower
    );
  }) : null;

  // 2. Validate Category Assignment (when category filter is active)
  if (!isAllCat) {
    const validTargetCatIds = new Set<string>([targetCatLower]);
    const descendantSubIds = new Set<string>();
    const descendantNestedIds = new Set<string>();

    if (categoryObj) {
      if (categoryObj.id) validTargetCatIds.add(String(categoryObj.id).toLowerCase());
      if (categoryObj.slug) validTargetCatIds.add(String(categoryObj.slug).toLowerCase());
      if ((categoryObj as any).seoSlug) validTargetCatIds.add(String((categoryObj as any).seoSlug).toLowerCase());
      const computedSlug = getCategorySlug(categoryObj);
      if (computedSlug) validTargetCatIds.add(computedSlug.toLowerCase());
      if (categoryObj.name) {
        validTargetCatIds.add(String(categoryObj.name).toLowerCase());
        validTargetCatIds.add(createSlug(categoryObj.name).toLowerCase());
      }

      if (Array.isArray(categoryObj.subcategories)) {
        for (const sub of categoryObj.subcategories) {
          if (!sub) continue;
          if (sub.id) descendantSubIds.add(String(sub.id).toLowerCase());
          if (sub.slug) descendantSubIds.add(String(sub.slug).toLowerCase());
          if (Array.isArray(sub.subcategories)) {
            for (const nested of sub.subcategories) {
              if (nested) {
                if (nested.id) descendantNestedIds.add(String(nested.id).toLowerCase());
                if (nested.slug) descendantNestedIds.add(String(nested.slug).toLowerCase());
              }
            }
          }
        }
      }
    } else {
      // If targetCat was not found at root level, it may be a subcategory or nested subcategory used as primary route
      for (const cat of categories) {
        if (!cat || !Array.isArray(cat.subcategories)) continue;
        for (const sub of cat.subcategories) {
          if (!sub) continue;
          const sId = String(sub.id || '').toLowerCase();
          const sSlug = String(sub.slug || '').toLowerCase();
          const sNameSlug = sub.name ? createSlug(sub.name).toLowerCase() : '';
          if (sId === targetCatLower || sSlug === targetCatLower || sNameSlug === targetCatLower) {
            validTargetCatIds.add(sId);
            if (sSlug) validTargetCatIds.add(sSlug);
            descendantSubIds.add(sId);
            if (Array.isArray(sub.subcategories)) {
              for (const nested of sub.subcategories) {
                if (nested?.id) descendantNestedIds.add(String(nested.id).toLowerCase());
              }
            }
          }
        }
      }
    }

    // Direct match on product.categoryId or product.categories
    let matchesCat = Array.from(validTargetCatIds).some(id => pCatIds.has(id));
    if (!matchesCat) {
      // Or product assigned to explicit descendant subcategory or nested subcategory
      matchesCat = Array.from(descendantSubIds).some(sid => pSubIds.has(sid)) ||
        Array.from(descendantNestedIds).some(nid => pNestedIds.has(nid));
    }

    if (!matchesCat) {
      return false;
    }
  }

  // 3. Validate Subcategory Assignment (when subcategory filter is active)
  if (!isAllSub) {
    const validSubIds = new Set<string>([targetSubLower]);
    const descendantNestedIds = new Set<string>();

    const searchCats = categoryObj ? [categoryObj] : categories;
    for (const cat of searchCats) {
      if (!cat || !Array.isArray(cat.subcategories)) continue;
      for (const sub of cat.subcategories) {
        if (!sub) continue;
        const sId = String(sub.id || '').toLowerCase();
        const sSlug = String(sub.slug || '').toLowerCase();
        const sSeo = String((sub as any).seoSlug || '').toLowerCase();
        const sNameSlug = sub.name ? createSlug(sub.name).toLowerCase() : '';
        const sName = String(sub.name || '').toLowerCase();

        if (
          sId === targetSubLower ||
          sSlug === targetSubLower ||
          sSeo === targetSubLower ||
          sNameSlug === targetSubLower ||
          sName === targetSubLower
        ) {
          validSubIds.add(sId);
          if (sSlug) validSubIds.add(sSlug);
          if (Array.isArray(sub.subcategories)) {
            for (const nested of sub.subcategories) {
              if (nested?.id) descendantNestedIds.add(String(nested.id).toLowerCase());
              if (nested?.slug) descendantNestedIds.add(String(nested.slug).toLowerCase());
            }
          }
        }
      }
    }

    let matchesSub = Array.from(validSubIds).some(sid => pSubIds.has(sid));
    if (!matchesSub) {
      matchesSub = Array.from(descendantNestedIds).some(nid => pNestedIds.has(nid));
    }

    if (!matchesSub) {
      return false;
    }
  }

  // 4. Validate Nested Subcategory Assignment (when nested subcategory filter is active)
  if (!isAllNested) {
    const validNestedIds = new Set<string>([targetNestedLower]);
    const searchCats = categoryObj ? [categoryObj] : categories;
    for (const cat of searchCats) {
      if (!cat || !Array.isArray(cat.subcategories)) continue;
      for (const sub of cat.subcategories) {
        if (!sub || !Array.isArray(sub.subcategories)) continue;
        for (const nested of sub.subcategories) {
          if (!nested) continue;
          const nId = String(nested.id || '').toLowerCase();
          const nSlug = String(nested.slug || '').toLowerCase();
          const nSeo = String((nested as any).seoSlug || '').toLowerCase();
          const nNameSlug = nested.name ? createSlug(nested.name).toLowerCase() : '';
          const nName = String(nested.name || '').toLowerCase();

          if (
            nId === targetNestedLower ||
            nSlug === targetNestedLower ||
            nSeo === targetNestedLower ||
            nNameSlug === targetNestedLower ||
            nName === targetNestedLower
          ) {
            validNestedIds.add(nId);
            if (nSlug) validNestedIds.add(nSlug);
          }
        }
      }
    }

    const matchesNested = Array.from(validNestedIds).some(nid => pNestedIds.has(nid));
    if (!matchesNested) {
      return false;
    }
  }

  return true;
}

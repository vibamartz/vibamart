import { Product, Category, SubCategory, VisualNestedSubcategory } from '../types';
import { getCategorySlug, createSlug } from './slug';
import { useVisualNestedSubcategoryStore } from '../../backend/store';

/**
 * Universal category and subcategory assignment checker for a product.
 * Returns true if the product belongs to target category, subcategory, nested subcategory,
 * and visual nested subcategory explicitly by admin-assigned IDs.
 * Does NOT match products based on similar names, keywords, brands, or product types.
 * Strictly prevents cross-category leaks (e.g., men's shoes appearing in women's shoes).
 */
export function isProductAssignedToCategory(
  product: Product,
  targetCategorySlugOrId: string,
  categories: Category[] = [],
  targetSubCategorySlugOrId?: string,
  targetNestedSubCategorySlugOrId?: string,
  targetVisualNestedSubCategorySlugOrId?: string,
  visualItems?: VisualNestedSubcategory[]
): boolean {
  if (!product) return false;

  const targetCat = (targetCategorySlugOrId || '').trim();
  const targetCatLower = targetCat.toLowerCase();
  const targetSub = (targetSubCategorySlugOrId || '').trim();
  const targetSubLower = targetSub.toLowerCase();
  const targetNested = (targetNestedSubCategorySlugOrId || '').trim();
  const targetNestedLower = targetNested.toLowerCase();
  const targetVisual = (targetVisualNestedSubCategorySlugOrId || '').trim();
  const targetVisualLower = targetVisual.toLowerCase();

  const isAllCat = !targetCat || targetCatLower === 'for-you' || targetCatLower === 'all' || targetCatLower === 'all-deals' || targetCatLower === 'categories' || targetCatLower === '';
  const isAllSub = !targetSub || targetSubLower === 'all' || targetSubLower === '';
  const isAllNested = !targetNested || targetNestedLower === 'all' || targetNestedLower === '';
  const isAllVisual = !targetVisual || targetVisualLower === 'all' || targetVisualLower === '';

  // 'for-you', 'all', 'all-deals' or empty with no subcategory/nested filter means show all categories
  if (isAllCat && isAllSub && isAllNested && isAllVisual) {
    return true;
  }

  // 1. Extract all admin-assigned IDs for the product (normalized to lowercase)
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
  if ((product as any).subCategory) pSubIds.add(String((product as any).subCategory).toLowerCase());
  if ((product as any).subCategorySlug) pSubIds.add(String((product as any).subCategorySlug).toLowerCase());

  const pNestedIds = new Set<string>();
  if (product.nestedSubCategoryId) pNestedIds.add(String(product.nestedSubCategoryId).toLowerCase());
  if (Array.isArray(product.nestedSubCategoryIds)) {
    product.nestedSubCategoryIds.forEach(n => n && pNestedIds.add(String(n).toLowerCase()));
  }
  if ((product as any).nestedSubCategory) pNestedIds.add(String((product as any).nestedSubCategory).toLowerCase());
  if ((product as any).nestedSubCategorySlug) pNestedIds.add(String((product as any).nestedSubCategorySlug).toLowerCase());

  const pVisualIds = new Set<string>();
  if (product.visualNestedSubcategoryId) pVisualIds.add(String(product.visualNestedSubcategoryId).toLowerCase());
  if (Array.isArray(product.visualNestedSubcategoryIds)) {
    product.visualNestedSubcategoryIds.forEach(v => v && pVisualIds.add(String(v).toLowerCase()));
  }

  // Resolve visual items list (from argument or store)
  const effectiveVisualItems: VisualNestedSubcategory[] = Array.isArray(visualItems) && visualItems.length > 0
    ? visualItems
    : (typeof useVisualNestedSubcategoryStore !== 'undefined' ? (useVisualNestedSubcategoryStore.getState()?.items || []) : []);

  // 2. Locate category object in category store by ID, slug, seoSlug, computed slug, or name
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

  // 3. Category Filter Validation
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
          if (sub.name) {
            descendantSubIds.add(String(sub.name).toLowerCase());
            descendantSubIds.add(createSlug(sub.name).toLowerCase());
          }
          if (Array.isArray(sub.subcategories)) {
            for (const nested of sub.subcategories) {
              if (nested) {
                if (nested.id) descendantNestedIds.add(String(nested.id).toLowerCase());
                if (nested.slug) descendantNestedIds.add(String(nested.slug).toLowerCase());
                if (nested.name) {
                  descendantNestedIds.add(String(nested.name).toLowerCase());
                  descendantNestedIds.add(createSlug(nested.name).toLowerCase());
                }
              }
            }
          }
        }
      }
    }

    // Direct match on product.categoryId or product.categories
    let matchesCat = Array.from(validTargetCatIds).some(id => pCatIds.has(id));
    if (!matchesCat) {
      // Or product assigned to explicit descendant subcategory or nested subcategory under this category
      matchesCat = Array.from(descendantSubIds).some(sid => pSubIds.has(sid)) ||
        Array.from(descendantNestedIds).some(nid => pNestedIds.has(nid));
    }

    if (!matchesCat) {
      return false;
    }
  }

  // 4. Subcategory Filter Validation
  let matchedSubObj: SubCategory | null = null;
  let parentCatOfMatchedSub: Category | null = null;

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
          matchedSubObj = sub;
          parentCatOfMatchedSub = cat;
          validSubIds.add(sId);
          if (sSlug) validSubIds.add(sSlug);
          if (sub.name) {
            validSubIds.add(sName);
            validSubIds.add(sNameSlug);
          }
          if (Array.isArray(sub.subcategories)) {
            for (const nested of sub.subcategories) {
              if (nested) {
                if (nested.id) descendantNestedIds.add(String(nested.id).toLowerCase());
                if (nested.slug) descendantNestedIds.add(String(nested.slug).toLowerCase());
                if (nested.name) {
                  descendantNestedIds.add(String(nested.name).toLowerCase());
                  descendantNestedIds.add(createSlug(nested.name).toLowerCase());
                }
              }
            }
          }
        }
      }
    }

    // Direct match on product.subCategoryId or descendant nested subcategory match
    let matchesSub = Array.from(validSubIds).some(sid => pSubIds.has(sid));
    if (!matchesSub) {
      matchesSub = Array.from(descendantNestedIds).some(nid => pNestedIds.has(nid));
    }

    if (!matchesSub) {
      return false;
    }
  }

  // 5. Nested Subcategory Filter Validation
  if (!isAllNested) {
    const validNestedIds = new Set<string>([targetNestedLower]);
    let matchedNestedObj: any = null;
    let parentSubOfMatchedNested: SubCategory | null = matchedSubObj;
    let parentCatOfMatchedNested: Category | null = parentCatOfMatchedSub || categoryObj;

    // Search strictly within matched subcategory if present to prevent cross-category collisions
    const searchSubs = matchedSubObj
      ? [matchedSubObj]
      : (categoryObj?.subcategories || categories.flatMap(c => c?.subcategories || []));

    for (const sub of searchSubs) {
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
          matchedNestedObj = nested;
          parentSubOfMatchedNested = sub;
          validNestedIds.add(nId);
          if (nSlug) validNestedIds.add(nSlug);
          if (nested.name) {
            validNestedIds.add(nName);
            validNestedIds.add(nNameSlug);
          }
          break;
        }
      }
      if (matchedNestedObj) break;
    }

    // Also check if targetNested corresponds to a Visual Nested Subcategory
    let matchesVisualAssignment = pVisualIds.has(targetNestedLower);
    if (!matchesVisualAssignment && effectiveVisualItems.length > 0) {
      const vMatch = effectiveVisualItems.find(v => {
        if (!v) return false;
        const vId = String(v.id || '').toLowerCase();
        const vSlug = String(v.slug || '').toLowerCase();
        const vSeo = String(v.seoSlug || '').toLowerCase();
        const vName = String(v.name || '').toLowerCase();
        const vNameSlug = v.name ? createSlug(v.name).toLowerCase() : '';
        return (
          vId === targetNestedLower ||
          vSlug === targetNestedLower ||
          vSeo === targetNestedLower ||
          vName === targetNestedLower ||
          vNameSlug === targetNestedLower
        );
      });
      if (vMatch) {
        const vMatchId = String(vMatch.id).toLowerCase();
        matchesVisualAssignment = pVisualIds.has(vMatchId) || (Array.isArray(vMatch.productIds) && vMatch.productIds.includes(product.id));
      }
    }

    const matchesNested = Array.from(validNestedIds).some(nid => pNestedIds.has(nid)) || matchesVisualAssignment;
    if (!matchesNested) {
      return false;
    }

    // Strict Parent Branch Isolation: product must belong to the same parent subcategory branch
    if (parentSubOfMatchedNested && pSubIds.size > 0) {
      const parentSubBranchIds = new Set<string>();
      if (parentSubOfMatchedNested.id) parentSubBranchIds.add(String(parentSubOfMatchedNested.id).toLowerCase());
      if (parentSubOfMatchedNested.slug) parentSubBranchIds.add(String(parentSubOfMatchedNested.slug).toLowerCase());
      if (parentSubOfMatchedNested.name) {
        parentSubBranchIds.add(String(parentSubOfMatchedNested.name).toLowerCase());
        parentSubBranchIds.add(createSlug(parentSubOfMatchedNested.name).toLowerCase());
      }
      const belongsToParentSubBranch = Array.from(parentSubBranchIds).some(id => pSubIds.has(id));
      if (!belongsToParentSubBranch) {
        return false;
      }
    }

    // Strict Parent Category Isolation: product must belong to the same parent category branch
    if (parentCatOfMatchedNested && pCatIds.size > 0) {
      const parentCatBranchIds = new Set<string>();
      if (parentCatOfMatchedNested.id) parentCatBranchIds.add(String(parentCatOfMatchedNested.id).toLowerCase());
      if (parentCatOfMatchedNested.slug) parentCatBranchIds.add(String(parentCatOfMatchedNested.slug).toLowerCase());
      if (parentCatOfMatchedNested.name) {
        parentCatBranchIds.add(String(parentCatOfMatchedNested.name).toLowerCase());
        parentCatBranchIds.add(createSlug(parentCatOfMatchedNested.name).toLowerCase());
      }
      const belongsToParentCatBranch = Array.from(parentCatBranchIds).some(id => pCatIds.has(id));
      if (!belongsToParentCatBranch) {
        return false;
      }
    }
  }

  // 6. Visual Nested Subcategory Filter Validation
  if (!isAllVisual) {
    let matchesExplicitVisual = pVisualIds.has(targetVisualLower);
    if (!matchesExplicitVisual && effectiveVisualItems.length > 0) {
      const vMatch = effectiveVisualItems.find(v => {
        if (!v) return false;
        const vId = String(v.id || '').toLowerCase();
        const vSlug = String(v.slug || '').toLowerCase();
        const vSeo = String(v.seoSlug || '').toLowerCase();
        const vName = String(v.name || '').toLowerCase();
        const vNameSlug = v.name ? createSlug(v.name).toLowerCase() : '';
        return (
          vId === targetVisualLower ||
          vSlug === targetVisualLower ||
          vSeo === targetVisualLower ||
          vName === targetVisualLower ||
          vNameSlug === targetVisualLower
        );
      });
      if (vMatch) {
        const vMatchId = String(vMatch.id).toLowerCase();
        matchesExplicitVisual = pVisualIds.has(vMatchId) || (Array.isArray(vMatch.productIds) && vMatch.productIds.includes(product.id));
      }
    }

    if (!matchesExplicitVisual) {
      return false;
    }
  }

  return true;
}

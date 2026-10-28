import { Product, Category } from '../types';
import { getCategorySlug, createSlug } from './slug';

/**
 * Universal category assignment checker for a product.
 * Returns true if the product belongs to target category explicitly by admin-assigned category ID,
 * or through child subcategory / nested subcategory IDs explicitly belonging to that category in the hierarchy.
 * Does NOT match products based on similar names, keywords, brands, or product types.
 */
export function isProductAssignedToCategory(
  product: Product,
  targetCategorySlugOrId: string,
  categories: Category[] = []
): boolean {
  if (!product || !targetCategorySlugOrId) return false;
  const target = targetCategorySlugOrId.trim();
  const targetLower = target.toLowerCase();

  // 'for-you', 'all', 'all-deals' or empty means show all categories
  if (targetLower === 'for-you' || targetLower === 'all' || targetLower === 'all-deals' || targetLower === '') {
    return true;
  }

  // Match category object in category store by ID, slug, seoSlug, computed slug, or name
  const categoryObj = categories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    const computedSlug = String(getCategorySlug(c) || '').toLowerCase();
    const nameSlug = c.name ? createSlug(c.name).toLowerCase() : '';
    const cname = String(c.name || '').toLowerCase();
    return (
      cid === targetLower ||
      cslug === targetLower ||
      cseo === targetLower ||
      computedSlug === targetLower ||
      nameSlug === targetLower ||
      cname === targetLower
    );
  });

  const validTargetIds = new Set<string>([targetLower]);
  if (categoryObj) {
    if (categoryObj.id) validTargetIds.add(String(categoryObj.id).toLowerCase());
    if (categoryObj.slug) validTargetIds.add(String(categoryObj.slug).toLowerCase());
    if ((categoryObj as any).seoSlug) validTargetIds.add(String((categoryObj as any).seoSlug).toLowerCase());
    const computedSlug = getCategorySlug(categoryObj);
    if (computedSlug) validTargetIds.add(computedSlug.toLowerCase());
    if (categoryObj.name) {
      validTargetIds.add(String(categoryObj.name).toLowerCase());
      validTargetIds.add(createSlug(categoryObj.name).toLowerCase());
    }
  }

  // 1. Direct match on product.categoryId (admin-assigned category ID, slug, or name)
  if (product.categoryId && validTargetIds.has(String(product.categoryId).toLowerCase())) {
    return true;
  }

  // Also check product.category or product.categorySlug if present
  if ((product as any).category && validTargetIds.has(String((product as any).category).toLowerCase())) {
    return true;
  }
  if ((product as any).categorySlug && validTargetIds.has(String((product as any).categorySlug).toLowerCase())) {
    return true;
  }

  // 2. Match within product.categories array (admin-assigned category IDs)
  if (Array.isArray(product.categories)) {
    if (product.categories.some(c => c && validTargetIds.has(String(c).toLowerCase()))) {
      return true;
    }
  }

  // 3. Subcategory and Nested Subcategory relationship match:
  // If product belongs to an explicit child subcategory or nested subcategory under this category
  if (categoryObj && Array.isArray(categoryObj.subcategories) && categoryObj.subcategories.length > 0) {
    const descendantSubIds = new Set<string>();
    const descendantNestedIds = new Set<string>();

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

    if (product.subCategoryId && descendantSubIds.has(String(product.subCategoryId).toLowerCase())) {
      return true;
    }

    if (Array.isArray(product.subCategoryIds)) {
      if (product.subCategoryIds.some(sid => sid && descendantSubIds.has(String(sid).toLowerCase()))) {
        return true;
      }
    }

    if (product.nestedSubCategoryId && descendantNestedIds.has(String(product.nestedSubCategoryId).toLowerCase())) {
      return true;
    }

    if (Array.isArray(product.nestedSubCategoryIds)) {
      if (product.nestedSubCategoryIds.some(nid => nid && descendantNestedIds.has(String(nid).toLowerCase()))) {
        return true;
      }
    }
  }

  return false;
}


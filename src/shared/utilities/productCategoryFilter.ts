import { Product, Category } from '../types';

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

  // Match category object in category store by ID, slug, or seoSlug (strictly NOT by name)
  const categoryObj = categories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    return cid === targetLower || cslug === targetLower || cseo === targetLower;
  });

  const targetCatId = categoryObj ? String(categoryObj.id).toLowerCase() : targetLower;

  // 1. Direct match on product.categoryId (admin-assigned category ID)
  if (product.categoryId && String(product.categoryId).toLowerCase() === targetCatId) {
    return true;
  }

  // 2. Match within product.categories array (admin-assigned category IDs)
  if (Array.isArray(product.categories)) {
    if (product.categories.some(c => c && String(c).toLowerCase() === targetCatId)) {
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

      if (Array.isArray(sub.subcategories)) {
        for (const nested of sub.subcategories) {
          if (nested && nested.id) {
            descendantNestedIds.add(String(nested.id).toLowerCase());
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


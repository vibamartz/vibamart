import { Product, Category } from '../types';

/**
 * Universal category assignment checker for a product.
 * Returns true if the product belongs to target category either directly (categoryId, categories array)
 * or through any child subcategory of that category.
 */
export function isProductAssignedToCategory(
  product: Product,
  targetCategorySlugOrId: string,
  categories: Category[] = []
): boolean {
  if (!product || !targetCategorySlugOrId) return false;
  const target = targetCategorySlugOrId.trim().toLowerCase();

  // 'for-you', 'all', 'all-deals' or empty means show all categories
  if (target === 'for-you' || target === 'all' || target === 'all-deals' || target === '') {
    return true;
  }

  // Match category object in category store
  const categoryObj = categories.find(c => {
    if (!c) return false;
    const cid = String(c.id || '').toLowerCase();
    const cslug = String(c.slug || '').toLowerCase();
    const cseo = String((c as any).seoSlug || '').toLowerCase();
    const cname = String(c.name || '').toLowerCase();
    return cid === target || cslug === target || cseo === target || cname === target;
  });

  const targetSet = new Set<string>([target]);
  if (categoryObj) {
    if (categoryObj.id) targetSet.add(String(categoryObj.id).toLowerCase());
    if (categoryObj.slug) targetSet.add(String(categoryObj.slug).toLowerCase());
    if ((categoryObj as any).seoSlug) targetSet.add(String((categoryObj as any).seoSlug).toLowerCase());
    if (categoryObj.name) targetSet.add(String(categoryObj.name).toLowerCase());
  }

  // 1. Direct match on product.categoryId
  if (product.categoryId && targetSet.has(String(product.categoryId).toLowerCase())) {
    return true;
  }

  // 2. Direct match on product.category name
  if ((product as any).category && targetSet.has(String((product as any).category).toLowerCase())) {
    return true;
  }

  // 3. Match within product.categories array
  if (Array.isArray(product.categories)) {
    if (product.categories.some(c => targetSet.has(String(c).toLowerCase()))) {
      return true;
    }
  }

  // 4. Subcategory relationship match: if product belongs to a subcategory of this category
  if (categoryObj && Array.isArray(categoryObj.subcategories) && categoryObj.subcategories.length > 0) {
    const subIds = new Set(
      categoryObj.subcategories.map(s => String(s.id || '').toLowerCase()).filter(Boolean)
    );
    const subSlugs = new Set(
      categoryObj.subcategories.map(s => String(s.slug || '').toLowerCase()).filter(Boolean)
    );

    if (product.subCategoryId) {
      const pSub = String(product.subCategoryId).toLowerCase();
      if (subIds.has(pSub) || subSlugs.has(pSub)) return true;
    }

    if (Array.isArray(product.subCategoryIds)) {
      if (product.subCategoryIds.some(sid => {
        const idLower = String(sid).toLowerCase();
        return subIds.has(idLower) || subSlugs.has(idLower);
      })) {
        return true;
      }
    }
  }

  return false;
}

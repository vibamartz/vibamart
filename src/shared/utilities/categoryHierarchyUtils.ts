import { Category, SubCategory, VisualNestedSubcategory, Product, FlatCategoryNode, CategoryHierarchyLevel } from '../types';

/**
 * Build a unified flat list of all category levels (Main, Sub, Nested, Visual Showcase, Deep)
 * dynamically from the existing category store and visual nested subcategories store.
 * Never hardcodes category names or hierarchy levels.
 */
export function buildFlatCategoryHierarchy(
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = [],
  allProducts: Product[] = []
): FlatCategoryNode[] {
  const nodes: FlatCategoryNode[] = [];
  const productCountMap = new Map<string, number>();

  const getProductCountForNode = (level: CategoryHierarchyLevel, id: string, rawVisual?: VisualNestedSubcategory): number => {
    const cacheKey = `${level}:${id}`;
    if (productCountMap.has(cacheKey)) {
      return productCountMap.get(cacheKey)!;
    }

    let count = 0;
    if (level === 'category') {
      count = allProducts.filter(p =>
        p.categoryId === id ||
        Boolean(p.categories?.includes(id))
      ).length;
    } else if (level === 'subcategory') {
      count = allProducts.filter(p =>
        p.subCategoryId === id ||
        Boolean(p.subCategoryIds?.includes(id))
      ).length;
    } else if (level === 'nested_subcategory' || level === 'deep_subcategory') {
      count = allProducts.filter(p =>
        p.nestedSubCategoryId === id ||
        Boolean(p.nestedSubCategoryIds?.includes(id))
      ).length;
    } else if (level === 'visual_nested_subcategory') {
      const explicitIds = new Set(rawVisual?.productIds || []);
      count = allProducts.filter(p =>
        explicitIds.has(p.id) ||
        p.visualNestedSubcategoryId === id ||
        Boolean(p.visualNestedSubcategoryIds?.includes(id))
      ).length;
    }

    productCountMap.set(cacheKey, count);
    return count;
  };

  // 1. Process Main Categories and nested levels
  categories.forEach(cat => {
    const catKey = `category:${cat.id}`;
    const catBreadcrumb = cat.name;

    nodes.push({
      key: catKey,
      id: cat.id,
      name: cat.name,
      level: 'category',
      levelNumber: 1,
      levelLabel: 'Main Category',
      pathIds: [cat.id],
      pathNames: [cat.name],
      breadcrumb: catBreadcrumb,
      image: cat.image,
      icon: cat.icon || cat.iconImage,
      assignedProductCount: getProductCountForNode('category', cat.id),
      raw: cat
    });

    // Subcategories (Level 2)
    (cat.subcategories || []).forEach(sub => {
      const subKey = `subcategory:${cat.id}:${sub.id}`;
      const subBreadcrumb = `${cat.name} › ${sub.name}`;

      nodes.push({
        key: subKey,
        id: sub.id,
        name: sub.name,
        level: 'subcategory',
        levelNumber: 2,
        levelLabel: 'Subcategory',
        pathIds: [cat.id, sub.id],
        pathNames: [cat.name, sub.name],
        breadcrumb: subBreadcrumb,
        parentTargetId: cat.id,
        parentTargetType: 'category',
        image: sub.image,
        icon: sub.icon,
        badgeText: sub.badgeText,
        assignedProductCount: getProductCountForNode('subcategory', sub.id),
        raw: sub
      });

      // Nested Subcategories (Level 3)
      (sub.subcategories || []).forEach(nested => {
        const nestedKey = `nested_subcategory:${cat.id}:${sub.id}:${nested.id}`;
        const nestedBreadcrumb = `${cat.name} › ${sub.name} › ${nested.name}`;

        nodes.push({
          key: nestedKey,
          id: nested.id,
          name: nested.name,
          level: 'nested_subcategory',
          levelNumber: 3,
          levelLabel: 'Nested Subcategory',
          pathIds: [cat.id, sub.id, nested.id],
          pathNames: [cat.name, sub.name, nested.name],
          breadcrumb: nestedBreadcrumb,
          parentTargetId: sub.id,
          parentTargetType: 'subcategory',
          image: nested.image,
          icon: nested.icon,
          badgeText: nested.badgeText,
          assignedProductCount: getProductCountForNode('nested_subcategory', nested.id),
          raw: nested
        });

        // Deep subcategories (Level 4+ if present)
        (nested.subcategories || []).forEach(deep => {
          const deepKey = `deep_subcategory:${cat.id}:${sub.id}:${nested.id}:${deep.id}`;
          const deepBreadcrumb = `${cat.name} › ${sub.name} › ${nested.name} › ${deep.name}`;

          nodes.push({
            key: deepKey,
            id: deep.id,
            name: deep.name,
            level: 'deep_subcategory',
            levelNumber: 4,
            levelLabel: 'Deep Subcategory',
            pathIds: [cat.id, sub.id, nested.id, deep.id],
            pathNames: [cat.name, sub.name, nested.name, deep.name],
            breadcrumb: deepBreadcrumb,
            parentTargetId: nested.id,
            parentTargetType: 'nested_subcategory',
            image: deep.image,
            icon: deep.icon,
            badgeText: deep.badgeText,
            assignedProductCount: getProductCountForNode('deep_subcategory', deep.id),
            raw: deep
          });
        });
      });
    });
  });

  // 2. Process Visual Nested Subcategories (Level 4 / Visual Showcases)
  visualItems.forEach(v => {
    const parentPathIds = v.parentPathIds || [v.categoryId, v.subCategoryId, v.nestedSubCategoryId].filter(Boolean) as string[];
    let parentPathNames = v.parentPathNames || [];

    // Fallback: resolve path names from categories tree if missing
    if (parentPathNames.length === 0) {
      const cat = categories.find(c => c.id === v.categoryId);
      const sub = cat?.subcategories?.find(s => s.id === v.subCategoryId);
      const nested = sub?.subcategories?.find(n => n.id === v.nestedSubCategoryId);
      parentPathNames = [cat?.name, sub?.name, nested?.name].filter(Boolean) as string[];
    }

    const displayName = v.name?.trim() || v.offerText?.trim() || `Showcase Card (${v.id.slice(-4)})`;
    const fullPathNames = [...parentPathNames, displayName];
    const breadcrumb = fullPathNames.join(' › ');
    const visualKey = `visual_nested_subcategory:${v.id}`;

    nodes.push({
      key: visualKey,
      id: v.id,
      name: displayName,
      level: 'visual_nested_subcategory',
      levelNumber: 4,
      levelLabel: 'Visual Showcase',
      pathIds: [...parentPathIds, v.id],
      pathNames: fullPathNames,
      breadcrumb: breadcrumb,
      parentTargetId: v.parentTargetId || v.nestedSubCategoryId || v.subCategoryId || v.categoryId,
      parentTargetType: v.parentTargetType || (v.nestedSubCategoryId ? 'nested_subcategory' : 'subcategory'),
      image: v.image,
      badgeText: v.badgeText,
      offerText: v.offerText,
      assignedProductCount: getProductCountForNode('visual_nested_subcategory', v.id, v),
      raw: v
    });
  });

  return nodes;
}

/**
 * Search category hierarchy nodes by query (name, breadcrumb, badge, offer)
 */
export function searchCategoryHierarchy(nodes: FlatCategoryNode[], query: string): FlatCategoryNode[] {
  if (!query || !query.trim()) return nodes;
  const q = query.toLowerCase().trim();

  return nodes.filter(node =>
    node.name.toLowerCase().includes(q) ||
    node.breadcrumb.toLowerCase().includes(q) ||
    (node.offerText && node.offerText.toLowerCase().includes(q)) ||
    (node.badgeText && node.badgeText.toLowerCase().includes(q))
  );
}

/**
 * Check if a product is currently assigned to a flat category node
 */
export function isProductAssignedToNode(
  product: Product,
  node: FlatCategoryNode,
  visualItems: VisualNestedSubcategory[] = []
): boolean {
  if (!product || !node) return false;

  if (node.level === 'category') {
    return product.categoryId === node.id || Boolean(product.categories?.includes(node.id));
  }

  if (node.level === 'subcategory') {
    return product.subCategoryId === node.id || Boolean(product.subCategoryIds?.includes(node.id));
  }

  if (node.level === 'nested_subcategory' || node.level === 'deep_subcategory') {
    return product.nestedSubCategoryId === node.id || Boolean(product.nestedSubCategoryIds?.includes(node.id));
  }

  if (node.level === 'visual_nested_subcategory') {
    if (product.visualNestedSubcategoryId === node.id) return true;
    if (product.visualNestedSubcategoryIds?.includes(node.id)) return true;
    const rawVisual = visualItems.find(v => v.id === node.id) || (node.raw as VisualNestedSubcategory);
    return Boolean(rawVisual?.productIds?.includes(product.id));
  }

  return false;
}

/**
 * Get all flat category nodes a product is currently assigned to
 */
export function getProductAssignmentNodes(
  product: Product,
  allNodes: FlatCategoryNode[],
  visualItems: VisualNestedSubcategory[] = []
): FlatCategoryNode[] {
  if (!product) return [];
  return allNodes.filter(node => isProductAssignedToNode(product, node, visualItems));
}

/**
 * Get human-readable breadcrumbs of all current assignments for a product
 */
export function getProductAssignmentBreadcrumbs(
  product: Product,
  allNodes: FlatCategoryNode[]
): string[] {
  if (!product) return [];
  const assignedList: string[] = [];

  for (const node of allNodes) {
    if (isProductAssignedToNode(product, node)) {
      assignedList.push(node.breadcrumb);
    }
  }

  return assignedList;
}

/**
 * Find a node by key
 */
export function findCategoryNodeByKey(nodes: FlatCategoryNode[], key: string): FlatCategoryNode | undefined {
  return nodes.find(n => n.key === key);
}

// Re-export CategoryHierarchyEngine and provide cached helpers for component filtering
import { CategoryHierarchyEngine, isTShirtTerm, isShirtTerm } from '../../backend/search/categoryHierarchy';
export { CategoryHierarchyEngine, isTShirtTerm, isShirtTerm };

const hierarchyEngineCache = new WeakMap<Category[], CategoryHierarchyEngine>();

/**
 * Get or create cached CategoryHierarchyEngine for a category set.
 */
export function getOrCreateHierarchyEngine(
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = []
): CategoryHierarchyEngine {
  let engine = hierarchyEngineCache.get(categories);
  if (!engine) {
    engine = new CategoryHierarchyEngine(categories, visualItems);
    hierarchyEngineCache.set(categories, engine);
  }
  return engine;
}

import { createSlug } from './slug';
import { isProductAssignedToCategory } from './productCategoryFilter';

/**
 * Determine if a product is explicitly assigned to a target category, subcategory,
 * nested subcategory, or visual subcategory.
 * Each product must appear ONLY in the category and subcategory explicitly assigned to it by the admin.
 * For example, men's shoes appear only in the assigned men's shoes category and never in the women's shoes category.
 * Does not match products in other categories based on similar names, keywords, brands, or product types.
 */
export function isProductInHierarchy(
  product: Product,
  targetFilter: string,
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = [],
  parentCategoryFilter?: string,
  parentSubCategoryFilter?: string
): boolean {
  if (!product || !targetFilter) return false;
  const filterTrim = targetFilter.trim();
  if (!filterTrim || filterTrim === 'all' || filterTrim === 'categories') {
    return true;
  }
  if (filterTrim === 'all-deals') {
    return Boolean((product.discountPrice && product.discountPrice < product.price) || (product.discountPercentage && product.discountPercentage > 0));
  }

  const filterLower = filterTrim.toLowerCase();

  // 1. Check if targetFilter corresponds to a Visual Nested Subcategory
  for (const v of visualItems) {
    if (!v) continue;
    const vId = String(v.id || '').toLowerCase();
    const vSlug = String(v.slug || '').toLowerCase();
    const vSeo = String(v.seoSlug || '').toLowerCase();
    const vName = String(v.name || '').toLowerCase();
    const vNameSlug = v.name ? createSlug(v.name).toLowerCase() : '';

    if (
      vId === filterLower ||
      vSlug === filterLower ||
      vSeo === filterLower ||
      vName === filterLower ||
      vNameSlug === filterLower
    ) {
      return isProductAssignedToCategory(
        product,
        parentCategoryFilter || v.categoryId || '',
        categories,
        parentSubCategoryFilter || v.subCategoryId || '',
        v.nestedSubCategoryId || '',
        v.id,
        visualItems
      );
    }
  }

  // 2. Identify Target Level in Categories Tree
  let isCat = false;
  let isSub = false;
  let isNested = false;
  let resolvedParentCat: string | undefined = parentCategoryFilter;
  let resolvedParentSub: string | undefined = parentSubCategoryFilter;

  for (const cat of categories) {
    if (!cat) continue;
    const cId = String(cat.id || '').toLowerCase();
    const cSlug = String(cat.slug || '').toLowerCase();
    const cSeo = String((cat as any).seoSlug || '').toLowerCase();
    const cNameSlug = cat.name ? createSlug(cat.name).toLowerCase() : '';

    if (cId === filterLower || cSlug === filterLower || cSeo === filterLower || cNameSlug === filterLower) {
      isCat = true;
      resolvedParentCat = cat.id;
      break;
    }

    if (Array.isArray(cat.subcategories)) {
      for (const sub of cat.subcategories) {
        if (!sub) continue;
        const sId = String(sub.id || '').toLowerCase();
        const sSlug = String(sub.slug || '').toLowerCase();
        const sSeo = String((sub as any).seoSlug || '').toLowerCase();
        const sNameSlug = sub.name ? createSlug(sub.name).toLowerCase() : '';

        if (sId === filterLower || sSlug === filterLower || sSeo === filterLower || sNameSlug === filterLower) {
          isSub = true;
          resolvedParentCat = resolvedParentCat || cat.id;
          resolvedParentSub = sub.id;
          break;
        }

        if (Array.isArray(sub.subcategories)) {
          for (const nested of sub.subcategories) {
            if (!nested) continue;
            const nId = String(nested.id || '').toLowerCase();
            const nSlug = String(nested.slug || '').toLowerCase();
            const nSeo = String((nested as any).seoSlug || '').toLowerCase();
            const nNameSlug = nested.name ? createSlug(nested.name).toLowerCase() : '';

            if (nId === filterLower || nSlug === filterLower || nSeo === filterLower || nNameSlug === filterLower) {
              isNested = true;
              resolvedParentCat = resolvedParentCat || cat.id;
              resolvedParentSub = resolvedParentSub || sub.id;
              break;
            }
          }
        }
        if (isNested) break;
      }
    }
    if (isSub || isNested) break;
  }

  // Delegate to universal isProductAssignedToCategory based on resolved level
  if (isNested) {
    return isProductAssignedToCategory(
      product,
      resolvedParentCat || '',
      categories,
      resolvedParentSub || '',
      targetFilter,
      undefined,
      visualItems
    );
  }

  if (isSub) {
    return isProductAssignedToCategory(
      product,
      resolvedParentCat || '',
      categories,
      targetFilter,
      undefined,
      undefined,
      visualItems
    );
  }

  if (isCat) {
    return isProductAssignedToCategory(
      product,
      targetFilter,
      categories,
      undefined,
      undefined,
      undefined,
      visualItems
    );
  }

  // Fallback if not directly matched in category tree
  return isProductAssignedToCategory(
    product,
    parentCategoryFilter || targetFilter,
    categories,
    parentSubCategoryFilter,
    parentSubCategoryFilter ? targetFilter : undefined,
    undefined,
    visualItems
  );
}

export function getProductHierarchyIds(
  product: Product,
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = []
): Set<string> {
  const engine = getOrCreateHierarchyEngine(categories, visualItems);
  return engine.resolveProductHierarchy(product).hierarchyIds;
}

/**
 * Get all descendant IDs for a category/subcategory/nested/visual node.
 */
export function getDescendantCategoryIds(
  nodeIdOrSlug: string,
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = []
): Set<string> {
  const engine = getOrCreateHierarchyEngine(categories, visualItems);
  return engine.getDescendantIds(nodeIdOrSlug);
}

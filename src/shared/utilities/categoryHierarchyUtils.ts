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

/**
 * Determine if a product is explicitly assigned to a target category, subcategory,
 * nested subcategory, or visual subcategory.
 * Each product must appear only in the category or subcategory explicitly assigned to it by the admin.
 * For example, products assigned to T-Shirts must not appear in Shirts unless explicitly assigned there.
 */
export function isProductInHierarchy(
  product: Product,
  targetFilter: string,
  categories: Category[],
  visualItems: VisualNestedSubcategory[] = []
): boolean {
  if (!product || !targetFilter) return false;
  const filterTrim = targetFilter.trim();
  if (!filterTrim || filterTrim === 'all' || filterTrim === 'all-deals' || filterTrim === 'categories') {
    return true;
  }

  const filterLower = filterTrim.toLowerCase();
  const filterSlug = createSlug(filterTrim).toLowerCase();

  // Explicit isolation check: Products assigned to T-Shirts must not appear in Shirts unless explicitly assigned there
  const productIsTShirt = (
    (product.nestedSubCategoryId && isTShirtTerm(product.nestedSubCategoryId)) ||
    (Array.isArray(product.nestedSubCategoryIds) && product.nestedSubCategoryIds.some(isTShirtTerm)) ||
    ((product as any).nestedSubCategoryName && isTShirtTerm((product as any).nestedSubCategoryName)) ||
    (product.subCategoryId && isTShirtTerm(product.subCategoryId)) ||
    (Array.isArray(product.subCategoryIds) && product.subCategoryIds.some(isTShirtTerm)) ||
    ((product as any).subCategoryName && isTShirtTerm((product as any).subCategoryName))
  );

  const productExplicitlyAssignedToShirts = (
    (product.subCategoryId && isShirtTerm(product.subCategoryId) && !product.nestedSubCategoryId) ||
    (Array.isArray(product.subCategoryIds) && product.subCategoryIds.some(isShirtTerm)) ||
    (Array.isArray(product.nestedSubCategoryIds) && product.nestedSubCategoryIds.some(isShirtTerm)) ||
    (product.nestedSubCategoryId && isShirtTerm(product.nestedSubCategoryId))
  );

  if (isShirtTerm(filterLower) || isShirtTerm(filterSlug)) {
    if (productIsTShirt && !productExplicitlyAssignedToShirts) {
      return false;
    }
  }

  if (isTShirtTerm(filterLower) || isTShirtTerm(filterSlug)) {
    if (!productIsTShirt) {
      return false;
    }
  }

  // 1. Match against Category tree nodes (Category, SubCategory, Nested SubCategory)
  const targetKeys = new Set<string>();
  targetKeys.add(filterLower);
  if (filterSlug) targetKeys.add(filterSlug);

  if (isTShirtTerm(filterLower) || isTShirtTerm(filterSlug)) {
    targetKeys.add('2-1-1');
    targetKeys.add('t-shirts-polos');
    targetKeys.add('t-shirts & polos');
    targetKeys.add('t-shirts');
    targetKeys.add('t-shirt');
  } else if (isShirtTerm(filterLower) || isShirtTerm(filterSlug)) {
    targetKeys.add('2-1-2');
    targetKeys.add('casual-shirts');
    targetKeys.add('casual shirts');
    targetKeys.add('shirts');
    targetKeys.add('shirt');
  }

  const matchedTreeNodes: { id: string; slug?: string; seoSlug?: string; name?: string; level: CategoryHierarchyLevel }[] = [];

  const traverseNodes = (nodes: any[], level: CategoryHierarchyLevel) => {
    for (const item of nodes) {
      if (!item) continue;
      const itemId = String(item.id || '').toLowerCase();
      const itemSlug = String(item.slug || '').toLowerCase();
      const itemSeoSlug = String((item as any).seoSlug || '').toLowerCase();
      const itemName = String(item.name || '').toLowerCase().trim();
      const itemNameSlug = createSlug(item.name || '').toLowerCase();

      if (
        targetKeys.has(itemId) ||
        targetKeys.has(itemSlug) ||
        targetKeys.has(itemSeoSlug) ||
        targetKeys.has(itemNameSlug) ||
        targetKeys.has(itemName)
      ) {
        matchedTreeNodes.push({
          id: String(item.id || ''),
          slug: item.slug,
          seoSlug: (item as any).seoSlug,
          name: item.name,
          level
        });
      }

      if (Array.isArray(item.subcategories) && item.subcategories.length > 0) {
        const nextLevel: CategoryHierarchyLevel = level === 'category' ? 'subcategory' : 'nested_subcategory';
        traverseNodes(item.subcategories, nextLevel);
      }
    }
  };

  traverseNodes(categories, 'category');

  for (const v of visualItems) {
    if (!v) continue;
    const vId = String(v.id || '').toLowerCase();
    const vSlug = String(v.slug || '').toLowerCase();
    const vName = String(v.name || '').toLowerCase().trim();
    const vNameSlug = createSlug(v.name || '').toLowerCase();
    if (
      vId === filterLower ||
      vSlug === filterLower ||
      vSlug === filterSlug ||
      vNameSlug === filterLower ||
      vNameSlug === filterSlug ||
      vName === filterLower
    ) {
      matchedTreeNodes.push({
        id: String(v.id || ''),
        slug: v.slug,
        name: v.name,
        level: 'visual_nested_subcategory'
      });
    }
  }

  // 2. Build product's explicitly assigned key sets by level
  const pCatKeys = new Set<string>();
  if (product.categoryId) {
    pCatKeys.add(String(product.categoryId).toLowerCase());
    const cs = createSlug(String(product.categoryId)).toLowerCase();
    if (cs) pCatKeys.add(cs);
  }
  if (Array.isArray(product.categories)) {
    product.categories.forEach(c => {
      if (c) {
        pCatKeys.add(String(c).toLowerCase());
        const cs = createSlug(String(c)).toLowerCase();
        if (cs) pCatKeys.add(cs);
      }
    });
  }
  if ((product as any).categoryName) {
    pCatKeys.add(String((product as any).categoryName).toLowerCase().trim());
    pCatKeys.add(createSlug(String((product as any).categoryName)).toLowerCase());
  }

  const pSubKeys = new Set<string>();
  if (product.subCategoryId) {
    pSubKeys.add(String(product.subCategoryId).toLowerCase());
    const ss = createSlug(String(product.subCategoryId)).toLowerCase();
    if (ss) pSubKeys.add(ss);
  }
  if (Array.isArray(product.subCategoryIds)) {
    product.subCategoryIds.forEach(s => {
      if (s) {
        pSubKeys.add(String(s).toLowerCase());
        const ss = createSlug(String(s)).toLowerCase();
        if (ss) pSubKeys.add(ss);
      }
    });
  }
  if ((product as any).subCategoryName) {
    pSubKeys.add(String((product as any).subCategoryName).toLowerCase().trim());
    pSubKeys.add(createSlug(String((product as any).subCategoryName)).toLowerCase());
  }

  const pNestedKeys = new Set<string>();
  if (product.nestedSubCategoryId) {
    pNestedKeys.add(String(product.nestedSubCategoryId).toLowerCase());
    const ns = createSlug(String(product.nestedSubCategoryId)).toLowerCase();
    if (ns) pNestedKeys.add(ns);
  }
  if (Array.isArray(product.nestedSubCategoryIds)) {
    product.nestedSubCategoryIds.forEach(n => {
      if (n) {
        pNestedKeys.add(String(n).toLowerCase());
        const ns = createSlug(String(n)).toLowerCase();
        if (ns) pNestedKeys.add(ns);
      }
    });
  }
  if ((product as any).nestedSubCategoryName) {
    pNestedKeys.add(String((product as any).nestedSubCategoryName).toLowerCase().trim());
    pNestedKeys.add(createSlug(String((product as any).nestedSubCategoryName)).toLowerCase());
  }

  const pVisualKeys = new Set<string>();
  if (product.visualNestedSubcategoryId) {
    pVisualKeys.add(String(product.visualNestedSubcategoryId).toLowerCase());
  }
  if (Array.isArray(product.visualNestedSubcategoryIds)) {
    product.visualNestedSubcategoryIds.forEach(v => v && pVisualKeys.add(String(v).toLowerCase()));
  }
  for (const v of visualItems) {
    if (v && Array.isArray(v.productIds) && v.productIds.includes(product.id)) {
      pVisualKeys.add(String(v.id).toLowerCase());
      if (v.slug) pVisualKeys.add(String(v.slug).toLowerCase());
    }
  }

  // Enrich product keys with node slugs and names from category tree
  for (const cat of categories) {
    const cId = String(cat.id || '').toLowerCase();
    if (pCatKeys.has(cId)) {
      if (cat.slug) pCatKeys.add(cat.slug.toLowerCase());
      if (cat.name) {
        pCatKeys.add(cat.name.toLowerCase().trim());
        pCatKeys.add(createSlug(cat.name).toLowerCase());
      }
    }
    (cat.subcategories || []).forEach(sub => {
      const sId = String(sub.id || '').toLowerCase();
      if (pSubKeys.has(sId)) {
        if (sub.slug) pSubKeys.add(sub.slug.toLowerCase());
        if (sub.name) {
          pSubKeys.add(sub.name.toLowerCase().trim());
          pSubKeys.add(createSlug(sub.name).toLowerCase());
        }
      }
      (sub.subcategories || []).forEach(nested => {
        const nId = String(nested.id || '').toLowerCase();
        if (pNestedKeys.has(nId)) {
          if (nested.slug) pNestedKeys.add(nested.slug.toLowerCase());
          if (nested.name) {
            pNestedKeys.add(nested.name.toLowerCase().trim());
            pNestedKeys.add(createSlug(nested.name).toLowerCase());
          }
        }
      });
    });
  }

  if (Array.from(pNestedKeys).some(isTShirtTerm)) {
    pNestedKeys.add('t-shirts');
    pNestedKeys.add('t-shirt');
  }
  if (Array.from(pNestedKeys).some(isShirtTerm)) {
    pNestedKeys.add('shirts');
    pNestedKeys.add('shirt');
  }

  // 3. Match against matched tree nodes by level
  if (matchedTreeNodes.length > 0) {
    for (const node of matchedTreeNodes) {
      const nodeKeys = [
        String(node.id || '').toLowerCase(),
        String(node.slug || '').toLowerCase(),
        String(node.seoSlug || '').toLowerCase(),
        String(node.name || '').toLowerCase().trim(),
        createSlug(node.name || '').toLowerCase()
      ].filter(Boolean);

      if (node.level === 'category') {
        if (nodeKeys.some(k => pCatKeys.has(k))) return true;
      } else if (node.level === 'subcategory') {
        if (nodeKeys.some(k => pSubKeys.has(k))) return true;
      } else if (node.level === 'nested_subcategory' || node.level === 'deep_subcategory') {
        if (nodeKeys.some(k => pNestedKeys.has(k))) return true;
      } else if (node.level === 'visual_nested_subcategory') {
        if (nodeKeys.some(k => pVisualKeys.has(k))) return true;
      }
    }
    return false;
  }

  // 4. Direct fallback match across all explicitly assigned keys
  for (const tk of targetKeys) {
    if (pCatKeys.has(tk) || pSubKeys.has(tk) || pNestedKeys.has(tk) || pVisualKeys.has(tk)) {
      return true;
    }
  }

  return false;
}

/**
 * Get all hierarchy IDs (category, subcategory, nested, visual, and all ancestor IDs)
 * for a product.
 */
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

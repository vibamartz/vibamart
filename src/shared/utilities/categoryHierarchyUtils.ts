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
 * Each product must appear ONLY in the category and subcategory explicitly assigned to it by the admin.
 * For example, men's shoes appear only in the assigned men's shoes category and never in the women's shoes category.
 * Does not match products in other categories based on similar names, keywords, brands, or product types.
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

  // 1. Visual Showcase Match: Check if targetFilter corresponds to a Visual Nested Subcategory
  for (const v of visualItems) {
    if (!v) continue;
    const vId = String(v.id || '').toLowerCase();
    const vSlug = String(v.slug || '').toLowerCase();
    if (vId === filterLower || (vSlug && (vSlug === filterLower || vSlug === filterSlug))) {
      if (product.visualNestedSubcategoryId && String(product.visualNestedSubcategoryId).toLowerCase() === vId) return true;
      if (Array.isArray(product.visualNestedSubcategoryIds) && product.visualNestedSubcategoryIds.some(id => id && String(id).toLowerCase() === vId)) return true;
      if (Array.isArray(v.productIds) && v.productIds.includes(product.id)) return true;
      return false;
    }
  }

  // 2. Identify Target Hierarchy Nodes in Categories Tree by ID or Slug (Strictly NOT by generic name or keyword)
  interface MatchedHierarchyNode {
    id: string;
    level: CategoryHierarchyLevel;
    descendantSubIds: Set<string>;
    descendantNestedIds: Set<string>;
  }

  const matchedNodes: MatchedHierarchyNode[] = [];

  for (const cat of categories) {
    if (!cat) continue;
    const catId = String(cat.id || '').toLowerCase();
    const catSlug = String(cat.slug || '').toLowerCase();
    const catSeoSlug = String((cat as any).seoSlug || '').toLowerCase();
    const isCatMatch = catId === filterLower || catSlug === filterLower || (catSeoSlug && catSeoSlug === filterLower) || catSlug === filterSlug;

    const catSubIds = new Set<string>();
    const catNestedIds = new Set<string>();

    if (Array.isArray(cat.subcategories)) {
      for (const sub of cat.subcategories) {
        if (!sub) continue;
        const subId = String(sub.id || '').toLowerCase();
        const subSlug = String(sub.slug || '').toLowerCase();
        const subSeoSlug = String((sub as any).seoSlug || '').toLowerCase();
        catSubIds.add(subId);

        const subNestedIds = new Set<string>();
        if (Array.isArray(sub.subcategories)) {
          for (const nested of sub.subcategories) {
            if (!nested) continue;
            const nestedId = String(nested.id || '').toLowerCase();
            const nestedSlug = String(nested.slug || '').toLowerCase();
            const nestedSeoSlug = String((nested as any).seoSlug || '').toLowerCase();
            catNestedIds.add(nestedId);
            subNestedIds.add(nestedId);

            const isNestedMatch = nestedId === filterLower || nestedSlug === filterLower || (nestedSeoSlug && nestedSeoSlug === filterLower) || nestedSlug === filterSlug;
            if (isNestedMatch) {
              matchedNodes.push({
                id: String(nested.id || nestedId),
                level: 'nested_subcategory',
                descendantSubIds: new Set(),
                descendantNestedIds: new Set([nestedId])
              });
            }
          }
        }

        const isSubMatch = subId === filterLower || subSlug === filterLower || (subSeoSlug && subSeoSlug === filterLower) || subSlug === filterSlug;
        if (isSubMatch) {
          matchedNodes.push({
            id: String(sub.id || subId),
            level: 'subcategory',
            descendantSubIds: new Set([subId]),
            descendantNestedIds: subNestedIds
          });
        }
      }
    }

    if (isCatMatch) {
      matchedNodes.push({
        id: String(cat.id || catId),
        level: 'category',
        descendantSubIds: catSubIds,
        descendantNestedIds: catNestedIds
      });
    }
  }

  // 3. Extract the product's admin-assigned IDs
  const pCatIds = new Set<string>();
  if (product.categoryId) pCatIds.add(String(product.categoryId).toLowerCase());
  if (Array.isArray(product.categories)) {
    product.categories.forEach(c => c && pCatIds.add(String(c).toLowerCase()));
  }

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

  // 4. Test product against matched target nodes
  if (matchedNodes.length > 0) {
    for (const node of matchedNodes) {
      const nodeId = node.id.toLowerCase();
      if (node.level === 'category') {
        // Direct category assignment match
        if (pCatIds.has(nodeId)) return true;
        // Or product is explicitly assigned to a child subcategory or nested subcategory under this category
        for (const sid of pSubIds) {
          if (node.descendantSubIds.has(sid)) return true;
        }
        for (const nid of pNestedIds) {
          if (node.descendantNestedIds.has(nid)) return true;
        }
      } else if (node.level === 'subcategory') {
        // Product must be assigned to this exact subcategory ID
        if (pSubIds.has(nodeId)) return true;
        // Or product is explicitly assigned to a nested subcategory under this subcategory
        for (const nid of pNestedIds) {
          if (node.descendantNestedIds.has(nid)) return true;
        }
      } else if (node.level === 'nested_subcategory' || node.level === 'deep_subcategory') {
        // Product must be assigned to this exact nested subcategory ID
        if (pNestedIds.has(nodeId)) return true;
      }
    }
    return false;
  }

  // 5. Direct ID fallback (if targetFilter is an ID not found in categories tree)
  if (pCatIds.has(filterLower) || pSubIds.has(filterLower) || pNestedIds.has(filterLower)) {
    return true;
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

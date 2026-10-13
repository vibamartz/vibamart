import { Category, SubCategory, VisualNestedSubcategory, Product, FlatCategoryNode } from '../types';

/**
 * Flattens the hierarchical structure of Categories, Subcategories,
 * Nested Subcategories, and Visual Nested Subcategories into a flat, searchable list of nodes.
 */
export function flattenCategoryHierarchy(
  categories: Category[] = [],
  visualItems: VisualNestedSubcategory[] = [],
  allProducts: Product[] = []
): FlatCategoryNode[] {
  const nodes: FlatCategoryNode[] = [];

  // Helper map for fast product count calculation
  const productCountMap = new Map<string, number>();

  const getProductCountForNode = (
    level: FlatCategoryNode['level'],
    id: string,
    rawVisual?: VisualNestedSubcategory
  ): number => {
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
      levelLabel: 'Visual Nested Subcategory',
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
 * Search category hierarchy nodes by query
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
 * Check if a product is already assigned to a flat category node
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

import { Category, SubCategory, VisualNestedSubcategory, Product, FlatCategoryNode } from '../types';

/**
 * Check if a product is currently assigned to a category node
 */
export function isProductAssignedToNode(product: Product, node: FlatCategoryNode): boolean {
  if (!product || !node) return false;

  switch (node.level) {
    case 'visual_nested_subcategory': {
      const visualItem = node.raw as VisualNestedSubcategory;
      if (visualItem.productIds && visualItem.productIds.includes(product.id)) {
        return true;
      }
      if (product.visualNestedSubcategoryId === node.id) {
        return true;
      }
      if (product.visualNestedSubcategoryIds && product.visualNestedSubcategoryIds.includes(node.id)) {
        return true;
      }
      return false;
    }

    case 'nested_subcategory':
    case 'deep_subcategory': {
      if (product.nestedSubCategoryId === node.id) return true;
      if (product.nestedSubCategoryIds && product.nestedSubCategoryIds.includes(node.id)) return true;
      return false;
    }

    case 'subcategory': {
      if (product.subCategoryId === node.id) return true;
      if (product.subCategoryIds && product.subCategoryIds.includes(node.id)) return true;
      return false;
    }

    case 'category': {
      if (product.categoryId === node.id) return true;
      if (product.categories && product.categories.includes(node.id)) return true;
      return false;
    }

    default:
      return false;
  }
}

/**
 * Get all current category path labels for a product
 */
export function getProductCurrentAssignments(product: Product, allNodes: FlatCategoryNode[]): string[] {
  if (!product || !allNodes) return [];
  const assignments: string[] = [];

  for (const node of allNodes) {
    if (isProductAssignedToNode(product, node)) {
      assignments.push(`${node.levelLabel}: ${node.breadcrumb}`);
    }
  }

  return assignments;
}

/**
 * Recursively flatten entire category hierarchy into a unified searchable list
 */
export function flattenCategoryHierarchy(
  categories: Category[] = [],
  visualItems: VisualNestedSubcategory[] = [],
  products: Product[] = []
): FlatCategoryNode[] {
  const result: FlatCategoryNode[] = [];

  // Helper to count assigned products
  const countAssigned = (checkFn: (p: Product) => boolean): number => {
    if (!products || products.length === 0) return 0;
    return products.filter(checkFn).length;
  };

  // Recursive traverser for subcategories
  const traverseSubCategories = (
    subs: SubCategory[],
    parentPathIds: string[],
    parentPathNames: string[],
    currentLevelNumber: number
  ) => {
    for (const sub of subs) {
      const subPathIds = [...parentPathIds, sub.id];
      const subPathNames = [...parentPathNames, sub.name];
      const breadcrumb = subPathNames.join(' > ');

      let level: FlatCategoryNode['level'] = 'subcategory';
      let levelLabel = 'Subcategory';

      if (currentLevelNumber === 3) {
        level = 'nested_subcategory';
        levelLabel = 'Nested Subcategory';
      } else if (currentLevelNumber > 3) {
        level = 'deep_subcategory';
        levelLabel = `Level ${currentLevelNumber} Subcategory`;
      }

      const assignedCount = countAssigned(p => {
        if (currentLevelNumber === 2) {
          return p.subCategoryId === sub.id || (p.subCategoryIds && p.subCategoryIds.includes(sub.id));
        } else {
          return p.nestedSubCategoryId === sub.id || (p.nestedSubCategoryIds && p.nestedSubCategoryIds.includes(sub.id));
        }
      });

      result.push({
        key: `${level}:${subPathIds.join(':')}`,
        id: sub.id,
        name: sub.name,
        level,
        levelNumber: currentLevelNumber,
        levelLabel,
        pathIds: subPathIds,
        pathNames: subPathNames,
        breadcrumb,
        parentTargetId: parentPathIds[parentPathIds.length - 1],
        parentTargetType: currentLevelNumber === 2 ? 'category' : 'subcategory',
        image: sub.image,
        icon: sub.icon,
        badgeText: sub.badgeText,
        assignedProductCount: assignedCount,
        raw: sub
      });

      // Recurse if child subcategories exist
      if (sub.subcategories && sub.subcategories.length > 0) {
        traverseSubCategories(sub.subcategories, subPathIds, subPathNames, currentLevelNumber + 1);
      }
    }
  };

  // 1. Traverse top-level Categories & their children
  for (const cat of categories) {
    const catPathIds = [cat.id];
    const catPathNames = [cat.name];
    const assignedCount = countAssigned(p => p.categoryId === cat.id || (p.categories && p.categories.includes(cat.id)));

    result.push({
      key: `category:${cat.id}`,
      id: cat.id,
      name: cat.name,
      level: 'category',
      levelNumber: 1,
      levelLabel: 'Main Category',
      pathIds: catPathIds,
      pathNames: catPathNames,
      breadcrumb: cat.name,
      image: cat.image,
      icon: cat.icon,
      assignedProductCount: assignedCount,
      raw: cat
    });

    if (cat.subcategories && cat.subcategories.length > 0) {
      traverseSubCategories(cat.subcategories, catPathIds, catPathNames, 2);
    }
  }

  // 2. Add Visual Nested Subcategories
  for (const visual of visualItems) {
    const visualPathIds = visual.parentPathIds && visual.parentPathIds.length > 0
      ? [...visual.parentPathIds, visual.id]
      : [visual.categoryId, visual.subCategoryId, visual.nestedSubCategoryId, visual.id].filter(Boolean) as string[];

    const visualPathNames = visual.parentPathNames && visual.parentPathNames.length > 0
      ? [...visual.parentPathNames, visual.name || 'Visual Subcategory']
      : [visual.categoryName, visual.subCategoryName, visual.nestedSubCategoryName, visual.name].filter(Boolean) as string[];

    const assignedCount = countAssigned(p => {
      if (visual.productIds && visual.productIds.includes(p.id)) return true;
      if (p.visualNestedSubcategoryId === visual.id) return true;
      if (p.visualNestedSubcategoryIds && p.visualNestedSubcategoryIds.includes(visual.id)) return true;
      return false;
    });

    result.push({
      key: `visual:${visual.id}`,
      id: visual.id,
      name: visual.name || 'Visual Nested Subcategory',
      level: 'visual_nested_subcategory',
      levelNumber: visualPathIds.length > 0 ? visualPathIds.length : 4,
      levelLabel: 'Visual Nested Subcategory',
      pathIds: visualPathIds,
      pathNames: visualPathNames,
      breadcrumb: visualPathNames.join(' > '),
      parentTargetId: visual.parentTargetId || visual.nestedSubCategoryId || visual.subCategoryId || visual.categoryId,
      parentTargetType: visual.parentTargetType || 'subcategory',
      image: visual.image,
      badgeText: visual.badgeText,
      offerText: visual.offerText,
      assignedProductCount: assignedCount,
      raw: visual
    });
  }

  return result;
}

/**
 * Filter flat category nodes by query string and/or level
 */
export function filterCategoryNodes(
  nodes: FlatCategoryNode[],
  query: string = '',
  levelFilter: string = 'all'
): FlatCategoryNode[] {
  let filtered = nodes;

  if (levelFilter && levelFilter !== 'all') {
    filtered = filtered.filter(n => n.level === levelFilter);
  }

  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return filtered;

  return filtered.filter(n => {
    if (n.name.toLowerCase().includes(cleanQuery)) return true;
    if (n.breadcrumb.toLowerCase().includes(cleanQuery)) return true;
    if (n.id.toLowerCase().includes(cleanQuery)) return true;
    if (n.levelLabel.toLowerCase().includes(cleanQuery)) return true;
    if (n.offerText && n.offerText.toLowerCase().includes(cleanQuery)) return true;
    return false;
  });
}

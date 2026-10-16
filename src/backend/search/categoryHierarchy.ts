import { Category, SubCategory, VisualNestedSubcategory, Product } from '../../shared/types';
import { createSlug } from '../../shared/utilities/slug';

export interface HierarchyNodeInfo {
  id: string;
  name: string;
  slug: string;
  level: 'category' | 'subcategory' | 'nested_subcategory' | 'deep_subcategory' | 'visual_nested_subcategory';
  levelNumber: number; // 1 = Main, 2 = Sub, 3 = Nested, 4 = Deep / Visual, 5+ = Child of Visual / Deep
  parentId?: string;
  parentType?: string;
  pathIds: string[];
  pathNames: string[];
  breadcrumb: string;
  isActive: boolean;
  isVisible: boolean;
  image?: string;
  badgeText?: string;
  offerText?: string;
  raw?: Category | SubCategory | VisualNestedSubcategory;
}

/**
 * Normalizes category search terms for resilient case-insensitive matching.
 */
function normalizeName(term: string): string {
  return term
    .toLowerCase()
    .replace(/[&/\\#,+()$~%.'":*?<>{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dynamic Category Hierarchy Engine
 * 
 * Supports arbitrary depth category trees, visual nested subcategories,
 * and high-performance O(1) descendant/ancestor lookups for global search and filtering.
 */
export class CategoryHierarchyEngine {
  private nodesById: Map<string, HierarchyNodeInfo> = new Map();
  private nodesBySlug: Map<string, HierarchyNodeInfo> = new Map();
  private nodesByNormalizedName: Map<string, HierarchyNodeInfo[]> = new Map();
  private descendantIdsMap: Map<string, Set<string>> = new Map();
  private ancestorIdsMap: Map<string, Set<string>> = new Map();
  private visualProductsMap: Map<string, Set<string>> = new Map();
  private productVisualMap: Map<string, Set<string>> = new Map();
  private allNodesList: HierarchyNodeInfo[] = [];

  constructor(categories: Category[] = [], visualItems: VisualNestedSubcategory[] = []) {
    if (categories.length > 0 || visualItems.length > 0) {
      this.loadHierarchy(categories, visualItems);
    }
  }

  /**
   * Clears and builds the dynamic hierarchy index from categories and visual items.
   */
  public loadHierarchy(categories: Category[], visualItems: VisualNestedSubcategory[] = []): void {
    this.nodesById.clear();
    this.nodesBySlug.clear();
    this.nodesByNormalizedName.clear();
    this.descendantIdsMap.clear();
    this.ancestorIdsMap.clear();
    this.visualProductsMap.clear();
    this.productVisualMap.clear();
    this.allNodesList = [];

    // Temporary graph for computing descendants and ancestors
    const childrenMap = new Map<string, Set<string>>();
    const parentMap = new Map<string, string>();

    const registerNode = (node: HierarchyNodeInfo) => {
      this.nodesById.set(node.id, node);
      if (node.slug) {
        this.nodesBySlug.set(node.slug.toLowerCase(), node);
      }
      const norm = normalizeName(node.name);
      if (norm) {
        const existing = this.nodesByNormalizedName.get(norm) || [];
        existing.push(node);
        this.nodesByNormalizedName.set(norm, existing);
      }
      this.allNodesList.push(node);

      if (node.parentId) {
        parentMap.set(node.id, node.parentId);
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, new Set());
        }
        childrenMap.get(node.parentId)!.add(node.id);
      }
    };

    // Recursive helper to traverse standard category tree to unlimited depth
    const traverseSubcategories = (
      subs: SubCategory[],
      parentPathIds: string[],
      parentPathNames: string[],
      currentLevelNumber: number,
      parentTargetId: string,
      parentTargetType: string
    ) => {
      for (const sub of subs) {
        if (!sub || !sub.id) continue;
        const subId = String(sub.id);
        const subName = (sub.name || '').trim();
        const subSlug = sub.slug || (sub as any).seoSlug || createSlug(subName) || subId;
        const currentPathIds = [...parentPathIds, subId];
        const currentPathNames = [...parentPathNames, subName];
        const breadcrumb = currentPathNames.join(' › ');

        let level: HierarchyNodeInfo['level'] = 'subcategory';
        if (currentLevelNumber === 3) level = 'nested_subcategory';
        else if (currentLevelNumber >= 4) level = 'deep_subcategory';

        const nodeInfo: HierarchyNodeInfo = {
          id: subId,
          name: subName,
          slug: subSlug,
          level,
          levelNumber: currentLevelNumber,
          parentId: parentTargetId,
          parentType: parentTargetType,
          pathIds: currentPathIds,
          pathNames: currentPathNames,
          breadcrumb,
          isActive: sub.isActive !== false,
          isVisible: sub.isVisible !== false,
          image: sub.image,
          badgeText: sub.badgeText,
          raw: sub
        };

        registerNode(nodeInfo);

        // Recursive child subcategories at arbitrary depth
        if (Array.isArray(sub.subcategories) && sub.subcategories.length > 0) {
          traverseSubcategories(
            sub.subcategories,
            currentPathIds,
            currentPathNames,
            currentLevelNumber + 1,
            subId,
            level
          );
        }
      }
    };

    // 1. Process Main Categories (Level 1)
    for (const cat of categories) {
      if (!cat || !cat.id) continue;
      const catId = String(cat.id);
      const catName = (cat.name || '').trim();
      const catSlug = cat.slug || cat.seoSlug || createSlug(catName) || catId;
      const pathIds = [catId];
      const pathNames = [catName];

      const catNode: HierarchyNodeInfo = {
        id: catId,
        name: catName,
        slug: catSlug,
        level: 'category',
        levelNumber: 1,
        pathIds,
        pathNames,
        breadcrumb: catName,
        isActive: true,
        isVisible: cat.isVisible !== false,
        image: cat.image,
        raw: cat
      };

      registerNode(catNode);

      if (Array.isArray(cat.subcategories) && cat.subcategories.length > 0) {
        traverseSubcategories(
          cat.subcategories,
          pathIds,
          pathNames,
          2,
          catId,
          'category'
        );
      }
    }

    // 2. Process Visual Nested Subcategories (Visual Showcase Nodes)
    for (const v of visualItems) {
      if (!v || !v.id) continue;
      const vId = String(v.id);
      const vName = (v.name?.trim() || v.offerText?.trim() || `Showcase (${vId.slice(-4)})`);
      const vSlug = v.slug || v.seoSlug || createSlug(vName) || vId;

      // Resolve parent target ID: prioritize direct parentTargetId -> nestedSubCategoryId -> subCategoryId -> categoryId
      const parentTargetId = v.parentTargetId || v.nestedSubCategoryId || v.subCategoryId || v.categoryId;
      const parentNode = parentTargetId ? this.nodesById.get(parentTargetId) : undefined;

      let parentPathIds = v.parentPathIds;
      let parentPathNames = v.parentPathNames;

      if (!parentPathIds || parentPathIds.length === 0) {
        parentPathIds = parentNode ? parentNode.pathIds : [v.categoryId, v.subCategoryId, v.nestedSubCategoryId].filter(Boolean) as string[];
      }
      if (!parentPathNames || parentPathNames.length === 0) {
        parentPathNames = parentNode ? parentNode.pathNames : [v.categoryName, v.subCategoryName, v.nestedSubCategoryName].filter(Boolean) as string[];
      }

      const fullPathIds = [...parentPathIds, vId];
      const fullPathNames = [...parentPathNames, vName];
      const breadcrumb = fullPathNames.join(' › ');
      const parentLevelNumber = parentNode ? parentNode.levelNumber : (v.nestedSubCategoryId ? 3 : 2);

      const visualNode: HierarchyNodeInfo = {
        id: vId,
        name: vName,
        slug: vSlug,
        level: 'visual_nested_subcategory',
        levelNumber: parentLevelNumber + 1,
        parentId: parentTargetId,
        parentType: v.parentTargetType || (parentNode ? parentNode.level : 'subcategory'),
        pathIds: fullPathIds,
        pathNames: fullPathNames,
        breadcrumb,
        isActive: v.isActive !== false,
        isVisible: v.isVisible !== false,
        image: v.image,
        badgeText: v.badgeText,
        offerText: v.offerText,
        raw: v
      };

      registerNode(visualNode);

      // Track explicitly assigned product IDs
      const assignedProducts = new Set<string>();
      if (Array.isArray(v.productIds)) {
        v.productIds.forEach(pid => {
          if (pid) {
            assignedProducts.add(pid);
            if (!this.productVisualMap.has(pid)) {
              this.productVisualMap.set(pid, new Set());
            }
            this.productVisualMap.get(pid)!.add(vId);
          }
        });
      }
      this.visualProductsMap.set(vId, assignedProducts);
    }

    // 3. Precompute Ancestors Map for each node
    for (const [nodeId] of this.nodesById.entries()) {
      const ancestors = new Set<string>();
      let curr = parentMap.get(nodeId);
      while (curr) {
        ancestors.add(curr);
        curr = parentMap.get(curr);
      }
      this.ancestorIdsMap.set(nodeId, ancestors);
    }

    // 4. Precompute Descendants Map for each node (including self)
    for (const [nodeId] of this.nodesById.entries()) {
      const descendants = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        descendants.add(current);
        const children = childrenMap.get(current);
        if (children) {
          for (const childId of children) {
            if (!descendants.has(childId)) {
              queue.push(childId);
            }
          }
        }
      }
      this.descendantIdsMap.set(nodeId, descendants);
    }
  }

  /**
   * Find a hierarchy node by ID, slug, or exact name.
   */
  public getNode(idOrSlugOrName: string): HierarchyNodeInfo | undefined {
    if (!idOrSlugOrName) return undefined;
    const trimmed = idOrSlugOrName.trim();
    if (this.nodesById.has(trimmed)) {
      return this.nodesById.get(trimmed);
    }
    const lower = trimmed.toLowerCase();
    if (this.nodesBySlug.has(lower)) {
      return this.nodesBySlug.get(lower);
    }
    const norm = normalizeName(trimmed);
    const byName = this.nodesByNormalizedName.get(norm);
    if (byName && byName.length > 0) {
      return byName[0];
    }
    return undefined;
  }

  /**
   * Returns all descendant IDs (including the node itself) for a given category/subcategory/nested/visual node.
   */
  public getDescendantIds(idOrSlugOrName: string): Set<string> {
    if (!idOrSlugOrName) return new Set();
    const node = this.getNode(idOrSlugOrName);
    if (node && this.descendantIdsMap.has(node.id)) {
      return this.descendantIdsMap.get(node.id)!;
    }
    // Fallback: If not found in tree, return just the normalized value
    return new Set([idOrSlugOrName.trim()]);
  }

  /**
   * Returns all ancestor IDs for a given node ID up to the root category.
   */
  public getAncestorIds(nodeId: string): Set<string> {
    if (!nodeId) return new Set();
    return this.ancestorIdsMap.get(nodeId) || new Set();
  }

  /**
   * Resolves complete hierarchy assignments for a product across all levels.
   */
  public resolveProductHierarchy(product: Product): {
    hierarchyIds: Set<string>;
    allNames: string[];
    categoryNames: string[];
    visualNames: string[];
    breadcrumbs: string[];
  } {
    const hierarchyIds = new Set<string>();
    const allNamesSet = new Set<string>();
    const visualNamesSet = new Set<string>();
    const breadcrumbsSet = new Set<string>();

    if (!product) {
      return { hierarchyIds, allNames: [], categoryNames: [], visualNames: [], breadcrumbs: [] };
    }

    // Direct IDs assigned on the product
    const directIds = new Set<string>();

    if (product.categoryId) directIds.add(String(product.categoryId));
    if (Array.isArray(product.categories)) {
      product.categories.forEach(c => c && directIds.add(String(c)));
    }

    if (product.subCategoryId) directIds.add(String(product.subCategoryId));
    if (Array.isArray(product.subCategoryIds)) {
      product.subCategoryIds.forEach(s => s && directIds.add(String(s)));
    }

    if (product.nestedSubCategoryId) directIds.add(String(product.nestedSubCategoryId));
    if (Array.isArray(product.nestedSubCategoryIds)) {
      product.nestedSubCategoryIds.forEach(n => n && directIds.add(String(n)));
    }

    if (product.visualNestedSubcategoryId) directIds.add(String(product.visualNestedSubcategoryId));
    if (Array.isArray(product.visualNestedSubcategoryIds)) {
      product.visualNestedSubcategoryIds.forEach(v => v && directIds.add(String(v)));
    }

    // Check Visual Nested Subcategories that explicitly include product.id
    if (product.id && this.productVisualMap.has(product.id)) {
      const visualParents = this.productVisualMap.get(product.id)!;
      for (const vId of visualParents) {
        directIds.add(vId);
      }
    }

    // For every direct ID, expand all ancestor IDs and collect metadata
    for (const dId of directIds) {
      hierarchyIds.add(dId);
      const node = this.getNode(dId);
      if (node) {
        hierarchyIds.add(node.id);
        allNamesSet.add(node.name);
        if (node.level === 'visual_nested_subcategory') {
          visualNamesSet.add(node.name);
          if (node.offerText) visualNamesSet.add(node.offerText);
        }
        breadcrumbsSet.add(node.breadcrumb);

        // Include all ancestor nodes
        const ancestors = this.ancestorIdsMap.get(node.id);
        if (ancestors) {
          for (const aId of ancestors) {
            hierarchyIds.add(aId);
            const aNode = this.nodesById.get(aId);
            if (aNode) {
              allNamesSet.add(aNode.name);
              breadcrumbsSet.add(aNode.breadcrumb);
            }
          }
        }
      }
    }

    const allNamesList = Array.from(allNamesSet);
    return {
      hierarchyIds,
      allNames: allNamesList,
      categoryNames: allNamesList,
      visualNames: Array.from(visualNamesSet),
      breadcrumbs: Array.from(breadcrumbsSet)
    };
  }

  /**
   * Checks whether a product matches a target category/subcategory filter.
   * Dynamically checks if ANY assigned product hierarchy ID is in the target filter's descendant set.
   */
  public matchesFilter(
    productHierarchyIds: Set<string> | string[] | undefined,
    filterValue: string
  ): boolean {
    if (!filterValue || !productHierarchyIds) return false;
    const filterTrim = filterValue.trim();
    if (!filterTrim || filterTrim === 'all' || filterTrim === 'all-deals' || filterTrim === 'categories') {
      return true;
    }

    const targetDescendants = this.getDescendantIds(filterTrim);
    if (productHierarchyIds instanceof Set) {
      for (const id of productHierarchyIds) {
        if (targetDescendants.has(id)) return true;
      }
    } else if (Array.isArray(productHierarchyIds)) {
      for (const id of productHierarchyIds) {
        if (targetDescendants.has(id)) return true;
      }
    }

    // Also check direct slug/name match
    const filterLower = filterTrim.toLowerCase();
    const filterNorm = normalizeName(filterTrim);
    const targetNode = this.getNode(filterTrim);
    if (targetNode) {
      if (productHierarchyIds instanceof Set) {
        if (productHierarchyIds.has(targetNode.id)) return true;
      } else if (Array.isArray(productHierarchyIds)) {
        if (productHierarchyIds.includes(targetNode.id)) return true;
      }
    }

    return false;
  }

  /**
   * Finds category hierarchy nodes whose name or slug matches or is contained in query.
   */
  public findNodesMatchingQuery(query: string): HierarchyNodeInfo[] {
    if (!query) return [];
    const qNorm = normalizeName(query);
    if (!qNorm) return [];

    const matches: HierarchyNodeInfo[] = [];
    const seen = new Set<string>();

    // Exact name match
    const exactMatches = this.nodesByNormalizedName.get(qNorm);
    if (exactMatches) {
      for (const node of exactMatches) {
        if (!seen.has(node.id)) {
          seen.add(node.id);
          matches.push(node);
        }
      }
    }

    // Substring or prefix matches across all nodes
    for (const node of this.allNodesList) {
      if (seen.has(node.id)) continue;
      const nodeNorm = normalizeName(node.name);
      if (
        nodeNorm === qNorm ||
        nodeNorm.startsWith(qNorm) ||
        (qNorm.length >= 4 && nodeNorm.includes(qNorm)) ||
        (nodeNorm.length >= 4 && qNorm.includes(nodeNorm))
      ) {
        seen.add(node.id);
        matches.push(node);
      }
    }

    return matches;
  }

  /**
   * Search category hierarchy nodes for live autocomplete suggestions.
   */
  public searchNodes(query: string, limit = 5): HierarchyNodeInfo[] {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    if (q.length < 2) return [];

    const results: HierarchyNodeInfo[] = [];
    const seen = new Set<string>();

    for (const node of this.allNodesList) {
      if (!node.isActive || !node.isVisible) continue;
      const lowerName = node.name.toLowerCase();
      const lowerBreadcrumb = node.breadcrumb.toLowerCase();

      if (
        lowerName.startsWith(q) ||
        lowerName.includes(q) ||
        lowerBreadcrumb.includes(q) ||
        (node.badgeText && node.badgeText.toLowerCase().includes(q)) ||
        (node.offerText && node.offerText.toLowerCase().includes(q))
      ) {
        if (!seen.has(node.id)) {
          seen.add(node.id);
          results.push(node);
          if (results.length >= limit) break;
        }
      }
    }

    return results;
  }

  /**
   * Returns all active nodes in the hierarchy.
   */
  public getAllNodes(): HierarchyNodeInfo[] {
    return this.allNodesList;
  }

  /**
   * Returns total count of indexed hierarchy nodes.
   */
  public getNodeCount(): number {
    return this.allNodesList.length;
  }
}

export const globalCategoryHierarchy = new CategoryHierarchyEngine();

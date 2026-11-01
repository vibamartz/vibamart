import { Product, Category, SubCategory, VisualNestedSubcategory } from '../types';
import { getCategorySlug, createSlug } from './slug';
import { useVisualNestedSubcategoryStore } from '../../backend/store';

interface HierarchyIndex {
  categoryNodes: Map<string, CategoryNodeInfo>;
  nodesById: Map<string, CategoryNodeInfo>;
  nodesByIdentifier: Map<string, CategoryNodeInfo[]>;
  rootCategories: CategoryNodeInfo[];
}

interface CategoryNodeInfo {
  id: string;
  slug: string;
  seoSlug?: string;
  name: string;
  level: 'category' | 'subcategory' | 'nested_subcategory' | 'deep_subcategory';
  rootCategoryId: string;
  parentSubCategoryId?: string;
  parentId?: string;
  identifiers: Set<string>;
  descendantSubIds: Set<string>;
  descendantNestedIds: Set<string>;
  raw: Category | SubCategory;
}

const hierarchyCache = new WeakMap<Category[], HierarchyIndex>();

function normalizeStr(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str).trim().toLowerCase();
}

/**
 * Builds a fast, normalized hierarchy index for category trees.
 * Cached by category array reference.
 */
function getHierarchyIndex(categories: Category[]): HierarchyIndex {
  if (Array.isArray(categories) && hierarchyCache.has(categories)) {
    return hierarchyCache.get(categories)!;
  }

  const nodesById = new Map<string, CategoryNodeInfo>();
  const nodesByIdentifier = new Map<string, CategoryNodeInfo[]>();
  const rootCategories: CategoryNodeInfo[] = [];

  const addIdentifier = (key: string, node: CategoryNodeInfo) => {
    const k = normalizeStr(key);
    if (!k) return;
    node.identifiers.add(k);
    const existing = nodesByIdentifier.get(k) || [];
    existing.push(node);
    nodesByIdentifier.set(k, existing);
  };

  if (Array.isArray(categories)) {
    for (const cat of categories) {
      if (!cat) continue;
      const catId = String(cat.id || '');
      const catSlug = String(cat.slug || getCategorySlug(cat) || '');
      const catName = String(cat.name || '');
      const catSeo = String((cat as any).seoSlug || '');

      const catNode: CategoryNodeInfo = {
        id: catId,
        slug: catSlug,
        seoSlug: catSeo,
        name: catName,
        level: 'category',
        rootCategoryId: catId,
        identifiers: new Set<string>(),
        descendantSubIds: new Set<string>(),
        descendantNestedIds: new Set<string>(),
        raw: cat
      };

      addIdentifier(catId, catNode);
      if (catSlug) addIdentifier(catSlug, catNode);
      if (catSeo) addIdentifier(catSeo, catNode);
      if (catName) {
        addIdentifier(catName, catNode);
        addIdentifier(createSlug(catName), catNode);
      }

      nodesById.set(normalizeStr(catId), catNode);
      if (catSlug) nodesById.set(normalizeStr(catSlug), catNode);
      rootCategories.push(catNode);

      // Subcategories (Level 2)
      if (Array.isArray(cat.subcategories)) {
        for (const sub of cat.subcategories) {
          if (!sub) continue;
          const subId = String(sub.id || '');
          const subSlug = String(sub.slug || '');
          const subName = String(sub.name || '');
          const subSeo = String((sub as any).seoSlug || '');

          catNode.descendantSubIds.add(normalizeStr(subId));
          if (subSlug) catNode.descendantSubIds.add(normalizeStr(subSlug));

          const subNode: CategoryNodeInfo = {
            id: subId,
            slug: subSlug,
            seoSlug: subSeo,
            name: subName,
            level: 'subcategory',
            rootCategoryId: catId,
            parentId: catId,
            identifiers: new Set<string>(),
            descendantSubIds: new Set<string>([normalizeStr(subId)]),
            descendantNestedIds: new Set<string>(),
            raw: sub
          };

          addIdentifier(subId, subNode);
          if (subSlug) addIdentifier(subSlug, subNode);
          if (subSeo) addIdentifier(subSeo, subNode);
          if (subName) {
            addIdentifier(subName, subNode);
            addIdentifier(createSlug(subName), subNode);
          }

          nodesById.set(normalizeStr(subId), subNode);

          // Nested Subcategories (Level 3)
          if (Array.isArray(sub.subcategories)) {
            for (const nested of sub.subcategories) {
              if (!nested) continue;
              const nestedId = String(nested.id || '');
              const nestedSlug = String(nested.slug || '');
              const nestedName = String(nested.name || '');
              const nestedSeo = String((nested as any).seoSlug || '');

              const normNestedId = normalizeStr(nestedId);
              catNode.descendantNestedIds.add(normNestedId);
              subNode.descendantNestedIds.add(normNestedId);
              if (nestedSlug) {
                const normNestedSlug = normalizeStr(nestedSlug);
                catNode.descendantNestedIds.add(normNestedSlug);
                subNode.descendantNestedIds.add(normNestedSlug);
              }

              const nestedNode: CategoryNodeInfo = {
                id: nestedId,
                slug: nestedSlug,
                seoSlug: nestedSeo,
                name: nestedName,
                level: 'nested_subcategory',
                rootCategoryId: catId,
                parentSubCategoryId: subId,
                parentId: subId,
                identifiers: new Set<string>(),
                descendantSubIds: new Set<string>(),
                descendantNestedIds: new Set<string>([normNestedId]),
                raw: nested
              };

              addIdentifier(nestedId, nestedNode);
              if (nestedSlug) addIdentifier(nestedSlug, nestedNode);
              if (nestedSeo) addIdentifier(nestedSeo, nestedNode);
              if (nestedName) {
                addIdentifier(nestedName, nestedNode);
                addIdentifier(createSlug(nestedName), nestedNode);
              }

              nodesById.set(normNestedId, nestedNode);

              // Deep subcategories (Level 4+ if present)
              if (Array.isArray(nested.subcategories)) {
                for (const deep of nested.subcategories) {
                  if (!deep) continue;
                  const deepId = String(deep.id || '');
                  const deepSlug = String(deep.slug || '');
                  const deepName = String(deep.name || '');
                  const deepSeo = String((deep as any).seoSlug || '');
                  const normDeepId = normalizeStr(deepId);

                  catNode.descendantNestedIds.add(normDeepId);
                  subNode.descendantNestedIds.add(normDeepId);

                  const deepNode: CategoryNodeInfo = {
                    id: deepId,
                    slug: deepSlug,
                    seoSlug: deepSeo,
                    name: deepName,
                    level: 'deep_subcategory',
                    rootCategoryId: catId,
                    parentSubCategoryId: subId,
                    parentId: nestedId,
                    identifiers: new Set<string>(),
                    descendantSubIds: new Set<string>(),
                    descendantNestedIds: new Set<string>([normDeepId]),
                    raw: deep
                  };

                  addIdentifier(deepId, deepNode);
                  if (deepSlug) addIdentifier(deepSlug, deepNode);
                  if (deepSeo) addIdentifier(deepSeo, deepNode);
                  if (deepName) {
                    addIdentifier(deepName, deepNode);
                    addIdentifier(createSlug(deepName), deepNode);
                  }

                  nodesById.set(normDeepId, deepNode);
                }
              }
            }
          }
        }
      }
    }
  }

  const index: HierarchyIndex = {
    categoryNodes: nodesById,
    nodesById,
    nodesByIdentifier,
    rootCategories
  };

  if (Array.isArray(categories)) {
    hierarchyCache.set(categories, index);
  }

  return index;
}

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

  const targetCatRaw = (targetCategorySlugOrId || '').trim();
  const targetCatLower = targetCatRaw.toLowerCase();
  const targetSubRaw = (targetSubCategorySlugOrId || '').trim();
  const targetSubLower = targetSubRaw.toLowerCase();
  const targetNestedRaw = (targetNestedSubCategorySlugOrId || '').trim();
  const targetNestedLower = targetNestedRaw.toLowerCase();
  const targetVisualRaw = (targetVisualNestedSubCategorySlugOrId || '').trim();
  const targetVisualLower = targetVisualRaw.toLowerCase();

  const isAllCat = !targetCatRaw || targetCatLower === 'for-you' || targetCatLower === 'all' || targetCatLower === 'all-deals' || targetCatLower === 'categories';
  const isAllSub = !targetSubRaw || targetSubLower === 'all';
  const isAllNested = !targetNestedRaw || targetNestedLower === 'all';
  const isAllVisual = !targetVisualRaw || targetVisualLower === 'all';

  // 'for-you', 'all', or empty with no subcategory/nested filter means show all categories
  if (isAllCat && isAllSub && isAllNested && isAllVisual) {
    if (targetCatLower === 'all-deals') {
      return Boolean((product.discountPrice && product.discountPrice < product.price) || (product.discountPercentage && product.discountPercentage > 0));
    }
    return true;
  }

  // 1. Extract all admin-assigned IDs and tokens for the product (normalized to lowercase)
  const pCatIds = new Set<string>();
  if (product.categoryId) pCatIds.add(normalizeStr(product.categoryId));
  if (Array.isArray(product.categories)) {
    product.categories.forEach(c => c && pCatIds.add(normalizeStr(c)));
  }
  if ((product as any).category) pCatIds.add(normalizeStr((product as any).category));
  if ((product as any).categorySlug) pCatIds.add(normalizeStr((product as any).categorySlug));

  const pSubIds = new Set<string>();
  if (product.subCategoryId) pSubIds.add(normalizeStr(product.subCategoryId));
  if (Array.isArray(product.subCategoryIds)) {
    product.subCategoryIds.forEach(s => s && pSubIds.add(normalizeStr(s)));
  }
  if ((product as any).subCategory) pSubIds.add(normalizeStr((product as any).subCategory));
  if ((product as any).subCategorySlug) pSubIds.add(normalizeStr((product as any).subCategorySlug));

  const pNestedIds = new Set<string>();
  if (product.nestedSubCategoryId) pNestedIds.add(normalizeStr(product.nestedSubCategoryId));
  if (Array.isArray(product.nestedSubCategoryIds)) {
    product.nestedSubCategoryIds.forEach(n => n && pNestedIds.add(normalizeStr(n)));
  }
  if ((product as any).nestedSubCategory) pNestedIds.add(normalizeStr((product as any).nestedSubCategory));
  if ((product as any).nestedSubCategorySlug) pNestedIds.add(normalizeStr((product as any).nestedSubCategorySlug));

  const pVisualIds = new Set<string>();
  if (product.visualNestedSubcategoryId) pVisualIds.add(normalizeStr(product.visualNestedSubcategoryId));
  if (Array.isArray(product.visualNestedSubcategoryIds)) {
    product.visualNestedSubcategoryIds.forEach(v => v && pVisualIds.add(normalizeStr(v)));
  }

  // Resolve visual items list (from argument or store)
  const effectiveVisualItems: VisualNestedSubcategory[] = Array.isArray(visualItems) && visualItems.length > 0
    ? visualItems
    : (typeof useVisualNestedSubcategoryStore !== 'undefined' ? (useVisualNestedSubcategoryStore.getState()?.items || []) : []);

  // Build / retrieve indexed hierarchy
  const hierarchy = getHierarchyIndex(categories);

  // Helper to find a node by identifier matching a specific parent / level
  const findNode = (identifier: string, level?: 'category' | 'subcategory' | 'nested_subcategory', parentId?: string): CategoryNodeInfo | null => {
    const key = normalizeStr(identifier);
    if (!key) return null;
    const candidates = hierarchy.nodesByIdentifier.get(key) || [];
    if (candidates.length === 0) return null;

    if (level && parentId) {
      const normPid = normalizeStr(parentId);
      const match = candidates.find(c => c.level === level && (normalizeStr(c.parentId) === normPid || normalizeStr(c.rootCategoryId) === normPid || normalizeStr(c.parentSubCategoryId) === normPid));
      if (match) return match;
    }
    if (level) {
      const match = candidates.find(c => c.level === level);
      if (match) return match;
    }
    if (parentId) {
      const normPid = normalizeStr(parentId);
      const match = candidates.find(c => normalizeStr(c.parentId) === normPid || normalizeStr(c.rootCategoryId) === normPid || normalizeStr(c.parentSubCategoryId) === normPid);
      if (match) return match;
    }
    return candidates[0] || null;
  };

  // Helper to find visual item by identifier
  const findVisualItem = (identifier: string): VisualNestedSubcategory | null => {
    const key = normalizeStr(identifier);
    if (!key || effectiveVisualItems.length === 0) return null;
    return effectiveVisualItems.find(v => {
      if (!v) return false;
      return (
        normalizeStr(v.id) === key ||
        normalizeStr(v.slug) === key ||
        normalizeStr(v.seoSlug) === key ||
        normalizeStr(v.name) === key ||
        (v.name && normalizeStr(createSlug(v.name)) === key)
      );
    }) || null;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. VISUAL NESTED SUBCATEGORY FILTER (Level 4 / Visual Showcase)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAllVisual) {
    const vMatch = findVisualItem(targetVisualRaw);
    if (vMatch) {
      const vMatchId = normalizeStr(vMatch.id);
      const isAssigned = pVisualIds.has(vMatchId) || (Array.isArray(vMatch.productIds) && vMatch.productIds.includes(product.id));
      if (!isAssigned) return false;

      // Branch isolation: product must belong to visual item's parent category/subcategory
      if (vMatch.categoryId && pCatIds.size > 0) {
        const vCatNode = findNode(vMatch.categoryId, 'category');
        const vCatIds = vCatNode ? vCatNode.identifiers : new Set([normalizeStr(vMatch.categoryId)]);
        const catMatches = Array.from(vCatIds).some(id => pCatIds.has(id));
        if (!catMatches) return false;
      }
      if (vMatch.subCategoryId && vMatch.subCategoryId !== 'all' && pSubIds.size > 0) {
        const vSubNode = findNode(vMatch.subCategoryId, 'subcategory');
        const vSubIds = vSubNode ? vSubNode.identifiers : new Set([normalizeStr(vMatch.subCategoryId)]);
        const subMatches = Array.from(vSubIds).some(id => pSubIds.has(id));
        if (!subMatches) return false;
      }
      return true;
    }

    // Direct fallback check
    return pVisualIds.has(targetVisualLower);
  }

  // Resolve target nodes for Category, Subcategory, and Nested Subcategory
  let catNode: CategoryNodeInfo | null = !isAllCat ? findNode(targetCatRaw, 'category') : null;
  let subNode: CategoryNodeInfo | null = !isAllSub ? findNode(targetSubRaw, 'subcategory', catNode?.id) : null;

  // If subNode is found and catNode was not explicitly specified or not found, derive catNode from subNode
  if (subNode && !catNode) {
    catNode = hierarchy.nodesById.get(normalizeStr(subNode.rootCategoryId)) || null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. NESTED SUBCATEGORY FILTER (Level 3)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAllNested) {
    // A. Check if targetNested is a Visual Nested Subcategory
    const vMatch = findVisualItem(targetNestedRaw);
    if (vMatch) {
      const vMatchId = normalizeStr(vMatch.id);
      const isAssigned = pVisualIds.has(vMatchId) || (Array.isArray(vMatch.productIds) && vMatch.productIds.includes(product.id));
      if (!isAssigned) return false;

      if (vMatch.categoryId && pCatIds.size > 0) {
        const vCatNode = findNode(vMatch.categoryId, 'category');
        const vCatIds = vCatNode ? vCatNode.identifiers : new Set([normalizeStr(vMatch.categoryId)]);
        if (!Array.from(vCatIds).some(id => pCatIds.has(id))) return false;
      }
      if (vMatch.subCategoryId && vMatch.subCategoryId !== 'all' && pSubIds.size > 0) {
        const vSubNode = findNode(vMatch.subCategoryId, 'subcategory');
        const vSubIds = vSubNode ? vSubNode.identifiers : new Set([normalizeStr(vMatch.subCategoryId)]);
        if (!Array.from(vSubIds).some(id => pSubIds.has(id))) return false;
      }
      return true;
    }

    // B. Search for standard nested subcategory node strictly within parent subcategory / category
    const parentSubId = subNode?.id;
    let nestedNode: CategoryNodeInfo | null = findNode(targetNestedRaw, 'nested_subcategory', parentSubId || catNode?.id);

    if (nestedNode) {
      // 1. Product must have this exact nested subcategory ID assigned
      const matchesNestedId = Array.from(nestedNode.identifiers).some(id => pNestedIds.has(id)) ||
        pNestedIds.has(normalizeStr(nestedNode.id)) ||
        Array.from(nestedNode.descendantNestedIds).some(dId => pNestedIds.has(dId));

      if (!matchesNestedId) {
        return false;
      }

      // 2. Strict Parent Subcategory Branch Isolation:
      // Product must belong to the exact parent subcategory of this nested subcategory
      const parentSubOfNested = hierarchy.nodesById.get(normalizeStr(nestedNode.parentSubCategoryId || nestedNode.parentId || ''));
      if (parentSubOfNested) {
        // If product has subcategories assigned, it must match the parent subcategory
        if (pSubIds.size > 0) {
          const belongsToParentSub = Array.from(parentSubOfNested.identifiers).some(id => pSubIds.has(id)) ||
            pSubIds.has(normalizeStr(parentSubOfNested.id));
          if (!belongsToParentSub) return false;
        }
      }

      // 3. Strict Parent Root Category Branch Isolation:
      const parentCatOfNested = hierarchy.nodesById.get(normalizeStr(nestedNode.rootCategoryId));
      if (parentCatOfNested) {
        if (pCatIds.size > 0) {
          const belongsToParentCat = Array.from(parentCatOfNested.identifiers).some(id => pCatIds.has(id)) ||
            pCatIds.has(normalizeStr(parentCatOfNested.id));
          if (!belongsToParentCat) return false;
        }
      }

      return true;
    }

    // Direct ID fallback check
    if (pNestedIds.has(targetNestedLower) || pVisualIds.has(targetNestedLower)) {
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SUBCATEGORY FILTER (Level 2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAllSub) {
    if (subNode) {
      // 1. Direct subcategory match or explicit descendant nested subcategory match
      const directSubMatch = Array.from(subNode.identifiers).some(id => pSubIds.has(id)) || pSubIds.has(normalizeStr(subNode.id));
      const descendantNestedMatch = Array.from(subNode.descendantNestedIds).some(nid => pNestedIds.has(nid));

      if (!directSubMatch && !descendantNestedMatch) {
        return false;
      }

      // 2. Negative isolation: If product is assigned to a different subcategory in the store,
      // it must not leak into this subcategory
      if (!directSubMatch && pSubIds.size > 0) {
        // Product has an assigned subcategory that does NOT match this subcategory!
        return false;
      }

      // 3. Strict Parent Root Category Branch Isolation:
      const parentCatOfSub = hierarchy.nodesById.get(normalizeStr(subNode.rootCategoryId));
      if (parentCatOfSub && pCatIds.size > 0) {
        const belongsToParentCat = Array.from(parentCatOfSub.identifiers).some(id => pCatIds.has(id)) ||
          pCatIds.has(normalizeStr(parentCatOfSub.id));
        if (!belongsToParentCat) return false;
      }

      return true;
    }

    // Direct ID fallback check
    return pSubIds.has(targetSubLower);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. MAIN CATEGORY FILTER (Level 1)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAllCat) {
    if (targetCatLower === 'all-deals') {
      return Boolean((product.discountPrice && product.discountPrice < product.price) || (product.discountPercentage && product.discountPercentage > 0));
    }

    if (catNode) {
      // 1. Direct category match
      const directCatMatch = Array.from(catNode.identifiers).some(id => pCatIds.has(id)) || pCatIds.has(normalizeStr(catNode.id));

      // 2. Or explicit descendant subcategory / nested subcategory assignment
      const descendantSubMatch = Array.from(catNode.descendantSubIds).some(sid => pSubIds.has(sid));
      const descendantNestedMatch = Array.from(catNode.descendantNestedIds).some(nid => pNestedIds.has(nid));

      if (!directCatMatch && !descendantSubMatch && !descendantNestedMatch) {
        return false;
      }

      // 3. Strict Cross-Category Conflict Prevention:
      // If product has an explicit categoryId set to another known main category,
      // prevent cross-category leakage (e.g. Mobiles appearing in Fashion)
      if (product.categoryId) {
        const prodCatLower = normalizeStr(product.categoryId);
        const otherRoot = hierarchy.rootCategories.find(r =>
          r.id !== catNode?.id &&
          (normalizeStr(r.id) === prodCatLower || normalizeStr(r.slug) === prodCatLower || r.identifiers.has(prodCatLower))
        );
        if (otherRoot) {
          // Product belongs to a different main category!
          return false;
        }
      }

      return true;
    }

    // Direct ID fallback check
    return pCatIds.has(targetCatLower);
  }

  return true;
}

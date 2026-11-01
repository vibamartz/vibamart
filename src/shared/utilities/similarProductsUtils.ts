import { Product, Category, SubCategory } from '../types';
import { getProductSlug, getCategorySlug, getSubcategorySlug, getNestedSubcategorySlug, createSlug } from './slug';
import { cleanProductCode } from './productCode';
import { isProductAssignedToCategory } from './productCategoryFilter';
import { CATEGORIES as DEFAULT_CATEGORIES } from '../constants';

export interface ResolvedCategoryPath {
  catNode: Category | null;
  catId: string;
  catSlug: string;
  catName: string;

  subNode: SubCategory | null;
  subId: string;
  subSlug: string;
  subName: string;

  nestedNode: SubCategory | null;
  nestedId: string;
  nestedSlug: string;
  nestedName: string;

  catTokens: Set<string>;
  subTokens: Set<string>;
  nestedTokens: Set<string>;
}

function normalizeToken(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase();
}

/**
 * Resolves the hierarchical category, subcategory, and nested subcategory path
 * for a given product using the provided categories tree.
 */
export function resolveProductCategoryPath(
  product: Product | {
    id?: string;
    categoryId?: string;
    subCategoryId?: string;
    nestedSubCategoryId?: string;
    categories?: string[];
    subCategoryIds?: string[];
    nestedSubCategoryIds?: string[];
    category?: string;
    subcategory?: string;
    subCategory?: string;
    nestedSubCategory?: string;
    nestedSubcategory?: string;
    categorySlug?: string;
    subCategorySlug?: string;
    nestedSubCategorySlug?: string;
  } | null | undefined,
  categories: Category[] = []
): ResolvedCategoryPath {
  const catTokens = new Set<string>();
  const subTokens = new Set<string>();
  const nestedTokens = new Set<string>();

  if (product) {
    // Collect Category tokens
    if (product.categoryId) catTokens.add(normalizeToken(product.categoryId));
    if (Array.isArray(product.categories)) {
      product.categories.forEach(c => c && catTokens.add(normalizeToken(c)));
    }
    if ((product as any).category) catTokens.add(normalizeToken((product as any).category));
    if ((product as any).categorySlug) catTokens.add(normalizeToken((product as any).categorySlug));
    if ((product as any).categoryName) catTokens.add(normalizeToken((product as any).categoryName));

    // Collect Subcategory tokens
    if (product.subCategoryId) subTokens.add(normalizeToken(product.subCategoryId));
    if (Array.isArray(product.subCategoryIds)) {
      product.subCategoryIds.forEach(s => s && subTokens.add(normalizeToken(s)));
    }
    if ((product as any).subCategory) subTokens.add(normalizeToken((product as any).subCategory));
    if ((product as any).subcategory) subTokens.add(normalizeToken((product as any).subcategory));
    if ((product as any).subCategorySlug) subTokens.add(normalizeToken((product as any).subCategorySlug));
    if ((product as any).subCategoryName) subTokens.add(normalizeToken((product as any).subCategoryName));

    // Collect Nested Subcategory tokens
    if (product.nestedSubCategoryId) nestedTokens.add(normalizeToken(product.nestedSubCategoryId));
    if (Array.isArray(product.nestedSubCategoryIds)) {
      product.nestedSubCategoryIds.forEach(n => n && nestedTokens.add(normalizeToken(n)));
    }
    if ((product as any).nestedSubCategory) nestedTokens.add(normalizeToken((product as any).nestedSubCategory));
    if ((product as any).nestedSubcategory) nestedTokens.add(normalizeToken((product as any).nestedSubcategory));
    if ((product as any).nestedSubCategorySlug) nestedTokens.add(normalizeToken((product as any).nestedSubCategorySlug));
    if ((product as any).nestedSubCategoryName) nestedTokens.add(normalizeToken((product as any).nestedSubCategoryName));
  }

  const catList = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  let matchedCatNode: Category | null = null;
  let matchedSubNode: SubCategory | null = null;
  let matchedNestedNode: SubCategory | null = null;

  // 1. Try to find a matching Level 3 (Nested Subcategory) node in the tree first
  // (Search both nestedTokens and subTokens in case nested subcategory was stored under subCategoryId)
  const candidateNestedTokens = new Set([...nestedTokens, ...subTokens]);
  for (const cat of catList) {
    if (!cat || !Array.isArray(cat.subcategories)) continue;
    for (const sub of cat.subcategories) {
      if (!sub || !Array.isArray(sub.subcategories)) continue;
      for (const nested of sub.subcategories) {
        if (!nested) continue;
        const nTokens = [
          nested.id,
          nested.slug,
          (nested as any).seoSlug,
          nested.name,
          nested.name ? createSlug(nested.name) : ''
        ].map(normalizeToken).filter(Boolean);

        const isMatch = nTokens.some(t => candidateNestedTokens.has(t));
        if (isMatch) {
          matchedNestedNode = nested;
          matchedSubNode = sub;
          matchedCatNode = cat;
          break;
        }
      }
      if (matchedNestedNode) break;
    }
    if (matchedNestedNode) break;
  }

  // 2. If no nested node found, try matching Level 2 (Subcategory) node
  if (!matchedSubNode) {
    for (const cat of catList) {
      if (!cat || !Array.isArray(cat.subcategories)) continue;
      for (const sub of cat.subcategories) {
        if (!sub) continue;
        const sTokens = [
          sub.id,
          sub.slug,
          (sub as any).seoSlug,
          sub.name,
          sub.name ? createSlug(sub.name) : ''
        ].map(normalizeToken).filter(Boolean);

        const isMatch = sTokens.some(t => subTokens.has(t));
        if (isMatch) {
          matchedSubNode = sub;
          matchedCatNode = cat;
          break;
        }
      }
      if (matchedSubNode) break;
    }
  }

  // 3. If no category node matched yet, match Level 1 (Category) node
  if (!matchedCatNode) {
    for (const cat of catList) {
      if (!cat) continue;
      const cTokens = [
        cat.id,
        cat.slug,
        (cat as any).seoSlug,
        cat.name,
        cat.name ? createSlug(cat.name) : ''
      ].map(normalizeToken).filter(Boolean);

      const isMatch = cTokens.some(t => catTokens.has(t));
      if (isMatch) {
        matchedCatNode = cat;
        break;
      }
    }
  }

  // Expand token sets with matched hierarchy node identifiers for full bidirectional compatibility
  if (matchedCatNode) {
    [matchedCatNode.id, matchedCatNode.slug, (matchedCatNode as any).seoSlug, matchedCatNode.name]
      .map(normalizeToken)
      .forEach(t => t && catTokens.add(t));
    if (matchedCatNode.name) catTokens.add(normalizeToken(createSlug(matchedCatNode.name)));
  }

  if (matchedSubNode) {
    [matchedSubNode.id, matchedSubNode.slug, (matchedSubNode as any).seoSlug, matchedSubNode.name]
      .map(normalizeToken)
      .forEach(t => t && subTokens.add(t));
    if (matchedSubNode.name) subTokens.add(normalizeToken(createSlug(matchedSubNode.name)));
  }

  if (matchedNestedNode) {
    [matchedNestedNode.id, matchedNestedNode.slug, (matchedNestedNode as any).seoSlug, matchedNestedNode.name]
      .map(normalizeToken)
      .forEach(t => t && nestedTokens.add(t));
    if (matchedNestedNode.name) nestedTokens.add(normalizeToken(createSlug(matchedNestedNode.name)));
  }

  const rawCatId = product?.categoryId || (product?.categories && product.categories[0]) || (product as any)?.category || '';
  const rawSubId = product?.subCategoryId || (product?.subCategoryIds && product.subCategoryIds[0]) || (product as any)?.subCategory || '';
  const rawNestedId = (product as any)?.nestedSubCategoryId || (product as any)?.nestedSubCategoryIds?.[0] || (product as any)?.nestedSubCategory || '';

  const catId = matchedCatNode ? String(matchedCatNode.id) : String(rawCatId);
  const catSlug = matchedCatNode ? getCategorySlug(matchedCatNode) : (rawCatId ? createSlug(String(rawCatId)) : '');
  const catName = matchedCatNode ? String(matchedCatNode.name || '') : '';

  const subId = matchedSubNode ? String(matchedSubNode.id) : String(rawSubId);
  const subSlug = matchedSubNode ? getSubcategorySlug(matchedSubNode) : (rawSubId ? createSlug(String(rawSubId)) : '');
  const subName = matchedSubNode ? String(matchedSubNode.name || '') : '';

  const nestedId = matchedNestedNode ? String(matchedNestedNode.id) : String(rawNestedId);
  const nestedSlug = matchedNestedNode ? getNestedSubcategorySlug(matchedNestedNode) : (rawNestedId ? createSlug(String(rawNestedId)) : '');
  const nestedName = matchedNestedNode ? String(matchedNestedNode.name || '') : '';

  return {
    catNode: matchedCatNode,
    catId,
    catSlug,
    catName,

    subNode: matchedSubNode,
    subId,
    subSlug,
    subName,

    nestedNode: matchedNestedNode,
    nestedId,
    nestedSlug,
    nestedName,

    catTokens,
    subTokens,
    nestedTokens
  };
}

/**
 * Universal validator to check if candidate product is an eligible similar product for current product.
 * Strictly adheres to:
 * 1. Admin-assigned category and subcategory relevance.
 * 2. Unrelated products from other categories or other subcategories are excluded.
 * 3. Excludes current product (by ID, document ID, productCode, slug, or name).
 * 4. Excludes duplicate products.
 * 5. Excludes inactive, draft, storefront-hidden, deleted, and out-of-stock products.
 * 6. Never uses general product recommendations, keyword matching, or cross-category suggestions.
 */
export function isProductEligibleSimilar(
  candidate: Product,
  currentProduct: Product | {
    id: string;
    slug?: string;
    productCode?: string;
    categoryId?: string;
    subCategoryId?: string;
    nestedSubCategoryId?: string;
    categories?: string[];
    subCategoryIds?: string[];
    nestedSubCategoryIds?: string[];
    name?: string;
  },
  categories: Category[] = [],
  rewardIds: Set<string> = new Set()
): boolean {
  if (!candidate || !candidate.id) return false;
  if (!currentProduct) return false;

  // 1. Exclude the currently viewed product
  const currentId = String(currentProduct.id || '').trim();
  const currentDocId = String((currentProduct as any)._id || currentProduct.id || '').trim();
  const currentSlug = String((currentProduct as any).slug || getProductSlug(currentProduct) || '').trim().toLowerCase();
  const currentCode = (currentProduct as any).productCode ? cleanProductCode((currentProduct as any).productCode) : '';
  const currentName = currentProduct.name ? String(currentProduct.name).trim().toLowerCase() : '';

  const candId = String(candidate.id || '').trim();
  const candDocId = String((candidate as any)._id || candidate.id || '').trim();
  const candSlug = String((candidate as any).slug || getProductSlug(candidate) || '').trim().toLowerCase();
  const candCode = (candidate as any).productCode ? cleanProductCode((candidate as any).productCode) : '';
  const candName = candidate.name ? String(candidate.name).trim().toLowerCase() : '';

  if (
    (currentId && candId && candId === currentId) ||
    (currentDocId && candDocId && candDocId === currentDocId) ||
    (currentSlug && candSlug && candSlug === currentSlug) ||
    (currentCode && candCode && candCode === currentCode) ||
    (currentName && candName && candName === currentName)
  ) {
    return false;
  }

  // 2. Exclude reward products
  if (rewardIds.has(candidate.id)) {
    return false;
  }

  // 3. Exclude deleted products
  if ((candidate as any).isDeleted === true || (candidate as any).deleted === true || (candidate as any).is_deleted === true) {
    return false;
  }

  // 4. Exclude inactive or storefront-hidden products
  if (
    (candidate.status && candidate.status !== 'active') ||
    candidate.isVisible === false ||
    (candidate as any).archived === true ||
    (candidate as any).isArchived === true
  ) {
    return false;
  }

  // 5. Exclude out-of-stock products
  if (candidate.inStock === false || candidate.status === 'out_of_stock') {
    return false;
  }
  const stockNum = Number(candidate.stock ?? 0);
  const hasVariants = Array.isArray(candidate.variants) && candidate.variants.length > 0;
  if (hasVariants) {
    const hasInStockVariant = candidate.variants!.some(v =>
      !v.disabled &&
      (v as any).status !== 'disabled' &&
      v.inStock !== false &&
      Number(v.stock ?? 0) > 0
    );
    if (!hasInStockVariant && stockNum <= 0) {
      return false;
    }
  } else {
    if (stockNum <= 0) {
      return false;
    }
  }

  // 6. Strict Category, Subcategory & Nested Subcategory relevance (Admin-assigned)
  const catList = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const currentPath = resolveProductCategoryPath(currentProduct, catList);
  const candidatePath = resolveProductCategoryPath(candidate, catList);

  // If current product cannot be resolved to any category, do not show unverified recommendations
  if (!currentPath.catId && !currentPath.catSlug && currentPath.catTokens.size === 0) {
    return false;
  }

  // 6A. Main Category Isolation
  if (currentPath.catNode && candidatePath.catNode) {
    if (currentPath.catNode.id !== candidatePath.catNode.id) {
      return false;
    }
  } else {
    const hasCatMatch = Array.from(currentPath.catTokens).some(t => candidatePath.catTokens.has(t)) ||
      (currentPath.catId && isProductAssignedToCategory(candidate, currentPath.catId, catList)) ||
      (currentPath.catSlug && isProductAssignedToCategory(candidate, currentPath.catSlug, catList));
    if (!hasCatMatch) {
      return false;
    }
  }

  // Prevent cross-category leak (e.g. Mobile Phones or Electronics appearing in Fashion)
  if (currentPath.catNode) {
    for (const rootCat of catList) {
      if (rootCat.id !== currentPath.catNode.id) {
        const otherRootTokens = [rootCat.id, rootCat.slug, (rootCat as any).seoSlug, rootCat.name]
          .map(normalizeToken)
          .filter(Boolean);
        if (candidate.categoryId && otherRootTokens.includes(normalizeToken(candidate.categoryId))) {
          return false;
        }
      }
    }
  }

  // 6B. Subcategory Matching (Strict Isolation)
  const currentHasSub = Boolean(currentPath.subNode || currentPath.subId || currentPath.subSlug || currentPath.subTokens.size > 0);
  if (currentHasSub) {
    const candHasSub = Boolean(candidatePath.subNode || candidatePath.subId || candidatePath.subSlug || candidatePath.subTokens.size > 0);
    // If current product is assigned to a subcategory, candidate MUST also belong to that subcategory
    if (!candHasSub) {
      return false;
    }

    if (currentPath.subNode && candidatePath.subNode) {
      if (currentPath.subNode.id !== candidatePath.subNode.id) {
        return false;
      }
    } else {
      const hasSubMatch = Array.from(currentPath.subTokens).some(t => candidatePath.subTokens.has(t)) ||
        (currentPath.subId && isProductAssignedToCategory(candidate, currentPath.catId || currentPath.catSlug, catList, currentPath.subId)) ||
        (currentPath.subSlug && isProductAssignedToCategory(candidate, currentPath.catId || currentPath.catSlug, catList, currentPath.subSlug));
      if (!hasSubMatch) {
        return false;
      }
    }
  }

  // 6C. Nested Subcategory Matching (Deepest Admin Assignment)
  // E.g. If viewing a Women's Dress (Fashion > Women > Dresses & Gowns), show only Dresses & Gowns!
  const currentHasNested = Boolean(currentPath.nestedNode || currentPath.nestedId || currentPath.nestedSlug || currentPath.nestedTokens.size > 0);
  if (currentHasNested) {
    if (currentPath.nestedNode && candidatePath.nestedNode) {
      if (currentPath.nestedNode.id !== candidatePath.nestedNode.id) {
        return false;
      }
    } else if (candidatePath.nestedNode && currentPath.nestedTokens.size > 0) {
      const candNestedTokens = [candidatePath.nestedNode.id, candidatePath.nestedNode.slug, (candidatePath.nestedNode as any).seoSlug, candidatePath.nestedNode.name]
        .map(normalizeToken)
        .filter(Boolean);
      const matches = candNestedTokens.some(t => currentPath.nestedTokens.has(t));
      if (!matches) {
        return false;
      }
    } else if (candidatePath.nestedTokens.size > 0 && currentPath.nestedTokens.size > 0) {
      const hasIntersection = Array.from(currentPath.nestedTokens).some(t => candidatePath.nestedTokens.has(t));
      if (!hasIntersection) {
        return false;
      }
    } else {
      const hasNestedMatch = Array.from(currentPath.nestedTokens).some(t => candidatePath.nestedTokens.has(t)) ||
        (currentPath.nestedId && isProductAssignedToCategory(candidate, currentPath.catId || currentPath.catSlug, catList, currentPath.subId || currentPath.subSlug, currentPath.nestedId)) ||
        (currentPath.nestedSlug && isProductAssignedToCategory(candidate, currentPath.catId || currentPath.catSlug, catList, currentPath.subId || currentPath.subSlug, currentPath.nestedSlug));
      if (!hasNestedMatch) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Returns the correct View All / Click to See All URL for the current product's similar products.
 * Resolves to:
 * - /categories/:categorySlug/:subcategorySlug/:nestedSubcategorySlug (if product has nested subcategory)
 * - /categories/:categorySlug/:subcategorySlug (if product has subcategory)
 * - /categories/:categorySlug (if product has only a category)
 * - /products?category=...&subCategory=...&nestedSubCategory=... (fallback)
 */
export function getSimilarProductsSeeAllLink(
  product: Product | {
    id?: string;
    categoryId?: string;
    subCategoryId?: string;
    nestedSubCategoryId?: string;
    categories?: string[];
    subCategoryIds?: string[];
    nestedSubCategoryIds?: string[];
    category?: string;
    subcategory?: string;
    subCategory?: string;
    nestedSubCategory?: string;
    categorySlug?: string;
    subCategorySlug?: string;
    nestedSubCategorySlug?: string;
  } | null | undefined,
  categories: Category[] = []
): string {
  if (!product) return '/products';

  const catList = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const path = resolveProductCategoryPath(product, catList);

  if (path.catSlug && path.subSlug && path.nestedSlug) {
    return `/categories/${path.catSlug}/${path.subSlug}/${path.nestedSlug}`;
  }
  if (path.catSlug && path.subSlug) {
    return `/categories/${path.catSlug}/${path.subSlug}`;
  }
  if (path.catSlug) {
    return `/categories/${path.catSlug}`;
  }

  if (path.catId) {
    const params = new URLSearchParams();
    params.set('category', path.catId);
    if (path.subId) params.set('subCategory', path.subId);
    if (path.nestedId) params.set('nestedSubCategory', path.nestedId);
    return `/products?${params.toString()}`;
  }

  return '/products';
}

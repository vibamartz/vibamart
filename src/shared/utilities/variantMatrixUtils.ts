import { Product, ProductVariant, VariantAttribute, VariantAttributeValue, FamilyColorVariant, FamilyProductVariant } from '../types';
import { db } from '../../backend/firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getProductSlug } from './slug';

/**
 * Normalizes attribute name for canonical matching (e.g. "Color " -> "Color", case-insensitive comparison helper)
 */
export function normalizeAttributeKey(key: string): string {
  return (key || '').trim();
}

/**
 * Normalizes attribute value
 */
export function normalizeAttributeVal(val: string): string {
  return (val || '').trim();
}

/**
 * Creates a unique canonical hash/key for an attribute combination
 * e.g., { "Size": "M", "Color": "Black" } -> "color:black|size:m"
 */
export function getCanonicalVariantKey(attributes: Record<string, string> | undefined | null): string {
  if (!attributes || typeof attributes !== 'object') return '';
  const entries = Object.entries(attributes)
    .map(([k, v]) => [normalizeAttributeKey(k).toLowerCase(), normalizeAttributeVal(v).toLowerCase()])
    .filter(([k, v]) => k && v);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}:${v}`).join('|');
}

/**
 * Formats a clean, professional human-readable title for a variant combination
 * e.g., "Black / M / 128GB"
 */
export function getVariantCombinationTitle(
  attributes?: Record<string, string> | null,
  fallbackName?: string
): string {
  if (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
    const values = Object.values(attributes).map(v => normalizeAttributeVal(v)).filter(Boolean);
    if (values.length > 0) {
      return values.join(' / ');
    }
  }
  return fallbackName || 'Default Variant';
}

/**
 * Extracts normalized attributes map from a variant, handling both new universal format and legacy fields.
 */
export function extractVariantAttributes(v: ProductVariant): Record<string, string> {
  const result: Record<string, string> = {};

  // 1. If universal attributes map exists
  if (v.attributes && typeof v.attributes === 'object') {
    Object.entries(v.attributes).forEach(([k, val]) => {
      if (k && val) result[normalizeAttributeKey(k)] = normalizeAttributeVal(val);
    });
  }

  // 2. Legacy fields fallback if not already populated
  if (!result['Color'] && (v.color || v.colorName)) {
    result['Color'] = normalizeAttributeVal(v.colorName || v.color || '');
  }
  if (!result['Size'] && (v.size || v.shoeSize)) {
    result['Size'] = normalizeAttributeVal(v.size || v.shoeSize || '');
  }
  if (!result['Storage'] && v.storage) {
    result['Storage'] = normalizeAttributeVal(v.storage);
  }
  if (!result['RAM'] && v.ram) {
    result['RAM'] = normalizeAttributeVal(v.ram);
  }
  if (!result['Shade'] && v.shade) {
    result['Shade'] = normalizeAttributeVal(v.shade);
  }
  if (!result['Volume'] && v.volume) {
    result['Volume'] = normalizeAttributeVal(v.volume);
  }
  if (!result['Material'] && v.material) {
    result['Material'] = normalizeAttributeVal(v.material);
  }
  if (!result['Model'] && v.model) {
    result['Model'] = normalizeAttributeVal(v.model);
  }

  return result;
}

/**
 * Derives dynamic VariantAttribute list from product, automatically upgrading legacy products
 */
export function getProductVariantAttributes(product: Partial<Product> | null | undefined): VariantAttribute[] {
  if (!product) return [];

  // 1. If explicit variantAttributesList is saved and has valid configured values
  if (Array.isArray(product.variantAttributesList) && product.variantAttributesList.length > 0) {
    const validExplicitAttrs = product.variantAttributesList
      .filter(attr => attr && attr.name && Array.isArray(attr.values) && attr.values.length > 0)
      .map(attr => ({
        ...attr,
        name: normalizeAttributeKey(attr.name),
        values: (attr.values || [])
          .filter(val => val && val.name && val.name.trim().length > 0)
          .map(val => ({
            ...val,
            name: normalizeAttributeVal(val.name),
            linkedProductId: val.linkedProductId,
            linkedProductName: val.linkedProductName
          }))
      }))
      .filter(attr => attr.values.length > 0);

    if (validExplicitAttrs.length > 0) {
      return validExplicitAttrs;
    }
  }

  // 2. If product has variants, inspect all active variants and extract discovered attributes
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const activeVariants = product.variants.filter(v => !v.disabled && v.status !== 'disabled');
    const attrMap = new Map<string, { type: 'color' | 'text' | 'button'; valuesMap: Map<string, VariantAttributeValue> }>();

    activeVariants.forEach(v => {
      const attrs = extractVariantAttributes(v);
      Object.entries(attrs).forEach(([attrName, attrVal]) => {
        const cleanName = normalizeAttributeKey(attrName);
        const cleanVal = normalizeAttributeVal(attrVal);
        if (!cleanName || !cleanVal) return;

        if (!attrMap.has(cleanName)) {
          const isColor = cleanName.toLowerCase().includes('color') || cleanName.toLowerCase().includes('colour') || cleanName.toLowerCase().includes('shade');
          attrMap.set(cleanName, {
            type: isColor ? 'color' : 'button',
            valuesMap: new Map()
          });
        }

        const attrEntry = attrMap.get(cleanName)!;
        const isColorAttr = cleanName.toLowerCase().includes('color') || cleanName.toLowerCase().includes('colour') || cleanName.toLowerCase().includes('shade');
        if (!attrEntry.valuesMap.has(cleanVal)) {
          attrEntry.valuesMap.set(cleanVal, {
            id: `val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: cleanVal,
            hex: (isColorAttr && v.colorHex) ? v.colorHex : undefined,
            image: (v.image || v.images?.[0]) ? (v.image || v.images?.[0]) : undefined,
            linkedProductId: v.linkedProductId,
            linkedProductName: v.linkedProductName
          });
        }
      });
    });

    if (attrMap.size > 0) {
      return Array.from(attrMap.entries())
        .map(([name, { type, valuesMap }], idx) => ({
          id: `attr_${idx + 1}_${name.toLowerCase().replace(/\s+/g, '_')}`,
          name,
          type,
          values: Array.from(valuesMap.values())
        }))
        .filter(attr => attr.values.length > 0);
    }
  }

  // If no configured variant attributes with valid values exist, return empty list (do not fabricate dummy selectors)
  return [];
}

/**
 * Category Variant Template Presets for 1-click configuration
 */
export const CATEGORY_VARIANT_TEMPLATES: {
  id: string;
  name: string;
  categoryKeyword: string;
  attributes: {
    name: string;
    displayType: 'image' | 'button' | 'dropdown' | 'text' | 'swatch';
    suggestedValues?: string[];
  }[];
}[] = [
  {
    id: 'tpl_clothing',
    name: 'Clothing & Apparel (Color + Size)',
    categoryKeyword: 'fashion',
    attributes: [
      { name: 'Color', displayType: 'image', suggestedValues: ['Black', 'Navy Blue', 'White', 'Maroon', 'Olive Green'] },
      { name: 'Size', displayType: 'button', suggestedValues: ['S', 'M', 'L', 'XL', 'XXL'] }
    ]
  },
  {
    id: 'tpl_footwear',
    name: 'Shoes & Footwear (Color + Size)',
    categoryKeyword: 'shoes',
    attributes: [
      { name: 'Color', displayType: 'image', suggestedValues: ['Black', 'Brown', 'White', 'Navy Blue', 'Grey'] },
      { name: 'Size', displayType: 'button', suggestedValues: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] }
    ]
  },
  {
    id: 'tpl_smartphones',
    name: 'Smartphones (Color + RAM + Storage)',
    categoryKeyword: 'mobile',
    attributes: [
      { name: 'Color', displayType: 'image', suggestedValues: ['Midnight Black', 'Starlight Silver', 'Deep Purple', 'Titanium Gray'] },
      { name: 'RAM', displayType: 'button', suggestedValues: ['6GB', '8GB', '12GB'] },
      { name: 'Storage', displayType: 'button', suggestedValues: ['128GB', '256GB', '512GB'] }
    ]
  },
  {
    id: 'tpl_laptops',
    name: 'Laptops & PCs (Color + RAM + Storage)',
    categoryKeyword: 'laptop',
    attributes: [
      { name: 'Color', displayType: 'button', suggestedValues: ['Space Gray', 'Silver', 'Black'] },
      { name: 'RAM', displayType: 'button', suggestedValues: ['8GB', '16GB', '32GB'] },
      { name: 'Storage', displayType: 'button', suggestedValues: ['512GB SSD', '1TB SSD', '2TB SSD'] }
    ]
  },
  {
    id: 'tpl_smartwatches',
    name: 'Smartwatches (Color + Model / Size)',
    categoryKeyword: 'watch',
    attributes: [
      { name: 'Color', displayType: 'image', suggestedValues: ['Active Black', 'Rose Gold', 'Silver Frost', 'Midnight Blue'] },
      { name: 'Model', displayType: 'button', suggestedValues: ['40mm (Bluetooth)', '44mm (Bluetooth)', '44mm (LTE / Cellular)'] }
    ]
  },
  {
    id: 'tpl_audio',
    name: 'Earbuds & Audio (Color + Model)',
    categoryKeyword: 'audio',
    attributes: [
      { name: 'Color', displayType: 'image', suggestedValues: ['Phantom Black', 'Cloud White', 'Navy Blue'] },
      { name: 'Model', displayType: 'button', suggestedValues: ['Standard Edition', 'Pro ANC Edition'] }
    ]
  },
  {
    id: 'tpl_skincare',
    name: 'Skincare & Cosmetics (Size + Pack Size)',
    categoryKeyword: 'beauty',
    attributes: [
      { name: 'Size', displayType: 'button', suggestedValues: ['50ml', '100ml', '200ml'] },
      { name: 'Pack Size', displayType: 'button', suggestedValues: ['Pack of 1', 'Pack of 2 (Saver)', 'Pack of 3'] }
    ]
  },
  {
    id: 'tpl_grocery',
    name: 'Food & Grocery (Weight + Pack Size)',
    categoryKeyword: 'grocery',
    attributes: [
      { name: 'Weight', displayType: 'button', suggestedValues: ['250g', '500g', '1kg', '5kg'] },
      { name: 'Pack Size', displayType: 'button', suggestedValues: ['Pack of 1', 'Pack of 2', 'Family Pack'] }
    ]
  },
  {
    id: 'tpl_furniture',
    name: 'Furniture & Living (Color + Material + Size)',
    categoryKeyword: 'furniture',
    attributes: [
      { name: 'Color', displayType: 'swatch', suggestedValues: ['Walnut Brown', 'Oak Natural', 'Matte Black', 'Cream'] },
      { name: 'Material', displayType: 'button', suggestedValues: ['Solid Teak Wood', 'Sheesham Wood', 'Engineered Wood'] },
      { name: 'Size', displayType: 'button', suggestedValues: ['Compact / Standard', 'Large / Queen', 'King Size'] }
    ]
  }
];

/**
 * Checks for circular linking between two products in the catalog
 */
export function isCircularProductLink(
  currentProductId: string | undefined,
  targetProductId: string | undefined,
  catalog: Product[] = []
): boolean {
  if (!currentProductId || !targetProductId) return false;
  if (currentProductId === targetProductId) return true;

  // Follow target product's linked products to see if it links back to currentProductId
  const visited = new Set<string>([currentProductId]);
  let queue: string[] = [targetProductId];

  while (queue.length > 0) {
    const nextId = queue.shift()!;
    if (nextId === currentProductId) return true;
    if (visited.has(nextId)) continue;
    visited.add(nextId);

    const targetProduct = catalog.find(p => p.id === nextId);
    if (targetProduct) {
      // Check variants and attribute values of targetProduct for links
      const linkedIds = new Set<string>();
      (targetProduct.variants || []).forEach(v => {
        if (v.linkedProductId) linkedIds.add(v.linkedProductId);
      });
      (targetProduct.variantAttributesList || []).forEach(a => {
        (a.values || []).forEach(val => {
          if (val.linkedProductId) linkedIds.add(val.linkedProductId);
        });
      });

      linkedIds.forEach(id => {
        if (!visited.has(id)) queue.push(id);
      });
    }
  }

  return false;
}

/**
 * Validates SKU and Combination Key uniqueness across all variants of a product
 */
export function validateVariantMatrixUniqueness(variants: ProductVariant[]): {
  isValid: boolean;
  duplicateSkus: string[];
  duplicateKeys: string[];
} {
  const seenSkus = new Set<string>();
  const duplicateSkus: string[] = [];
  const seenKeys = new Set<string>();
  const duplicateKeys: string[] = [];

  variants.forEach(v => {
    if (v.disabled || v.isArchived) return;

    // Check SKU uniqueness
    if (v.sku && v.sku.trim()) {
      const cleanSku = v.sku.trim().toUpperCase();
      if (seenSkus.has(cleanSku)) {
        duplicateSkus.push(cleanSku);
      } else {
        seenSkus.add(cleanSku);
      }
    }

    // Check Combination Key uniqueness
    const attrs = extractVariantAttributes(v);
    const key = getCanonicalVariantKey(attrs);
    if (key) {
      if (seenKeys.has(key)) {
        duplicateKeys.push(key);
      } else {
        seenKeys.add(key);
      }
    }
  });

  return {
    isValid: duplicateSkus.length === 0 && duplicateKeys.length === 0,
    duplicateSkus: Array.from(new Set(duplicateSkus)),
    duplicateKeys: Array.from(new Set(duplicateKeys))
  };
}

/**
 * Generates Cartesian Product of all configured variant attribute values.
 * Preserves custom price, MRP, images, SKU, stock, and disabled status from existing variants.
 * Non-matched existing variants are safely preserved as archived instead of being lost.
 */
export function generateVariantMatrix(
  attributes: VariantAttribute[],
  baseProduct?: Partial<Product>,
  existingVariants?: ProductVariant[]
): ProductVariant[] {
  // Filter active attributes that have at least one value
  const activeAttributes = attributes.filter(
    a => !a.disabled && Array.isArray(a.values) && a.values.some(v => !v.disabled && v.name.trim().length > 0)
  );

  if (activeAttributes.length === 0) {
    return [];
  }

  // Build list of arrays to cross-product
  const attributeValueSets = activeAttributes.map(attr => {
    const validValues = attr.values.filter(v => !v.disabled && v.name.trim().length > 0);
    return validValues.map(val => ({
      attributeId: attr.id,
      attributeName: normalizeAttributeKey(attr.name),
      valueId: val.id,
      valueName: normalizeAttributeVal(val.name),
      hex: val.hex,
      image: val.image,
      linkedProductId: val.linkedProductId,
      linkedProductName: val.linkedProductName
    }));
  });

  // Cartesian product algorithm
  function cartesian(sets: any[][]): any[][] {
    return sets.reduce(
      (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
      [[]] as any[][]
    );
  }

  const combinations = cartesian(attributeValueSets);

  // Index existing variants by canonical combination key and ID
  const existingByCanonical = new Map<string, ProductVariant>();
  const usedExistingIds = new Set<string>();

  if (Array.isArray(existingVariants)) {
    existingVariants.forEach(v => {
      const attrs = extractVariantAttributes(v);
      const key = v.combinationKey || getCanonicalVariantKey(attrs);
      if (key && !existingByCanonical.has(key)) {
        existingByCanonical.set(key, v);
      }
    });
  }

  const basePrice = baseProduct?.discountPrice || baseProduct?.price || 0;
  const baseMrp = baseProduct?.mrp || baseProduct?.price || basePrice;
  const baseSku = (baseProduct?.sku || 'SKU').replace(/\s+/g, '-').toUpperCase();
  const baseImage = baseProduct?.primaryImage || baseProduct?.images?.[0] || '';

  const generatedVariants: ProductVariant[] = combinations.map((combo, idx) => {
    const attrsRecord: Record<string, string> = {};
    let matchedHex = '#000000';
    let matchedSwatchImage = '';
    let matchedLinkedProductId: string | undefined = undefined;
    let matchedLinkedProductName: string | undefined = undefined;

    combo.forEach(item => {
      attrsRecord[item.attributeName] = item.valueName;
      if (item.hex) matchedHex = item.hex;
      if (item.image) matchedSwatchImage = item.image;
      const isColorAttr = item.attributeName.toLowerCase().includes('color') ||
                          item.attributeName.toLowerCase().includes('colour') ||
                          item.attributeName.toLowerCase().includes('shade');
      if (isColorAttr && item.linkedProductId) {
        matchedLinkedProductId = item.linkedProductId;
        matchedLinkedProductName = item.linkedProductName;
      }
    });

    const canonicalKey = getCanonicalVariantKey(attrsRecord);
    const existing = existingByCanonical.get(canonicalKey);

    const comboTitle = getVariantCombinationTitle(attrsRecord);

    if (existing) {
      usedExistingIds.add(existing.id);
      // Preserve existing customizations, but ensure combinationKey & attributes map are synchronized
      return {
        ...existing,
        productId: baseProduct?.id || existing.productId,
        name: existing.name || comboTitle,
        attributes: attrsRecord,
        attributeValues: attrsRecord,
        combinationKey: canonicalKey,
        isArchived: false,
        status: existing.disabled ? 'disabled' : (existing.stock > 0 ? 'active' : 'out_of_stock'),
        colorHex: existing.colorHex || matchedHex,
        linkedProductId: existing.linkedProductId || matchedLinkedProductId,
        linkedProductName: existing.linkedProductName || matchedLinkedProductName,
        // Legacy mapping sync
        color: attrsRecord['Color'] || attrsRecord['Shade'] || existing.color || '',
        colorName: attrsRecord['Color'] || attrsRecord['Shade'] || existing.colorName || '',
        size: attrsRecord['Size'] || existing.size || '',
        storage: attrsRecord['Storage'] || existing.storage || '',
        ram: attrsRecord['RAM'] || existing.ram || '',
        material: attrsRecord['Material'] || existing.material || '',
        model: attrsRecord['Model'] || existing.model || '',
      };
    }

    // Generate new unique variant
    const variantId = `var_${Date.now()}_${(idx + 1).toString().padStart(2, '0')}_${Math.random().toString(36).substring(2, 6)}`;
    const variantSku = `${baseSku}_V${(idx + 1).toString().padStart(2, '0')}`;
    const variantImg = matchedSwatchImage || baseImage;

    return {
      id: variantId,
      productId: baseProduct?.id,
      name: comboTitle,
      attributes: attrsRecord,
      attributeValues: attrsRecord,
      combinationKey: canonicalKey,
      sku: variantSku,
      price: basePrice,
      mrp: baseMrp,
      discountPrice: basePrice,
      discountPercentage: baseMrp > basePrice ? Math.round(((baseMrp - basePrice) / baseMrp) * 100) : 0,
      stock: 10,
      lowStockThreshold: 2,
      inStock: true,
      status: 'active',
      disabled: false,
      isArchived: false,
      image: variantImg,
      images: variantImg ? [variantImg] : [],
      colorHex: matchedHex,
      linkedProductId: matchedLinkedProductId,
      linkedProductName: matchedLinkedProductName,
      // Legacy support fields
      color: attrsRecord['Color'] || attrsRecord['Shade'] || '',
      colorName: attrsRecord['Color'] || attrsRecord['Shade'] || '',
      size: attrsRecord['Size'] || '',
      storage: attrsRecord['Storage'] || '',
      ram: attrsRecord['RAM'] || '',
      material: attrsRecord['Material'] || '',
      model: attrsRecord['Model'] || '',
    };
  });

  // Safe regeneration: Preserve any previous variants not in the new combination set as archived
  if (Array.isArray(existingVariants)) {
    const unreferencedVariants = existingVariants
      .filter(v => !usedExistingIds.has(v.id))
      .map(v => ({
        ...v,
        isArchived: true,
        disabled: true,
        status: 'archived' as const
      }));

    return [...generatedVariants, ...unreferencedVariants];
  }

  return generatedVariants;
}

/**
 * Combination-aware availability calculator for customer storefront.
 * Given all active variants and current selected attributes, evaluates for each attribute and each value:
 * 1. `available`: Can this value form a valid variant with the rest of current selections?
 * 2. `inStock`: Does that valid combination have stock > 0?
 * 3. `variant`: The corresponding matched variant (if fully determined).
 */
export function calculateAttributeAvailability(
  variants: ProductVariant[],
  attributes: VariantAttribute[],
  currentSelection: Record<string, string>
): Record<string, Record<string, { available: boolean; inStock: boolean; variant?: ProductVariant }>> {
  const result: Record<string, Record<string, { available: boolean; inStock: boolean; variant?: ProductVariant }>> = {};
  const activeVariants = (variants || []).filter(v => !v.disabled && v.status !== 'disabled');

  attributes.forEach(attr => {
    const attrName = normalizeAttributeKey(attr.name);
    result[attrName] = {};

    (attr.values || []).forEach(val => {
      const valName = normalizeAttributeVal(val.name);

      // Create a hypothetical selection with this value for this attribute
      const testSelection: Record<string, string> = {
        ...currentSelection,
        [attrName]: valName
      };

      // Filter other attributes that the product has
      const otherAttributes = attributes.filter(a => normalizeAttributeKey(a.name) !== attrName);

      // Find if there is any active variant that matches this value and as many other selections as possible
      let matchingVariants = activeVariants.filter(v => {
        const vAttrs = extractVariantAttributes(v);
        const matchVal = normalizeAttributeVal(vAttrs[attrName]) === valName;
        if (!matchVal) return false;

        // Check if other selected attributes match
        return otherAttributes.every(otherAttr => {
          const oName = normalizeAttributeKey(otherAttr.name);
          const selVal = currentSelection[oName];
          if (!selVal) return true; // Not selected yet
          return normalizeAttributeVal(vAttrs[oName]) === normalizeAttributeVal(selVal);
        });
      });

      // If no exact match with all other selections, check if this value exists AT ALL in any active variant
      const existsInAnyVariant = activeVariants.some(v => {
        const vAttrs = extractVariantAttributes(v);
        return normalizeAttributeVal(vAttrs[attrName]) === valName;
      });

      const isAvailable = matchingVariants.length > 0 || (otherAttributes.length > 0 && existsInAnyVariant);
      const inStockVariants = matchingVariants.filter(v => (v.stock ?? 0) > 0 && v.inStock !== false);
      const isInStock = inStockVariants.length > 0 || (matchingVariants.length === 0 && existsInAnyVariant);

      const resolvedVariant = inStockVariants[0] || matchingVariants[0];

      result[attrName][valName] = {
        available: isAvailable,
        inStock: isInStock,
        variant: resolvedVariant
      };
    });
  });

  return result;
}

/**
 * Finds the exact variant matching a full or partial attribute selection
 */
export function findMatchingVariant(
  variants: ProductVariant[],
  attributes: VariantAttribute[],
  selection: Record<string, string>
): ProductVariant | undefined {
  if (!variants || variants.length === 0) return undefined;
  const activeVariants = variants.filter(v => !v.disabled && v.status !== 'disabled');

  // 1. Try exact canonical match
  const testKey = getCanonicalVariantKey(selection);
  const exactMatch = activeVariants.find(v => {
    const vAttrs = extractVariantAttributes(v);
    return getCanonicalVariantKey(vAttrs) === testKey;
  });
  if (exactMatch) return exactMatch;

  // 2. Score-based best match across active attributes
  let bestScore = -1;
  let bestVariant: ProductVariant | undefined = undefined;

  activeVariants.forEach(v => {
    const vAttrs = extractVariantAttributes(v);
    let score = 0;
    let matchCount = 0;

    Object.entries(selection).forEach(([k, val]) => {
      const vVal = vAttrs[normalizeAttributeKey(k)];
      if (vVal && normalizeAttributeVal(vVal) === normalizeAttributeVal(val)) {
        score += 2;
        matchCount++;
      } else if (vVal) {
        score -= 1;
      }
    });

    if ((v.stock ?? 0) > 0 && v.inStock !== false) {
      score += 1; // Prefer in-stock variant
    }

    if (score > bestScore && matchCount > 0) {
      bestScore = score;
      bestVariant = v;
    }
  });

  return bestVariant || activeVariants[0];
}

/**
 * Resolves a valid selection when the user changes one attribute value.
 * Preserves other selections if valid, or falls back intelligently to the best compatible combination.
 */
export function resolveValidVariantSelection(
  variants: ProductVariant[],
  attributes: VariantAttribute[],
  currentSelection: Record<string, string>,
  changedAttrName: string,
  changedValName: string
): { selectedAttributes: Record<string, string>; variant?: ProductVariant } {
  const normAttrName = normalizeAttributeKey(changedAttrName);
  const normValName = normalizeAttributeVal(changedValName);

  const activeVariants = (variants || []).filter(v => !v.disabled && v.status !== 'disabled');

  // 1. Find all active variants that have this changed attribute value
  const matchingWithChanged = activeVariants.filter(v => {
    const vAttrs = extractVariantAttributes(v);
    return normalizeAttributeVal(vAttrs[normAttrName]) === normValName;
  });

  if (matchingWithChanged.length === 0) {
    // Value not found in active variants, keep current
    return { selectedAttributes: { ...currentSelection, [normAttrName]: normValName } };
  }

  // 2. Try to find a variant from matchingWithChanged that shares the MAXIMUM number of other current selections
  let bestVariant: ProductVariant = matchingWithChanged[0];
  let maxMatchingOthers = -1;

  matchingWithChanged.forEach(v => {
    const vAttrs = extractVariantAttributes(v);
    let matchCount = 0;
    let inStockBonus = (v.stock ?? 0) > 0 && v.inStock !== false ? 1 : 0;

    Object.entries(currentSelection).forEach(([k, val]) => {
      const cleanK = normalizeAttributeKey(k);
      if (cleanK === normAttrName) return;
      if (normalizeAttributeVal(vAttrs[cleanK]) === normalizeAttributeVal(val)) {
        matchCount++;
      }
    });

    const totalWeight = matchCount * 10 + inStockBonus;
    if (totalWeight > maxMatchingOthers) {
      maxMatchingOthers = totalWeight;
      bestVariant = v;
    }
  });

  // Extract full attributes from the chosen best variant
  const newAttributes = extractVariantAttributes(bestVariant);

  return {
    selectedAttributes: newAttributes,
    variant: bestVariant
  };
}

/**
 * Determines the best initial selection for a product details page
 */
export function getBestInitialSelection(
  product: Product,
  initialVariantIdOrParams?: string | Record<string, string>
): { selectedAttributes: Record<string, string>; variant?: ProductVariant } {
  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');

  if (activeVariants.length === 0) {
    return { selectedAttributes: {} };
  }

  // 1. If specific variantId requested and active
  if (typeof initialVariantIdOrParams === 'string' && initialVariantIdOrParams) {
    const target = activeVariants.find(v => v.id === initialVariantIdOrParams);
    if (target) {
      return {
        selectedAttributes: extractVariantAttributes(target),
        variant: target
      };
    }
  }

  // 2. If attribute params map provided (e.g. from URL query params)
  if (typeof initialVariantIdOrParams === 'object' && initialVariantIdOrParams) {
    const matching = findMatchingVariant(activeVariants, getProductVariantAttributes(product), initialVariantIdOrParams);
    if (matching) {
      return {
        selectedAttributes: extractVariantAttributes(matching),
        variant: matching
      };
    }
  }

  // 3. Prefer first in-stock variant
  const firstInStock = activeVariants.find(v => (v.stock ?? 0) > 0 && v.inStock !== false);
  const selected = firstInStock || activeVariants[0];

  return {
    selectedAttributes: extractVariantAttributes(selected),
    variant: selected
  };
}

/**
 * Calculates effective price and price range across all active variants for product cards/details
 */
export function getProductPriceRange(product: Product): {
  minPrice: number;
  maxPrice: number;
  hasRange: boolean;
  displayPrice: number;
  displayMrp: number;
  discountPercentage: number;
  inStock: boolean;
  totalStock: number;
} {
  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');
  const basePrice = product.discountPrice || product.price || 0;
  const baseMrp = product.mrp || product.price || basePrice;

  if (activeVariants.length === 0) {
    const inStock = product.inStock !== false && product.status !== 'out_of_stock' && (product.stock ?? 0) > 0;
    return {
      minPrice: basePrice,
      maxPrice: basePrice,
      hasRange: false,
      displayPrice: basePrice,
      displayMrp: baseMrp,
      discountPercentage: baseMrp > basePrice ? Math.round(((baseMrp - basePrice) / baseMrp) * 100) : 0,
      inStock,
      totalStock: product.stock || 0
    };
  }

  const prices = activeVariants.map(v => {
    if (v.price && v.price > 0) return v.price;
    if (v.discountPrice && v.discountPrice > 0) return v.discountPrice;
    return basePrice + (v.extraPrice || 0);
  });

  const mrps = activeVariants.map(v => {
    if (v.mrp && v.mrp > 0) return v.mrp;
    return baseMrp + (v.extraPrice || 0);
  });

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minMrp = Math.min(...mrps);
  const maxMrp = Math.max(...mrps);

  const totalStock = activeVariants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  const inStock = activeVariants.some(v => (v.stock ?? 0) > 0 && v.inStock !== false);

  const discountPercentage = maxMrp > minPrice ? Math.round(((maxMrp - minPrice) / maxMrp) * 100) : 0;

  return {
    minPrice,
    maxPrice,
    hasRange: minPrice !== maxPrice,
    displayPrice: minPrice,
    displayMrp: maxMrp || minMrp,
    discountPercentage,
    inStock,
    totalStock
  };
}

/**
 * Returns available attribute badges for product listings (e.g. "3 Colors", "4 Sizes", "2 Storage Options")
 */
export function getAvailableAttributeSummaries(product: Product): string[] {
  const attributes = getProductVariantAttributes(product);
  const summaries: string[] = [];

  attributes.forEach(attr => {
    const count = (attr.values || []).filter(v => !v.disabled).length;
    if (count > 1) {
      summaries.push(`${count} ${attr.name}s`);
    }
  });

  return summaries;
}

/**
 * Builds a clean, deduplicated, sorted Family Matrix from a list of family products.
 * Supports UNIVERSAL product-family relationships across ANY attribute (Color, Storage, Size, RAM, Capacity, Pack Size, Material, etc.).
 * Guarantees that each variant entry points to a REAL independent Product ID.
 */
export function buildFamilyProductMatrix(
  familyProducts: Product[],
  currentProduct?: Partial<Product> | null
): FamilyProductVariant[] {
  if (!familyProducts || familyProducts.length === 0) {
    if (currentProduct && currentProduct.id) {
      const familyAttr = currentProduct.familyAttributeName || (currentProduct.familyColorName || currentProduct.familyColorHex || currentProduct.color ? 'Color' : 'Option');
      const pVal = currentProduct.familyAttributeValue || currentProduct.familyColorName || currentProduct.color || currentProduct.name || 'Default';
      const pThumb = currentProduct.familyThumbnail || currentProduct.primaryImage || currentProduct.images?.[0] || '';
      return [{
        productId: currentProduct.id,
        productSlug: getProductSlug(currentProduct as Product),
        productCode: currentProduct.productCode,
        attributeName: familyAttr,
        attributeValue: pVal,
        color: pVal,
        thumbnail: pThumb,
        hex: currentProduct.familyColorHex,
        displayOrder: currentProduct.familyAttributeOrder ?? currentProduct.familyColorOrder ?? 1,
        price: currentProduct.discountPrice || currentProduct.price,
        mrp: currentProduct.mrp || currentProduct.price,
        inStock: currentProduct.inStock !== false && currentProduct.status !== 'out_of_stock' && (currentProduct.stock ?? 0) > 0,
        stock: currentProduct.stock ?? 0,
        productName: currentProduct.name || '',
        isCurrentProduct: true
      }];
    }
    return [];
  }

  // Deduplicate products by ID
  const uniqueProductsMap = new Map<string, Product>();
  familyProducts.forEach(p => {
    if (p && p.id && p.status !== 'inactive' && p.isVisible !== false) {
      uniqueProductsMap.set(p.id, p);
    }
  });

  // If currentProduct is provided and not in the map, add it
  if (currentProduct && currentProduct.id && !uniqueProductsMap.has(currentProduct.id)) {
    uniqueProductsMap.set(currentProduct.id, currentProduct as Product);
  }

  const allProds = Array.from(uniqueProductsMap.values());

  // Determine family attribute name:
  // 1. Check if configured explicitly on currentProduct or any family product
  let familyAttrName = currentProduct?.familyAttributeName || allProds.find(p => p.familyAttributeName)?.familyAttributeName;
  if (!familyAttrName) {
    // If any product has familyColorName or familyColorHex or color, treat as Color
    const hasColorData = allProds.some(p => p.familyColorName || p.familyColorHex || p.color);
    if (hasColorData) {
      familyAttrName = 'Color';
    } else {
      // Check if products have an attribute in variantAttributesList
      const firstWithAttrs = allProds.find(p => p.variantAttributesList && p.variantAttributesList.length > 0);
      if (firstWithAttrs?.variantAttributesList?.[0]?.name) {
        familyAttrName = firstWithAttrs.variantAttributesList[0].name;
      } else {
        familyAttrName = 'Option';
      }
    }
  }

  const result: FamilyProductVariant[] = [];
  const seenValues = new Set<string>();

  allProds.forEach((p, idx) => {
    // Determine attribute value for this product
    let val = (p.familyAttributeValue || '').trim();
    if (!val) {
      if (familyAttrName.toLowerCase() === 'color' || !familyAttrName) {
        val = (p.familyColorName || p.color || '').trim();
      }
    }
    if (!val && p.variants && p.variants.length > 0) {
      // Look in first variant attributes
      const firstV = p.variants[0];
      const vAttrs = extractVariantAttributes(firstV);
      if (familyAttrName && vAttrs[familyAttrName]) {
        val = vAttrs[familyAttrName];
      } else if (vAttrs['Color']) {
        val = vAttrs['Color'];
      }
    }
    if (!val) {
      // Check direct product field matching familyAttrName (e.g. storage, size, capacity, etc.)
      const directVal = (p as any)[familyAttrName.toLowerCase()];
      if (typeof directVal === 'string' && directVal.trim()) {
        val = directVal.trim();
      }
    }
    if (!val) {
      val = p.name;
    }

    const cleanVal = normalizeAttributeVal(val);
    const valLower = cleanVal.toLowerCase();

    // Prevent duplicate entries in the same family matrix (unless it's the current product)
    if (seenValues.has(valLower) && p.id !== currentProduct?.id) {
      return;
    }
    seenValues.add(valLower);

    const thumbnail = p.familyThumbnail || p.primaryImage || (p.images && p.images[0]) || (p.variants && p.variants[0]?.image) || '';
    const hex = p.familyColorHex || (p.variants && p.variants[0]?.colorHex) || undefined;
    const isCurrent = Boolean(currentProduct?.id && (p.id === currentProduct.id || (p.slug && p.slug === currentProduct.slug)));
    const inStock = p.inStock !== false && p.status !== 'out_of_stock' && (p.stock ?? 0) > 0;

    result.push({
      productId: p.id,
      productSlug: getProductSlug(p),
      productCode: p.productCode,
      attributeName: familyAttrName,
      attributeValue: cleanVal,
      color: cleanVal, // Backward-compatible alias
      thumbnail,
      hex,
      displayOrder: p.familyAttributeOrder ?? p.familyColorOrder ?? (idx + 1),
      price: p.discountPrice || p.price,
      mrp: p.mrp || p.price,
      inStock,
      stock: p.stock ?? 0,
      productName: p.name || '',
      isCurrentProduct: isCurrent
    });
  });

  // Sort matrix by displayOrder ascending, then by attributeValue
  result.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return (a.attributeValue || a.color || '').localeCompare(b.attributeValue || b.color || '');
  });

  return result;
}

export const buildFamilyColorMatrix = buildFamilyProductMatrix;

/**
 * In-memory cache for family product queries to optimize performance and prevent unnecessary Firestore reads.
 */
const familyProductsCache = new Map<string, { timestamp: number; products: Product[] }>();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Queries only products belonging to the specified familyId from Firestore.
 * Does NOT fetch the entire product catalog.
 */
export async function fetchFamilyProductMatrix(
  familyId: string | undefined | null,
  currentProduct?: Partial<Product> | null
): Promise<FamilyProductVariant[]> {
  const cleanFamilyId = (familyId || '').trim();
  if (!cleanFamilyId) {
    return buildFamilyProductMatrix([], currentProduct);
  }

  // Check cache
  const cached = familyProductsCache.get(cleanFamilyId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return buildFamilyProductMatrix(cached.products, currentProduct);
  }

  try {
    const q = query(
      collection(db, 'products'),
      where('familyId', '==', cleanFamilyId)
    );
    const snap = await getDocs(q);
    const familyProducts = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Product))
      .filter(p => p && p.isVisible !== false && p.status !== 'inactive');

    familyProductsCache.set(cleanFamilyId, {
      timestamp: Date.now(),
      products: familyProducts
    });

    return buildFamilyProductMatrix(familyProducts, currentProduct);
  } catch (err) {
    console.error(`Failed to query family products for familyId "${cleanFamilyId}":`, err);
    return buildFamilyProductMatrix([], currentProduct);
  }
}

export const fetchFamilyColorMatrix = fetchFamilyProductMatrix;

/**
 * Extracts unique available size values for a product (e.g. ['M', 'L', 'XL', 'XXL'])
 */
export function extractProductSizes(product: Partial<Product> | null | undefined): string[] {
  if (!product) return [];
  const sizesSet = new Set<string>();

  // 1. From variantAttributesList (attributes with name 'size', 'shoe size', etc.)
  if (Array.isArray(product.variantAttributesList)) {
    product.variantAttributesList.forEach(attr => {
      const k = (attr.name || '').trim().toLowerCase();
      if (k === 'size' || k.includes('size')) {
        attr.values?.forEach(v => {
          const valName = (v.name || v.value || '').trim();
          if (valName) sizesSet.add(valName);
        });
      }
    });
  }

  // 2. From variants
  if (Array.isArray(product.variants)) {
    product.variants.forEach(v => {
      const attrs = extractVariantAttributes(v);
      Object.entries(attrs).forEach(([key, val]) => {
        if (key.toLowerCase() === 'size' || key.toLowerCase().includes('size')) {
          const trimmed = (val || '').trim();
          if (trimmed) sizesSet.add(trimmed);
        }
      });
      if (v.size && typeof v.size === 'string' && v.size.trim()) {
        sizesSet.add(v.size.trim());
      }
      if (v.shoeSize && typeof v.shoeSize === 'string' && v.shoeSize.trim()) {
        sizesSet.add(v.shoeSize.trim());
      }
    });
  }

  // 3. Explicit sizes array
  if (Array.isArray(product.sizes)) {
    product.sizes.forEach(s => {
      const trimmed = (s || '').trim();
      if (trimmed) sizesSet.add(trimmed);
    });
  }

  // 4. From product.size
  if (product.size && typeof product.size === 'string') {
    const parts = product.size.split(',').map(s => s.trim()).filter(Boolean);
    parts.forEach(p => sizesSet.add(p));
  }

  return Array.from(sizesSet);
}

/**
 * Resolves active specifications for ANY product given selected attributes or variant, with universal fallback to default specifications
 */
export function getProductSpecificationsForSelection(
  product: Partial<Product> | null | undefined,
  selectedAttributes?: Record<string, string> | null,
  selectedVariantId?: string | null,
  selectedVariant?: ProductVariant | null
): { key: string; value: string }[] {
  if (!product) return [];

  const defaultSpecs = Array.isArray(product.specifications) ? product.specifications : [];
  const specMaps = [
    product.variantSpecifications,
    product.specificationsByVariant,
    product.sizeSpecifications,
    product.specificationsBySize
  ].filter(Boolean) as Record<string, { key: string; value: string }[]>[];

  if (specMaps.length === 0) {
    return defaultSpecs;
  }

  // Helper to lookup a key across all spec maps
  const findInMaps = (lookupKey: string | undefined | null): { key: string; value: string }[] | null => {
    if (!lookupKey) return null;
    const cleanKey = lookupKey.trim();
    if (!cleanKey) return null;
    const cleanLower = cleanKey.toLowerCase();

    for (const map of specMaps) {
      if (typeof map !== 'object') continue;
      // 1. Direct exact match
      if (Array.isArray(map[cleanKey]) && map[cleanKey].length > 0) {
        return map[cleanKey];
      }
      // 2. Case-insensitive match
      const matchingKey = Object.keys(map).find(
        k => k.trim().toLowerCase() === cleanLower
      );
      if (matchingKey && Array.isArray(map[matchingKey]) && map[matchingKey].length > 0) {
        return map[matchingKey];
      }
    }
    return null;
  };

  // 1. Look up by exact Variant ID
  if (selectedVariantId) {
    const byId = findInMaps(selectedVariantId);
    if (byId) return byId;
  }
  if (selectedVariant?.id) {
    const byId = findInMaps(selectedVariant.id);
    if (byId) return byId;
  }

  // 2. Look up by Combination Key (e.g. "color:black|storage:128gb")
  if (selectedVariant?.combinationKey) {
    const byCombo = findInMaps(selectedVariant.combinationKey);
    if (byCombo) return byCombo;
  }
  if (selectedAttributes) {
    const canonicalKey = getCanonicalVariantKey(selectedAttributes);
    if (canonicalKey) {
      const byCanonical = findInMaps(canonicalKey);
      if (byCanonical) return byCanonical;
    }
  }

  // 3. Look up by Variant Combination Display Name (e.g. "Black / 128GB" or "128GB")
  if (selectedVariant?.name) {
    const byName = findInMaps(selectedVariant.name);
    if (byName) return byName;
  }

  // 4. Look up by individual selected attribute values (e.g. "128GB", "256GB", "1kg", "XL", "Cotton")
  if (selectedAttributes && typeof selectedAttributes === 'object') {
    for (const [attrName, attrVal] of Object.entries(selectedAttributes)) {
      if (!attrVal) continue;
      // Look up by raw value (e.g. "256GB" or "XL")
      const byVal = findInMaps(attrVal);
      if (byVal) return byVal;

      // Look up by "Attribute:Value" (e.g. "Storage:256GB" or "Size:XL")
      const byAttrVal = findInMaps(`${attrName}:${attrVal}`);
      if (byAttrVal) return byAttrVal;
    }
  }

  // 5. Look up by legacy variant properties (size, shoeSize, storage, ram, capacity, weight, etc.)
  if (selectedVariant) {
    const variantAttrs = extractVariantAttributes(selectedVariant);
    for (const [attrName, attrVal] of Object.entries(variantAttrs)) {
      if (!attrVal) continue;
      const byVal = findInMaps(attrVal);
      if (byVal) return byVal;
      const byAttrVal = findInMaps(`${attrName}:${attrVal}`);
      if (byAttrVal) return byAttrVal;
    }
  }

  return defaultSpecs;
}

/**
 * Resolves active specifications for a product given a selected size, with fallback to default specifications
 */
export function getProductSpecificationsForSize(
  product: Partial<Product> | null | undefined,
  selectedSize?: string | null
): { key: string; value: string }[] {
  if (!product) return [];
  if (selectedSize) {
    return getProductSpecificationsForSelection(product, { Size: selectedSize });
  }
  return Array.isArray(product.specifications) ? product.specifications : [];
}




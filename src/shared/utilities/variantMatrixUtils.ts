import { Product, ProductVariant, VariantAttribute, VariantAttributeValue } from '../types';

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

  // 1. If explicit variantAttributesList is saved
  if (Array.isArray(product.variantAttributesList) && product.variantAttributesList.length > 0) {
    return product.variantAttributesList.map(attr => ({
      ...attr,
      name: normalizeAttributeKey(attr.name),
      values: (attr.values || []).map(val => ({
        ...val,
        name: normalizeAttributeVal(val.name)
      }))
    }));
  }

  // 2. If product has variants, inspect all variants and extract discovered attributes
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const attrMap = new Map<string, { type: 'color' | 'text' | 'button'; valuesMap: Map<string, VariantAttributeValue> }>();

    product.variants.forEach(v => {
      const attrs = extractVariantAttributes(v);
      Object.entries(attrs).forEach(([attrName, attrVal]) => {
        const cleanName = normalizeAttributeKey(attrName);
        const cleanVal = normalizeAttributeVal(attrVal);
        if (!cleanName || !cleanVal) return;

        if (!attrMap.has(cleanName)) {
          const isColor = cleanName.toLowerCase().includes('color') || cleanName.toLowerCase().includes('shade');
          attrMap.set(cleanName, {
            type: isColor ? 'color' : 'button',
            valuesMap: new Map()
          });
        }

        const attrEntry = attrMap.get(cleanName)!;
        if (!attrEntry.valuesMap.has(cleanVal)) {
          attrEntry.valuesMap.set(cleanVal, {
            id: `val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: cleanVal,
            hex: (cleanName.toLowerCase().includes('color') && v.colorHex) ? v.colorHex : undefined,
            image: (v.image || v.images?.[0]) ? (v.image || v.images?.[0]) : undefined
          });
        }
      });
    });

    if (attrMap.size > 0) {
      return Array.from(attrMap.entries()).map(([name, { type, valuesMap }], idx) => ({
        id: `attr_${idx + 1}_${name.toLowerCase().replace(/\s+/g, '_')}`,
        name,
        type,
        values: Array.from(valuesMap.values())
      }));
    }
  }

  // 3. Fallback to legacy string array if defined
  if (Array.isArray(product.variantAttributes) && product.variantAttributes.length > 0) {
    return product.variantAttributes.map((attrKey, idx) => {
      const name = attrKey.charAt(0).toUpperCase() + attrKey.slice(1);
      return {
        id: `attr_${idx + 1}_${attrKey}`,
        name,
        type: attrKey.toLowerCase() === 'color' ? 'color' : 'button',
        values: []
      };
    });
  }

  return [];
}

/**
 * Generates Cartesian Product of all configured variant attribute values.
 * Preserves custom price, MRP, images, SKU, stock, and disabled status from existing variants.
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
      image: val.image
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
  const existingById = new Map<string, ProductVariant>();

  if (Array.isArray(existingVariants)) {
    existingVariants.forEach(v => {
      if (v.id) existingById.set(v.id, v);
      const attrs = extractVariantAttributes(v);
      const key = getCanonicalVariantKey(attrs);
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

    combo.forEach(item => {
      attrsRecord[item.attributeName] = item.valueName;
      if (item.hex) matchedHex = item.hex;
      if (item.image) matchedSwatchImage = item.image;
    });

    const canonicalKey = getCanonicalVariantKey(attrsRecord);
    const existing = existingByCanonical.get(canonicalKey);

    const comboTitle = getVariantCombinationTitle(attrsRecord);

    if (existing) {
      // Preserve existing customizations, but ensure attributes map and name are updated
      return {
        ...existing,
        name: existing.name || comboTitle,
        attributes: attrsRecord,
        attributeValues: attrsRecord,
        colorHex: existing.colorHex || matchedHex,
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
      name: comboTitle,
      attributes: attrsRecord,
      attributeValues: attrsRecord,
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
      image: variantImg,
      images: variantImg ? [variantImg] : [],
      colorHex: matchedHex,
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
  initialVariantId?: string
): { selectedAttributes: Record<string, string>; variant?: ProductVariant } {
  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');

  if (activeVariants.length === 0) {
    return { selectedAttributes: {} };
  }

  // If specific variantId requested and active
  if (initialVariantId) {
    const target = activeVariants.find(v => v.id === initialVariantId);
    if (target) {
      return {
        selectedAttributes: extractVariantAttributes(target),
        variant: target
      };
    }
  }

  // Prefer first in-stock variant
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

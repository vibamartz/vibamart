import React from 'react';
import { Product, ProductVariant, VariantAttribute, FamilyColorVariant } from '../types';
import { useNavigate } from 'react-router-dom';
import {
  getProductVariantAttributes,
  calculateAttributeAvailability,
  resolveValidVariantSelection,
  normalizeAttributeKey,
  normalizeAttributeVal
} from '../utilities/variantMatrixUtils';
import { Ruler, Check, ChevronDown } from 'lucide-react';

interface UniversalVariantSelectorProps {
  product: Product;
  selectedAttributes: Record<string, string>;
  selectedVariantId?: string;
  familyColorVariants?: FamilyColorVariant[];
  onSelectVariant: (variantId: string, updatedAttributes: Record<string, string>) => void;
  onOpenSizeChart?: () => void;
  showSizeChartButton?: boolean;
}

export default function UniversalVariantSelector({
  product,
  selectedAttributes,
  selectedVariantId,
  familyColorVariants = [],
  onSelectVariant,
  onOpenSizeChart,
  showSizeChartButton = true
}: UniversalVariantSelectorProps) {
  const navigate = useNavigate();
  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');
  const allAttributes = getProductVariantAttributes(product);

  const hasFamilyColors = Array.isArray(familyColorVariants) && familyColorVariants.length > 0;
  const familyAttrName = familyColorVariants[0]?.attributeName || product.familyAttributeName || (familyColorVariants.some(f => f.hex) ? 'Color' : 'Color');

  // Filter out standalone attribute if familyColorVariants is provided for that attribute (to avoid duplicate rows)
  const nonColorAttributes = hasFamilyColors
    ? allAttributes.filter(a => {
        const k = normalizeAttributeKey(a.name).toLowerCase();
        const fKey = familyAttrName.toLowerCase();
        if (fKey === 'color' || fKey.includes('color')) {
          return !k.includes('color') && !k.includes('colour') && !k.includes('shade') && a.type !== 'color';
        }
        return k !== fKey;
      })
    : allAttributes;

  // If no family colors and (no attributes or no variants), do not render
  if (!hasFamilyColors && (activeVariants.length === 0 || allAttributes.length === 0)) {
    return null;
  }

  // Calculate combination-aware availability for remaining non-color or all attributes
  const availabilityMatrix = calculateAttributeAvailability(activeVariants, allAttributes, selectedAttributes);

  const handleAttributeValueClick = (attrName: string, valName: string) => {
    const cleanKey = normalizeAttributeKey(attrName);
    const attr = allAttributes.find(a => normalizeAttributeKey(a.name) === cleanKey);
    const valObj = attr?.values?.find(v => normalizeAttributeVal(v.name) === normalizeAttributeVal(valName));

    // Direct navigation when customer clicks any attribute value that has a Product Link (Universal)
    if (valObj?.linkedProductId) {
      const targetLinkedId = valObj.linkedProductId.trim();
      if (targetLinkedId && targetLinkedId !== product.id && targetLinkedId !== product.slug) {
        navigate(`/products/${targetLinkedId}`);
        return;
      }
    }

    const { selectedAttributes: newSelection, variant } = resolveValidVariantSelection(
      activeVariants,
      allAttributes,
      selectedAttributes,
      attrName,
      valName
    );

    // Direct navigation if resolved variant has a Product Link
    if (variant?.linkedProductId) {
      const targetLinkedId = variant.linkedProductId.trim();
      if (targetLinkedId && targetLinkedId !== product.id && targetLinkedId !== product.slug) {
        navigate(`/products/${targetLinkedId}`);
        return;
      }
    }

    // Local variant state switch within current product
    if (variant) {
      onSelectVariant(variant.id, newSelection);
    }
  };

  const handleFamilyColorClick = (colorVar: FamilyColorVariant) => {
    if (colorVar.isCurrentProduct || colorVar.productId === product.id) {
      return; // Already on this real product
    }
    const targetSlugOrId = colorVar.productSlug || colorVar.productId;
    if (targetSlugOrId) {
      navigate(`/products/${targetSlugOrId}`);
    }
  };

  // Find active family color / attribute variant
  const activeFamilyColor = hasFamilyColors
    ? familyColorVariants.find(c => c.isCurrentProduct || c.productId === product.id || (product.slug && c.productSlug === product.slug)) || familyColorVariants[0]
    : null;

  /**
   * Helper to determine intelligent display type
   */
  const getAttributeDisplayType = (attr: VariantAttribute): 'image' | 'button' | 'dropdown' | 'text' | 'swatch' => {
    if (attr.displayType) return attr.displayType;
    const nameLower = attr.name.toLowerCase();
    if (nameLower.includes('color') || nameLower.includes('shade') || attr.type === 'color' || attr.type === 'image') {
      return 'image';
    }
    if (attr.type === 'select' || attr.type === 'dropdown') {
      return 'dropdown';
    }
    if (attr.type === 'text') {
      return 'text';
    }
    return 'button';
  };

  /**
   * Helper to find a representative image for a specific attribute value
   */
  const getThumbnailImageForValue = (attrName: string, valName: string, explicitImg?: string): string | undefined => {
    if (explicitImg) return explicitImg;
    const matchingVariant = activeVariants.find(v => {
      const vAttrs = v.attributes || v.attributeValues || {};
      const matchKey = Object.keys(vAttrs).find(k => normalizeAttributeKey(k) === normalizeAttributeKey(attrName));
      if (matchKey && normalizeAttributeVal(vAttrs[matchKey]) === normalizeAttributeVal(valName)) {
        return Boolean(v.image || (v.images && v.images.length > 0));
      }
      if (normalizeAttributeKey(attrName).toLowerCase().includes('color')) {
        const vColor = v.color || v.colorName || '';
        return normalizeAttributeVal(vColor) === normalizeAttributeVal(valName) && Boolean(v.image || (v.images && v.images.length > 0));
      }
      return false;
    });

    return matchingVariant?.image || matchingVariant?.images?.[0];
  };

  return (
    <div className="space-y-4 sm:space-y-5 pt-1">
      {/* 1. PRODUCT FAMILY MATRIX (Real Independent Linked Products) */}
      {hasFamilyColors && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              {familyAttrName}:
              <span className="text-emerald-700 font-extrabold normal-case text-xs">
                {activeFamilyColor?.attributeValue || activeFamilyColor?.color || product.familyAttributeValue || product.familyColorName || product.color || `Select ${familyAttrName}`}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {familyColorVariants.map((item) => {
              const isSelected = Boolean(
                item.isCurrentProduct ||
                item.productId === product.id ||
                (product.slug && item.productSlug === product.slug)
              );
              const isInStock = item.inStock;
              const thumbnailSrc = item.thumbnail;
              const itemLabel = item.attributeValue || item.color || item.productName;

              return (
                <button
                  key={item.productId}
                  type="button"
                  onClick={() => handleFamilyColorClick(item)}
                  title={`${itemLabel} ${!isInStock ? '(Out of Stock)' : ''}`}
                  className={`group relative rounded-xl transition-all flex flex-col items-center justify-center p-1.5 min-w-[62px] sm:min-w-[70px] max-w-[84px] cursor-pointer text-center ${
                    isSelected
                      ? 'border-2 border-emerald-600 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/20'
                      : !isInStock
                      ? 'border border-dashed border-gray-300 bg-gray-50/80 hover:border-gray-400'
                      : 'border border-gray-200 bg-white hover:border-gray-400 hover:shadow-2xs'
                  }`}
                >
                  {/* Image Thumbnail or Color Swatch */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center relative shrink-0">
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt={itemLabel}
                        className={`w-full h-full object-contain transition-transform group-hover:scale-105 ${
                          !isInStock ? 'grayscale opacity-60' : ''
                        }`}
                      />
                    ) : item.hex ? (
                      <span
                        className="w-7 h-7 rounded-full border border-gray-300 shadow-2xs"
                        style={{ backgroundColor: item.hex }}
                      />
                    ) : (
                      <span className="text-[10px] font-black uppercase text-gray-400">
                        {itemLabel.slice(0, 3)}
                      </span>
                    )}

                    {/* Out of Stock Strike / Ribbon */}
                    {!isInStock && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                          Out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Value / Color Name Label */}
                  <span
                    className={`text-[11px] font-bold mt-1.5 line-clamp-1 break-words w-full ${
                      isSelected
                        ? 'text-emerald-900 font-extrabold'
                        : !isInStock
                        ? 'text-gray-400'
                        : 'text-gray-700'
                    }`}
                  >
                    {itemLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. ATTRIBUTES (e.g. Size, RAM, Storage, etc.) */}
      {nonColorAttributes.map((attr) => {
        const attrName = normalizeAttributeKey(attr.name);
        const currentSelectedVal = selectedAttributes[attrName] || '';
        const displayType = getAttributeDisplayType(attr);
        const isSize = attrName.toLowerCase().includes('size');

        return (
          <div key={attr.id} className="space-y-2.5">
            {/* Attribute Label & Selected Value Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                {attr.name}:
                <span className="text-emerald-700 font-extrabold normal-case text-xs">
                  {currentSelectedVal || 'Select Option'}
                </span>
              </span>

              {isSize && showSizeChartButton && product.sizeChart && onOpenSizeChart && (
                <button
                  type="button"
                  onClick={onOpenSizeChart}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" /> Size Chart
                </button>
              )}
            </div>

            {/* 1. IMAGE / SWATCH DISPLAY (Visual Reference: Color + Thumbnails) */}
            {displayType === 'image' || displayType === 'swatch' ? (
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {(attr.values || []).map((val) => {
                  const valName = normalizeAttributeVal(val.name);
                  const isSelected = currentSelectedVal.toLowerCase() === valName.toLowerCase();
                  const availability = availabilityMatrix[attrName]?.[valName] || { available: true, inStock: true };
                  const isPossible = availability.available;
                  const isInStock = availability.inStock;
                  const thumbnailSrc = getThumbnailImageForValue(attr.name, val.name, val.image);

                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => handleAttributeValueClick(attrName, valName)}
                      disabled={!isPossible}
                      title={`${valName} ${!isPossible ? '(Unavailable combination)' : !isInStock ? '(Out of Stock)' : ''}`}
                      className={`group relative rounded-xl transition-all flex flex-col items-center justify-center p-1.5 min-w-[62px] sm:min-w-[70px] max-w-[84px] cursor-pointer text-center ${
                        isSelected
                          ? 'border-2 border-emerald-600 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-500/20'
                          : !isPossible
                          ? 'border border-gray-200 bg-gray-100/70 opacity-40 cursor-not-allowed'
                          : !isInStock
                          ? 'border border-dashed border-gray-300 bg-gray-50/80 hover:border-gray-400'
                          : 'border border-gray-200 bg-white hover:border-gray-400 hover:shadow-2xs'
                      }`}
                    >
                      {/* Image Thumbnail or Color Swatch */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center relative shrink-0">
                        {thumbnailSrc ? (
                          <img
                            src={thumbnailSrc}
                            alt={valName}
                            className={`w-full h-full object-contain transition-transform group-hover:scale-105 ${
                              !isPossible || !isInStock ? 'grayscale opacity-60' : ''
                            }`}
                          />
                        ) : val.hex ? (
                          <span
                            className="w-7 h-7 rounded-full border border-gray-300 shadow-2xs"
                            style={{ backgroundColor: val.hex }}
                          />
                        ) : (
                          <span className="text-[10px] font-black uppercase text-gray-400">
                            {valName.slice(0, 3)}
                          </span>
                        )}

                        {/* Out of Stock Strike / Ribbon */}
                        {!isInStock && isPossible && (
                          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="text-[8px] font-black uppercase tracking-tighter text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                              Out
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Color / Value Name Label */}
                      <span
                        className={`text-[11px] font-bold mt-1.5 line-clamp-1 break-words w-full ${
                          isSelected
                            ? 'text-emerald-900 font-extrabold'
                            : !isPossible
                            ? 'text-gray-400 line-through'
                            : !isInStock
                            ? 'text-gray-400'
                            : 'text-gray-700'
                        }`}
                      >
                        {valName}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : displayType === 'dropdown' ? (
              /* 2. DROPDOWN DISPLAY */
              <div className="relative max-w-xs">
                <select
                  value={currentSelectedVal}
                  onChange={(e) => handleAttributeValueClick(attrName, e.target.value)}
                  className="w-full text-xs font-bold border border-gray-200 rounded-xl py-2.5 px-3 bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 appearance-none cursor-pointer pr-8"
                >
                  <option value="" disabled>Select {attr.name}...</option>
                  {(attr.values || []).map((val) => {
                    const valName = normalizeAttributeVal(val.name);
                    const availability = availabilityMatrix[attrName]?.[valName] || { available: true, inStock: true };
                    const isPossible = availability.available;
                    const isInStock = availability.inStock;

                    return (
                      <option
                        key={val.id}
                        value={valName}
                        disabled={!isPossible}
                      >
                        {valName} {!isPossible ? '(Unavailable)' : !isInStock ? '(Out of Stock)' : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            ) : (
              /* 3. BUTTON PILL DISPLAY (e.g. Size [S] [M] [L] [XL], RAM, Storage, Capacity, etc.) */
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {(attr.values || []).map((val) => {
                  const valName = normalizeAttributeVal(val.name);
                  const isSelected = currentSelectedVal.toLowerCase() === valName.toLowerCase();
                  const availability = availabilityMatrix[attrName]?.[valName] || { available: true, inStock: true };
                  const isPossible = availability.available;
                  const isInStock = availability.inStock;

                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => handleAttributeValueClick(attrName, valName)}
                      disabled={!isPossible}
                      title={`${valName} ${!isPossible ? '(Unavailable)' : !isInStock ? '(Out of Stock)' : ''}`}
                      className={`min-w-[44px] px-3.5 py-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : !isPossible
                          ? 'border-gray-200 bg-gray-100/70 text-gray-300 opacity-40 cursor-not-allowed line-through'
                          : !isInStock
                          ? 'border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className={!isInStock && !isSelected ? 'line-through text-gray-400' : ''}>
                        {valName}
                      </span>
                      {!isInStock && isPossible && (
                        <span className={`text-[8px] uppercase ${isSelected ? 'text-emerald-100' : 'text-rose-500 font-bold'}`}>
                          (Out)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

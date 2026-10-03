import React from 'react';
import { Product, ProductVariant, VariantAttribute } from '../types';
import {
  getProductVariantAttributes,
  calculateAttributeAvailability,
  resolveValidVariantSelection,
  normalizeAttributeKey,
  normalizeAttributeVal
} from '../utilities/variantMatrixUtils';
import { Ruler, Check, AlertCircle } from 'lucide-react';

interface UniversalVariantSelectorProps {
  product: Product;
  selectedAttributes: Record<string, string>;
  selectedVariantId?: string;
  onSelectVariant: (variantId: string, updatedAttributes: Record<string, string>) => void;
  onOpenSizeChart?: () => void;
  showSizeChartButton?: boolean;
}

export default function UniversalVariantSelector({
  product,
  selectedAttributes,
  selectedVariantId,
  onSelectVariant,
  onOpenSizeChart,
  showSizeChartButton = true
}: UniversalVariantSelectorProps) {
  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');
  const attributes = getProductVariantAttributes(product);

  // If no attributes or no variants, do not render
  if (activeVariants.length === 0 || attributes.length === 0) {
    return null;
  }

  // Calculate combination-aware availability
  const availabilityMatrix = calculateAttributeAvailability(activeVariants, attributes, selectedAttributes);

  const handleAttributeValueClick = (attrName: string, valName: string) => {
    const { selectedAttributes: newSelection, variant } = resolveValidVariantSelection(
      activeVariants,
      attributes,
      selectedAttributes,
      attrName,
      valName
    );

    if (variant) {
      onSelectVariant(variant.id, newSelection);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pt-2">
      {attributes.map((attr) => {
        const attrName = normalizeAttributeKey(attr.name);
        const currentSelectedVal = selectedAttributes[attrName] || '';
        const isColor = attrName.toLowerCase().includes('color') || attrName.toLowerCase().includes('shade');
        const isSize = attrName.toLowerCase().includes('size');

        return (
          <div key={attr.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
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

            {/* Values Row / Swatches */}
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {(attr.values || []).map((val) => {
                const valName = normalizeAttributeVal(val.name);
                const isSelected = currentSelectedVal.toLowerCase() === valName.toLowerCase();
                const availability = availabilityMatrix[attrName]?.[valName] || { available: true, inStock: true };
                const isPossible = availability.available;
                const isInStock = availability.inStock;

                // Color swatch style
                if (isColor) {
                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => handleAttributeValueClick(attrName, valName)}
                      disabled={!isPossible}
                      title={`${valName} ${!isPossible ? '(Unavailable)' : !isInStock ? '(Out of Stock)' : ''}`}
                      className={`group relative px-3 py-2 rounded-xl border-2 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs ring-1 ring-emerald-500/20'
                          : !isPossible
                          ? 'border-gray-200 bg-gray-100/70 text-gray-400 opacity-40 cursor-not-allowed line-through'
                          : !isInStock
                          ? 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                          : 'border-gray-200 text-gray-800 bg-white hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {val.image ? (
                        <img
                          src={val.image}
                          alt={valName}
                          className="w-5 h-5 rounded-md object-contain border border-gray-200 bg-white shrink-0"
                        />
                      ) : val.hex ? (
                        <span
                          className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0 shadow-2xs"
                          style={{ backgroundColor: val.hex }}
                        />
                      ) : null}

                      <span className={!isInStock && !isSelected ? 'line-through' : ''}>
                        {valName}
                      </span>

                      {!isInStock && isPossible && (
                        <span className="text-[8px] font-black uppercase text-rose-500 tracking-wider">
                          Out
                        </span>
                      )}
                    </button>
                  );
                }

                // Standard pill button for all other attributes (Size, RAM, Storage, Capacity, Material, Pack Size, Style, Model, Custom)
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => handleAttributeValueClick(attrName, valName)}
                    disabled={!isPossible}
                    title={`${valName} ${!isPossible ? '(Unavailable)' : !isInStock ? '(Out of Stock)' : ''}`}
                    className={`min-w-[42px] px-3.5 py-2.5 rounded-xl border-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
          </div>
        );
      })}
    </div>
  );
}

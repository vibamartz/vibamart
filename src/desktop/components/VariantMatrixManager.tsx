import React, { useState } from 'react';
import { Product, ProductVariant, VariantAttribute, VariantAttributeValue } from '../../shared/types';
import {
  generateVariantMatrix,
  getVariantCombinationTitle,
  extractVariantAttributes,
  getCanonicalVariantKey,
  normalizeAttributeKey,
  normalizeAttributeVal
} from '../../shared/utilities/variantMatrixUtils';
import { VariantMultiImageInput } from './VariantImageInput';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Layers, Sparkles,
  Copy, Tag, Check, AlertCircle, RefreshCw, SlidersHorizontal, Image as ImageIcon,
  CheckCircle2, X, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import toast from 'react-hot-toast';

const COMMON_ATTRIBUTE_PRESETS = [
  'Color', 'Size', 'Storage', 'RAM', 'Capacity', 'Weight', 'Pack Size',
  'Material', 'Style', 'Model', 'Shoe Size', 'Shade', 'Flavor', 'Pattern'
];

interface VariantMatrixManagerProps {
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  baseProduct: Partial<Product>;
  onAttributesChange: (attributes: VariantAttribute[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
}

export default function VariantMatrixManager({
  attributes,
  variants,
  baseProduct,
  onAttributesChange,
  onVariantsChange
}: VariantMatrixManagerProps) {
  const [newAttributeName, setNewAttributeName] = useState('');
  const [newValueInputs, setNewValueInputs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'attributes' | 'matrix'>('attributes');
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [bulkStock, setBulkStock] = useState<string>('');
  const [bulkMrp, setBulkMrp] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);

  // --- ATTRIBUTE ACTIONS ---

  const addAttribute = (name: string) => {
    const cleanName = normalizeAttributeKey(name);
    if (!cleanName) return;

    if (attributes.some(a => a.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`Attribute "${cleanName}" already exists.`);
      return;
    }

    const isColor = cleanName.toLowerCase().includes('color') || cleanName.toLowerCase().includes('shade');
    const newAttr: VariantAttribute = {
      id: `attr_${Date.now()}_${cleanName.toLowerCase().replace(/\s+/g, '_')}`,
      name: cleanName,
      type: isColor ? 'color' : 'button',
      values: [],
      disabled: false
    };

    const updated = [...attributes, newAttr];
    onAttributesChange(updated);
    setNewAttributeName('');
    toast.success(`Added attribute "${cleanName}"`);
  };

  const removeAttribute = (attrId: string) => {
    const target = attributes.find(a => a.id === attrId);
    if (!target) return;
    if (window.confirm(`Remove attribute "${target.name}" and all its values?`)) {
      const updated = attributes.filter(a => a.id !== attrId);
      onAttributesChange(updated);
      toast.success(`Removed attribute "${target.name}"`);
    }
  };

  const toggleAttributeDisabled = (attrId: string) => {
    const updated = attributes.map(a => a.id === attrId ? { ...a, disabled: !a.disabled } : a);
    onAttributesChange(updated);
  };

  const moveAttribute = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= attributes.length) return;
    const updated = [...attributes];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onAttributesChange(updated);
  };

  // --- VALUE ACTIONS ---

  const addAttributeValue = (attrId: string, valueName: string) => {
    const cleanVal = normalizeAttributeVal(valueName);
    if (!cleanVal) return;

    const attr = attributes.find(a => a.id === attrId);
    if (!attr) return;

    if (attr.values.some(v => v.name.toLowerCase() === cleanVal.toLowerCase())) {
      toast.error(`Value "${cleanVal}" already exists in ${attr.name}.`);
      return;
    }

    const isColor = attr.name.toLowerCase().includes('color') || attr.name.toLowerCase().includes('shade');
    const newVal: VariantAttributeValue = {
      id: `val_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: cleanVal,
      hex: isColor ? '#000000' : undefined,
      disabled: false
    };

    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return { ...a, values: [...(a.values || []), newVal] };
    });

    onAttributesChange(updated);
    setNewValueInputs(prev => ({ ...prev, [attrId]: '' }));
  };

  const removeAttributeValue = (attrId: string, valId: string) => {
    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return { ...a, values: a.values.filter(v => v.id !== valId) };
    });
    onAttributesChange(updated);
  };

  const updateAttributeValueHex = (attrId: string, valId: string, hex: string) => {
    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return {
        ...a,
        values: a.values.map(v => v.id === valId ? { ...v, hex } : v)
      };
    });
    onAttributesChange(updated);
  };

  const toggleAttributeValueDisabled = (attrId: string, valId: string) => {
    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return {
        ...a,
        values: a.values.map(v => v.id === valId ? { ...v, disabled: !v.disabled } : v)
      };
    });
    onAttributesChange(updated);
  };

  // --- MATRIX GENERATION ---

  const handleGenerateMatrix = () => {
    const activeAttrs = attributes.filter(a => !a.disabled && a.values.some(v => !v.disabled && v.name.trim()));
    if (activeAttrs.length === 0) {
      toast.error('Add at least one attribute with values before generating the matrix.');
      return;
    }

    const newMatrix = generateVariantMatrix(attributes, baseProduct, variants);
    onVariantsChange(newMatrix);
    setActiveTab('matrix');
    toast.success(`Generated ${newMatrix.length} variants! Existing customizations preserved.`);
  };

  // --- VARIANT MANAGEMENT ACTIONS ---

  const addManualVariant = () => {
    const initialImg = baseProduct.primaryImage || (baseProduct.images?.[0] || '');
    const newV: ProductVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Custom Variant ${(variants?.length || 0) + 1}`,
      attributes: {},
      attributeValues: {},
      price: baseProduct.discountPrice || baseProduct.price || 0,
      mrp: baseProduct.mrp || baseProduct.price || 0,
      discountPrice: baseProduct.discountPrice || baseProduct.price || 0,
      discountPercentage: 0,
      stock: 10,
      lowStockThreshold: 2,
      sku: `${(baseProduct.sku || 'SKU').replace(/\s+/g, '-')}_VAR_${(variants?.length || 0) + 1}`,
      inStock: true,
      status: 'active',
      disabled: false,
      image: initialImg,
      images: initialImg ? [initialImg] : []
    };
    onVariantsChange([...(variants || []), newV]);
    setExpandedVariantId(newV.id);
    toast.success('Added new custom variant.');
  };

  const duplicateVariant = (variantId: string) => {
    const source = variants.find(v => v.id === variantId);
    if (!source) return;

    const cloned: ProductVariant = {
      ...source,
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${source.name || 'Variant'} (Copy)`,
      sku: `${source.sku || 'SKU'}-COPY`,
      attributes: { ...(source.attributes || {}) },
      attributeValues: { ...(source.attributeValues || {}) },
      images: [...(source.images || [])]
    };

    onVariantsChange([...variants, cloned]);
    toast.success('Variant duplicated.');
  };

  const removeVariant = (variantId: string) => {
    onVariantsChange(variants.filter(v => v.id !== variantId));
    toast.success('Variant removed.');
  };

  const toggleVariantDisabled = (variantId: string) => {
    onVariantsChange(
      variants.map(v => {
        if (v.id !== variantId) return v;
        const newDisabled = !v.disabled;
        return {
          ...v,
          disabled: newDisabled,
          status: newDisabled ? 'disabled' : (v.stock > 0 ? 'active' : 'out_of_stock')
        };
      })
    );
  };

  const updateVariant = (variantId: string, updates: Partial<ProductVariant>) => {
    onVariantsChange(
      variants.map(v => {
        if (v.id !== variantId) return v;
        const merged = { ...v, ...updates };

        // Auto calculate discount percentage
        const mrp = merged.mrp || 0;
        const price = merged.price || 0;
        if (mrp > price && mrp > 0) {
          merged.discountPercentage = Math.round(((mrp - price) / mrp) * 100);
          merged.discountPrice = price;
        }

        // Auto update inStock & status
        if (merged.disabled) {
          merged.status = 'disabled';
        } else if (merged.stock <= 0) {
          merged.status = 'out_of_stock';
          merged.inStock = false;
        } else {
          merged.status = 'active';
          merged.inStock = true;
        }

        return merged;
      })
    );
  };

  const moveVariant = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= variants.length) return;
    const updated = [...variants];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onVariantsChange(updated);
  };

  // --- BULK ACTIONS ---

  const applyBulkPrice = () => {
    const p = Number(bulkPrice);
    if (isNaN(p) || p < 0) return toast.error('Enter a valid price');
    onVariantsChange(variants.map(v => ({ ...v, price: p, discountPrice: p })));
    setBulkPrice('');
    toast.success(`Applied ₹${p} price to all variants`);
  };

  const applyBulkMrp = () => {
    const m = Number(bulkMrp);
    if (isNaN(m) || m < 0) return toast.error('Enter a valid MRP');
    onVariantsChange(variants.map(v => {
      const price = v.price || 0;
      const discount = m > price && m > 0 ? Math.round(((m - price) / m) * 100) : 0;
      return { ...v, mrp: m, discountPercentage: discount };
    }));
    setBulkMrp('');
    toast.success(`Applied ₹${m} MRP to all variants`);
  };

  const applyBulkStock = () => {
    const s = Number(bulkStock);
    if (isNaN(s) || s < 0) return toast.error('Enter a valid stock number');
    onVariantsChange(variants.map(v => ({
      ...v,
      stock: s,
      inStock: s > 0,
      status: v.disabled ? 'disabled' : (s > 0 ? 'active' : 'out_of_stock')
    })));
    setBulkStock('');
    toast.success(`Applied ${s} units stock to all variants`);
  };

  const autoGenerateSkus = () => {
    const baseSku = (baseProduct.sku || 'SKU').replace(/\s+/g, '-').toUpperCase();
    onVariantsChange(
      variants.map((v, idx) => {
        const comboKey = Object.values(extractVariantAttributes(v))
          .map(val => val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
          .filter(Boolean)
          .join('-');
        const skuSuffix = comboKey ? `-${comboKey}` : `_V${(idx + 1).toString().padStart(2, '0')}`;
        return {
          ...v,
          sku: `${baseSku}${skuSuffix}`
        };
      })
    );
    toast.success('Generated canonical SKUs for all variants.');
  };

  const totalPossibleCombos = attributes
    .filter(a => !a.disabled)
    .reduce((acc, a) => {
      const valCount = a.values.filter(v => !v.disabled && v.name.trim()).length;
      return valCount > 0 ? acc * valCount : acc;
    }, attributes.some(a => !a.disabled && a.values.some(v => !v.disabled && v.name.trim())) ? 1 : 0);

  return (
    <div className="bg-white p-6 sm:p-10 rounded-[36px] sm:rounded-[48px] border border-gray-100 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <Layers className="w-4 h-4" />
            </span>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">
              Universal Product Variant Matrix
            </h3>
          </div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1.5">
            Configure dynamic attributes (Color, Size, RAM, Storage, etc.) & generate automated Cartesian matrix
          </p>
        </div>

        {/* Tab Switcher & Generation Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('attributes')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'attributes'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              1. Attributes ({attributes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              2. Matrix ({variants.length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleGenerateMatrix}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Matrix {totalPossibleCombos > 0 ? `(${totalPossibleCombos})` : ''}
          </button>
        </div>
      </div>

      {/* TAB 1: ATTRIBUTES BUILDER */}
      {activeTab === 'attributes' && (
        <div className="space-y-8">
          {/* Quick Presets */}
          <div className="space-y-2.5 bg-gray-50/80 p-5 rounded-3xl border border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
              Quick Attribute Presets (Click to Add)
            </span>
            <div className="flex flex-wrap gap-2">
              {COMMON_ATTRIBUTE_PRESETS.map(preset => {
                const isAdded = attributes.some(a => a.name.toLowerCase() === preset.toLowerCase());
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => addAttribute(preset)}
                    disabled={isAdded}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 opacity-60 cursor-default'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-500 hover:text-emerald-700'
                    }`}
                  >
                    {isAdded ? <Check className="w-3 h-3 text-emerald-600" /> : <Plus className="w-3 h-3 text-gray-400" />}
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Custom Attribute Input */}
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={newAttributeName}
              onChange={e => setNewAttributeName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAttribute(newAttributeName);
                }
              }}
              placeholder="Custom Attribute Name (e.g. Battery Capacity, Wheel Size, Edition, Pack Count)..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600 transition-all"
            />
            <button
              type="button"
              onClick={() => addAttribute(newAttributeName)}
              className="px-6 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Attribute
            </button>
          </div>

          {/* Attributes List */}
          <div className="space-y-6">
            {attributes.map((attr, idx) => {
              const isColor = attr.name.toLowerCase().includes('color') || attr.name.toLowerCase().includes('shade');
              const valueInputVal = newValueInputs[attr.id] || '';

              return (
                <div
                  key={attr.id}
                  className={`p-6 sm:p-7 rounded-3xl border-2 transition-all space-y-5 ${
                    attr.disabled ? 'bg-gray-100/60 border-gray-200 opacity-70' : 'bg-gray-50/90 border-gray-200/80'
                  }`}
                >
                  {/* Attribute Row Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-gray-900 text-white text-xs font-black flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="text-sm font-black uppercase tracking-wider text-gray-900">
                          {attr.name}
                        </span>
                        <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase">
                          ({attr.values.length} values)
                        </span>
                      </div>
                      {attr.disabled && (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-full">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveAttribute(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        title="Move Attribute Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAttribute(idx, 'down')}
                        disabled={idx === attributes.length - 1}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        title="Move Attribute Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttributeDisabled(attr.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1 ${
                          attr.disabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {attr.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {attr.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAttribute(attr.id)}
                        className="p-2 bg-white text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-200"
                        title="Delete Attribute"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Values List */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                      Configured Values ({attr.name})
                    </span>

                    <div className="flex flex-wrap gap-2.5">
                      {attr.values.map(val => (
                        <div
                          key={val.id}
                          className={`group flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold bg-white transition-all shadow-2xs ${
                            val.disabled ? 'opacity-40 border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-emerald-400'
                          }`}
                        >
                          {isColor && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={val.hex || '#000000'}
                                onChange={e => updateAttributeValueHex(attr.id, val.id, e.target.value)}
                                className="w-5 h-5 rounded-md cursor-pointer border-0 p-0"
                                title="Pick Color Hex"
                              />
                              <span className="text-[9px] font-mono font-bold text-gray-400 uppercase">
                                {val.hex || '#000000'}
                              </span>
                            </div>
                          )}

                          <span className="text-gray-900">{val.name}</span>

                          <button
                            type="button"
                            onClick={() => toggleAttributeValueDisabled(attr.id, val.id)}
                            className="text-gray-300 hover:text-amber-600 transition-colors ml-1"
                            title={val.disabled ? 'Enable Value' : 'Disable Value'}
                          >
                            {val.disabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeAttributeValue(attr.id, val.id)}
                            className="text-gray-300 hover:text-rose-600 transition-colors ml-0.5"
                            title="Remove Value"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {attr.values.length === 0 && (
                        <span className="text-xs text-gray-400 italic py-1">
                          No values added yet. Type below to add options.
                        </span>
                      )}
                    </div>

                    {/* Add Value Input */}
                    <div className="flex gap-2 max-w-md pt-1">
                      <input
                        type="text"
                        value={valueInputVal}
                        onChange={e => setNewValueInputs(p => ({ ...p, [attr.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAttributeValue(attr.id, valueInputVal);
                          }
                        }}
                        placeholder={`Add ${attr.name} value (e.g. ${isColor ? 'Midnight Blue, Cosmic Black' : 'XL, 256GB, Pack of 2'})...`}
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold outline-none focus:border-emerald-600 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => addAttributeValue(attr.id, valueInputVal)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shrink-0"
                      >
                        + Add Value
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {attributes.length === 0 && (
              <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[32px]">
                No attributes configured. Click any preset button above or type a custom attribute name to begin.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VARIANT MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {/* Matrix Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/80 p-5 rounded-3xl border border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                Total Generated Combinations: <span className="text-emerald-700 font-black">{variants.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-700 hover:border-gray-900 transition-all flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3 h-3" />
                {showBulkActions ? 'Hide Bulk Operations' : 'Bulk Operations'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addManualVariant}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variant
              </button>
              <button
                type="button"
                onClick={handleGenerateMatrix}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-generate Matrix
              </button>
            </div>
          </div>

          {/* Bulk Operations Bar */}
          {showBulkActions && (
            <div className="p-6 bg-emerald-50/60 rounded-3xl border border-emerald-100 space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900 block">
                Bulk Update All {variants.length} Variants
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Selling Price (₹)"
                    value={bulkPrice}
                    onChange={e => setBulkPrice(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkPrice}
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="MRP (₹)"
                    value={bulkMrp}
                    onChange={e => setBulkMrp(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkMrp}
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Stock Units"
                    value={bulkStock}
                    onChange={e => setBulkStock(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkStock}
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800"
                  >
                    Apply
                  </button>
                </div>

                <button
                  type="button"
                  onClick={autoGenerateSkus}
                  className="w-full py-2 bg-white border border-emerald-300 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Auto SKUs
                </button>
              </div>
            </div>
          )}

          {/* Variants Matrix Cards */}
          <div className="space-y-4">
            {variants.map((v, idx) => {
              const isExpanded = expandedVariantId === v.id;
              const attrs = extractVariantAttributes(v);
              const comboTitle = v.name || getVariantCombinationTitle(attrs, `Variant #${idx + 1}`);
              const isOutOfStock = (v.stock ?? 0) <= 0;
              const isLowStock = !isOutOfStock && (v.stock ?? 0) <= (v.lowStockThreshold || 3);

              return (
                <div
                  key={v.id}
                  className={`rounded-3xl border-2 transition-all ${
                    v.disabled
                      ? 'bg-gray-100/70 border-gray-200 opacity-60'
                      : isOutOfStock
                      ? 'bg-rose-50/30 border-rose-100'
                      : 'bg-gray-50/80 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Variant Summary Header */}
                  <div className="p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>

                      {/* Variant Primary Thumbnail */}
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                        {v.images?.[0] || v.image ? (
                          <img
                            src={v.images?.[0] || v.image}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : v.colorHex ? (
                          <span className="w-5 h-5 rounded-full border border-gray-300" style={{ backgroundColor: v.colorHex }} />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-gray-300" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-gray-900 truncate">
                            {comboTitle}
                          </span>
                          {/* Status Badges */}
                          {v.disabled ? (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[9px] font-black uppercase rounded-md">
                              DISABLED
                            </span>
                          ) : isOutOfStock ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-md">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-md">
                              ACTIVE
                            </span>
                          )}
                          {isLowStock && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded-md">
                              LOW STOCK
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 mt-0.5 flex-wrap">
                          <span>SKU: {v.sku || 'N/A'}</span>
                          <span>•</span>
                          <span>Price: ₹{(v.price ?? 0).toLocaleString()}</span>
                          <span>•</span>
                          <span>Stock: {v.stock ?? 0} units</span>
                          {v.images && v.images.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{v.images.length} images</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveVariant(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveVariant(idx, 'down')}
                        disabled={idx === variants.length - 1}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateVariant(v.id)}
                        className="p-2 bg-white text-gray-700 hover:text-emerald-700 rounded-xl border border-gray-200"
                        title="Duplicate Variant"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVariantDisabled(v.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1 ${
                          v.disabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {v.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {v.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeVariant(v.id)}
                        className="p-2 bg-white text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-200"
                        title="Delete Variant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedVariantId(isExpanded ? null : v.id)}
                        className="p-2 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-100"
                        title={isExpanded ? 'Collapse' : 'Expand Details'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Edit Form */}
                  {isExpanded && (
                    <div className="p-6 sm:p-8 border-t border-gray-200/80 bg-white rounded-b-3xl space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Variant Display Title */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Variant Title / Display Name
                          </label>
                          <input
                            type="text"
                            value={v.name || ''}
                            onChange={e => updateVariant(v.id, { name: e.target.value })}
                            placeholder="e.g. Midnight Black / 256GB"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* SKU */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            SKU Identifier
                          </label>
                          <input
                            type="text"
                            value={v.sku || ''}
                            onChange={e => updateVariant(v.id, { sku: e.target.value })}
                            placeholder="SKU-XXX-01"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Barcode / Optional Code */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Barcode / EAN (Optional)
                          </label>
                          <input
                            type="text"
                            value={v.barcode || ''}
                            onChange={e => updateVariant(v.id, { barcode: e.target.value })}
                            placeholder="8900 0000 XXXX"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Selling Price */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Selling Price (₹)
                          </label>
                          <input
                            type="number"
                            value={v.price ?? 0}
                            onChange={e => updateVariant(v.id, { price: Number(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* MRP */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            MRP (₹)
                          </label>
                          <input
                            type="number"
                            value={v.mrp ?? (v.price || 0)}
                            onChange={e => updateVariant(v.id, { mrp: Number(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Stock Units */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Stock Units
                          </label>
                          <input
                            type="number"
                            value={v.stock ?? 0}
                            onChange={e => updateVariant(v.id, { stock: Number(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Low Stock Threshold */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Low Stock Alert Threshold
                          </label>
                          <input
                            type="number"
                            value={v.lowStockThreshold ?? 2}
                            onChange={e => updateVariant(v.id, { lowStockThreshold: Number(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Weight */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Weight (e.g. 0.5 kg, 200g)
                          </label>
                          <input
                            type="text"
                            value={typeof v.weight === 'string' || typeof v.weight === 'number' ? v.weight : ''}
                            onChange={e => updateVariant(v.id, { weight: e.target.value })}
                            placeholder="e.g. 250g, 1.2kg"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>

                        {/* Dimensions */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Dimensions (L × W × H)
                          </label>
                          <input
                            type="text"
                            value={typeof v.dimensions === 'string' ? v.dimensions : ''}
                            onChange={e => updateVariant(v.id, { dimensions: e.target.value })}
                            placeholder="e.g. 15 x 8 x 2 cm"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                          />
                        </div>
                      </div>

                      {/* Variant Images Gallery */}
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                          Variant-Specific Images (Up to 10 images)
                        </span>
                        <VariantMultiImageInput
                          images={v.images || (v.image ? [v.image] : [])}
                          onChange={imgs => updateVariant(v.id, { images: imgs, image: imgs[0] || '' })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {variants.length === 0 && (
              <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[32px]">
                No variants generated. Go to "1. Attributes" tab and click "Generate Matrix", or click "Add Variant" above.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

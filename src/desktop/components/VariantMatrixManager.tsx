import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, VariantAttribute, VariantAttributeValue } from '../../shared/types';
import { db } from '../../backend/firebase/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  generateVariantMatrix,
  getVariantCombinationTitle,
  extractVariantAttributes,
  getCanonicalVariantKey,
  normalizeAttributeKey,
  normalizeAttributeVal,
  CATEGORY_VARIANT_TEMPLATES,
  isCircularProductLink,
  validateVariantMatrixUniqueness
} from '../../shared/utilities/variantMatrixUtils';
import { VariantMultiImageInput } from './VariantImageInput';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Layers, Sparkles,
  Copy, Tag, Check, AlertCircle, RefreshCw, SlidersHorizontal, Image as ImageIcon,
  CheckCircle2, X, ChevronDown, ChevronUp, Package, Link2, ExternalLink, Search, Unlink,
  LayoutGrid, Table as TableIcon, Bookmark, ShieldAlert, CheckSquare, Square
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
  const [matrixViewMode, setMatrixViewMode] = useState<'table' | 'cards'>('table');
  const [showCategoryTemplates, setShowCategoryTemplates] = useState(false);
  const [bulkPrice, setBulkPrice] = useState<string>('');
  const [bulkStock, setBulkStock] = useState<string>('');
  const [bulkMrp, setBulkMrp] = useState<string>('');
  const [bulkLowStock, setBulkLowStock] = useState<string>('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null);

  // --- LINKED PRODUCTS CATALOG STATE & MODAL ---
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [linkedProductModalTarget, setLinkedProductModalTarget] = useState<{
    type: 'attributeValue' | 'variant';
    attrId?: string;
    valId?: string;
    variantId?: string;
    currentLinkedId?: string;
    title?: string;
  } | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setLoadingProducts(true);
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (isMounted) {
          const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
          setAvailableProducts(prods);
        }
      } catch (err) {
        console.warn('Error fetching products for variant linking:', err);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    };
    fetchCatalog();
    return () => { isMounted = false; };
  }, []);

  const assignLinkedProductToValue = (attrId: string, valId: string, productToLink: Product) => {
    // Check for circular linking to avoid infinite navigation loops
    if (baseProduct.id && isCircularProductLink(baseProduct.id, productToLink.id, availableProducts)) {
      toast.error(`Cannot link "${productToLink.name}": Circular relationship detected (product already links back).`);
      return;
    }

    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return {
        ...a,
        values: a.values.map(v => {
          if (v.id !== valId) return v;
          return {
            ...v,
            linkedProductId: productToLink.id,
            linkedProductName: productToLink.name,
            image: v.image || productToLink.primaryImage || productToLink.images?.[0] || undefined
          };
        })
      };
    });
    onAttributesChange(updated);
    setLinkedProductModalTarget(null);
    toast.success(`Linked product "${productToLink.name}" to variant value.`);
  };

  const removeLinkedProductFromValue = (attrId: string, valId: string) => {
    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return {
        ...a,
        values: a.values.map(v => {
          if (v.id !== valId) return v;
          const copy = { ...v };
          delete copy.linkedProductId;
          delete copy.linkedProductName;
          return copy;
        })
      };
    });
    onAttributesChange(updated);
    toast.success('Removed linked product.');
  };

  const assignLinkedProductToVariant = (variantId: string, productToLink: Product) => {
    if (baseProduct.id && isCircularProductLink(baseProduct.id, productToLink.id, availableProducts)) {
      toast.error(`Cannot link "${productToLink.name}": Circular relationship detected (product already links back).`);
      return;
    }

    onVariantsChange(
      variants.map(v => {
        if (v.id !== variantId) return v;
        return {
          ...v,
          linkedProductId: productToLink.id,
          linkedProductName: productToLink.name,
          image: v.image || productToLink.primaryImage || productToLink.images?.[0] || undefined
        };
      })
    );
    setLinkedProductModalTarget(null);
    toast.success(`Linked product "${productToLink.name}" to variant combination.`);
  };

  const removeLinkedProductFromVariant = (variantId: string) => {
    onVariantsChange(
      variants.map(v => {
        if (v.id !== variantId) return v;
        const copy = { ...v };
        delete copy.linkedProductId;
        delete copy.linkedProductName;
        return copy;
      })
    );
    toast.success('Removed linked product from variant.');
  };

  const filteredCatalogProducts = availableProducts.filter(p => {
    if (baseProduct.id && p.id === baseProduct.id) return false;
    if (!productSearchTerm.trim()) return true;
    const term = productSearchTerm.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.id && p.id.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.productCode && p.productCode.toLowerCase().includes(term)) ||
      (p.brand && p.brand.toLowerCase().includes(term))
    );
  });

  // --- CATEGORY TEMPLATES APPLIER ---
  const applyCategoryTemplate = (tpl: typeof CATEGORY_VARIANT_TEMPLATES[0]) => {
    const newAttrs: VariantAttribute[] = tpl.attributes.map((a, idx) => ({
      id: `attr_${Date.now()}_${idx}_${a.name.toLowerCase().replace(/\s+/g, '_')}`,
      name: a.name,
      displayType: a.displayType,
      type: a.name.toLowerCase().includes('color') ? 'color' : 'button',
      values: (a.suggestedValues || []).map((valName, vIdx) => ({
        id: `val_${Date.now()}_${idx}_${vIdx}`,
        name: valName,
        hex: a.name.toLowerCase().includes('color') ? '#000000' : undefined,
        disabled: false
      })),
      disabled: false
    }));
    onAttributesChange(newAttrs);
    setShowCategoryTemplates(false);
    toast.success(`Applied "${tpl.name}" category template.`);
  };

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
      displayType: isColor ? 'image' : 'button',
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

  const updateAttributeDisplayType = (attrId: string, displayType: 'image' | 'button' | 'dropdown' | 'text' | 'swatch') => {
    const updated = attributes.map(a => (a.id === attrId ? { ...a, displayType } : a));
    onAttributesChange(updated);
  };

  const toggleAttributeValueDisabled = (attrId: string, valId: string) => {
    const updated = attributes.map(a => {
      if (a.id !== attrId) return a;
      return {
        ...a,
        values: a.values.map(v => (v.id === valId ? { ...v, disabled: !v.disabled } : v))
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
    toast.success(`Generated ${newMatrix.length} variants! Existing records preserved safely.`);
  };

  // --- VARIANT MANAGEMENT ACTIONS ---

  const addManualVariant = () => {
    const initialImg = baseProduct.primaryImage || (baseProduct.images?.[0] || '');
    const newV: ProductVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: baseProduct.id,
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
      isArchived: false,
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

  const applyBulkLowStockThreshold = () => {
    const t = Number(bulkLowStock);
    if (isNaN(t) || t < 0) return toast.error('Enter a valid threshold');
    onVariantsChange(variants.map(v => ({ ...v, lowStockThreshold: t })));
    setBulkLowStock('');
    toast.success(`Applied threshold of ${t} to all variants`);
  };

  const toggleAllVariantsStatus = (enable: boolean) => {
    onVariantsChange(variants.map(v => ({
      ...v,
      disabled: !enable,
      status: !enable ? 'disabled' : (v.stock > 0 ? 'active' : 'out_of_stock')
    })));
    toast.success(`${enable ? 'Enabled' : 'Disabled'} all variants`);
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

  const uniquenessValidation = validateVariantMatrixUniqueness(variants);
  const activeAttributesList = attributes.filter(a => !a.disabled);

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
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
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
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
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
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Matrix {totalPossibleCombos > 0 ? `(${totalPossibleCombos})` : ''}
          </button>
        </div>
      </div>

      {/* TAB 1: ATTRIBUTES BUILDER */}
      {activeTab === 'attributes' && (
        <div className="space-y-8">
          {/* Category Variant Templates Bar */}
          <div className="bg-emerald-50/70 p-5 rounded-3xl border border-emerald-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                  Category Variant Templates
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">
                  (Click any preset to pre-fill standard attributes)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryTemplates(!showCategoryTemplates)}
                className="px-3 py-1.5 bg-white text-emerald-800 rounded-xl text-[10px] font-black uppercase border border-emerald-300 shadow-2xs hover:bg-emerald-100 transition-all cursor-pointer self-start sm:self-auto"
              >
                {showCategoryTemplates ? 'Hide Category Templates' : 'Browse All Templates'}
              </button>
            </div>

            {showCategoryTemplates && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-200/60">
                {CATEGORY_VARIANT_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyCategoryTemplate(tpl)}
                    className="p-3 bg-white hover:bg-emerald-100/60 rounded-2xl border border-emerald-200 text-left transition-all group cursor-pointer shadow-2xs"
                  >
                    <span className="text-xs font-black text-gray-900 group-hover:text-emerald-900 block truncate">
                      {tpl.name}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-emerald-700 mt-0.5 block">
                      {tpl.attributes.map(a => a.name).join(' + ')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Attribute Presets */}
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
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
              className="px-6 py-3.5 bg-gray-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer"
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Display Type Selector */}
                      <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-gray-200">
                        <span className="text-[9px] font-black uppercase text-gray-400">Display:</span>
                        <select
                          value={attr.displayType || (isColor ? 'image' : 'button')}
                          onChange={e => updateAttributeDisplayType(attr.id, e.target.value as any)}
                          className="text-[11px] font-bold bg-transparent border-0 outline-none text-gray-700 cursor-pointer"
                        >
                          <option value="image">Image / Thumbnail</option>
                          <option value="swatch">Color Swatch</option>
                          <option value="button">Button / Pill</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="text">Text</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => moveAttribute(idx, 'up')}
                        disabled={idx === 0}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200 cursor-pointer"
                        title="Move Attribute Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAttribute(idx, 'down')}
                        disabled={idx === attributes.length - 1}
                        className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200 cursor-pointer"
                        title="Move Attribute Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttributeDisabled(attr.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1 cursor-pointer ${
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
                        className="p-2 bg-white text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer"
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

                    <div className="flex flex-wrap gap-3">
                      {attr.values.map(val => (
                        <div
                          key={val.id}
                          className={`group flex flex-col gap-2 p-3 rounded-2xl border text-xs bg-white transition-all shadow-2xs min-w-[200px] max-w-xs ${
                            val.disabled ? 'opacity-50 border-gray-200 bg-gray-50' : 'border-gray-200 hover:border-emerald-400'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              {isColor && (
                                <div className="flex items-center gap-1.5 shrink-0">
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
                              <span className="text-gray-900 font-black truncate">{val.name}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleAttributeValueDisabled(attr.id, val.id)}
                                className="text-gray-300 hover:text-amber-600 transition-colors p-1 rounded-md hover:bg-gray-100 cursor-pointer"
                                title={val.disabled ? 'Enable Value' : 'Disable Value'}
                              >
                                {val.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => removeAttributeValue(attr.id, val.id)}
                                className="text-gray-300 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-gray-100 cursor-pointer"
                                title="Remove Value"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Linked Product Selection */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                            {val.linkedProductId ? (
                              <div className="flex items-center justify-between w-full bg-emerald-50 text-emerald-900 px-2.5 py-1.5 rounded-xl border border-emerald-200 gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="text-[11px] font-bold truncate" title={val.linkedProductName || val.linkedProductId}>
                                    {val.linkedProductName || `ID: ${val.linkedProductId}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProductSearchTerm('');
                                      setLinkedProductModalTarget({
                                        type: 'attributeValue',
                                        attrId: attr.id,
                                        valId: val.id,
                                        currentLinkedId: val.linkedProductId,
                                        title: `${attr.name}: ${val.name}`
                                      });
                                    }}
                                    className="text-[10px] font-black uppercase text-emerald-700 hover:text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs cursor-pointer"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLinkedProductFromValue(attr.id, val.id)}
                                    className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-md cursor-pointer"
                                    title="Unlink Product"
                                  >
                                    <Unlink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearchTerm('');
                                  setLinkedProductModalTarget({
                                    type: 'attributeValue',
                                    attrId: attr.id,
                                    valId: val.id,
                                    title: `${attr.name}: ${val.name}`
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg border border-dashed border-gray-300 transition-colors cursor-pointer"
                              >
                                <Link2 className="w-3 h-3 text-gray-400" />
                                Link Product
                              </button>
                            )}
                          </div>
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
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shrink-0 cursor-pointer"
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
          {/* Uniqueness Alert Banner if issues exist */}
          {!uniquenessValidation.isValid && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-black text-amber-900 uppercase tracking-wider block">
                  Variant Matrix Uniqueness Notice
                </span>
                {uniquenessValidation.duplicateSkus.length > 0 && (
                  <p className="text-amber-800 font-bold">
                    Duplicate SKUs detected: {uniquenessValidation.duplicateSkus.join(', ')}. Please ensure each SKU is unique or click "Auto SKUs" in Bulk Operations.
                  </p>
                )}
                {uniquenessValidation.duplicateKeys.length > 0 && (
                  <p className="text-amber-800 font-bold">
                    Duplicate combination keys found: {uniquenessValidation.duplicateKeys.join(', ')}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Matrix Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/80 p-5 rounded-3xl border border-gray-100">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                Total Combinations: <span className="text-emerald-700 font-black">{variants.length}</span>
              </span>

              {/* View Mode Switcher */}
              <div className="flex p-0.5 bg-gray-200/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    matrixViewMode === 'table' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  <TableIcon className="w-3 h-3" /> Table
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('cards')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    matrixViewMode === 'cards' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" /> Cards
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-700 hover:border-gray-900 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                {showBulkActions ? 'Hide Bulk Operations' : 'Bulk Operations'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addManualVariant}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Variant
              </button>
              <button
                type="button"
                onClick={handleGenerateMatrix}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-generate Matrix
              </button>
            </div>
          </div>

          {/* Bulk Operations Bar */}
          {showBulkActions && (
            <div className="p-6 bg-emerald-50/60 rounded-3xl border border-emerald-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900 block">
                  Bulk Operations on All {variants.length} Variants
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAllVariantsStatus(true)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAllVariantsStatus(false)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase cursor-pointer"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="flex gap-1.5">
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
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex gap-1.5">
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
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex gap-1.5">
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
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Low Stock Alert"
                    value={bulkLowStock}
                    onChange={e => setBulkLowStock(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyBulkLowStockThreshold}
                    className="px-3 py-2 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase shrink-0 hover:bg-emerald-800 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <button
                  type="button"
                  onClick={autoGenerateSkus}
                  className="w-full py-2 bg-white border border-emerald-300 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Auto SKUs
                </button>
              </div>
            </div>
          )}

          {/* VIEW 1: MATRIX TABLE VIEW */}
          {matrixViewMode === 'table' && (
            <div className="overflow-x-auto border border-gray-200 rounded-3xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100/80 text-[10px] font-black uppercase text-gray-500 tracking-wider border-b border-gray-200">
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-3 w-14">Image</th>
                    {activeAttributesList.map(a => (
                      <th key={a.id} className="py-3 px-3">{a.name}</th>
                    ))}
                    <th className="py-3 px-3 min-w-[130px]">SKU</th>
                    <th className="py-3 px-3 min-w-[90px]">MRP (₹)</th>
                    <th className="py-3 px-3 min-w-[90px]">Price (₹)</th>
                    <th className="py-3 px-3 min-w-[80px]">Stock</th>
                    <th className="py-3 px-3 min-w-[130px]">Linked Product</th>
                    <th className="py-3 px-3 min-w-[90px]">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {variants.map((v, idx) => {
                    const attrs = extractVariantAttributes(v);
                    const isOutOfStock = (v.stock ?? 0) <= 0;

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-gray-50/80 transition-colors ${
                          v.disabled ? 'opacity-50 bg-gray-50' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-bold text-gray-400">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                            {v.images?.[0] || v.image ? (
                              <img src={v.images?.[0] || v.image} alt="" className="w-full h-full object-contain" />
                            ) : v.colorHex ? (
                              <span className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: v.colorHex }} />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                            )}
                          </div>
                        </td>

                        {activeAttributesList.map(a => {
                          const val = attrs[normalizeAttributeKey(a.name)] || '-';
                          return (
                            <td key={a.id} className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">
                              {val}
                            </td>
                          );
                        })}

                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={v.sku || ''}
                            onChange={e => updateVariant(v.id, { sku: e.target.value })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none focus:bg-white focus:border-emerald-600"
                            placeholder="SKU"
                          />
                        </td>

                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={v.mrp ?? ''}
                            onChange={e => updateVariant(v.id, { mrp: Number(e.target.value) })}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                            placeholder="0"
                          />
                        </td>

                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={v.price ?? ''}
                            onChange={e => updateVariant(v.id, { price: Number(e.target.value) })}
                            className="w-full bg-emerald-50/50 border border-emerald-200 text-emerald-900 rounded-lg px-2.5 py-1.5 text-xs font-extrabold outline-none focus:bg-white focus:border-emerald-600"
                            placeholder="0"
                          />
                        </td>

                        <td className="py-3 px-3">
                          <input
                            type="number"
                            value={v.stock ?? 0}
                            onChange={e => updateVariant(v.id, { stock: Number(e.target.value) })}
                            className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:bg-white ${
                              isOutOfStock
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-gray-50 border-gray-200 text-gray-900'
                            }`}
                          />
                        </td>

                        <td className="py-3 px-3">
                          {v.linkedProductId ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 px-2 py-1 rounded-lg border border-emerald-200 max-w-[140px]">
                              <span className="truncate text-[11px] font-bold" title={v.linkedProductName || v.linkedProductId}>
                                {v.linkedProductName || v.linkedProductId}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeLinkedProductFromVariant(v.id)}
                                className="text-rose-500 hover:text-rose-700 cursor-pointer shrink-0"
                                title="Unlink"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setProductSearchTerm('');
                                setLinkedProductModalTarget({
                                  type: 'variant',
                                  variantId: v.id,
                                  title: v.name || `Variant #${idx + 1}`
                                });
                              }}
                              className="text-[10px] font-bold text-gray-500 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 border border-dashed border-gray-300 rounded-lg px-2 py-1 cursor-pointer"
                            >
                              + Link
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => toggleVariantDisabled(v.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                              v.disabled
                                ? 'bg-gray-200 text-gray-600'
                                : isOutOfStock
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {v.disabled ? 'Disabled' : isOutOfStock ? 'Out' : 'Active'}
                          </button>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateVariant(v.id)}
                              className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                              title="Duplicate"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMatrixViewMode('cards');
                                setExpandedVariantId(v.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer"
                              title="Edit Details & Images"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariant(v.id)}
                              className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: VARIANTS MATRIX CARDS */}
          {matrixViewMode === 'cards' && (
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
                          className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveVariant(idx, 'down')}
                          disabled={idx === variants.length - 1}
                          className="p-2 bg-white rounded-xl text-gray-400 hover:text-gray-900 disabled:opacity-30 border border-gray-200 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateVariant(v.id)}
                          className="p-2 bg-white text-gray-700 hover:text-emerald-700 rounded-xl border border-gray-200 cursor-pointer"
                          title="Duplicate Variant"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVariantDisabled(v.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1 cursor-pointer ${
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
                          className="p-2 bg-white text-rose-500 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer"
                          title="Delete Variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedVariantId(isExpanded ? null : v.id)}
                          className="p-2 bg-white text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-100 cursor-pointer"
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

                          {/* Barcode */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              Barcode / UPC (Optional)
                            </label>
                            <input
                              type="text"
                              value={v.barcode || ''}
                              onChange={e => updateVariant(v.id, { barcode: e.target.value })}
                              placeholder="890123456789"
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
                              value={v.price ?? ''}
                              onChange={e => updateVariant(v.id, { price: Number(e.target.value) })}
                              className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-950 outline-none focus:bg-white focus:border-emerald-600"
                            />
                          </div>

                          {/* MRP */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              MRP (₹)
                            </label>
                            <input
                              type="number"
                              value={v.mrp ?? ''}
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
                              Low-Stock Threshold
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
                              Weight (Optional)
                            </label>
                            <input
                              type="text"
                              value={typeof v.weight === 'string' || typeof v.weight === 'number' ? v.weight : ''}
                              onChange={e => updateVariant(v.id, { weight: e.target.value })}
                              placeholder="e.g. 250g / 1.2kg"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                            />
                          </div>

                          {/* Dimensions */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              Dimensions (Optional)
                            </label>
                            <input
                              type="text"
                              value={typeof v.dimensions === 'string' ? v.dimensions : ''}
                              onChange={e => updateVariant(v.id, { dimensions: e.target.value })}
                              placeholder="e.g. 15 x 8 x 2 cm"
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-emerald-600"
                            />
                          </div>

                          {/* Linked Product for Variant */}
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              Linked Existing ViBa Product (Optional)
                            </label>
                            {v.linkedProductId ? (
                              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-bold text-emerald-950 truncate">
                                    {v.linkedProductName || v.linkedProductId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProductSearchTerm('');
                                      setLinkedProductModalTarget({
                                        type: 'variant',
                                        variantId: v.id,
                                        currentLinkedId: v.linkedProductId,
                                        title: comboTitle
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-white text-emerald-700 text-[10px] font-black uppercase rounded border border-emerald-300 cursor-pointer"
                                  >
                                    Change
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLinkedProductFromVariant(v.id)}
                                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                    title="Unlink"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearchTerm('');
                                  setLinkedProductModalTarget({
                                    type: 'variant',
                                    variantId: v.id,
                                    title: comboTitle
                                  });
                                }}
                                className="w-full py-2.5 px-3 bg-gray-50 hover:bg-emerald-50 text-gray-600 hover:text-emerald-800 border border-dashed border-gray-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5" /> Link to Existing ViBa Product
                              </button>
                            )}
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
            </div>
          )}

          {variants.length === 0 && (
            <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[32px]">
              No variants generated. Go to "1. Attributes" tab and click "Generate Matrix", or click "Add Variant" above.
            </div>
          )}
        </div>
      )}

      {/* --- LINKED PRODUCT SELECTION MODAL --- */}
      {linkedProductModalTarget && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-gray-100 shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 sm:p-7 border-b border-gray-100 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <h4 className="text-lg font-black text-gray-900 tracking-tight">
                    Link ViBa Mart Product
                  </h4>
                </div>
                <p className="text-xs text-gray-400 font-bold mt-1">
                  Target: <span className="text-emerald-700 font-black">{linkedProductModalTarget.title || 'Variant Item'}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLinkedProductModalTarget(null)}
                className="p-2.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-5 sm:p-6 border-b border-gray-100 bg-gray-50/70">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={e => setProductSearchTerm(e.target.value)}
                  placeholder="Search products by name, product code, SKU, or ID..."
                  autoFocus
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3 text-xs font-bold outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
                {productSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setProductSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 px-1 text-[11px] font-bold text-gray-400">
                <span>Showing {filteredCatalogProducts.length} existing products</span>
                {loadingProducts && <span className="text-emerald-600 animate-pulse">Loading catalog...</span>}
              </div>
            </div>

            {/* Modal Product List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
              {filteredCatalogProducts.map(prod => {
                const isSelected = prod.id === linkedProductModalTarget.currentLinkedId;
                const prodImg = prod.primaryImage || (prod.images && prod.images[0]) || '';
                const price = prod.discountPrice || prod.price || 0;

                return (
                  <div
                    key={prod.id}
                    className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Thumbnail & Product Details */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                        {prodImg ? (
                          <img src={prodImg} alt={prod.name} className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-300" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-900 truncate">
                            {prod.name}
                          </span>
                          {prod.status === 'active' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-md shrink-0">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase rounded-md shrink-0">
                              {prod.status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 mt-0.5 flex-wrap">
                          <span className="text-gray-900 font-extrabold">₹{price.toLocaleString()}</span>
                          {prod.mrp && prod.mrp > price && (
                            <span className="line-through text-gray-400">₹{prod.mrp.toLocaleString()}</span>
                          )}
                          <span>•</span>
                          <span>Stock: {prod.stock ?? 0}</span>
                          <span>•</span>
                          <span className="font-mono">{prod.sku || prod.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 flex items-center gap-2">
                      {isSelected ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (linkedProductModalTarget.type === 'attributeValue' && linkedProductModalTarget.attrId && linkedProductModalTarget.valId) {
                              assignLinkedProductToValue(linkedProductModalTarget.attrId, linkedProductModalTarget.valId, prod);
                            } else if (linkedProductModalTarget.type === 'variant' && linkedProductModalTarget.variantId) {
                              assignLinkedProductToVariant(linkedProductModalTarget.variantId, prod);
                            }
                          }}
                          className="px-4 py-2 bg-gray-900 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                        >
                          Select Product
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredCatalogProducts.length === 0 && (
                <div className="py-12 text-center text-gray-400 font-bold italic">
                  No existing products matched your search "{productSearchTerm}".
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              {linkedProductModalTarget.currentLinkedId ? (
                <button
                  type="button"
                  onClick={() => {
                    if (linkedProductModalTarget.type === 'attributeValue' && linkedProductModalTarget.attrId && linkedProductModalTarget.valId) {
                      removeLinkedProductFromValue(linkedProductModalTarget.attrId, linkedProductModalTarget.valId);
                    } else if (linkedProductModalTarget.type === 'variant' && linkedProductModalTarget.variantId) {
                      removeLinkedProductFromVariant(linkedProductModalTarget.variantId);
                    }
                    setLinkedProductModalTarget(null);
                  }}
                  className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Remove Current Link
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setLinkedProductModalTarget(null)}
                className="px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

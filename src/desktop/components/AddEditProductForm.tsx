import React, { useState, useRef, useEffect } from 'react';
import { collection, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import { Product, ProductVariant, LocationAvailabilityRule } from '../../shared/types';
import { CATEGORIES } from '../../shared/constants';
import toast from 'react-hot-toast';
import { Upload, X, Check, Search, Copy, Sparkles, Hash, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Layers, FileText, Bookmark, Tag, Filter, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useCategoryStore, useSettingsStore } from '../../backend/store';
import { ProductImageUploader, KEYWORD_SUGGESTIONS } from '../pages/AdminDashboard';
import { VariantImageInput, VariantMultiImageInput } from './VariantImageInput';
import ProductLocationManager from './ProductLocationManager';
import VariantMatrixManager from './VariantMatrixManager';
import {
  getProductVariantAttributes,
  extractVariantAttributes,
  getVariantCombinationTitle,
  getCanonicalVariantKey,
  extractProductSizes
} from '../../shared/utilities/variantMatrixUtils';

import { createSlug } from '../../shared/utilities/slug';
import { generateUniqueProductCode, formatProductCode, validateProductCode, isProductCodeUnique } from '../../shared/utilities/productCode';
import { query, orderBy, getDocs } from 'firebase/firestore';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import { processAllProductImages } from '../../backend/services/productStorageService';

export interface SpecificationPreset {
  id: string;
  name: string;
  categoryName?: string;
  isSystem?: boolean;
  specifications: { key: string; value: string }[];
}

const DEFAULT_SPEC_PRESETS: SpecificationPreset[] = [
  {
    id: 'preset_smartphones',
    name: 'Smartphones & Mobile Devices',
    categoryName: 'Electronics',
    isSystem: true,
    specifications: [
      { key: 'Brand', value: '' },
      { key: 'Model Name', value: '' },
      { key: 'Operating System', value: 'Android / iOS' },
      { key: 'RAM / Internal Storage', value: '8GB RAM / 128GB Storage' },
      { key: 'Processor', value: 'Octa-core Processor' },
      { key: 'Display Size & Type', value: '6.5" AMOLED 120Hz' },
      { key: 'Primary Camera', value: '50 MP Dual Camera' },
      { key: 'Front Camera', value: '16 MP Selfie Camera' },
      { key: 'Battery Capacity', value: '5000 mAh' },
      { key: 'Network / Connectivity', value: '5G, Wi-Fi 6, Bluetooth 5.3' },
      { key: 'Warranty', value: '1 Year Manufacturer Warranty' }
    ]
  },
  {
    id: 'preset_laptops',
    name: 'Laptops & Computers',
    categoryName: 'Electronics',
    isSystem: true,
    specifications: [
      { key: 'Brand', value: '' },
      { key: 'Model Name', value: '' },
      { key: 'Processor / CPU', value: 'Intel Core i5 / AMD Ryzen 5' },
      { key: 'RAM Memory', value: '16GB DDR4 / DDR5' },
      { key: 'Storage', value: '512GB NVMe SSD' },
      { key: 'Graphics Card (GPU)', value: 'Integrated / Dedicated GPU' },
      { key: 'Display Size & Resolution', value: '15.6" FHD (1920x1080)' },
      { key: 'Operating System', value: 'Windows 11 Home' },
      { key: 'Battery Backup', value: 'Up to 8 Hours' },
      { key: 'Weight', value: '1.6 kg' },
      { key: 'Warranty', value: '1 Year Onsite Warranty' }
    ]
  },
  {
    id: 'preset_fashion',
    name: 'Fashion & Apparel',
    categoryName: 'Fashion',
    isSystem: true,
    specifications: [
      { key: 'Brand', value: '' },
      { key: 'Fabric / Material', value: '100% Cotton / Blend' },
      { key: 'Fit Type', value: 'Regular Fit' },
      { key: 'Pattern / Design', value: 'Solid / Printed' },
      { key: 'Sleeve Length', value: 'Half Sleeve / Full Sleeve' },
      { key: 'Collar / Neckline', value: 'Round Neck / Polo' },
      { key: 'Care Instructions', value: 'Machine Wash / Gentle Cycle' },
      { key: 'Country of Origin', value: 'India' }
    ]
  },
  {
    id: 'preset_appliances',
    name: 'Home Appliances',
    categoryName: 'Home & Kitchen',
    isSystem: true,
    specifications: [
      { key: 'Brand', value: '' },
      { key: 'Model Number', value: '' },
      { key: 'Power Consumption', value: '1500W' },
      { key: 'Energy Star Rating', value: '5 Star' },
      { key: 'Capacity', value: '25 Litres' },
      { key: 'Body Material', value: 'Stainless Steel / ABS Plastic' },
      { key: 'Voltage', value: '220V - 240V AC' },
      { key: 'Warranty', value: '2 Years Comprehensive Warranty' }
    ]
  },
  {
    id: 'preset_footwear',
    name: 'Footwear & Shoes',
    categoryName: 'Fashion',
    isSystem: true,
    specifications: [
      { key: 'Brand', value: '' },
      { key: 'Upper Material', value: 'Synthetic Leather / Breathable Mesh' },
      { key: 'Sole Material', value: 'EVA / Rubber Sole' },
      { key: 'Closure Type', value: 'Lace-Up' },
      { key: 'Toe Shape', value: 'Round Toe' },
      { key: 'Occasion', value: 'Casual / Sports / Formal' },
      { key: 'Care Instructions', value: 'Wipe with clean dry cloth' }
    ]
  }
];

export default function AddEditProductForm({ product, onClose, onDelete }: { product: Product | null, onClose: () => void, onDelete?: (id: string, name: string) => Promise<boolean> }) {
  const { categories } = useCategoryStore();
  const { settings } = useSettingsStore();
  const [formData, setFormData] = useState<Partial<Product>>(() => {
    const defaults = {
      name: '',
      brand: '',
      description: '',
      fullDescription: '',
      price: 0,
      mrp: 0,
      discountPercentage: 0,
      gst: 0,
      enableGst: true,
      categoryId: '',
      subCategoryId: '',
      nestedSubCategoryId: '',
      vendorId: 'admin',
      images: [],
      primaryImage: '',
      sku: '',
      tags: [],
      stock: 0,
      status: 'active' as const,
      rating: 5,
      numReviews: 0,
      familyId: '',
      familyColorName: '',
      familyThumbnail: '',
      familyColorHex: '',
      familyColorOrder: 1,
      variants: [],
      variantAttributesList: [],
      variantAttributes: ['color', 'size'],
      sizeChart: '',
      sizes: [],
      specifications: [],
      variantSpecifications: {},
      specificationsByVariant: {},
      sizeSpecifications: {},
      specificationsBySize: {},
      features: [],
      serviceablePincodes: [],
      availabilityRules: [],
      color: '',
      size: '',
      isCodAllowed: true,
      isStockVisible: true,
      isFreeDelivery: true,
      isVisible: true,
      enableCustomerSupport: true,
      customerSupportText: '24/7 Customer Support',
      enableReturnPeriod: true,
      returnPeriodDays: 7,
      returnPolicy: '7-Day Return',
      noReturnsText: 'Non-Returnable',
      enableDoorstepCancellation: true,
      isReturnable: true,
      enableReturns: true,
      enableWarranty: true,
      warrantyPeriod: '1 Year Warranty',
      enableBrandSupport: true,
      brandSupportText: '7-Day Brand Support',
      createdAt: new Date().toISOString(),
    };
    if (product) {
      const derivedAttrs = getProductVariantAttributes(product);
      const initialVariantSpecs = product.variantSpecifications || product.specificationsByVariant || product.sizeSpecifications || product.specificationsBySize || {};
      return {
        ...defaults,
        ...product,
        name: product.name || '',
        brand: product.brand || '',
        description: product.description || '',
        fullDescription: product.fullDescription || '',
        primaryImage: product.primaryImage || '',
        sku: product.sku || '',
        productCode: product.productCode ? formatProductCode(product.productCode) : '',
        familyId: product.familyId || '',
        familyColorName: product.familyColorName || product.color || '',
        familyThumbnail: product.familyThumbnail || product.primaryImage || '',
        familyColorHex: product.familyColorHex || '',
        familyColorOrder: product.familyColorOrder || 1,
        color: product.color || '',
        size: product.size || '',
        sizes: product.sizes || [],
        sizeChart: product.sizeChart || '',
        variantAttributesList: product.variantAttributesList || derivedAttrs,
        variantAttributes: product.variantAttributes || ['color', 'size'],
        specifications: product.specifications || [],
        variantSpecifications: initialVariantSpecs,
        specificationsByVariant: initialVariantSpecs,
        sizeSpecifications: product.sizeSpecifications || product.specificationsBySize || initialVariantSpecs,
        specificationsBySize: product.specificationsBySize || product.sizeSpecifications || initialVariantSpecs,
        categoryId: product.categoryId || '',
        subCategoryId: product.subCategoryId || '',
        nestedSubCategoryId: product.nestedSubCategoryId || '',
        isCodAllowed: product.isCodAllowed !== false,
        isStockVisible: product.isStockVisible !== false,
        isFreeDelivery: product.isFreeDelivery !== false,
        isVisible: product.isVisible !== false,
        enableCustomerSupport: product.enableCustomerSupport !== undefined ? product.enableCustomerSupport : true,
        customerSupportText: product.customerSupportText || '24/7 Customer Support',
        enableReturnPeriod: product.enableReturnPeriod !== undefined ? product.enableReturnPeriod : true,
        returnPeriodDays: (product as any).returnDays || product.returnPeriodDays || 7,
        returnPolicy: product.returnPolicy || '7-Day Return',
        noReturnsText: product.noReturnsText || 'Non-Returnable',
        enableDoorstepCancellation: product.enableDoorstepCancellation !== undefined ? product.enableDoorstepCancellation : true,
        isReturnable: product.isReturnable !== undefined ? product.isReturnable : (product.enableReturns !== undefined ? product.enableReturns : true),
        enableReturns: product.enableReturns !== undefined ? product.enableReturns : true,
        enableWarranty: product.enableWarranty !== undefined ? product.enableWarranty : true,
        warrantyPeriod: (product as any).warranty || product.warrantyPeriod || '1 Year Warranty',
        enableBrandSupport: product.enableBrandSupport !== undefined ? product.enableBrandSupport : true,
        brandSupportText: product.brandSupportText || '7-Day Brand Support',
        variants: (product.variants || []).map(v => {
          const vImages = Array.isArray(v.images) && v.images.length > 0
            ? v.images.slice(0, 10)
            : (v.image ? [v.image] : []);
          const attrs = extractVariantAttributes(v);
          return {
            ...v,
            name: v.name || getVariantCombinationTitle(attrs),
            attributes: v.attributes || attrs,
            attributeValues: v.attributeValues || attrs,
            color: v.color || attrs['Color'] || '',
            colorHex: v.colorHex || '#000000',
            colorName: v.colorName || attrs['Color'] || '',
            size: v.size || attrs['Size'] || '',
            shoeSize: v.shoeSize || '',
            storage: v.storage || attrs['Storage'] || '',
            ram: v.ram || attrs['RAM'] || '',
            shade: v.shade || attrs['Shade'] || '',
            volume: v.volume || attrs['Volume'] || '',
            material: v.material || attrs['Material'] || '',
            model: v.model || attrs['Model'] || '',
            sku: v.sku || '',
            barcode: v.barcode || '',
            image: vImages[0] || '',
            images: vImages,
            price: v.price || product.discountPrice || product.price || 0,
            mrp: v.mrp || product.mrp || product.price || 0,
            discountPrice: v.price || product.discountPrice || product.price || 0,
            discountPercentage: v.discountPercentage || 0,
            stock: v.stock ?? 0,
            lowStockThreshold: v.lowStockThreshold ?? 2,
            inStock: (v.stock ?? 0) > 0 && !v.disabled,
            status: v.disabled ? 'disabled' : ((v.stock ?? 0) > 0 ? 'active' : 'out_of_stock'),
            disabled: v.disabled || false,
            weight: v.weight || '',
            dimensions: v.dimensions || '',
          };
        }),
        images: product.images || [],
        tags: product.tags || [],
        features: product.features || [],
        serviceablePincodes: product.serviceablePincodes || [],
        availabilityRules: product.availabilityRules || [],
        price: product.discountPrice !== undefined && product.discountPrice !== null ? product.discountPrice : product.price,
        mrp: product.discountPrice !== undefined && product.discountPrice !== null ? product.price : (product.mrp || product.price),
        stock: product.stock || 0,
        enableGst: product.enableGst !== undefined ? product.enableGst : (product.gst ? product.gst > 0 : true),
        gst: product.gst || 0,
        discountPercentage: product.discountPercentage || 0,
      };
    }
    return defaults;
  });

  const [currentTag, setCurrentTag] = useState('');
  const [currentPincodeInput, setCurrentPincodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showShareSpecsModal, setShowShareSpecsModal] = useState(false);
  const [shareSpecsTab, setShareSpecsTab] = useState<'similar' | 'all' | 'presets'>('similar');
  const [shareSpecsSearch, setShareSpecsSearch] = useState('');
  const [selectedSourceProduct, setSelectedSourceProduct] = useState<Product | null>(null);
  const [selectedSourcePreset, setSelectedSourcePreset] = useState<SpecificationPreset | null>(null);

  // Custom Specification Presets stored in localStorage
  const [customPresets, setCustomPresets] = useState<SpecificationPreset[]>(() => {
    try {
      const saved = localStorage.getItem('viba_admin_spec_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedAttributeFilter, setSelectedAttributeFilter] = useState<string>('all');
  const [activeSpecTargetKey, setActiveSpecTargetKey] = useState<string>('default');

  const availableSizes = extractProductSizes(formData);
  const dynamicVariantAttrs = getProductVariantAttributes(formData);
  const activeProductVariants = (formData.variants || []).filter((v: any) => !v.disabled && v.status !== 'disabled');

  // Build a list of attribute groups (e.g. Storage: ["128GB", "256GB"], RAM: ["8GB", "16GB"], Size: ["M", "L", "XL"])
  const configurableAttributeGroups: { attributeName: string; values: string[] }[] = [];

  dynamicVariantAttrs.forEach(attr => {
    const vals = (attr.values || []).map(v => (v.name || v.value || '').trim()).filter(Boolean);
    if (vals.length > 0) {
      configurableAttributeGroups.push({
        attributeName: attr.name,
        values: Array.from(new Set(vals))
      });
    }
  });

  if (configurableAttributeGroups.length === 0 && availableSizes.length > 0) {
    configurableAttributeGroups.push({
      attributeName: 'Size',
      values: availableSizes
    });
  }

  // Helper to get currently active specs list depending on active tab
  const getActiveTabSpecs = (): { key: string; value: string }[] => {
    if (activeSpecTargetKey === 'default') {
      return formData.specifications || [];
    }
    const specMaps = formData.variantSpecifications || formData.specificationsByVariant || formData.sizeSpecifications || formData.specificationsBySize || {};
    return specMaps[activeSpecTargetKey] || [];
  };

  // Helper to update currently active specs list
  const updateActiveTabSpecs = (newSpecs: { key: string; value: string }[]) => {
    if (activeSpecTargetKey === 'default') {
      setFormData(prev => ({
        ...prev,
        specifications: newSpecs
      }));
    } else {
      setFormData(prev => {
        const nextVariantSpecs = {
          ...(prev.variantSpecifications || prev.specificationsByVariant || prev.sizeSpecifications || prev.specificationsBySize || {}),
          [activeSpecTargetKey]: newSpecs
        };
        return {
          ...prev,
          variantSpecifications: nextVariantSpecs,
          specificationsByVariant: nextVariantSpecs,
          sizeSpecifications: nextVariantSpecs,
          specificationsBySize: nextVariantSpecs
        };
      });
    }
  };

  const isTargetUsingDefault = (key: string): boolean => {
    const specMaps = formData.variantSpecifications || formData.specificationsByVariant || formData.sizeSpecifications || formData.specificationsBySize || {};
    return !specMaps[key] || specMaps[key].length === 0;
  };

  const copyDefaultSpecsToTarget = (targetKey?: string) => {
    const target = targetKey || activeSpecTargetKey;
    if (target === 'default') return;
    const defaultSpecs = formData.specifications || [];
    const cloned = defaultSpecs.map(s => ({ key: s.key, value: s.value }));
    setFormData(prev => {
      const nextVariantSpecs = {
        ...(prev.variantSpecifications || prev.specificationsByVariant || prev.sizeSpecifications || prev.specificationsBySize || {}),
        [target]: cloned
      };
      return {
        ...prev,
        variantSpecifications: nextVariantSpecs,
        specificationsByVariant: nextVariantSpecs,
        sizeSpecifications: nextVariantSpecs,
        specificationsBySize: nextVariantSpecs
      };
    });
    toast.success(`Copied ${cloned.length} default specifications to "${target}"`);
  };

  const clearTargetSpecs = (targetKey?: string) => {
    const target = targetKey || activeSpecTargetKey;
    if (target === 'default') return;
    setFormData(prev => {
      const nextVariantSpecs = { ...(prev.variantSpecifications || prev.specificationsByVariant || prev.sizeSpecifications || prev.specificationsBySize || {}) };
      delete nextVariantSpecs[target];
      return {
        ...prev,
        variantSpecifications: nextVariantSpecs,
        specificationsByVariant: nextVariantSpecs,
        sizeSpecifications: nextVariantSpecs,
        specificationsBySize: nextVariantSpecs
      };
    });
    toast.success(`Reverted "${target}" to use Default Specifications`);
  };

  // Universal helper to apply a list of specifications (from a product or a preset)
  const applySharedSpecificationsList = (specsList: { key: string; value: string }[], sourceTitle: string) => {
    if (!specsList || specsList.length === 0) {
      toast.error('Selected template has no specifications to apply.');
      return;
    }

    // Clean, trim, and deduplicate by key (preserving non-empty values)
    const specMap = new Map<string, string>();
    specsList.forEach(s => {
      const k = (s.key || '').trim();
      const v = (s.value || '').trim();
      if (k) {
        if (!specMap.has(k) || (v && !specMap.get(k))) {
          specMap.set(k, v);
        }
      }
    });

    const clonedSpecs = Array.from(specMap.entries()).map(([key, value]) => ({ key, value }));

    if (clonedSpecs.length === 0) {
      toast.error('No valid specification keys found to apply.');
      return;
    }

    updateActiveTabSpecs(clonedSpecs);

    toast.success(`Applied ${clonedSpecs.length} specifications to ${activeSpecTargetKey === 'default' ? 'default specifications' : `variant "${activeSpecTargetKey}"`} from "${sourceTitle}"`);
    setShowShareSpecsModal(false);
    setSelectedSourceProduct(null);
    setSelectedSourcePreset(null);
  };

  const applySharedSpecifications = (sourceProduct: Product) => {
    applySharedSpecificationsList(sourceProduct.specifications || [], sourceProduct.name);
  };

  const applySharedPreset = (preset: SpecificationPreset) => {
    applySharedSpecificationsList(preset.specifications || [], preset.name);
  };

  // Clean empty or duplicate specification keys from current active specifications
  const cleanAndDeduplicateSpecifications = () => {
    const currentSpecs = getActiveTabSpecs();
    if (currentSpecs.length === 0) {
      toast.error('No specifications to clean.');
      return;
    }

    const specMap = new Map<string, string>();
    currentSpecs.forEach(s => {
      const k = (s.key || '').trim();
      const v = (s.value || '').trim();
      if (k || v) {
        const keyName = k || 'Unspecified Attribute';
        if (!specMap.has(keyName) || (v && !specMap.get(keyName))) {
          specMap.set(keyName, v);
        }
      }
    });

    const cleaned = Array.from(specMap.entries()).map(([key, value]) => ({ key, value }));
    updateActiveTabSpecs(cleaned);
    toast.success(`Cleaned specifications. ${cleaned.length} attributes retained.`);
  };

  // Save current active specifications as a reusable custom preset
  const handleSaveCustomPreset = () => {
    const currentSpecs = getActiveTabSpecs();
    const validSpecs = currentSpecs
      .map(s => ({ key: (s.key || '').trim(), value: (s.value || '').trim() }))
      .filter(s => s.key.length > 0);

    if (validSpecs.length === 0) {
      toast.error('Add at least one specification attribute before saving as a reusable preset.');
      return;
    }

    const nameToUse = newPresetName.trim() || `${formData.brand || 'Category'} - ${validSpecs.length} Specs Preset`;
    const newPreset: SpecificationPreset = {
      id: `preset_${Date.now()}`,
      name: nameToUse,
      categoryName: selectedCategory?.name || 'Custom',
      specifications: validSpecs
    };

    const updatedPresets = [newPreset, ...customPresets];
    setCustomPresets(updatedPresets);
    try {
      localStorage.setItem('viba_admin_spec_presets', JSON.stringify(updatedPresets));
    } catch (e) {
      console.error('Failed to persist custom presets:', e);
    }

    toast.success(`Saved reusable preset "${nameToUse}"`);
    setShowSavePresetModal(false);
    setNewPresetName('');
  };

  const handleDeleteCustomPreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updated);
    try {
      localStorage.setItem('viba_admin_spec_presets', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
    if (selectedSourcePreset?.id === presetId) {
      setSelectedSourcePreset(null);
    }
    toast.success('Preset deleted');
  };

  // Fetch all existing products for uniqueness checks & auto-generate Product Code
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        const prods = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setExistingProducts(prods);

        // Auto-generate Product Code for new product or if existing product lacks code
        if (!product?.productCode) {
          const newCode = generateUniqueProductCode(prods);
          setFormData(prev => ({ ...prev, productCode: prev.productCode || newCode }));
        }
      } catch (err) {
        console.error('Failed to load existing products for product code generation:', err);
        if (!formData.productCode) {
          setFormData(prev => ({ ...prev, productCode: generateUniqueProductCode([]) }));
        }
      }
    };
    loadProducts();
  }, []);

  // Set default categoryId once categories load, if none is set
  useEffect(() => {
    if (!formData.categoryId && categories.length > 0) {
      setFormData(prev => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, formData.categoryId]);

  const selectedCategory = categories.find(c => c.id === formData.categoryId);
  const selectedSubCategory = selectedCategory?.subcategories?.find(s => s.id === formData.subCategoryId);

  // Auto-calculate discount
  useEffect(() => {
    const mrp = formData.mrp || 0;
    const price = formData.price || 0;
    let discount = 0;
    if (mrp > 0 && price > 0 && mrp > price) {
      discount = Math.round(((mrp - price) / mrp) * 100);
    }
    if (discount !== formData.discountPercentage) {
      setFormData(prev => ({ ...prev, discountPercentage: discount }));
    }
  }, [formData.mrp, formData.price, formData.discountPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.tags && formData.tags.length > 0 && formData.tags.length < settings.minKeywords) {
      toast.error(`You've added some keywords but the minimum is ${settings.minKeywords}. Please add more or remove all.`);
      return;
    }

    // Validate Product Code
    const codeToValidate = formData.productCode || generateUniqueProductCode(existingProducts);
    const valResult = validateProductCode(codeToValidate);
    if (!valResult.valid) {
      toast.error(valResult.error || 'Invalid Product Code format');
      return;
    }
    if (!isProductCodeUnique(codeToValidate, existingProducts, product?.id)) {
      toast.error(`Product Code "${codeToValidate}" is already assigned to another product. Product Codes must be unique.`);
      return;
    }

    setBusy(true);
    const toastId = toast.loading(product ? 'Synchronizing product update...' : 'Uploading images and deploying product...');

    try {
      const pid = product?.id || `prod_${Date.now()}`;
      const mrp = formData.mrp || 0;
      const price = formData.price || 0;
      const isDiscounted = mrp > 0 && price > 0 && mrp > price;
      const generatedSlug = createSlug(formData.name || '') || `product-${pid}`;
      const finalProductCode = formatProductCode(codeToValidate);

      // Upload or compress image files (main images, primary image, variant images) to avoid Firestore payload limits
      const { images: processedImages, primaryImage: processedPrimaryImage, variants: processedVariants } =
        await processAllProductImages(formData);

      // Ensure each variant has canonical combinationKey and productId assigned
      const finalizedVariants = (processedVariants || []).map((v: any) => {
        const attrs = extractVariantAttributes(v);
        const comboKey = v.combinationKey || getCanonicalVariantKey(attrs);
        return {
          ...v,
          productId: pid,
          combinationKey: comboKey,
          attributes: v.attributes || attrs,
          attributeValues: v.attributeValues || attrs
        };
      });

      // Clean specifications (remove items with empty keys and trim whitespace)
      const cleanedSpecs = (formData.specifications || [])
        .map(s => ({ key: (s.key || '').trim(), value: (s.value || '').trim() }))
        .filter(s => s.key.length > 0);

      // Clean variant-specific specifications for valid product attributes/variants
      const currentSizes = extractProductSizes(formData);
      const rawVariantSpecs = formData.variantSpecifications || formData.specificationsByVariant || formData.sizeSpecifications || formData.specificationsBySize || {};
      const cleanedVariantSpecs: Record<string, { key: string; value: string }[]> = {};

      Object.entries(rawVariantSpecs).forEach(([specKey, specs]) => {
        const trimmedKey = specKey.trim();
        if (trimmedKey && Array.isArray(specs)) {
          const cleanedList = specs
            .map(s => ({ key: (s.key || '').trim(), value: (s.value || '').trim() }))
            .filter(s => s.key.length > 0);
          if (cleanedList.length > 0) {
            cleanedVariantSpecs[trimmedKey] = cleanedList;
          }
        }
      });

      const hasVariantSpecs = Object.keys(cleanedVariantSpecs).length > 0;

      // Auto calculate product total stock from active variants if variants exist
      const activeVars = (finalizedVariants || []).filter((v: any) => !v.disabled && v.status !== 'disabled');
      const calculatedStock = finalizedVariants && finalizedVariants.length > 0
        ? activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
        : Number(formData.stock) || 0;

      const rawData = {
        ...formData,
        specifications: cleanedSpecs,
        variantSpecifications: hasVariantSpecs ? cleanedVariantSpecs : null,
        specificationsByVariant: hasVariantSpecs ? cleanedVariantSpecs : null,
        sizeSpecifications: hasVariantSpecs ? cleanedVariantSpecs : null,
        specificationsBySize: hasVariantSpecs ? cleanedVariantSpecs : null,
        sizes: currentSizes.length > 0 ? currentSizes : (formData.sizes || null),
        id: pid,
        productCode: finalProductCode,
        images: processedImages,
        primaryImage: processedPrimaryImage,
        variants: finalizedVariants,
        stock: calculatedStock,
        slug: product?.slug || generatedSlug,
        price: isDiscounted ? mrp : price,
        discountPrice: isDiscounted ? price : null,
        mrp: mrp || price,
        discountPercentage: isDiscounted ? Math.round(((mrp - price) / mrp) * 100) : 0,
        updatedAt: new Date().toISOString()
      };

      // Clean undefined values recursively
      const productData = cleanForFirestore(rawData);

      await setDoc(doc(db, 'products', pid), productData, { merge: true });
      await logAdminAction(
        product ? AdminAction.PRODUCT_UPDATE : AdminAction.PRODUCT_CREATE,
        `${product ? 'Refined' : 'Deployed'} product: ${formData.name}`,
        pid,
        'products'
      );

      toast.success(product ? 'Systems Updated' : 'Product Deployed', { id: toastId });
      onClose();
    } catch (err) {
      console.error('Product deployment error:', err);
      toast.error('Deployment Failed', { id: toastId });
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setBusy(false);
    }
  };

  const addVariant = () => {
    const initialImg = formData.primaryImage || (formData.images?.[0] || '');
    const newVariant: ProductVariant = {
      id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: '',
      color: '',
      colorHex: '#000000',
      colorName: '',
      size: '',
      shoeSize: '',
      storage: '',
      ram: '',
      shade: '',
      volume: '',
      material: '',
      model: '',
      price: formData.price || 0,
      extraPrice: 0,
      stock: 10,
      sku: `${formData.sku || 'SKU'}_VAR_${(formData.variants?.length || 0) + 1}`,
      image: initialImg,
      images: initialImg ? [initialImg] : [],
      disabled: false,
    };
    const nextVariants = [...(formData.variants || []), newVariant];
    const activeVars = nextVariants.filter((v: any) => !v.disabled && v.status !== 'disabled');
    const totalStock = activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
    setFormData(prev => ({ ...prev, variants: nextVariants, stock: totalStock }));
  };

  const removeVariant = (id: string) => {
    const nextVariants = formData.variants?.filter(v => v.id !== id) || [];
    const activeVars = nextVariants.filter((v: any) => !v.disabled && v.status !== 'disabled');
    const totalStock = nextVariants.length > 0
      ? activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
      : formData.stock;
    setFormData(prev => ({ ...prev, variants: nextVariants, stock: totalStock }));
  };

  const moveVariant = (index: number, direction: 'up' | 'down') => {
    const variants = [...(formData.variants || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= variants.length) return;
    const temp = variants[index];
    variants[index] = variants[targetIndex];
    variants[targetIndex] = temp;
    setFormData(prev => ({ ...prev, variants }));
  };

  const toggleVariantDisabled = (id: string) => {
    const nextVariants = formData.variants?.map(v => v.id === id ? { ...v, disabled: !v.disabled, status: !v.disabled ? 'disabled' : ((v.stock || 0) > 0 ? 'active' : 'out_of_stock') } : v) || [];
    const activeVars = nextVariants.filter((v: any) => !v.disabled && v.status !== 'disabled');
    const totalStock = nextVariants.length > 0
      ? activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
      : formData.stock;
    setFormData(prev => ({
      ...prev,
      variants: nextVariants,
      stock: totalStock
    }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    const nextVariants = formData.variants?.map(v => {
      if (v.id !== id) return v;
      const updated = { ...v, [field]: value };
      if (field === 'images') {
        const imgs = Array.isArray(value) ? value.slice(0, 8) : [];
        updated.images = imgs;
        updated.image = imgs[0] || '';
      } else if (field === 'image') {
        const singleImg = value || '';
        updated.image = singleImg;
        if (!updated.images || updated.images.length === 0) {
          updated.images = singleImg ? [singleImg] : [];
        } else {
          updated.images[0] = singleImg;
        }
      }
      return updated;
    }) || [];
    const activeVars = nextVariants.filter((v: any) => !v.disabled && v.status !== 'disabled');
    const totalStock = nextVariants.length > 0
      ? activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
      : formData.stock;
    setFormData(prev => ({
      ...prev,
      variants: nextVariants,
      stock: totalStock
    }));
  };

  const toggleVariantAttribute = (attr: string) => {
    const currentAttrs = formData.variantAttributes || [];
    const updatedAttrs = currentAttrs.includes(attr)
      ? currentAttrs.filter(a => a !== attr)
      : [...currentAttrs, attr];
    setFormData(prev => ({ ...prev, variantAttributes: updatedAttrs }));
  };

  const addSpecification = (key = '', value = '') => {
    const currentSpecs = getActiveTabSpecs();
    updateActiveTabSpecs([...currentSpecs, { key, value }]);
  };

  const updateSpecification = (index: number, key: string, value: string) => {
    const currentSpecs = [...getActiveTabSpecs()];
    currentSpecs[index] = { key, value };
    updateActiveTabSpecs(currentSpecs);
  };

  const removeSpecification = (index: number) => {
    const currentSpecs = getActiveTabSpecs().filter((_, i) => i !== index);
    updateActiveTabSpecs(currentSpecs);
  };

  const moveSpecification = (index: number, direction: 'up' | 'down') => {
    const specs = [...getActiveTabSpecs()];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= specs.length) return;
    const temp = specs[index];
    specs[index] = specs[targetIndex];
    specs[targetIndex] = temp;
    updateActiveTabSpecs(specs);
  };

  const addQuickSpecTemplate = (keyName: string) => {
    const currentSpecs = getActiveTabSpecs();
    if (!currentSpecs.some(s => s.key.toLowerCase() === keyName.toLowerCase())) {
      updateActiveTabSpecs([...currentSpecs, { key: keyName, value: '' }]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto pb-20 space-y-12"
    >
      <div className="flex justify-between items-end border-b border-gray-100 pb-10">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic">
            {product ? 'EDIT_NODE' : 'NEW_ENTITY'}
          </h2>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-[0.2em] mt-2">
            Product Identification {product?.id ? `(${product.id.slice(0, 8)})` : ''}
          </p>
        </div>
        <div className="flex gap-4">
          {product && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const nameToDelete = product.name || formData.name || 'this product';
                if (onDelete) {
                  setBusy(true);
                  const success = await onDelete(product.id, nameToDelete);
                  if (success) onClose();
                  setBusy(false);
                } else {
                  if (window.confirm(`DANGER: Permanently delete "${nameToDelete}"?`)) {
                    setBusy(true);
                    const tid = toast.loading('Deleting...');
                    try {
                      await deleteDoc(doc(db, 'products', product.id));
                      await logAdminAction(AdminAction.PRODUCT_DELETE, `Deleted product from edit view: ${nameToDelete}`, product.id, 'products');
                      toast.success('Product Deleted', { id: tid });
                      onClose();
                    } catch (err) {
                      console.error('Delete from modal failed:', err);
                      toast.error('Failed to delete', { id: tid });
                      handleFirestoreError(err, OperationType.DELETE, `products/${product.id}`);
                    } finally {
                      setBusy(false);
                    }
                  }
                }
              }}
              className="px-8 py-4 bg-red-50 text-red-500 border-2 border-transparent rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Delete Product
            </button>
          )}
          <button onClick={onClose} type="button" className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:border-gray-900 hover:text-gray-900 transition-all">
            Abort Operation
          </button>
          <button type="submit" form="product-form" disabled={busy} className="px-10 py-4 bg-gray-900 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-gray-200 hover:scale-105 active:scale-95 transition-all">
            Save Product
          </button>
        </div>
      </div>

      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Media & Variants */}
        <div className="lg:col-span-2 space-y-12">

          {/* Media Section */}
          <ProductImageUploader
            images={formData.images || []}
            onChange={(imgs) =>
              setFormData(p => ({
                ...p,
                images: imgs,
                primaryImage: imgs[0] ?? p.primaryImage
              }))
            }
          />

          {/* Product Info Section */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-10">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Core Configuration</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Entity Name</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="E.g. Lunar Edition X-1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Brand Signature</label>
                <input
                  value={formData.brand}
                  onChange={e => setFormData(p => ({ ...p, brand: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Manufacturer Name"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Internal Digest (Short Description)</label>
                <input
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-bold text-sm"
                  placeholder="Brief architectural summary..."
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Technical Documentation (Full Description)</label>
                <textarea
                  value={formData.fullDescription}
                  onChange={e => setFormData(p => ({ ...p, fullDescription: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[32px] px-8 py-6 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm h-48 resize-none"
                  placeholder="Exhaustive specifications and features..."
                />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Serviceable Pincodes (Comma separated, empty for nationwide)</label>
                <textarea
                  value={formData.serviceablePincodes?.join(', ') || ''}
                  onChange={e => setFormData(p => ({ ...p, serviceablePincodes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[32px] px-8 py-6 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm h-32 resize-none"
                  placeholder="E.g. 560001, 560064, 110001"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-3 bg-emerald-50/60 border border-emerald-100 p-6 rounded-[28px] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                      <Hash className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-emerald-900">
                        Auto-Generated Product Code (12 Digits)
                      </label>
                      <p className="text-[10px] text-emerald-600 font-semibold">
                        Format: 8900 0996 XXXX • Permanent unique identifier for product lookup & search
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.productCode) {
                        navigator.clipboard.writeText(formData.productCode);
                        setCopiedCode(true);
                        toast.success(`Product Code "${formData.productCode}" copied to clipboard!`);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <div className="flex gap-3 items-center">
                  <input
                    value={formData.productCode || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(p => ({ ...p, productCode: formatProductCode(val) }));
                    }}
                    className="w-full bg-white border border-emerald-200 rounded-[20px] px-6 py-4 outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono font-black text-lg tracking-wider text-emerald-950"
                    placeholder="8900 0996 XXXX"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Node Identifier (SKU)</label>
                <input
                  value={formData.sku}
                  onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="SKU-000-X"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Default Color</label>
                <input
                  maxLength={40}
                  value={formData.color}
                  onChange={e => setFormData(p => ({ ...p, color: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Default Color"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Default Size</label>
                <input
                  maxLength={50}
                  value={formData.size}
                  onChange={e => setFormData(p => ({ ...p, size: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Default Size"
                />
              </div>
            </div>
          </div>



          {/* Universal Variant Matrix Manager */}
          <VariantMatrixManager
            attributes={formData.variantAttributesList || []}
            variants={formData.variants || []}
            baseProduct={formData}
            onAttributesChange={(newAttrs) =>
              setFormData((prev) => ({
                ...prev,
                variantAttributesList: newAttrs,
                variantAttributes: newAttrs.map((a) => a.name.toLowerCase()),
              }))
            }
            onVariantsChange={(newVariants) => {
              const activeVars = (newVariants || []).filter((v: any) => !v.disabled && v.status !== 'disabled');
              const totalVariantStock = activeVars.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
              setFormData((prev) => ({
                ...prev,
                variants: newVariants,
                stock: newVariants && newVariants.length > 0 ? totalVariantStock : prev.stock,
              }));
            }}
            onBaseProductChange={(updates) =>
              setFormData((prev) => ({
                ...prev,
                ...updates,
              }))
            }
          />

          {/* Specifications Management Section */}
          <div className="bg-white p-6 sm:p-10 rounded-[36px] sm:rounded-[48px] border border-gray-100 shadow-sm space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Product Specifications</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                  Manage structured technical attributes shown on Product Details
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowShareSpecsModal(true);
                    setSelectedSourceProduct(null);
                    setSelectedSourcePreset(null);
                    setShareSpecsSearch('');
                    setShareSpecsTab('similar');
                  }}
                  className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" /> Reuse / Share Specifications
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (getActiveTabSpecs().length === 0) {
                      toast.error('Add specifications before saving as a preset.');
                      return;
                    }
                    setShowSavePresetModal(true);
                  }}
                  className="px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Bookmark className="w-3.5 h-3.5" /> Save as Preset
                </button>

                <button
                  type="button"
                  onClick={cleanAndDeduplicateSpecifications}
                  className="px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-amber-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Clean / Deduplicate
                </button>

                <button
                  type="button"
                  onClick={() => addSpecification()}
                  className="px-5 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>
            </div>

            {/* Universal Variant / Attribute Selector Tabs */}
            {configurableAttributeGroups.length > 0 && (
              <div className="space-y-4 bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                      Configure Specifications by Variant / Attribute
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">
                    {configurableAttributeGroups.map(g => `${g.values.length} ${g.attributeName}`).join(' • ')}
                  </span>
                </div>

                {/* If multiple attributes exist, allow filtering by attribute type */}
                {configurableAttributeGroups.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedAttributeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                        selectedAttributeFilter === 'all'
                          ? 'bg-gray-800 text-white shadow-xs'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      All Attributes
                    </button>
                    {configurableAttributeGroups.map(g => (
                      <button
                        key={g.attributeName}
                        type="button"
                        onClick={() => setSelectedAttributeFilter(g.attributeName)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                          selectedAttributeFilter === g.attributeName
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {g.attributeName} ({g.values.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Value Selector Pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveSpecTargetKey('default')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      activeSpecTargetKey === 'default'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span>🌐 Default / Shared</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                      activeSpecTargetKey === 'default' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {(formData.specifications || []).length}
                    </span>
                  </button>

                  {configurableAttributeGroups
                    .filter(g => selectedAttributeFilter === 'all' || selectedAttributeFilter === g.attributeName)
                    .flatMap(g => g.values.map(val => ({ attrName: g.attributeName, val })))
                    .map(({ attrName, val }) => {
                      const customCount = (
                        formData.variantSpecifications?.[val] ||
                        formData.variantSpecifications?.[`${attrName}:${val}`] ||
                        formData.specificationsByVariant?.[val] ||
                        formData.sizeSpecifications?.[val] ||
                        formData.specificationsBySize?.[val] ||
                        []
                      ).length;
                      const isCustom = customCount > 0;
                      const isSelected = activeSpecTargetKey === val;

                      return (
                        <button
                          key={`${attrName}_${val}`}
                          type="button"
                          onClick={() => setActiveSpecTargetKey(val)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : isCustom
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>{configurableAttributeGroups.length > 1 ? `${attrName}: ` : ''}{val}</span>
                          {isCustom ? (
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                              isSelected ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'
                            }`}>
                              {customCount} custom
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                              isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-gray-100 text-gray-400'
                            }`}>
                              Default
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>

                {/* Info banner for currently active variant target */}
                {activeSpecTargetKey !== 'default' && (
                  <div className="pt-2 border-t border-gray-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      {isTargetUsingDefault(activeSpecTargetKey) ? (
                        <p className="text-gray-500 font-medium">
                          Variant <strong className="text-gray-900 font-extrabold">{activeSpecTargetKey}</strong> is currently using <strong className="text-gray-900">Default Specifications</strong> ({(formData.specifications || []).length} attributes).
                        </p>
                      ) : (
                        <p className="text-emerald-800 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Configuring custom specifications for <strong className="font-extrabold">{activeSpecTargetKey}</strong> ({getActiveTabSpecs().length} attributes).
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isTargetUsingDefault(activeSpecTargetKey) ? (
                        <button
                          type="button"
                          onClick={() => copyDefaultSpecsToTarget(activeSpecTargetKey)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Copy className="w-3 h-3" /> Copy Default Specs
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => copyDefaultSpecsToTarget(activeSpecTargetKey)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                            title="Overwrite with default specifications"
                          >
                            <Copy className="w-3 h-3" /> Reload Default
                          </button>
                          <button
                            type="button"
                            onClick={() => clearTargetSpecs(activeSpecTargetKey)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Revert to Default
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Template Buttons */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">
                Quick Category Attributes {activeSpecTargetKey !== 'default' ? `(Target: ${activeSpecTargetKey})` : ''}
              </span>
              <div className="flex flex-wrap gap-2">
                {['Brand', 'Model', 'Material', 'Color', 'Size', 'Chest', 'Length', 'Sleeve', 'Waist', 'Dimensions', 'Weight', 'Capacity', 'Warranty'].map(tpl => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => addQuickSpecTemplate(tpl)}
                    className="px-3 py-1.5 bg-gray-50 text-gray-700 text-[10px] font-black uppercase rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    + {tpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {getActiveTabSpecs().map((spec, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <input
                    type="text"
                    placeholder="Attribute Name (e.g. Chest, Length, Fabric)"
                    value={spec.key}
                    onChange={e => updateSpecification(idx, e.target.value, spec.value)}
                    className="w-full sm:w-1/3 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-600 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Specification Value (e.g. 42, 100% Cotton)"
                    value={spec.value}
                    onChange={e => updateSpecification(idx, spec.key, e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-600 transition-all"
                  />
                  <div className="flex items-center justify-end gap-1 shrink-0 pt-1 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => moveSpecification(idx, 'up')}
                      disabled={idx === 0}
                      className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSpecification(idx, 'down')}
                      disabled={idx === getActiveTabSpecs().length - 1}
                      className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSpecification(idx)}
                      className="p-2 text-rose-500 hover:text-rose-700 cursor-pointer ml-1"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {getActiveTabSpecs().length === 0 && (
                <div className="py-8 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[28px] space-y-2">
                  {activeSpecTargetKey !== 'default' ? (
                    <div>
                      <p>Variant <strong className="text-gray-700">{activeSpecTargetKey}</strong> is currently using Default Specifications.</p>
                      <p className="text-xs font-normal text-gray-400 mt-1">Click "Copy Default Specs" above or "Add Field" to define custom specifications for this variant.</p>
                    </div>
                  ) : (
                    <p>No specification fields added. Use Quick Category Attributes above, Reuse Specifications, or click Add Field.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logistics & Category */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Logistics & Placement</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Protocol Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                >
                  <option value="active">Active Deployment</option>
                  <option value="draft">Draft Protocol</option>
                  <option value="out_of_stock">Emergency Out-of-Stock</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Inventory Depth</label>
                  {formData.variants && formData.variants.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Auto-synced from {formData.variants.filter((v: any) => !v.disabled && v.status !== 'disabled').length} active variants ({formData.stock} units)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData(p => ({ ...p, stock: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-50/80 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Cash on Delivery</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Enable or disable COD</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.isCodAllowed !== false}
                      onChange={e => setFormData(p => ({ ...p, isCodAllowed: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="bg-gray-50/80 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Stock Visibility</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Display stock status</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.isStockVisible !== false}
                      onChange={e => setFormData(p => ({ ...p, isStockVisible: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="bg-gray-50/80 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Free Delivery</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Enable or disable free shipping</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.isFreeDelivery !== false}
                      onChange={e => setFormData(p => ({ ...p, isFreeDelivery: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Product Stock Availability Location Management (State, District, City, PIN Codes) */}
              <ProductLocationManager
                rules={formData.availabilityRules || []}
                onChange={(rules) => setFormData(p => ({ ...p, availabilityRules: rules }))}
              />
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Primary Collection</label>
                <select
                  value={formData.categoryId}
                  onChange={e => setFormData(p => ({ ...p, categoryId: e.target.value, subCategoryId: '', nestedSubCategoryId: '' }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Sector (Sub-category)</label>
                <select
                  value={formData.subCategoryId}
                  onChange={e => setFormData(p => ({ ...p, subCategoryId: e.target.value, nestedSubCategoryId: '' }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm disabled:opacity-30"
                  disabled={!selectedCategory?.subcategories || selectedCategory.subcategories.length === 0}
                >
                  <option value="">Select Sector</option>
                  {selectedCategory?.subcategories?.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
              {selectedSubCategory?.subcategories && selectedSubCategory.subcategories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Nested Sub-category</label>
                  <select
                    value={formData.nestedSubCategoryId}
                    onChange={e => setFormData(p => ({ ...p, nestedSubCategoryId: e.target.value }))}
                    className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  >
                    <option value="">Select Nested Sub-category</option>
                    {selectedSubCategory.subcategories.map(nested => <option key={nested.id} value={nested.id}>{nested.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Support & Service Details Management */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Product Services & Support Badges</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                Configure individual service guarantees and badges displayed on the Product Details page
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Customer Support */}
              <div className="bg-gray-50/80 p-5 rounded-[28px] border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Customer Support</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Show support badge</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.enableCustomerSupport !== false}
                      onChange={e => setFormData(p => ({ ...p, enableCustomerSupport: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                {formData.enableCustomerSupport !== false && (
                  <input
                    type="text"
                    value={formData.customerSupportText || ''}
                    onChange={e => setFormData(p => ({ ...p, customerSupportText: e.target.value }))}
                    placeholder="24/7 Customer Support"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* 2. Return Policy & Period */}
              <div className="bg-gray-50/80 p-5 rounded-[28px] border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Product Return Policy</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Is product returnable?</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.isReturnable !== false}
                      onChange={e => setFormData(p => ({ ...p, isReturnable: e.target.checked, enableReturns: e.target.checked, enableReturnPeriod: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                {formData.isReturnable !== false ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.returnPeriodDays || 7}
                      onChange={e => {
                        const days = Number(e.target.value) || 7;
                        setFormData(p => ({ ...p, returnPeriodDays: days, returnPolicy: `${days}-Day Return` }));
                      }}
                      placeholder="7"
                      className="w-20 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-center outline-none focus:border-emerald-500"
                    />
                    <input
                      type="text"
                      value={formData.returnPolicy || ''}
                      onChange={e => setFormData(p => ({ ...p, returnPolicy: e.target.value }))}
                      placeholder="7-Day Return"
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formData.noReturnsText || ''}
                    onChange={e => setFormData(p => ({ ...p, noReturnsText: e.target.value }))}
                    placeholder="Non-Returnable"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-amber-500"
                  />
                )}
              </div>

              {/* 3. Doorstep Cancellation */}
              <div className="bg-gray-50/80 p-5 rounded-[28px] border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Doorstep Cancellation</span>
                  <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Allow cancel at delivery</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={formData.enableDoorstepCancellation !== false}
                    onChange={e => setFormData(p => ({ ...p, enableDoorstepCancellation: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* 4. Warranty */}
              <div className="bg-gray-50/80 p-5 rounded-[28px] border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Product Warranty</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Enable warranty badge</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.enableWarranty !== false}
                      onChange={e => setFormData(p => ({ ...p, enableWarranty: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                {formData.enableWarranty !== false && (
                  <input
                    type="text"
                    value={formData.warrantyPeriod || ''}
                    onChange={e => setFormData(p => ({ ...p, warrantyPeriod: e.target.value }))}
                    placeholder="1 Year Warranty"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* 5. Brand Support */}
              <div className="bg-gray-50/80 p-5 rounded-[28px] border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Brand Support</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Enable brand support badge</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                    <input
                      type="checkbox"
                      checked={formData.enableBrandSupport !== false}
                      onChange={e => setFormData(p => ({ ...p, enableBrandSupport: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                {formData.enableBrandSupport !== false && (
                  <input
                    type="text"
                    value={formData.brandSupportText || ''}
                    onChange={e => setFormData(p => ({ ...p, brandSupportText: e.target.value }))}
                    placeholder="7-Day Brand Support"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Inventory & Meta */}
        <div className="space-y-12">

          {/* Economy & Pricing */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Economic Model</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Market Retail Price (MRP)</label>
                <input
                  type="number"
                  value={formData.mrp}
                  onChange={e => setFormData(p => ({ ...p, mrp: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-xl italic"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Effective Selling Price</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData(p => ({ ...p, price: Number(e.target.value) }))}
                  className="w-full bg-blue-50/50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-xl italic text-blue-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Discount (%)</label>
                  <div className="w-full bg-gray-50 rounded-[24px] px-8 py-5 font-black text-sm opacity-50">
                    {formData.discountPercentage}%
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Savings (₹)</label>
                  <div className="w-full bg-green-50 text-green-700 rounded-[24px] px-8 py-5 font-black text-sm">
                    ₹{formData.mrp && formData.price && formData.mrp > formData.price ? (formData.mrp - formData.price).toLocaleString() : 0}
                  </div>
                </div>
                <div className="space-y-3 col-span-full md:col-span-2 bg-gray-50/80 p-6 rounded-[28px] border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">GST / Tax Control</span>
                      <span className="text-[11px] font-bold text-gray-400">Enable or disable GST tax for this product</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enableGst !== false}
                        onChange={e => {
                          const enabled = e.target.checked;
                          setFormData(p => ({
                            ...p,
                            enableGst: enabled,
                            gst: enabled ? (p.gst || 18) : 0
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  {formData.enableGst !== false ? (
                    <div className="pt-2 flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">GST Rate (%)</label>
                        <input
                          type="number"
                          value={formData.gst}
                          onChange={e => setFormData(p => ({ ...p, gst: Number(e.target.value) }))}
                          placeholder="18"
                          className="w-full bg-white border-2 border-gray-100 rounded-[20px] px-6 py-3 outline-none focus:border-primary transition-all font-black text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                          GST Active ({formData.gst || 0}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <span className="text-xs font-bold text-gray-500 bg-gray-200/60 px-3 py-1.5 rounded-full">
                        🚫 GST Disabled / Tax Exempt
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Size Chart Section */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Size Chart Configuration</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Upload an image file or enter exact Size Chart image URL for customer viewing</p>
              </div>
            </div>
            <div>
              <VariantImageInput
                value={formData.sizeChart || ''}
                onChange={val => setFormData(p => ({ ...p, sizeChart: val }))}
                label="Size Chart Image (Upload File or Enter Link)"
                imageTypeLabel="Size Chart image"
              />
            </div>
          </div>


          {/* Tags & Search */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Keywords / Search Tags</h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={e => setCurrentTag(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const newTags = currentTag.split(',').map(t => t.trim()).filter(Boolean);
                      if (newTags.length > 0) {
                        const existingTags = formData.tags || [];
                        const uniqueNewTags = newTags.filter(t => !existingTags.includes(t));
                        setFormData(p => ({ ...p, tags: [...existingTags, ...uniqueNewTags] }));
                      }
                      setCurrentTag('');
                    }
                  }}
                  className="flex-1 bg-gray-50 border-4 border-transparent rounded-2xl px-6 py-4 outline-none focus:bg-white focus:border-primary/5 transition-all font-medium text-sm"
                  placeholder="Type keyword and press Enter or comma..."
                />
                <button
                  type="button"
                  onClick={() => {
                    const newTags = currentTag.split(',').map(t => t.trim()).filter(Boolean);
                    if (newTags.length > 0) {
                      const existingTags = formData.tags || [];
                      const uniqueNewTags = newTags.filter(t => !existingTags.includes(t));
                      setFormData(p => ({ ...p, tags: [...existingTags, ...uniqueNewTags] }));
                    }
                    setCurrentTag('');
                  }}
                  className="px-6 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all"
                >
                  Add
                </button>
              </div>
              <p className="text-[10px] text-gray-400 font-bold ml-1">Press Enter, comma, or click Add to insert keywords. Optional — if added, minimum {settings.minKeywords}.</p>
            </div>

            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                {formData.tags.map(tag => (
                  <span key={tag} className="px-4 py-2 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary/5 flex items-center gap-2">
                    {tag}
                    <button type="button" onClick={() => setFormData(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))} className="text-primary/40 hover:text-primary"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            {selectedCategory && KEYWORD_SUGGESTIONS[selectedCategory.name] && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-widest">Suggested Keywords for {selectedCategory.name}</p>
                <div className="flex flex-wrap gap-2">
                  {KEYWORD_SUGGESTIONS[selectedCategory.name].map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        const currentTags = formData.tags || [];
                        if (!currentTags.includes(suggestion)) {
                          setFormData(p => ({ ...p, tags: [...currentTags, suggestion] }));
                        }
                      }}
                      className="px-3 py-1.5 bg-gray-50 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </form>

      {/* Use / Share Existing Specifications Modal */}
      {showShareSpecsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] sm:rounded-[36px] max-w-3xl w-[95vw] sm:w-full p-5 sm:p-8 space-y-5 relative shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 flex-shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">Reuse & Share Product Specifications</h3>
                <p className="text-xs font-bold text-gray-400 mt-0.5">
                  Select existing saved specifications from similar products or presets
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowShareSpecsModal(false);
                  setSelectedSourceProduct(null);
                  setSelectedSourcePreset(null);
                }}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShareSpecsTab('similar');
                  setSelectedSourceProduct(null);
                  setSelectedSourcePreset(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  shareSpecsTab === 'similar'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Similar Products
              </button>

              <button
                type="button"
                onClick={() => {
                  setShareSpecsTab('all');
                  setSelectedSourceProduct(null);
                  setSelectedSourcePreset(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  shareSpecsTab === 'all'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> All Catalog Items
              </button>

              <button
                type="button"
                onClick={() => {
                  setShareSpecsTab('presets');
                  setSelectedSourceProduct(null);
                  setSelectedSourcePreset(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  shareSpecsTab === 'presets'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" /> Saved Presets ({DEFAULT_SPEC_PRESETS.length + customPresets.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-shrink-0">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shareSpecsSearch}
                onChange={e => setShareSpecsSearch(e.target.value)}
                placeholder={
                  shareSpecsTab === 'presets'
                    ? 'Search saved specification presets...'
                    : 'Search products by name, brand, or SKU...'
                }
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold outline-none focus:border-emerald-600 focus:bg-white transition-all"
              />
            </div>

            {/* Modal Body / Tab Content */}
            <div className="flex-1 overflow-y-auto min-h-[240px] space-y-3 pr-1">

              {/* TAB 1: SIMILAR PRODUCTS */}
              {shareSpecsTab === 'similar' && (
                (() => {
                  const similarProducts = existingProducts
                    .filter(p => p.id !== product?.id)
                    .filter(p => p.specifications && p.specifications.length > 0)
                    .filter(p => {
                      const sameCategory = formData.categoryId && p.categoryId === formData.categoryId;
                      const sameSubCategory = formData.subCategoryId && p.subCategoryId === formData.subCategoryId;
                      const sameBrand = formData.brand && p.brand && p.brand.toLowerCase().trim() === formData.brand.toLowerCase().trim();
                      return sameCategory || sameSubCategory || sameBrand;
                    })
                    .filter(p => {
                      if (!shareSpecsSearch.trim()) return true;
                      const q = shareSpecsSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.brand && p.brand.toLowerCase().includes(q))
                      );
                    });

                  if (similarProducts.length === 0) {
                    return (
                      <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-2xl space-y-2">
                        <p>No similar products found in this category or brand with saved specifications.</p>
                        <button
                          type="button"
                          onClick={() => setShareSpecsTab('presets')}
                          className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Bookmark className="w-3.5 h-3.5" /> Browse Category Presets Instead
                        </button>
                      </div>
                    );
                  }

                  return similarProducts.map(p => {
                    const isSelected = selectedSourceProduct?.id === p.id;
                    const sameCat = formData.categoryId && p.categoryId === formData.categoryId;
                    const sameSubCat = formData.subCategoryId && p.subCategoryId === formData.subCategoryId;
                    const sameBrand = formData.brand && p.brand && p.brand.toLowerCase().trim() === formData.brand.toLowerCase().trim();

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedSourceProduct(p);
                          setSelectedSourcePreset(null);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-11 h-11 object-cover rounded-xl bg-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-black text-xs flex-shrink-0">
                                PR
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-gray-900">{p.name}</h4>
                                {sameSubCat ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md uppercase">Subcategory Match</span>
                                ) : sameCat ? (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black rounded-md uppercase">Category Match</span>
                                ) : sameBrand ? (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-black rounded-md uppercase">Brand Match</span>
                                ) : null}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 mt-0.5 block">
                                {p.brand ? `${p.brand} • ` : ''}{p.specifications?.length || 0} specification attributes
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              applySharedSpecifications(p);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" /> Use Specs
                          </button>
                        </div>

                        {/* Preview Specs Pills */}
                        {p.specifications && p.specifications.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                            {p.specifications.slice(0, isSelected ? 30 : 6).map((s, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700">
                                <strong className="font-extrabold text-gray-900">{s.key}:</strong> {s.value || '—'}
                              </span>
                            ))}
                            {!isSelected && p.specifications.length > 6 && (
                              <span className="px-2 py-1 text-[10px] font-bold text-gray-400 italic">
                                +{p.specifications.length - 6} more (click to expand)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}

              {/* TAB 2: ALL CATALOG ITEMS */}
              {shareSpecsTab === 'all' && (
                (() => {
                  const candidateProducts = existingProducts
                    .filter(p => p.id !== product?.id)
                    .filter(p => p.specifications && p.specifications.length > 0)
                    .filter(p => {
                      if (!shareSpecsSearch.trim()) return true;
                      const q = shareSpecsSearch.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        (p.brand && p.brand.toLowerCase().includes(q))
                      );
                    });

                  if (candidateProducts.length === 0) {
                    return (
                      <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-2xl">
                        No catalog items found with existing specifications matching your search.
                      </div>
                    );
                  }

                  return candidateProducts.map(p => {
                    const isSelected = selectedSourceProduct?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedSourceProduct(p);
                          setSelectedSourcePreset(null);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover rounded-xl bg-gray-100 flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-black text-xs flex-shrink-0">
                                PR
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-black text-gray-900">{p.name}</h4>
                              <span className="text-[10px] font-bold text-gray-400 block mt-0.5">
                                {p.brand ? `${p.brand} • ` : ''}{p.specifications?.length || 0} specification attributes
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              applySharedSpecifications(p);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" /> Use Specs
                          </button>
                        </div>

                        {/* Preview Specs Pills */}
                        {p.specifications && p.specifications.length > 0 && (
                          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                            {p.specifications.slice(0, isSelected ? 30 : 6).map((s, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700">
                                <strong className="font-extrabold text-gray-900">{s.key}:</strong> {s.value || '—'}
                              </span>
                            ))}
                            {!isSelected && p.specifications.length > 6 && (
                              <span className="px-2 py-1 text-[10px] font-bold text-gray-400 italic">
                                +{p.specifications.length - 6} more (click to expand)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}

              {/* TAB 3: SAVED SPECIFICATION PRESETS */}
              {shareSpecsTab === 'presets' && (
                (() => {
                  const allPresets = [...DEFAULT_SPEC_PRESETS, ...customPresets].filter(preset => {
                    if (!shareSpecsSearch.trim()) return true;
                    const q = shareSpecsSearch.toLowerCase();
                    return (
                      preset.name.toLowerCase().includes(q) ||
                      (preset.categoryName && preset.categoryName.toLowerCase().includes(q))
                    );
                  });

                  if (allPresets.length === 0) {
                    return (
                      <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-2xl">
                        No specification presets found matching search.
                      </div>
                    );
                  }

                  return allPresets.map(preset => {
                    const isSelected = selectedSourcePreset?.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setSelectedSourcePreset(preset);
                          setSelectedSourceProduct(null);
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                              preset.isSystem ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <Bookmark className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-gray-900">{preset.name}</h4>
                                {preset.isSystem ? (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black rounded-md uppercase">Standard System Preset</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md uppercase">Custom Saved Preset</span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 block mt-0.5">
                                {preset.categoryName ? `${preset.categoryName} • ` : ''}{preset.specifications.length} attributes preset
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {!preset.isSystem && (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteCustomPreset(preset.id, e)}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="Delete Custom Preset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                applySharedPreset(preset);
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              <Check className="w-3.5 h-3.5" /> Apply Preset
                            </button>
                          </div>
                        </div>

                        {/* Preview Preset Attribute Pills */}
                        <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                          {preset.specifications.slice(0, isSelected ? 30 : 6).map((s, idx) => (
                            <span key={idx} className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700">
                              <strong className="font-extrabold text-gray-900">{s.key}:</strong> {s.value || 'Empty Value'}
                            </span>
                          ))}
                          {!isSelected && preset.specifications.length > 6 && (
                            <span className="px-2 py-1 text-[10px] font-bold text-gray-400 italic">
                              +{preset.specifications.length - 6} more (click to expand)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()
              )}

            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-100 flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-400">
                Specifications will be cloned cleanly into this product without affecting other products.
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowShareSpecsModal(false);
                    setSelectedSourceProduct(null);
                    setSelectedSourcePreset(null);
                  }}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer w-1/2 sm:w-auto"
                >
                  Cancel
                </button>
                {selectedSourceProduct && (
                  <button
                    type="button"
                    onClick={() => applySharedSpecifications(selectedSourceProduct)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 cursor-pointer w-1/2 sm:w-auto flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Apply ({selectedSourceProduct.specifications?.length || 0})
                  </button>
                )}
                {selectedSourcePreset && (
                  <button
                    type="button"
                    onClick={() => applySharedPreset(selectedSourcePreset)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 cursor-pointer w-1/2 sm:w-auto flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Apply Preset ({selectedSourcePreset.specifications.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom Preset Prompt Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 space-y-5 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">Save Specifications as Reusable Preset</h3>
                <p className="text-xs font-bold text-gray-400 mt-0.5">
                  Save current specification keys & values to reuse on similar products later
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Preset Template Name</label>
              <input
                type="text"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                placeholder={`e.g. ${formData.brand || 'Flagship'} - ${formData.specifications?.length || 0} Specs Preset`}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-600 focus:bg-white transition-all"
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 max-h-36 overflow-y-auto space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                Preview Attributes ({getActiveTabSpecs().length}):
              </span>
              {getActiveTabSpecs().map((s, idx) => (
                <div key={idx} className="text-[10px] font-bold text-gray-700">
                  • <strong className="font-extrabold text-gray-900">{s.key || 'Empty Key'}:</strong> {s.value || 'Empty Value'}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomPreset}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1"
              >
                <Bookmark className="w-3.5 h-3.5" /> Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

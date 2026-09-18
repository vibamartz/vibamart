import React, { useState, useRef, useEffect } from 'react';
import { collection, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { logAdminAction, AdminAction } from '../../backend/services/adminLogService';
import { Product, ProductVariant, LocationAvailabilityRule } from '../../shared/types';
import { CATEGORIES } from '../../shared/constants';
import toast from 'react-hot-toast';
import { Upload, X, Check, Search, Copy, Sparkles, Hash, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Layers, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { useCategoryStore, useSettingsStore } from '../../backend/store';
import { ProductImageUploader, KEYWORD_SUGGESTIONS } from '../pages/AdminDashboard';
import { VariantImageInput, VariantMultiImageInput } from './VariantImageInput';
import ProductLocationManager from './ProductLocationManager';

import { createSlug } from '../../shared/utilities/slug';
import { generateUniqueProductCode, formatProductCode, validateProductCode, isProductCodeUnique } from '../../shared/utilities/productCode';
import { query, orderBy, getDocs } from 'firebase/firestore';
import { cleanForFirestore } from '../../shared/utilities/firestoreUtils';
import { processAllProductImages } from '../../backend/services/productStorageService';

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
      variants: [],
      variantAttributes: ['color', 'size'],
      sizeChart: '',
      specifications: [],
      features: [],
      serviceablePincodes: [],
      availabilityRules: [],
      color: '',
      size: '',
      isCodAllowed: true,
      isStockVisible: true,
      createdAt: new Date().toISOString(),
    };
    if (product) {
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
        color: product.color || '',
        size: product.size || '',
        sizeChart: product.sizeChart || '',
        variantAttributes: product.variantAttributes || ['color', 'size'],
        specifications: product.specifications || [],
        categoryId: product.categoryId || '',
        subCategoryId: product.subCategoryId || '',
        nestedSubCategoryId: product.nestedSubCategoryId || '',
        isCodAllowed: product.isCodAllowed !== false,
        isStockVisible: product.isStockVisible !== false,
        variants: (product.variants || []).map(v => {
          const vImages = Array.isArray(v.images) && v.images.length > 0
            ? v.images.slice(0, 8)
            : (v.image ? [v.image] : []);
          return {
            ...v,
            name: v.name || '',
            color: v.color || '',
            colorHex: v.colorHex || '#000000',
            colorName: v.colorName || '',
            size: v.size || '',
            shoeSize: v.shoeSize || '',
            storage: v.storage || '',
            ram: v.ram || '',
            shade: v.shade || '',
            volume: v.volume || '',
            material: v.material || '',
            model: v.model || '',
            sku: v.sku || '',
            image: vImages[0] || '',
            images: vImages,
            price: v.price || 0,
            stock: v.stock || 0,
            disabled: v.disabled || false,
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

      const rawData = {
        ...formData,
        id: pid,
        productCode: finalProductCode,
        images: processedImages,
        primaryImage: processedPrimaryImage,
        variants: processedVariants,
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
    setFormData(prev => ({ ...prev, variants: [...(prev.variants || []), newVariant] }));
  };

  const removeVariant = (id: string) => {
    setFormData(prev => ({ ...prev, variants: prev.variants?.filter(v => v.id !== id) }));
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
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.map(v => v.id === id ? { ...v, disabled: !v.disabled } : v)
    }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.map(v => {
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
      })
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
    const currentSpecs = formData.specifications || [];
    setFormData(prev => ({
      ...prev,
      specifications: [...currentSpecs, { key, value }]
    }));
  };

  const updateSpecification = (index: number, key: string, value: string) => {
    const currentSpecs = [...(formData.specifications || [])];
    currentSpecs[index] = { key, value };
    setFormData(prev => ({ ...prev, specifications: currentSpecs }));
  };

  const removeSpecification = (index: number) => {
    const currentSpecs = (formData.specifications || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, specifications: currentSpecs }));
  };

  const moveSpecification = (index: number, direction: 'up' | 'down') => {
    const specs = [...(formData.specifications || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= specs.length) return;
    const temp = specs[index];
    specs[index] = specs[targetIndex];
    specs[targetIndex] = temp;
    setFormData(prev => ({ ...prev, specifications: specs }));
  };

  const addQuickSpecTemplate = (keyName: string) => {
    const currentSpecs = formData.specifications || [];
    if (!currentSpecs.some(s => s.key.toLowerCase() === keyName.toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        specifications: [...currentSpecs, { key: keyName, value: '' }]
      }));
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



          {/* Variant Matrix */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Variant Matrix</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                  Manage variant values, prices, stock, images & availability
                </p>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="px-6 py-3 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Append Variant
              </button>
            </div>

            <div className="space-y-6">
              {(formData.variants || []).map((v, idx) => {
                const attrs = formData.variantAttributes || ['color', 'size'];
                return (
                  <div
                    key={v.id}
                    className={`p-8 rounded-[32px] border-2 transition-all relative space-y-6 ${
                      v.disabled ? 'bg-gray-100/60 border-gray-200 opacity-70' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    {/* Top Action Header */}
                    <div className="flex items-center justify-between border-b border-gray-200/60 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                          {v.name || v.color || v.size || `Variant ${idx + 1}`}
                        </span>
                        {v.disabled && (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-full">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveVariant(idx, 'up')}
                          disabled={idx === 0}
                          className="p-2 bg-white rounded-xl text-gray-500 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveVariant(idx, 'down')}
                          disabled={idx === (formData.variants || []).length - 1}
                          className="p-2 bg-white rounded-xl text-gray-500 hover:text-gray-900 disabled:opacity-30 border border-gray-200"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleVariantDisabled(v.id)}
                          className={`p-2 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1 ${
                            v.disabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {v.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {v.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVariant(v.id)}
                          className="p-2 bg-white text-rose-500 rounded-xl border border-rose-200 hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                      <div className="col-span-2 lg:col-span-4 space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant Display Name / Label</label>
                        <input
                          className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                          placeholder="e.g. Midnight Blue / 128GB"
                          value={v.name || ''}
                          onChange={e => updateVariant(v.id, 'name', e.target.value)}
                        />
                      </div>

                      {attrs.includes('color') && (
                        <>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Color Name</label>
                            <input
                              className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                              placeholder="e.g. Midnight Blue"
                              value={v.color || v.colorName || ''}
                              onChange={e => {
                                updateVariant(v.id, 'color', e.target.value);
                                updateVariant(v.id, 'colorName', e.target.value);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Color Hex Code</label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="color"
                                value={v.colorHex || '#000000'}
                                onChange={e => updateVariant(v.id, 'colorHex', e.target.value)}
                                className="w-10 h-10 rounded-xl cursor-pointer border-0"
                              />
                              <input
                                className="flex-1 bg-white rounded-xl px-3 py-2.5 text-xs font-mono font-bold outline-none border border-gray-200 uppercase"
                                placeholder="#000000"
                                value={v.colorHex || ''}
                                onChange={e => updateVariant(v.id, 'colorHex', e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {attrs.includes('size') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Size</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. S, M, L, XL"
                            value={v.size || ''}
                            onChange={e => updateVariant(v.id, 'size', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('shoeSize') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Shoe Size (UK/US)</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. UK 8 / EU 42"
                            value={v.shoeSize || ''}
                            onChange={e => updateVariant(v.id, 'shoeSize', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('storage') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Storage Capacity</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. 128GB, 256GB"
                            value={v.storage || ''}
                            onChange={e => updateVariant(v.id, 'storage', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('ram') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">RAM</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. 8GB, 16GB"
                            value={v.ram || ''}
                            onChange={e => updateVariant(v.id, 'ram', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('shade') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Beauty Shade</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. Ruby Red, Nude 02"
                            value={v.shade || ''}
                            onChange={e => updateVariant(v.id, 'shade', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('volume') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Volume / Size</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. 50ml, 100ml"
                            value={v.volume || ''}
                            onChange={e => updateVariant(v.id, 'volume', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('material') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Material</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. Teak Wood, Cotton"
                            value={v.material || ''}
                            onChange={e => updateVariant(v.id, 'material', e.target.value)}
                          />
                        </div>
                      )}

                      {attrs.includes('model') && (
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Model / Variant</label>
                          <input
                            className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                            placeholder="e.g. Pro, Ultra"
                            value={v.model || ''}
                            onChange={e => updateVariant(v.id, 'model', e.target.value)}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Selling Price (₹)</label>
                        <input
                          type="number"
                          className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                          value={v.price ?? 0}
                          onChange={e => updateVariant(v.id, 'price', Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Stock Units</label>
                        <input
                          type="number"
                          className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                          value={v.stock ?? 0}
                          onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant SKU</label>
                        <input
                          className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-gray-200"
                          value={v.sku || ''}
                          onChange={e => updateVariant(v.id, 'sku', e.target.value)}
                        />
                      </div>

                      <div className="col-span-2 lg:col-span-4">
                        <VariantMultiImageInput
                          images={v.images || (v.image ? [v.image] : [])}
                          onChange={imgs => updateVariant(v.id, 'images', imgs)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {(!formData.variants || formData.variants.length === 0) && (
                <div className="py-12 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[32px]">
                  No sub-variants initialized. Click "Append Variant" to add options.
                </div>
              )}
            </div>
          </div>

          {/* Specifications Management Section */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Product Specifications</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                  Manage structured technical attributes shown on Product Details
                </p>
              </div>
              <button
                type="button"
                onClick={() => addSpecification()}
                className="px-6 py-3 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Field
              </button>
            </div>

            {/* Quick Template Buttons */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Quick Category Attributes</span>
              <div className="flex flex-wrap gap-2">
                {['Brand', 'Model', 'Material', 'Color', 'Size', 'Dimensions', 'Weight', 'Capacity', 'Compatibility', 'Warranty'].map(tpl => (
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

            <div className="space-y-4">
              {(formData.specifications || []).map((spec, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <input
                    type="text"
                    placeholder="Attribute Name (e.g. Brand, Warranty)"
                    value={spec.key}
                    onChange={e => updateSpecification(idx, e.target.value, spec.value)}
                    className="w-1/3 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Specification Value (e.g. 1 Year Warranty)"
                    value={spec.value}
                    onChange={e => updateSpecification(idx, spec.key, e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => moveSpecification(idx, 'up')}
                    disabled={idx === 0}
                    className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSpecification(idx, 'down')}
                    disabled={idx === (formData.specifications || []).length - 1}
                    className="p-2 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSpecification(idx)}
                    className="p-2 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {(!formData.specifications || formData.specifications.length === 0) && (
                <div className="py-8 text-center text-gray-400 font-bold italic border-2 border-dashed border-gray-200 rounded-[28px]">
                  No specification fields added. Use Quick Category Attributes above or click Add Field.
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
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Inventory Depth</label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData(p => ({ ...p, stock: Number(e.target.value) }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50/80 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-gray-900 block">Cash on Delivery (COD)</span>
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Enable or disable COD for checkout</span>
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
                    <span className="text-[10px] font-bold text-gray-400 block mt-0.5">Display stock status to customers</span>
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

          {/* Category Variant Attributes Config */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Enabled Variant Attributes</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                Select which variant options apply to this product category
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'color', label: 'Color (Name & Swatch)' },
                { id: 'size', label: 'Size (Clothing / Dimensions)' },
                { id: 'shoeSize', label: 'Shoe Size (Footwear)' },
                { id: 'storage', label: 'Storage (128GB, 256GB)' },
                { id: 'ram', label: 'RAM (8GB, 16GB)' },
                { id: 'shade', label: 'Shade (Beauty)' },
                { id: 'volume', label: 'Size / Volume (50ml, 100ml)' },
                { id: 'material', label: 'Material' },
                { id: 'model', label: 'Model / Variant' }
              ].map(attr => {
                const isChecked = (formData.variantAttributes || []).includes(attr.id);
                return (
                  <button
                    key={attr.id}
                    type="button"
                    onClick={() => toggleVariantAttribute(attr.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border-2 ${
                      isChecked
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-gray-50 text-gray-600 border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5" />}
                    {attr.label}
                  </button>
                );
              })}
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
    </motion.div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { collection, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { logAdminAction, AdminAction } from '../services/adminLogService';
import { Product, ProductVariant } from '../types';
import { CATEGORIES } from '../constants';
import toast from 'react-hot-toast';
import { Upload, X, Check, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useCategoryStore, useSettingsStore } from '../store';
import { ProductImageUploader, KEYWORD_SUGGESTIONS } from '../pages/AdminDashboard';

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
      features: [],
      serviceablePincodes: [],
      color: '',
      size: '',
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
        color: product.color || '',
        size: product.size || '',
        categoryId: product.categoryId || '',
        subCategoryId: product.subCategoryId || '',
        nestedSubCategoryId: product.nestedSubCategoryId || '',
        variants: (product.variants || []).map(v => ({
          ...v,
          name: v.name || '',
          color: v.color || '',
          size: v.size || '',
          material: v.material || '',
          sku: v.sku || '',
          image: v.image || '',
          price: v.price || 0,
          stock: v.stock || 0,
        })),
        images: product.images || [],
        tags: product.tags || [],
        features: product.features || [],
        serviceablePincodes: product.serviceablePincodes || [],
        price: product.discountPrice !== undefined && product.discountPrice !== null ? product.discountPrice : product.price,
        mrp: product.discountPrice !== undefined && product.discountPrice !== null ? product.price : (product.mrp || product.price),
        stock: product.stock || 0,
        gst: product.gst || 0,
        discountPercentage: product.discountPercentage || 0,
      };
    }
    return defaults;
  });

  const [currentTag, setCurrentTag] = useState('');
  const [busy, setBusy] = useState(false);

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

    setBusy(true);
    const toastId = toast.loading(product ? 'Synchronizing product update...' : 'Initializing new product record...');

    try {
      const pid = product?.id || `prod_${Date.now()}`;
      const mrp = formData.mrp || 0;
      const price = formData.price || 0;
      const isDiscounted = mrp > 0 && price > 0 && mrp > price;

      const rawData = {
        ...formData,
        id: pid,
        price: isDiscounted ? mrp : price,
        discountPrice: isDiscounted ? price : null,
        mrp: mrp || price,
        discountPercentage: isDiscounted ? Math.round(((mrp - price) / mrp) * 100) : 0,
        updatedAt: new Date().toISOString()
      };

      // Clean undefined values
      const productData: any = {};
      Object.keys(rawData).forEach(key => {
        const value = (rawData as any)[key];
        if (value !== undefined) {
          productData[key] = value;
        }
      });

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
      toast.error('Deployment Failed', { id: toastId });
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setBusy(false);
    }
  };

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: `var_${Date.now()}`,
      color: '',
      size: '',
      material: '',
      price: formData.price || 0,
      stock: 0,
      sku: `${formData.sku}_VAR_${formData.variants?.length || 0}`,
      image: formData.primaryImage || ''
    };
    setFormData(prev => ({ ...prev, variants: [...(prev.variants || []), newVariant] }));
  };

  const removeVariant = (id: string) => {
    setFormData(prev => ({ ...prev, variants: prev.variants?.filter(v => v.id !== id) }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants?.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
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
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Color Palette</label>
                <input
                  maxLength={40}
                  value={formData.color}
                  onChange={e => setFormData(p => ({ ...p, color: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Enter Color (Max 40)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Dimension Matrix</label>
                <input
                  maxLength={50}
                  value={formData.size}
                  onChange={e => setFormData(p => ({ ...p, size: e.target.value }))}
                  className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  placeholder="Enter Size (Max 50)"
                />
              </div>
            </div>
          </div>

          {/* Variant System */}
          <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Variant Matrix</h3>
              <button
                type="button"
                onClick={addVariant}
                className="px-6 py-3 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all"
              >
                Append Variant
              </button>
            </div>

            <div className="space-y-6">
              {(formData.variants || []).map((v, idx) => (
                <div key={v.id} className="p-8 bg-gray-50 rounded-[32px] grid grid-cols-2 lg:grid-cols-4 gap-6 items-end relative">
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="absolute -top-3 -right-3 p-3 bg-white text-red-500 rounded-full shadow-lg hover:bg-red-500 hover:text-white transition-all z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Color</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. Red" value={v.color} onChange={e => updateVariant(v.id, 'color', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Size</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. XL" value={v.size} onChange={e => updateVariant(v.id, 'size', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Material</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" placeholder="e.g. Cotton" value={v.material} onChange={e => updateVariant(v.id, 'material', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Individual Price (₹)</label>
                    <input type="number" className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.price} onChange={e => updateVariant(v.id, 'price', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Stock Units</label>
                    <input type="number" className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.stock} onChange={e => updateVariant(v.id, 'stock', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant SKU</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.sku} onChange={e => updateVariant(v.id, 'sku', e.target.value)} />
                  </div>
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-gray-400">Variant Specific Asset URL</label>
                    <input className="w-full bg-white rounded-xl px-4 py-2.5 text-xs font-bold outline-none" value={v.image} onChange={e => updateVariant(v.id, 'image', e.target.value)} />
                  </div>
                </div>
              ))}
              {(!formData.variants || formData.variants.length === 0) && (
                <div className="py-12 text-center text-gray-300 font-bold italic border-2 border-dashed border-gray-100 rounded-[32px]">
                  No sub-variants initialized.
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">GST/Tax (%)</label>
                  <input
                    type="number"
                    value={formData.gst}
                    onChange={e => setFormData(p => ({ ...p, gst: Number(e.target.value) }))}
                    className="w-full bg-gray-50 border-4 border-transparent rounded-[24px] px-8 py-5 outline-none focus:bg-white focus:border-primary/5 transition-all font-black text-sm"
                  />
                </div>
              </div>
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
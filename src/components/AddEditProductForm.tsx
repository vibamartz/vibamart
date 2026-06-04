import React, { useState, useEffect } from 'react';
import { Product, ProductVariant, Category } from '../types';
import { motion } from 'motion/react';
import { 
  Save, X, Image as ImageIcon, Plus, Trash2, Wand2, Calculator, 
  Tag, Info, Settings, Box, Check, UploadCloud 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../lib/firebase';
import { collection, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../store';

interface AddEditProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_PRODUCT: Partial<Product> = {
  name: '',
  sku: '',
  brand: '',
  categoryId: '',
  categories: [],
  description: '',
  mrp: 0,
  discountPrice: 0,
  discountPercentage: 0,
  gst: 0,
  taxInclusive: false,
  stock: 0,
  images: [],
  variants: [],
  specifications: [],
  features: [],
  status: 'active',
  rating: 0,
  numReviews: 0,
};

export default function AddEditProductForm({ product, onClose, onSuccess }: AddEditProductFormProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<Partial<Product>>(DEFAULT_PRODUCT);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Fetch categories for dropdowns
  useEffect(() => {
    const fetchCats = async () => {
      const snap = await getDocs(collection(db, 'categories'));
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setCategories(cats);
    };
    fetchCats();
  }, []);

  // Initialize form
  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        categories: product.categories || [],
        specifications: product.specifications || [],
        features: product.features || [],
        variants: product.variants || [],
        images: product.images || [],
      });
    }
  }, [product]);

  // Calculations
  useEffect(() => {
    const mrp = Number(formData.mrp) || 0;
    const sp = Number(formData.discountPrice) || 0;
    if (mrp > 0 && sp > 0 && mrp >= sp) {
      const discount = Math.round(((mrp - sp) / mrp) * 100);
      if (formData.discountPercentage !== discount) {
        setFormData(prev => ({ ...prev, discountPercentage: discount }));
      }
    } else if (formData.discountPercentage !== 0) {
      setFormData(prev => ({ ...prev, discountPercentage: 0 }));
    }
  }, [formData.mrp, formData.discountPrice]);

  const handleChange = (field: keyof Product, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    const currentImages = formData.images || [];
    if (currentImages.length + files.length > 6) {
      toast.error('Maximum 6 images allowed.');
      return;
    }

    files.forEach(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 2MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index)
    }));
  };

  // AI Generation Mock
  const generateAIDescription = async () => {
    if (!formData.name) {
      toast.error('Please enter a product name first.');
      return;
    }
    setIsGeneratingAI(true);
    
    // Simulate AI delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const brandStr = formData.brand ? ` by ${formData.brand}` : '';
    const desc = `Introducing the premium ${formData.name}${brandStr}. Designed for ultimate performance and stunning aesthetics, this product sets a new standard in its category. Carefully crafted with high-quality materials, it ensures durability and reliability for everyday use. Experience innovation and elegance perfectly blended into one exceptional package.`;
    
    setFormData(prev => ({ ...prev, description: desc }));
    setIsGeneratingAI(false);
    toast.success('Description generated with AI!');
  };

  // Dynamic Lists Handlers
  const handleAddFeature = () => {
    setFormData(prev => ({ ...prev, features: [...(prev.features || []), ''] }));
  };
  const handleFeatureChange = (index: number, val: string) => {
    const newF = [...(formData.features || [])];
    newF[index] = val;
    setFormData(prev => ({ ...prev, features: newF }));
  };
  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({ ...prev, features: prev.features?.filter((_, i) => i !== index) }));
  };

  const handleAddSpec = () => {
    setFormData(prev => ({ ...prev, specifications: [...(prev.specifications || []), { key: '', value: '' }] }));
  };
  const handleSpecChange = (index: number, field: 'key'|'value', val: string) => {
    const newS = [...(formData.specifications || [])];
    newS[index][field] = val;
    setFormData(prev => ({ ...prev, specifications: newS }));
  };
  const handleRemoveSpec = (index: number) => {
    setFormData(prev => ({ ...prev, specifications: prev.specifications?.filter((_, i) => i !== index) }));
  };

  const handleAddVariant = () => {
    setFormData(prev => ({ 
      ...prev, 
      variants: [...(prev.variants || []), { id: Date.now().toString(), name: '', color: '', size: '', stock: 0, price: 0 }] 
    }));
  };
  const handleVariantChange = (index: number, field: keyof ProductVariant, val: any) => {
    const newV = [...(formData.variants || [])];
    newV[index] = { ...newV[index], [field]: val };
    setFormData(prev => ({ ...prev, variants: newV }));
  };
  const handleRemoveVariant = (index: number) => {
    setFormData(prev => ({ ...prev, variants: prev.variants?.filter((_, i) => i !== index) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId || !formData.mrp || !formData.discountPrice) {
      toast.error('Please fill all required fields (*)');
      return;
    }
    
    setIsSaving(true);
    try {
      if (product?.id) {
        await updateDoc(doc(db, 'products', product.id), {
          ...formData,
        });
        toast.success('Product updated successfully!');
      } else {
        const newRef = doc(collection(db, 'products'));
        await setDoc(newRef, {
          id: newRef.id,
          vendorId: user?.uid || 'admin',
          createdAt: new Date().toISOString(),
          ...formData,
        });
        toast.success('Product created successfully!');
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryToggle = (catId: string) => {
    const currentCats = formData.categories || [];
    if (currentCats.includes(catId)) {
      setFormData(prev => ({ ...prev, categories: currentCats.filter(id => id !== catId) }));
    } else {
      setFormData(prev => ({ ...prev, categories: [...currentCats, catId] }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-4xl bg-white h-full flex flex-col shadow-2xl rounded-l-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50 rounded-tl-3xl">
          <div>
            <h2 className="text-2xl font-black text-gray-900">{product ? 'Edit Product' : 'Add New Product'}</h2>
            <p className="text-sm text-gray-500">Fill in the details below to publish your product.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar bg-gray-50/30">
          <form id="product-form" onSubmit={handleSave} className="space-y-10">
            
            {/* Section: Basic Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
                <Box className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">Product Name <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" placeholder="e.g. Sony WH-1000XM5 Headphones" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">SKU</label>
                  <input type="text" value={formData.sku} onChange={(e) => handleChange('sku', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono text-sm" placeholder="e.g. SNY-WH-B" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Brand</label>
                  <input type="text" value={formData.brand} onChange={(e) => handleChange('brand', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none" placeholder="e.g. Sony" />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">Primary Category <span className="text-rose-500">*</span></label>
                  <select required value={formData.categoryId} onChange={(e) => handleChange('categoryId', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium text-gray-700">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">Additional Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.filter(c => c.id !== formData.categoryId).map(c => (
                      <button type="button" key={c.id} onClick={() => handleCategoryToggle(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${formData.categories?.includes(c.id) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Media */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold text-gray-900">Media ({formData.images?.length || 0}/6)</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {formData.images?.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border border-gray-200 shadow-sm">
                    <img src={img} alt={`Product ${i}`} className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute top-2 left-2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">Primary</span>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => removeImage(i)} className="bg-white text-rose-600 p-2 rounded-full hover:bg-rose-50 hover:scale-110 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {(formData.images?.length || 0) < 6 && (
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors group">
                    <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mb-2 transition-colors" />
                    <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">Upload Image</span>
                    <span className="text-[10px] text-gray-400 mt-1">Max 2MB</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Section: Description */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold text-gray-900">Description</h3>
                </div>
                <button type="button" onClick={generateAIDescription} disabled={isGeneratingAI} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-70">
                  {isGeneratingAI ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generate AI Description
                </button>
              </div>
              
              <textarea value={formData.description} onChange={(e) => handleChange('description', e.target.value)} rows={5} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none custom-scrollbar" placeholder="Enter a detailed product description..."></textarea>
            </div>

            {/* Section: Pricing & Inventory */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold text-gray-900">Pricing & Inventory</h3>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                  <Calculator className="w-4 h-4" />
                  {formData.discountPercentage}% OFF
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">MRP (Original Price) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">₹</span>
                    <input type="number" required min="0" value={formData.mrp} onChange={(e) => handleChange('mrp', Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Selling Price <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">₹</span>
                    <input type="number" required min="0" value={formData.discountPrice} onChange={(e) => handleChange('discountPrice', Number(e.target.value))} className="w-full bg-white border border-indigo-200 rounded-xl pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all outline-none font-mono text-indigo-900 font-bold shadow-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Stock Quantity</label>
                  <input type="number" min="0" value={formData.stock} onChange={(e) => handleChange('stock', Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono" />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-gray-700">GST Percentage</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-1/2">
                      <input type="number" min="0" max="100" value={formData.gst} onChange={(e) => handleChange('gst', Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-8 pl-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">%</span>
                    </div>
                    <label className="flex items-center cursor-pointer bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 flex-1">
                      <input type="checkbox" checked={formData.taxInclusive} onChange={(e) => handleChange('taxInclusive', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                      <span className="ml-2 text-sm font-bold text-gray-700">Tax Inclusive in MRP</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Specifications & Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Specifications */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-bold text-gray-900">Specifications</h3>
                  </div>
                  <button type="button" onClick={handleAddSpec} className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 flex-1">
                  {formData.specifications?.map((spec, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={spec.key} onChange={(e) => handleSpecChange(i, 'key', e.target.value)} placeholder="e.g. Material" className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                      <input type="text" value={spec.value} onChange={(e) => handleSpecChange(i, 'value', e.target.value)} placeholder="e.g. Aluminum" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                      <button type="button" onClick={() => handleRemoveSpec(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {(!formData.specifications || formData.specifications.length === 0) && <p className="text-sm text-gray-400 italic text-center py-4">No specifications added</p>}
                </div>
              </div>

              {/* Features */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-gray-900">Key Features</h3>
                  </div>
                  <button type="button" onClick={handleAddFeature} className="p-1.5 text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 flex-1">
                  {formData.features?.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                      <input type="text" value={feat} onChange={(e) => handleFeatureChange(i, e.target.value)} placeholder="e.g. 30 hours battery life" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500" />
                      <button type="button" onClick={() => handleRemoveFeature(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {(!formData.features || formData.features.length === 0) && <p className="text-sm text-gray-400 italic text-center py-4">No features added</p>}
                </div>
              </div>
            </div>

            {/* Section: Variants */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <Box className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold text-gray-900">Product Variants</h3>
                </div>
                <button type="button" onClick={handleAddVariant} className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                  <Plus className="w-4 h-4" /> Add Variant
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.variants?.map((v, i) => (
                  <div key={v.id || i} className="bg-gray-50 p-4 rounded-xl border border-gray-200 grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Name</label>
                      <input type="text" value={v.name} onChange={(e) => handleVariantChange(i, 'name', e.target.value)} placeholder="e.g. Large" className="w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Color</label>
                      <input type="text" value={v.color} onChange={(e) => handleVariantChange(i, 'color', e.target.value)} placeholder="Black" className="w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Size</label>
                      <input type="text" value={v.size} onChange={(e) => handleVariantChange(i, 'size', e.target.value)} placeholder="XL" className="w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Extra ₹</label>
                      <input type="number" value={v.extraPrice} onChange={(e) => handleVariantChange(i, 'extraPrice', Number(e.target.value))} placeholder="0" className="w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Stock</label>
                      <input type="number" value={v.stock} onChange={(e) => handleVariantChange(i, 'stock', Number(e.target.value))} placeholder="10" className="w-full border-gray-200 rounded-lg text-sm px-3 py-2 focus:border-indigo-500" />
                    </div>
                    <button type="button" onClick={() => handleRemoveVariant(i)} className="p-2 text-rose-500 hover:bg-rose-100 bg-white border border-rose-100 rounded-lg h-[38px] flex items-center justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!formData.variants || formData.variants.length === 0) && <p className="text-sm text-gray-400 italic text-center py-4">No variants added (Single product type)</p>}
              </div>
            </div>

            {/* Section: Status */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Product Status</h3>
                <p className="text-sm text-gray-500">Determine if this product is visible to customers.</p>
              </div>
              <select 
                value={formData.status} 
                onChange={(e) => handleChange('status', e.target.value)}
                className={`font-bold px-4 py-2.5 rounded-xl border outline-none cursor-pointer ${
                  formData.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                  formData.status === 'inactive' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                  formData.status === 'out_of_stock' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <option value="active">Active (Visible)</option>
                <option value="inactive">Inactive (Hidden)</option>
                <option value="draft">Draft</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex justify-end gap-4 rounded-bl-3xl">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button type="submit" form="product-form" disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70">
            {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Saving...' : (product ? 'Update Product' : 'Publish Product')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

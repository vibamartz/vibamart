import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Banner, Product } from '../../shared/types';
import { 
  GripVertical, Edit2, Trash2, Eye, EyeOff, Plus, Image as ImageIcon, X, Monitor, Smartphone, 
  Save, Calendar, Link as LinkIcon, UploadCloud, Layers, CheckCircle2, AlertCircle, ShoppingBag, 
  Tag, Gift, ExternalLink, Compass, Search, FileText, Check, Sparkles
} from 'lucide-react';
import { useCategoryStore, useRewardsStore } from '../../backend/store';
import { getCategorySlug, getProductSlug, getRewardSlug, createSlug } from '../../shared/utilities/slug';
import { uploadImageFileToStorage } from '../../shared/utilities/cdnImageUtils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

// All standard app pages grouped by section
const APP_PAGE_OPTIONS = [
  {
    group: 'Main Store Pages',
    options: [
      { label: '🏠 Homepage', value: '/', desc: 'Main home screen' },
      { label: '🛍️ All Products Catalog', value: '/products', desc: 'Browse all products' },
      { label: '🗂️ Categories Showcase', value: '/categories', desc: 'Category directory' },
      { label: '🏷️ Deals & Offers Page', value: '/offers', desc: 'All active promotions' },
      { label: '🔥 Super Deal ₹259 Page', value: '/deal259', desc: 'Exclusive 259 deal hub' },
      { label: '🎁 Rewards & Loyalty Program', value: '/rewards', desc: 'Coin redemption & rewards' },
      { label: '🔍 Search Page', value: '/search', desc: 'Direct search screen' },
    ]
  },
  {
    group: 'Account, Cart & Checkout',
    options: [
      { label: '🛒 Shopping Cart', value: '/cart', desc: 'Customer cart' },
      { label: '💳 Checkout Screen', value: '/checkout', desc: 'Order checkout flow' },
      { label: '❤️ My Wishlist', value: '/wishlist', desc: 'Saved favorite items' },
      { label: '📦 Track Order & My Orders', value: '/track-order', desc: 'Order tracking screen' },
      { label: '👤 My Profile & Account', value: '/profile', desc: 'User profile management' },
      { label: '📍 Saved Delivery Addresses', value: '/addresses', desc: 'Address book' },
      { label: '🔔 Notifications & Alerts', value: '/notifications', desc: 'Push notifications center' },
    ]
  },
  {
    group: 'Help, Information & Policies',
    options: [
      { label: '❓ FAQ & Help Center', value: '/faq', desc: 'Frequently asked questions' },
      { label: '📜 Terms of Service', value: '/terms', desc: 'Terms & conditions' },
      { label: '🔒 Privacy Policy', value: '/privacy', desc: 'Data & privacy guidelines' },
      { label: '📞 Contact Us / Support', value: '/contact', desc: 'Customer support page' },
    ]
  }
];

type DestinationType = 'page' | 'category' | 'product' | 'banner-showcase' | 'reward' | 'brand' | 'custom';

export default function BannersManagementView() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatformTab, setActivePlatformTab] = useState<'all' | 'desktop' | 'mobile'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Data for destination picker and validation
  const { categories } = useCategoryStore();
  const { offers: rewardOffers } = useRewardsStore();
  const [dbProducts, setDbProducts] = useState<Product[]>([]);

  useEffect(() => {
    getDocs(collection(db, 'products')).then(snap => {
      setDbProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }).catch(err => console.error("Error loading products for banner validation:", err));
  }, []);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Banner>>({
    title: '',
    subtitle: '',
    image: '',
    link: '',
    slug: '',
    categoryId: 'for-you',
    productIds: [],
    active: true,
    platform: 'all',
    startDate: '',
    endDate: ''
  });

  // Interactive Destination State
  const [destinationType, setDestinationType] = useState<DestinationType>('page');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>('');
  const [selectedNestedSubCatId, setSelectedNestedSubCatId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Search state for product selector inside destination & product assignment
  const [destinationProductSearch, setDestinationProductSearch] = useState('');
  const [assignedProductSearch, setAssignedProductSearch] = useState('');
  const [assignedProductCategoryFilter, setAssignedProductCategoryFilter] = useState('all');

  const [isSaving, setIsSaving] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'file' | 'url'>('file');

  // Drag and Drop refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Extract unique brands from products
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    dbProducts.forEach(p => {
      if (p.brand && p.brand.trim()) {
        brandsSet.add(p.brand.trim());
      }
    });
    return Array.from(brandsSet).sort();
  }, [dbProducts]);

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Banner));
      setBanners(bannerData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching banners:", error);
      toast.error("Failed to load banners.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredBanners = banners.filter(b => {
    const p = b.platform || 'all';
    const platformMatch = activePlatformTab === 'all' || p === 'all' || p === activePlatformTab;
    if (!platformMatch) return false;
    if (selectedCategoryFilter === 'all') return true;
    if (selectedCategoryFilter === 'for-you') return b.categoryId === 'for-you' || !b.categoryId;
    return b.categoryId === selectedCategoryFilter;
  });

  // --- Drag and Drop Logic ---
  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.currentTarget.classList.add('opacity-50', 'bg-indigo-50/50');
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = async (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50', 'bg-indigo-50/50');
    
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newFilteredList = [...filteredBanners];
      const draggedItemContent = newFilteredList[dragItem.current];
      
      // Remove dragged item
      newFilteredList.splice(dragItem.current, 1);
      // Insert it into new position
      newFilteredList.splice(dragOverItem.current, 0, draggedItemContent);
      
      // Update local state temporarily for immediate feedback
      const batch = writeBatch(db);
      newFilteredList.forEach((banner, index) => {
        const bannerRef = doc(db, 'banners', banner.id);
        batch.update(bannerRef, { order: index });
      });

      try {
        await batch.commit();
        toast.success("Banners reordered successfully");
      } catch (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to save new order");
      }
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Helper to infer destination mode from existing link
  const detectDestinationType = (link?: string): DestinationType => {
    if (!link) return 'page';
    if (link.startsWith('/products/') || link.startsWith('/product/')) return 'product';
    if (link.startsWith('/categories/') || link.startsWith('/category/')) return 'category';
    if (link.startsWith('/offers/') || link.startsWith('/offer/') || link.startsWith('/banner/') || link.startsWith('/banners/')) return 'banner-showcase';
    if (link.startsWith('/rewards/')) return 'reward';
    if (link.startsWith('/brands/')) return 'brand';
    const isAppPage = APP_PAGE_OPTIONS.some(g => g.options.some(opt => opt.value === link));
    if (isAppPage) return 'page';
    return 'custom';
  };

  // --- Form Handlers ---
  const handleOpenModal = (banner?: Banner) => {
    setDestinationProductSearch('');
    setAssignedProductSearch('');
    setSelectedCatId('');
    setSelectedSubCatId('');
    setSelectedNestedSubCatId('');
    setSelectedProductId('');

    if (banner) {
      setEditingBanner(banner);
      setImageInputMode(banner.image && !banner.image.startsWith('data:') ? 'url' : 'file');
      setFormData({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image: banner.image || '',
        link: banner.link || '',
        slug: banner.slug || '',
        categoryId: banner.categoryId || 'for-you',
        productIds: banner.productIds || [],
        active: banner.active ?? true,
        platform: banner.platform || 'all',
        startDate: banner.startDate || '',
        endDate: banner.endDate || ''
      });

      const detected = detectDestinationType(banner.link);
      setDestinationType(detected);
    } else {
      setEditingBanner(null);
      setImageInputMode('file');
      setFormData({
        title: '',
        subtitle: '',
        image: '',
        link: '/',
        slug: '',
        categoryId: 'for-you',
        productIds: [],
        active: true,
        platform: 'all',
        startDate: '',
        endDate: ''
      });
      setDestinationType('page');
    }
    setIsModalOpen(true);
  };

  const compressImage = (file: File, maxWidth = 1200, maxHeight = 600, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size exceeds 5 MB limit');
        return;
      }
      try {
        const compressedBase64 = await compressImage(file, 1200, 600, 0.8);
        setFormData(prev => ({ ...prev, image: compressedBase64 }));
      } catch (err) {
        console.error("Failed to compress image:", err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Validate link destination against real existing pages/products/categories/rewards
  const isDestinationValid = useMemo(() => {
    const rawLink = (formData.link || '').trim();
    if (!rawLink) return true; // Optional link

    // External URLs
    if (/^https?:\/\//i.test(rawLink) || rawLink.startsWith('www.')) return true;

    // Standard static routes
    const staticRoutes = [
      '/', '/for-you', '/mobile', '/mobile-home', '/home-mobile', '/products', 
      '/categories', '/offers', '/deal259', '/rewards', '/cart', '/checkout', 
      '/order-success', '/profile', '/wishlist', '/orders', '/track-order', 
      '/requests', '/returns', '/addresses', '/notifications', '/faq', '/terms', 
      '/privacy', '/contact', '/search', '/login', '/seller', '/admin'
    ];
    if (staticRoutes.includes(rawLink)) return true;

    // Check category routes
    if (rawLink.startsWith('/categories/') || rawLink.startsWith('/category/')) {
      const parts = rawLink.replace(/^\/(categories|category)\//, '').split('/');
      const catSlug = parts[0];
      const subSlug = parts[1];
      const catMatch = categories.find(c => c.id === catSlug || c.slug === catSlug || c.seoSlug === catSlug || createSlug(c.name) === catSlug);
      if (!catMatch) return false;
      if (subSlug) {
        const subMatch = catMatch.subcategories?.find(s => s.id === subSlug || s.slug === subSlug || createSlug(s.name) === subSlug);
        return Boolean(subMatch);
      }
      return true;
    }

    // Check product routes
    if (rawLink.startsWith('/products/') || rawLink.startsWith('/product/')) {
      const prodSlug = rawLink.replace(/^\/(products|product)\//, '');
      return dbProducts.some(p => p.id === prodSlug || p.slug === prodSlug || getProductSlug(p) === prodSlug);
    }

    // Check reward routes
    if (rawLink.startsWith('/rewards/')) {
      const rwdSlug = rawLink.replace(/^\/rewards\//, '');
      return rewardOffers.some(r => r.id === rwdSlug || r.slug === rwdSlug || getRewardSlug(r) === rwdSlug);
    }

    // Check brand routes
    if (rawLink.startsWith('/brands/')) {
      const brandSlug = rawLink.replace(/^\/brands\//, '');
      return dbProducts.some(p => p.brand && createSlug(p.brand) === brandSlug);
    }

    // Check offer / banner routes
    if (rawLink.startsWith('/offers/') || rawLink.startsWith('/offer/') || rawLink.startsWith('/banner/') || rawLink.startsWith('/banners/')) {
      return true;
    }

    // Check order tracking with ID
    if (rawLink.startsWith('/track-order/') || rawLink.startsWith('/track-request/')) {
      return true;
    }

    return true; // Allow flexible custom routes
  }, [formData.link, categories, dbProducts, rewardOffers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image || !formData.image.trim()) {
      toast.error('Banner Image is required.');
      return;
    }

    if (!isDestinationValid) {
      toast.error(`Invalid Destination: The target URL "${formData.link}" does not exist. Please select or create a valid destination first.`);
      return;
    }

    setIsSaving(true);
    try {
      const bannerSlug = (formData.slug || createSlug(formData.title || '') || 'special-offer').trim();
      const finalLink = (formData.link || '').trim() || `/offers/${bannerSlug}`;

      // Upload banner image to Storage if base64/blob to get short clean permanent URL
      const cleanBannerImageUrl = await uploadImageFileToStorage(formData.image, {
        folder: 'banners',
        entityName: formData.title || bannerSlug
      });

      // Deduplicate product IDs inside the same banner
      const uniqueProductIds = Array.from(new Set(formData.productIds || []));

      const payload: Record<string, any> = {
        title: formData.title || '',
        subtitle: formData.subtitle || '',
        image: cleanBannerImageUrl || formData.image,
        link: finalLink,
        slug: bannerSlug,
        categoryId: formData.categoryId || 'for-you',
        productIds: uniqueProductIds,
        active: formData.active ?? true,
        platform: formData.platform || 'all',
        startDate: formData.startDate || '',
        endDate: formData.endDate || ''
      };

      if (editingBanner) {
        payload.id = editingBanner.id;
        payload.order = editingBanner.order ?? 0;
        const bannerRef = doc(db, 'banners', editingBanner.id);
        await setDoc(bannerRef, payload, { merge: true });
        toast.success('Banner updated successfully');
      } else {
        const newDocRef = doc(collection(db, 'banners'));
        payload.id = newDocRef.id;
        payload.order = banners.length;
        await setDoc(newDocRef, payload);
        toast.success('Banner created successfully');
      }
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving banner:', error);
      toast.error(`Failed to save banner: ${error?.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteDoc(doc(db, 'banners', id));
        toast.success('Banner deleted');
      } catch (error) {
        console.error('Error deleting banner:', error);
        toast.error('Failed to delete banner');
      }
    }
  };

  const handleToggleVisibility = async (banner: Banner) => {
    try {
      const newVisibility = !banner.active;
      const bannerRef = doc(db, 'banners', banner.id);
      await updateDoc(bannerRef, { active: newVisibility });
      toast.success(`Banner is now ${newVisibility ? 'visible' : 'hidden'}`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const isBannerCurrentlyActive = (banner: Banner) => {
    if (!banner.active) return false;
    const now = new Date().getTime();
    const start = banner.startDate ? new Date(banner.startDate).getTime() : 0;
    const end = banner.endDate ? new Date(banner.endDate).getTime() : Infinity;
    return now >= start && now <= end;
  };

  // Selected Category object for Cascading Subcategories
  const currentCategorySelection = useMemo(() => {
    return categories.find(c => c.id === selectedCatId || getCategorySlug(c) === selectedCatId);
  }, [categories, selectedCatId]);

  const currentSubcategorySelection = useMemo(() => {
    if (!currentCategorySelection || !selectedSubCatId) return null;
    return currentCategorySelection.subcategories?.find(s => s.id === selectedSubCatId || (s.slug && s.slug === selectedSubCatId) || createSlug(s.name) === selectedSubCatId);
  }, [currentCategorySelection, selectedSubCatId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Banner Management</h2>
          <p className="text-sm text-gray-500">Add, customize, and link promotional banners to any store page, category, or product.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      {/* Platform & Category Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm w-fit">
          <button
            onClick={() => setActivePlatformTab('all')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${activePlatformTab === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Layers className="w-4 h-4" />
            All Devices
          </button>
          <button
            onClick={() => setActivePlatformTab('desktop')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${activePlatformTab === 'desktop' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Monitor className="w-4 h-4" />
            Desktop
          </button>
          <button
            onClick={() => setActivePlatformTab('mobile')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer ${activePlatformTab === 'mobile' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Smartphone className="w-4 h-4" />
            Mobile
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Category Filter:</span>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 font-bold text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Categories</option>
            <option value="for-you">For You Category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>Category: {cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Banner List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 font-medium">Loading banners...</div>
        ) : filteredBanners.length === 0 ? (
          <div className="p-10 text-center text-gray-400 font-medium">No {activePlatformTab} banners found. Click "Add Banner" to create one.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBanners.map((banner, index) => {
              const currentlyActive = isBannerCurrentlyActive(banner);
              return (
                <div
                  key={banner.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col md:flex-row gap-6 p-6 items-center hover:bg-gray-50/80 transition-colors bg-white cursor-move group"
                >
                  <div className="flex justify-center text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0">
                    <GripVertical className="w-6 h-6" />
                  </div>
                  
                  {/* Banner Preview */}
                  <div className={`shrink-0 border-2 border-gray-100 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center ${activePlatformTab === 'desktop' ? 'w-64 h-32' : 'w-32 h-48'}`}>
                    {banner.image ? (
                      <img src={banner.image} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  
                  {/* Banner Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-bold text-gray-900 truncate">{banner.title || 'Untitled Banner'}</h4>
                      {!currentlyActive && banner.active && (
                         <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Scheduled (Inactive Now)</span>
                      )}
                      {!banner.active && (
                         <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Disabled</span>
                      )}
                    </div>
                    {banner.subtitle && <p className="text-sm text-gray-500 mb-2 truncate">{banner.subtitle}</p>}
                    
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        Category: {banner.categoryId === 'for-you' || !banner.categoryId
                          ? 'For You'
                          : categories.find(c => c.id === banner.categoryId || c.slug === banner.categoryId)?.name || banner.categoryId}
                      </span>
                      {banner.link && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg w-fit">
                          <LinkIcon className="w-3 h-3" />
                          <span className="truncate max-w-[240px]">{banner.link}</span>
                        </div>
                      )}
                      {banner.productIds && banner.productIds.length > 0 && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit">
                          <ShoppingBag className="w-3 h-3 text-emerald-600" />
                          {banner.productIds.length} Products Assigned
                        </span>
                      )}
                      {(banner.startDate || banner.endDate) && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg w-fit">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {banner.startDate ? new Date(banner.startDate).toLocaleDateString() : 'Now'} - {banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'Forever'}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleVisibility(banner)}
                      className={`p-2.5 rounded-xl transition-colors cursor-pointer ${banner.active ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                      title={banner.active ? 'Active' : 'Hidden'}
                    >
                      {banner.active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleOpenModal(banner)}
                      className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                      title="Edit Banner"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                      title="Delete Banner"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !isSaving && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {editingBanner ? 'Edit Promotional Banner' : 'Create New Promotional Banner'}
                    </h3>
                    <p className="text-xs text-gray-500">Configure destination page, products, images, and device settings.</p>
                  </div>
                </div>
                <button
                  onClick={() => !isSaving && setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form id="banner-form" onSubmit={handleSave} className="space-y-8">
                  
                  {/* Image Upload Area */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-indigo-600" />
                        Banner Image <span className="text-rose-500">*</span>
                      </label>

                      {/* Image Source Mode Toggle: File Upload vs URL Link */}
                      <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setImageInputMode('file')}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            imageInputMode === 'file'
                              ? 'bg-white text-indigo-600 shadow-xs'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <UploadCloud className="w-3.5 h-3.5" /> File Upload
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageInputMode('url')}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            imageInputMode === 'url'
                              ? 'bg-white text-indigo-600 shadow-xs'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> Image URL / Link
                        </button>
                      </div>
                    </div>

                    {/* Image Preview / Input Area */}
                    {formData.image ? (
                      <div className="space-y-3">
                        <div className={`relative group w-full ${formData.platform === 'desktop' ? 'aspect-[21/9] md:aspect-[3/1]' : 'aspect-[4/5] max-w-sm mx-auto'} rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-sm bg-gray-50 flex items-center justify-center`}>
                          <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2.5 p-4">
                            <label className="cursor-pointer bg-white text-gray-900 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5">
                              <UploadCloud className="w-3.5 h-3.5 text-indigo-600" /> Upload File
                              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </label>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-1.5 cursor-pointer border border-rose-200"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        </div>

                        {imageInputMode === 'url' && (
                          <div className="space-y-1">
                            <div className="relative">
                              <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                              <input
                                type="url"
                                value={formData.image}
                                onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                placeholder="https://example.com/banner-image.jpg"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-xs font-medium"
                              />
                            </div>
                            <p className="text-[11px] text-gray-400">Direct image link (HTTPS). Changes preview immediately.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {imageInputMode === 'file' ? (
                          <label className={`w-full ${formData.platform === 'desktop' ? 'aspect-[21/9] md:aspect-[3/1]' : 'aspect-[4/5] max-w-sm mx-auto'} rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors group`}>
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                              <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-indigo-500" />
                            </div>
                            <p className="text-sm font-bold text-gray-700">Click or drag image file to upload</p>
                            <p className="text-xs text-gray-500 mt-1">Supports JPG, PNG, WebP, GIF (Max 5MB)</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Recommended ratio: 3:1 (Desktop) / 2:1 (Mobile)</p>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                          </label>
                        ) : (
                          <div className="space-y-2 bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <label className="text-xs font-bold text-gray-700">Paste Image URL / Link</label>
                            <div className="relative">
                              <LinkIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                              <input
                                type="url"
                                value={formData.image || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                                placeholder="https://example.com/banner-image.jpg"
                                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-xs font-medium"
                              />
                            </div>
                            <p className="text-[11px] text-gray-400">Paste a link to any public image (e.g. CDN, Cloud Storage, or Unsplash).</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Basic Banner Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700">Banner Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                        placeholder="e.g. Mega Summer Electronics Sale"
                      />
                    </div>
                    
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-bold text-gray-700">Subtitle / Promotional Tagline</label>
                      <input
                        type="text"
                        value={formData.subtitle}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-medium"
                        placeholder="e.g. Get up to 50% discount + Free delivery today"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Target Platform</label>
                      <select
                        value={formData.platform || 'all'}
                        onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium text-sm text-gray-900"
                      >
                        <option value="all">All Devices (Mobile + Desktop)</option>
                        <option value="desktop">Desktop Only</option>
                        <option value="mobile">Mobile Only</option>
                      </select>
                    </div>

                    {/* Display Location / Category association */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Display Placement Location</label>
                      <select
                        value={formData.categoryId || 'for-you'}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-medium text-sm text-gray-900"
                      >
                        <option value="for-you">🏠 For You (Main Homepage Hero Banner)</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>🗂️ Category Section: {cat.name} ({getCategorySlug(cat)})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* --- COMPREHENSIVE BANNER DESTINATION (PAGE OPTIONS / PRODUCT / CATEGORY) -- */}
                  {/* ========================================================================= */}
                  <div className="space-y-4 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 p-6 rounded-3xl border border-indigo-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-100">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <Compass className="w-5 h-5 text-indigo-600" />
                          Banner Click Destination (All Page & Product Options)
                        </h4>
                        <p className="text-xs text-gray-500">Select where users land when clicking this banner.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDestinationValid ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verified Destination
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Invalid Route
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Destination Mode Selector Tabs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('page');
                          setFormData(prev => ({ ...prev, link: '/' }));
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'page'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 mb-1" />
                        App Pages
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('product');
                          if (dbProducts.length > 0) {
                            const firstProd = dbProducts[0];
                            setFormData(prev => ({ ...prev, link: `/products/${getProductSlug(firstProd)}` }));
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'product'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 mb-1" />
                        Specific Product
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('category');
                          if (categories.length > 0) {
                            const firstCat = categories[0];
                            setSelectedCatId(firstCat.id);
                            setFormData(prev => ({ ...prev, link: `/categories/${getCategorySlug(firstCat)}` }));
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'category'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Layers className="w-4 h-4 mb-1" />
                        Category
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('banner-showcase');
                          const bSlug = formData.slug || createSlug(formData.title || 'special-offer') || 'special-offer';
                          setFormData(prev => ({ ...prev, link: `/offers/${bSlug}` }));
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'banner-showcase'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 mb-1" />
                        Offer Hub
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('reward');
                          if (rewardOffers.length > 0) {
                            setFormData(prev => ({ ...prev, link: `/rewards/${getRewardSlug(rewardOffers[0])}` }));
                          } else {
                            setFormData(prev => ({ ...prev, link: '/rewards' }));
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'reward'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Gift className="w-4 h-4 mb-1" />
                        Rewards
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('brand');
                          if (availableBrands.length > 0) {
                            setFormData(prev => ({ ...prev, link: `/brands/${createSlug(availableBrands[0])}` }));
                          } else {
                            setFormData(prev => ({ ...prev, link: '/products' }));
                          }
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'brand'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Tag className="w-4 h-4 mb-1" />
                        Brand
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDestinationType('custom');
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                          destinationType === 'custom'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 scale-102'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <ExternalLink className="w-4 h-4 mb-1" />
                        Custom URL
                      </button>
                    </div>

                    {/* Mode 1: ALL APP PAGE OPTIONS */}
                    {destinationType === 'page' && (
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          Choose Application Page Destination
                        </label>
                        <select
                          value={formData.link || '/'}
                          onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-semibold text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                        >
                          {APP_PAGE_OPTIONS.map((grp) => (
                            <optgroup key={grp.group} label={`── ${grp.group} ──`} className="font-bold text-gray-900">
                              {grp.options.map(opt => (
                                <option key={opt.value} value={opt.value} className="font-medium text-gray-800 py-1">
                                  {opt.label} ({opt.value}) - {opt.desc}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Mode 2: SPECIFIC PRODUCT SELECTOR */}
                    {destinationType === 'product' && (
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                            <ShoppingBag className="w-4 h-4 text-indigo-600" />
                            Search & Select Target Product
                          </label>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {dbProducts.length} Products Available
                          </span>
                        </div>

                        {/* Search Product Input */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            value={destinationProductSearch}
                            onChange={(e) => setDestinationProductSearch(e.target.value)}
                            placeholder="Type product name, SKU, or brand..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                          />
                        </div>

                        {/* Product List Selector */}
                        <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-gray-50/50">
                          {dbProducts
                            .filter(p => {
                              if (!destinationProductSearch.trim()) return true;
                              const q = destinationProductSearch.toLowerCase();
                              return (
                                p.name.toLowerCase().includes(q) ||
                                (p.sku && p.sku.toLowerCase().includes(q)) ||
                                (p.brand && p.brand.toLowerCase().includes(q))
                              );
                            })
                            .slice(0, 20)
                            .map(prod => {
                              const prodSlug = getProductSlug(prod);
                              const targetLink = `/products/${prodSlug}`;
                              const isSelected = formData.link === targetLink || formData.link === `/product/${prod.id}`;
                              return (
                                <div
                                  key={prod.id}
                                  onClick={() => {
                                    setSelectedProductId(prod.id);
                                    setFormData(prev => ({ ...prev, link: targetLink }));
                                  }}
                                  className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                    isSelected ? 'bg-indigo-50/90 text-indigo-900 border-l-4 border-indigo-600' : 'hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <img
                                      src={prod.images?.[0] || 'https://via.placeholder.com/40'}
                                      alt={prod.name}
                                      className="w-10 h-10 object-cover rounded-lg shrink-0 border border-gray-200"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold text-xs text-gray-900 truncate">{prod.name}</p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                        <span>SKU: {prod.sku || 'N/A'}</span>
                                        {prod.brand && <span>• Brand: {prod.brand}</span>}
                                        <span className="font-bold text-emerald-600">• ₹{prod.discountPrice || prod.price}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                      <Check className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-bold text-indigo-600 hover:underline">Select</span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Mode 3: CASCADING CATEGORY & SUBCATEGORY SELECTOR */}
                    {destinationType === 'category' && (
                      <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          Choose Target Category / Subcategory
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Main Category */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">1. Main Category</label>
                            <select
                              value={selectedCatId}
                              onChange={(e) => {
                                const catId = e.target.value;
                                setSelectedCatId(catId);
                                setSelectedSubCatId('');
                                setSelectedNestedSubCatId('');
                                const catObj = categories.find(c => c.id === catId || getCategorySlug(c) === catId);
                                if (catObj) {
                                  setFormData(prev => ({ ...prev, link: `/categories/${getCategorySlug(catObj)}` }));
                                }
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                            >
                              <option value="">Select Category...</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Subcategory */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">2. Subcategory (Optional)</label>
                            <select
                              value={selectedSubCatId}
                              disabled={!currentCategorySelection || !currentCategorySelection.subcategories || currentCategorySelection.subcategories.length === 0}
                              onChange={(e) => {
                                const subId = e.target.value;
                                setSelectedSubCatId(subId);
                                setSelectedNestedSubCatId('');
                                if (!subId) {
                                  if (currentCategorySelection) {
                                    setFormData(prev => ({ ...prev, link: `/categories/${getCategorySlug(currentCategorySelection)}` }));
                                  }
                                } else {
                                  const subObj = currentCategorySelection?.subcategories?.find(s => s.id === subId || s.slug === subId || createSlug(s.name) === subId);
                                  if (currentCategorySelection && subObj) {
                                    const catSlug = getCategorySlug(currentCategorySelection);
                                    const subSlug = subObj.slug || createSlug(subObj.name);
                                    setFormData(prev => ({ ...prev, link: `/categories/${catSlug}/${subSlug}` }));
                                  }
                                }
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:bg-gray-100"
                            >
                              <option value="">Entire Category</option>
                              {currentCategorySelection?.subcategories?.map(sub => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Nested Subcategory */}
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">3. Nested Level (Optional)</label>
                            <select
                              value={selectedNestedSubCatId}
                              disabled={!currentSubcategorySelection || !currentSubcategorySelection.subcategories || currentSubcategorySelection.subcategories.length === 0}
                              onChange={(e) => {
                                const nestId = e.target.value;
                                setSelectedNestedSubCatId(nestId);
                                if (currentCategorySelection && currentSubcategorySelection) {
                                  const catSlug = getCategorySlug(currentCategorySelection);
                                  const subSlug = currentSubcategorySelection.slug || createSlug(currentSubcategorySelection.name);
                                  if (nestId) {
                                    const nestObj = currentSubcategorySelection.subcategories?.find(n => n.id === nestId || n.slug === nestId || createSlug(n.name) === nestId);
                                    const nestSlug = nestObj?.slug || (nestObj ? createSlug(nestObj.name) : nestId);
                                    setFormData(prev => ({ ...prev, link: `/categories/${catSlug}/${subSlug}/${nestSlug}` }));
                                  } else {
                                    setFormData(prev => ({ ...prev, link: `/categories/${catSlug}/${subSlug}` }));
                                  }
                                }
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:bg-gray-100"
                            >
                              <option value="">All in Subcategory</option>
                              {currentSubcategorySelection?.subcategories?.map(nest => (
                                <option key={nest.id} value={nest.id}>
                                  {nest.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mode 4: DEDICATED BANNER OFFER PAGE */}
                    {destinationType === 'banner-showcase' && (
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          Dedicated Banner Landing Page
                        </label>
                        <p className="text-xs text-gray-500">
                          This creates a dedicated showcase page displaying all "Assigned Products" attached to this banner below.
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-gray-100 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-800">/offers/</span>
                          <input
                            type="text"
                            value={formData.slug || (formData.title ? createSlug(formData.title) : '')}
                            onChange={(e) => {
                              const s = createSlug(e.target.value);
                              setFormData(prev => ({ ...prev, slug: s, link: `/offers/${s}` }));
                            }}
                            placeholder="summer-special-offer"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Mode 5: REWARDS & LOYALTY OFFERS */}
                    {destinationType === 'reward' && (
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Gift className="w-4 h-4 text-indigo-600" />
                          Select Reward / Loyalty Offer
                        </label>
                        <select
                          value={formData.link || '/rewards'}
                          onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          <option value="/rewards">🎁 Rewards Overview Hub (/rewards)</option>
                          {rewardOffers.map(rwd => (
                            <option key={rwd.id} value={`/rewards/${getRewardSlug(rwd)}`}>
                              Reward Offer: {rwd.title || rwd.brandName || rwd.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Mode 6: BRAND SHOWCASE */}
                    {destinationType === 'brand' && (
                      <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                        <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-indigo-600" />
                          Select Brand Showcase
                        </label>
                        <select
                          value={formData.link || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          <option value="/products">All Brands (/products)</option>
                          {availableBrands.map(brand => (
                            <option key={brand} value={`/brands/${createSlug(brand)}`}>
                              Brand: {brand}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Target Route Bar (Direct Edit & Validation) */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">Final Computed Destination Route</label>
                        <span className="text-[10px] text-indigo-600 font-bold">Editable Direct URL</span>
                      </div>
                      <div className="relative">
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.link || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                          className={`w-full bg-white border rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 transition-all outline-none font-mono text-xs font-bold ${
                            formData.link && !isDestinationValid 
                              ? 'border-rose-300 focus:ring-rose-500/20 text-rose-900' 
                              : 'border-gray-200 focus:ring-indigo-500/20 text-indigo-900'
                          }`}
                          placeholder="/products or /categories/electronics"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* --- ASSIGNED PRODUCTS IN BANNER (Banner -> Products Multi-Select) -------- */}
                  {/* ========================================================================= */}
                  <div className="space-y-4 bg-gray-50/80 p-6 rounded-3xl border border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-indigo-600" />
                          Assigned Products (Banner → Product Collection)
                        </h4>
                        <p className="text-xs text-gray-500">
                          Attach specific products to this banner. These appear when users open the banner's offer page.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                          {formData.productIds?.length || 0} Products Assigned
                        </span>
                        {formData.productIds && formData.productIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, productIds: [] }))}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-8 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={assignedProductSearch}
                          onChange={(e) => setAssignedProductSearch(e.target.value)}
                          placeholder="Search database products by name, SKU, or brand to add..."
                          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <select
                          value={assignedProductCategoryFilter}
                          onChange={(e) => setAssignedProductCategoryFilter(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          <option value="all">All Categories</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Category Bulk Add */}
                    {assignedProductCategoryFilter !== 'all' && (
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-indigo-100 text-xs">
                        <span className="text-gray-700 font-medium">
                          Found {dbProducts.filter(p => p.categoryId === assignedProductCategoryFilter).length} products in this category.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const catProducts = dbProducts.filter(p => p.categoryId === assignedProductCategoryFilter);
                            const catIds = catProducts.map(p => p.id);
                            setFormData(prev => ({
                              ...prev,
                              productIds: Array.from(new Set([...(prev.productIds || []), ...catIds]))
                            }));
                            toast.success(`Added ${catProducts.length} products to banner`);
                          }}
                          className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold transition-colors cursor-pointer"
                        >
                          + Add All From This Category
                        </button>
                      </div>
                    )}

                    {/* Search Results Dropdown List */}
                    {assignedProductSearch.trim() && (
                      <div className="bg-white border border-gray-200 rounded-2xl shadow-lg max-h-52 overflow-y-auto divide-y divide-gray-100">
                        {dbProducts
                          .filter(p => {
                            const matchCat = assignedProductCategoryFilter === 'all' || p.categoryId === assignedProductCategoryFilter;
                            const q = assignedProductSearch.toLowerCase();
                            const matchQuery = p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)) || (p.brand && p.brand.toLowerCase().includes(q));
                            return matchCat && matchQuery;
                          })
                          .slice(0, 15)
                          .map(prod => {
                            const isAssigned = formData.productIds?.includes(prod.id);
                            return (
                              <div key={prod.id} className="p-2.5 flex items-center justify-between hover:bg-gray-50 text-xs transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <img src={prod.images?.[0] || 'https://via.placeholder.com/40'} alt={prod.name} className="w-9 h-9 object-cover rounded-lg shrink-0 border border-gray-100" />
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{prod.name}</p>
                                    <p className="text-[10px] text-gray-400">SKU: {prod.sku || 'N/A'} • ₹{prod.discountPrice || prod.price}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isAssigned) {
                                      setFormData(prev => ({ ...prev, productIds: prev.productIds?.filter(id => id !== prod.id) }));
                                    } else {
                                      setFormData(prev => ({ ...prev, productIds: Array.from(new Set([...(prev.productIds || []), prod.id])) }));
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 cursor-pointer ${
                                    isAssigned ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                                >
                                  {isAssigned ? 'Remove' : '+ Assign'}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Assigned Product Chips Grid */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                        {(formData.productIds || []).map(pId => {
                          const prod = dbProducts.find(p => p.id === pId);
                          if (!prod) return null;
                          return (
                            <span key={pId} className="inline-flex items-center gap-2 bg-white border border-indigo-200 text-indigo-950 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs">
                              <img src={prod.images?.[0]} alt="" className="w-5 h-5 rounded-md object-cover border border-gray-100" />
                              <span className="max-w-[150px] truncate">{prod.name}</span>
                              <span className="text-[10px] text-indigo-500 font-bold">₹{prod.discountPrice || prod.price}</span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, productIds: prev.productIds?.filter(id => id !== pId) }))}
                                className="text-gray-400 hover:text-rose-600 transition-colors p-0.5 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          );
                        })}
                        {(!formData.productIds || formData.productIds.length === 0) && (
                          <div className="p-4 text-center w-full text-xs text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-200">
                            No products assigned yet. Use search above to attach individual products or full categories to this banner.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Live Banner Preview Box */}
                  <div className="bg-gradient-to-r from-gray-950 to-indigo-950 p-5 rounded-2xl text-white space-y-3 shadow-lg">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                      <span className="flex items-center gap-1.5"><Eye className="w-4 h-4 text-emerald-400" /> Live Interactive Preview</span>
                      <span className="bg-white/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">
                        {formData.platform === 'desktop' ? 'Desktop Only' : formData.platform === 'mobile' ? 'Mobile Only' : 'Mobile + Desktop'}
                      </span>
                    </div>
                    
                    <div className="relative rounded-xl overflow-hidden bg-black/40 aspect-[21/9] flex items-center justify-center border border-white/10">
                      {formData.image ? (
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover opacity-90" />
                      ) : (
                        <div className="text-gray-400 text-xs flex flex-col items-center gap-1">
                          <ImageIcon className="w-8 h-8 text-gray-500" /> Upload image to see live banner preview
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-5 flex flex-col justify-end">
                        {formData.categoryId && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/70 w-fit px-2.5 py-0.5 rounded border border-emerald-500/30 mb-1.5">
                            {formData.categoryId === 'for-you' ? 'For You Homepage' : categories.find(c => c.id === formData.categoryId)?.name || 'Category'}
                          </span>
                        )}
                        <h4 className="text-lg font-black text-white leading-tight">{formData.title || 'Banner Title'}</h4>
                        {formData.subtitle && <p className="text-xs text-gray-300 line-clamp-1 mt-0.5">{formData.subtitle}</p>}
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10 text-[10px] text-gray-300">
                          <span>Assigned Products: <strong className="text-white">{formData.productIds?.length || 0} items</strong></span>
                          <span className="text-indigo-300 font-mono underline flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" /> {formData.link || '/products'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scheduling & Activation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Schedule Start Time (Optional)</label>
                      <input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">Schedule End Time (Optional)</label>
                      <input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-xs font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2 bg-gray-50 p-4 rounded-2xl border border-gray-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Banner Active Status</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Toggle to instantly hide or publish this banner across selected devices</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                      </label>
                    </div>
                  </div>

                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/60 flex justify-end gap-3 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="banner-form"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Banner'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

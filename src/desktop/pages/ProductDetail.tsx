import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { Product, ProductVariant, WaitlistItem } from '../../shared/types';
import { Star, ShoppingCart, ShieldCheck, Truck, RefreshCcw, ChevronRight, Heart, Share2, Bell, MapPin, PackageCheck, Clock, CheckCircle2, XCircle, HelpCircle, Ruler, X, Check } from 'lucide-react';
import { useCartStore, useAuthStore, useCategoryStore, useSettingsStore } from '../../backend/store';
import DeliveryAndServiceDetails from '../../shared/components/DeliveryAndServiceDetails';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import LocationPickerModal from '../components/LocationPickerModal';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import PincodeChecker from '../components/PincodeChecker';
import { auth, db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import {
  doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc,
  arrayUnion, arrayRemove, limit, documentId
} from 'firebase/firestore';
import ProductCard from '../components/ProductCard';
import { getProductSlug, getCategorySlug, createSlug } from '../../shared/utilities/slug';
import { cleanProductCode, formatProductCode } from '../../shared/utilities/productCode';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { shareProduct, updateOpenGraphTags } from '../../shared/utilities/shareUtils';
import { getShortDeliveryText } from '../../shared/utilities/dateUtils';
import { isProductAvailableAtLocation } from '../../shared/utilities/locationAvailability';
import { addRecentlyViewedId, fetchRecentlyViewedProducts } from '../../shared/utilities/recentlyViewedUtils';

export default function ProductDetail() {
  const params = useParams();
  const targetSlugOrId = params.id || params.slug;
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem, items } = useCartStore();
  const { user, orderedProductIds } = useAuthStore();
  const { categories } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { selectedAddress } = useLocationStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isLocationAvailable, setIsLocationAvailable] = useState<boolean | null>(true);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState<'specifications' | 'description' | 'warranty' | 'manufacturer'>('specifications');

  const handleGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const width = e.currentTarget.clientWidth;
    if (width > 0) {
      const idx = Math.round(e.currentTarget.scrollLeft / width);
      if (idx >= 0 && idx !== selectedImage) {
        setSelectedImage(idx);
      }
    }
  };

  const scrollToImage = (idx: number) => {
    setSelectedImage(idx);
    if (galleryRef.current) {
      const width = galleryRef.current.clientWidth;
      galleryRef.current.scrollTo({ left: idx * width, behavior: 'smooth' });
    }
  };

  const getComboLabel = (v: ProductVariant) => {
    if (v.name && v.name.trim()) return v.name.trim();
    const parts: string[] = [];
    if (v.storage) parts.push(v.storage);
    if (v.ram) parts.push(v.ram);
    if (v.size || v.shoeSize) parts.push(v.size || v.shoeSize || '');
    if (v.shade) parts.push(v.shade);
    if (v.volume) parts.push(v.volume);
    if (v.material) parts.push(v.material);
    if (v.model) parts.push(v.model);
    return parts.length > 0 ? parts.join(' + ') : `Variant ${v.id}`;
  };

  // Evaluate location availability when product or selectedAddress changes
  useEffect(() => {
    if (product) {
      const res = isProductAvailableAtLocation(product, selectedAddress);
      setIsLocationAvailable(res.available);
    }
  }, [product, selectedAddress]);

  // Fetch product by Slug, ID or Product Code & Redirect to Canonical URL
  useEffect(() => {
    if (!targetSlugOrId) return;
    setLoading(true);
    setProduct(null);
    setNotFound(false);

    const fetchProduct = async () => {
      try {
        let foundProduct: Product | null = null;
        const cleanTargetCode = cleanProductCode(targetSlugOrId);

        // 1. Check direct Firestore doc ID
        try {
          const prodRef = doc(db, 'products', targetSlugOrId);
          const snap = await getDoc(prodRef);
          if (snap.exists()) {
            foundProduct = { id: snap.id, ...snap.data() } as Product;
          }
        } catch (_) { }

        // 2. Query by 'slug' field
        if (!foundProduct) {
          const qSlug = query(collection(db, 'products'), where('slug', '==', targetSlugOrId));
          const snapSlug = await getDocs(qSlug);
          if (!snapSlug.empty) {
            const firstDoc = snapSlug.docs[0];
            foundProduct = { id: firstDoc.id, ...firstDoc.data() } as Product;
          }
        }

        // 3. Query by 'productCode' field
        if (!foundProduct) {
          const qCode = query(collection(db, 'products'), where('productCode', '==', formatProductCode(targetSlugOrId)));
          const snapCode = await getDocs(qCode);
          if (!snapCode.empty) {
            const firstDoc = snapCode.docs[0];
            foundProduct = { id: firstDoc.id, ...firstDoc.data() } as Product;
          }
        }

        // 4. Fallback scan
        if (!foundProduct) {
          const allSnap = await getDocs(collection(db, 'products'));
          const matches = allSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Product))
            .find(p =>
              getProductSlug(p) === targetSlugOrId ||
              createSlug(p.name) === targetSlugOrId ||
              (cleanTargetCode && p.productCode && cleanProductCode(p.productCode) === cleanTargetCode)
            );
          if (matches) {
            foundProduct = matches;
          }
        }

        if (foundProduct && foundProduct.isVisible !== false && foundProduct.status !== 'inactive') {
          setProduct(foundProduct);
          // Auto select first enabled variant
          const firstValidVariant = foundProduct.variants?.find(v => !v.disabled);
          if (firstValidVariant) {
            setSelectedVariant(firstValidVariant.id);
          }
          const canonicalSlug = getProductSlug(foundProduct);
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          const img = (foundProduct.images && foundProduct.images.length > 0) ? foundProduct.images[0] : (foundProduct as any).image;
          updateOpenGraphTags(
            `${foundProduct.name} | ViBa Mart`,
            foundProduct.description || `Buy ${foundProduct.name} on ViBa Mart`,
            img,
            `${origin}/products/${canonicalSlug}`
          );

          if (targetSlugOrId !== canonicalSlug && (
            targetSlugOrId === foundProduct.id ||
            /^\d+$/.test(targetSlugOrId) ||
            (cleanTargetCode && foundProduct.productCode && cleanProductCode(foundProduct.productCode) === cleanTargetCode)
          )) {
            navigate(`/products/${canonicalSlug}`, { replace: true });
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error fetching product details:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [targetSlugOrId, navigate]);

  // Check waitlist
  useEffect(() => {
    if (!user || !product || product.stock > 0) return;
    const checkWaitlist = async () => {
      try {
        const wq = query(collection(db, 'waitlist'), where('userId', '==', user.uid), where('productId', '==', product.id));
        const wsnap = await getDocs(wq);
        setIsOnWaitlist(!wsnap.empty);
      } catch (err) {
        console.error("Error checking waitlist:", err);
      }
    };
    checkWaitlist();
  }, [user, product]);

  // Track recently viewed
  useEffect(() => {
    const trackRecent = async () => {
      if (product && product.id) {
        try {
          const rewardIds = await getRewardProductIds();
          if (rewardIds.has(product.id) || (product as any).isRewardProduct) {
            return;
          }
          addRecentlyViewedId(product.id);
        } catch (err) {
          console.error("Error updating recently viewed:", err);
        }
      }
    };
    trackRecent();
  }, [product]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !product) return <Navigate to="/product-not-found" replace />;

  const currentVariant = product.variants?.find(v => v.id === selectedVariant);
  const basePrice = (currentVariant?.price && currentVariant.price > 0) ? currentVariant.price : (product.discountPrice || product.price);
  const totalPrice = basePrice + (currentVariant?.extraPrice || 0);
  const originalPrice = product.mrp || product.price;
  const discountPercentage = originalPrice > totalPrice ? Math.round(((originalPrice - totalPrice) / originalPrice) * 100) : 0;
  const isInCart = items.some(item => item.productId === product.id && item.variantId === selectedVariant);
  const currentStock = currentVariant ? (currentVariant.stock ?? 0) : product.stock;

  const handleBuyNow = () => {
    if (isInCart) {
      navigate('/checkout');
      return;
    }
    const result = addItem(product, 1, selectedVariant);
    if (result.success || result.exists) {
      navigate('/checkout');
    } else {
      toast.error('Could not proceed to checkout. Out of stock.');
    }
  };

  const handleAddToCart = () => {
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const result = addItem(product, 1, selectedVariant);
    if (result.success) {
      toast.success('Product added to cart');
    } else if (result.exists) {
      navigate('/cart');
    } else if (result.limitReached) {
      toast.error('Cart limit reached (100 items max)');
    } else {
      toast.error('Could not add to cart. Out of stock.');
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user) {
      toast.error('Please login to join the waitlist');
      return;
    }

    try {
      const waitlistRef = collection(db, 'waitlist');
      await addDoc(waitlistRef, {
        userId: user.uid,
        productId: product.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        status: 'pending'
      } as Omit<WaitlistItem, 'id'>);

      setIsOnWaitlist(true);
      toast.success('You have been added to the waitlist!', { icon: '🔔' });
    } catch (err) {
      toast.error('Failed to join waitlist');
    }
  };

  const handleToggleWishlist = async () => {
    if (!user || !product) {
      toast.error('Please login to use wishlist');
      return;
    }

    const isWishlisted = user.wishlist?.includes(product.id);
    const currentWishlist = user.wishlist || [];
    const newWishlist = isWishlisted
      ? currentWishlist.filter(id => id !== product.id)
      : Array.from(new Set([...currentWishlist, product.id]));

    useAuthStore.getState().setUser({ ...user, wishlist: newWishlist });

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: isWishlisted ? arrayRemove(product.id) : arrayUnion(product.id)
      });
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const isWishlisted = user?.wishlist?.includes(product.id);

  const categoryObj = categories.find(c => c.id === product.categoryId);
  const subCategoryObj = categoryObj?.subcategories?.find(s => s.id === product.subCategoryId);
  const nestedSubCategoryObj = subCategoryObj?.subcategories?.find(n => n.id === product.nestedSubCategoryId);

  // Group variants by color, size, etc.
  const activeVariants = (product.variants || []).filter(v => !v.disabled);

  // Build specifications list excluding empty fields
  const specsList: { key: string; value: string }[] = [];
  if (product.specifications && Array.isArray(product.specifications)) {
    product.specifications.forEach(s => {
      if (s.key && s.value && s.key.trim() && s.value.trim()) {
        specsList.push({ key: s.key.trim(), value: s.value.trim() });
      }
    });
  }

  // Fallback specs from top-level fields if not in specsList
  if (product.brand && !specsList.some(s => s.key.toLowerCase() === 'brand')) {
    specsList.unshift({ key: 'Brand', value: product.brand });
  }
  if (product.color && !specsList.some(s => s.key.toLowerCase() === 'color')) {
    specsList.push({ key: 'Color', value: product.color });
  }
  if (product.size && !specsList.some(s => s.key.toLowerCase() === 'size')) {
    specsList.push({ key: 'Size', value: product.size });
  }

  // Manufacturer Details
  const manufacturerDetails: { key: string; value: string }[] = [];
  if (product.brand) {
    manufacturerDetails.push({ key: 'Brand / Manufacturer', value: product.brand });
  }
  if (product.productCode) {
    manufacturerDetails.push({ key: 'Product Code', value: formatProductCode(product.productCode) });
  }
  if (product.sku) {
    manufacturerDetails.push({ key: 'SKU', value: product.sku });
  }
  if (product.vendorId && product.vendorId !== 'admin') {
    manufacturerDetails.push({ key: 'Vendor ID', value: product.vendorId });
  }
  if (product.specifications && Array.isArray(product.specifications)) {
    product.specifications.forEach(s => {
      if (s.key && s.value) {
        const kLower = s.key.toLowerCase();
        if (
          (kLower.includes('manufacturer') || kLower.includes('origin') || kLower.includes('imported') || kLower.includes('packer') || kLower.includes('country')) &&
          !manufacturerDetails.some(m => m.key.toLowerCase() === kLower)
        ) {
          manufacturerDetails.push({ key: s.key.trim(), value: s.value.trim() });
        }
      }
    });
  }

  const rawWarranty = (product as any).warranty || product.warrantyPeriod || settings?.warrantyPeriod;
  const isWarrantyEnabled = product.enableWarranty !== false;

  const availableTabs: { id: 'specifications' | 'description' | 'warranty' | 'manufacturer'; label: string }[] = [];
  if (specsList.length > 0) {
    availableTabs.push({ id: 'specifications', label: 'Specifications' });
  }
  if ((product.fullDescription && product.fullDescription.trim()) || (product.description && product.description.trim())) {
    availableTabs.push({ id: 'description', label: 'Description' });
  }
  if (isWarrantyEnabled && rawWarranty && String(rawWarranty).trim()) {
    availableTabs.push({ id: 'warranty', label: 'Warranty' });
  }
  if (manufacturerDetails.length > 0) {
    availableTabs.push({ id: 'manufacturer', label: 'Manufacturer Info' });
  }

  const activeTabId = availableTabs.some(t => t.id === activeInfoTab)
    ? activeInfoTab
    : availableTabs[0]?.id;

  const activeImageSrc = currentVariant?.image || product.images?.[selectedImage] || 'https://via.placeholder.com/400x500?text=No+Image';

  return (
    <div className="bg-gray-50/50 min-h-screen pb-16">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 py-3.5 sm:px-6 lg:px-8 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 flex-wrap">
        <Link to="/" className="hover:text-green-600 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 text-gray-300" />
        <Link to="/products" className="hover:text-green-600 transition-colors">Shop</Link>
        {categoryObj && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <Link to={`/category/${getCategorySlug(categoryObj)}`} className="hover:text-green-600 transition-colors">{categoryObj.name}</Link>
          </>
        )}
        {subCategoryObj && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">{subCategoryObj.name}</span>
          </>
        )}
        {nestedSubCategoryObj && (
          <>
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <span className="text-gray-400">{nestedSubCategoryObj.name}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3 text-gray-300" />
        <span className="text-gray-900 truncate max-w-[240px] font-extrabold">{product.name}</span>
      </div>

      {/* Main Product Card: Left Image Gallery + Right Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-5 sm:p-7 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            
            {/* Left: Image Gallery */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-3 lg:sticky lg:top-24">
              <div className="relative aspect-square w-full max-h-[480px] overflow-hidden rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-2 sm:p-3 shadow-xs">
                <div
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth touch-pan-x"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {(product.images && product.images.length > 0 ? product.images : [activeImageSrc]).map((img, idx) => (
                    <div key={idx} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-white">
                      <img
                        src={currentVariant?.image && idx === selectedImage ? currentVariant.image : img}
                        alt={`${product.name} - ${idx + 1}`}
                        className="w-full h-full max-h-full max-w-full object-contain transition-all duration-300 bg-white"
                      />
                    </div>
                  ))}
                </div>

                {/* Discount Tag on Image */}
                {discountPercentage > 0 && (
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-green-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm tracking-wider uppercase">
                      {discountPercentage}% OFF
                    </span>
                  </div>
                )}

                {/* Top Right Floating Actions: Wishlist & Share */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 pointer-events-auto">
                  <button
                    onClick={handleToggleWishlist}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    className={`p-2.5 rounded-full border transition-all active:scale-95 flex items-center justify-center shadow-sm ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-200 text-rose-500'
                        : 'bg-white/95 backdrop-blur-xs border-gray-100 text-gray-500 hover:text-rose-500 hover:bg-rose-50'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      if (product) {
                        const currentImg = currentVariant?.image && selectedImage === 0
                          ? currentVariant.image
                          : (product.images && product.images[selectedImage]) || product.images?.[0] || (product as any).image;
                        shareProduct(product, {
                          specificImage: currentImg,
                          variantName: currentVariant?.name
                        });
                      }
                    }}
                    aria-label="Share product"
                    title="Share product"
                    className="p-2.5 rounded-full bg-white/95 backdrop-blur-xs border border-gray-100 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all shadow-sm flex items-center justify-center active:scale-95"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Thumbnails Row */}
              {(product.images || []).length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none snap-x touch-pan-x">
                  {(product.images || []).map((img, idx) => {
                    const isSelected = selectedImage === idx && !currentVariant?.image;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => scrollToImage(idx)}
                        className={`w-16 h-16 sm:w-18 sm:h-18 shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all bg-white p-1 flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'border-green-600 ring-2 ring-green-600/20 shadow-xs'
                            : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-contain bg-white" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Info, Variants, Actions, Delivery */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-5 min-w-0">
              
              {/* Brand & Seller Meta */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-0.5 rounded-md border border-green-200/60">
                    Verified Merchant
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    Seller: <span className="font-extrabold text-gray-900 hover:text-green-600 cursor-pointer">{product.brand || 'ViBa Mart'} Retail</span>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-snug tracking-tight">
                  {product.name}
                </h1>

                {/* Stock & Product Meta Row */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {product.isStockVisible !== false && (
                    currentStock > 0 ? (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        In Stock
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        Out of Stock
                      </span>
                    )
                  )}
                  {currentStock > 0 && currentStock <= 5 && (
                    <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Only {currentStock} left
                    </span>
                  )}
                  {product.productCode && (
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Code: {formatProductCode(product.productCode)}
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing & Savings Card */}
              <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-1">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                    ₹{totalPrice.toLocaleString()}
                  </span>
                  {originalPrice > totalPrice && (
                    <span className="text-lg text-gray-400 line-through font-semibold">
                      ₹{originalPrice.toLocaleString()}
                    </span>
                  )}
                  {discountPercentage > 0 && (
                    <span className="text-xs font-black text-green-700 bg-green-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {discountPercentage}% OFF
                    </span>
                  )}
                </div>
                {originalPrice > totalPrice && (
                  <p className="text-xs font-bold text-green-700 pt-0.5">
                    You save ₹{(originalPrice - totalPrice).toLocaleString()} (Inclusive of all taxes)
                  </p>
                )}
              </div>

              {/* Variants Section */}
              {activeVariants.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  {/* Selected Variant Summary */}
                  {currentVariant && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                        Selected: <span className="text-gray-900 font-extrabold">{currentVariant.name || currentVariant.color || getComboLabel(currentVariant)}</span>
                      </span>
                      {product.sizeChart && (
                        <button
                          type="button"
                          onClick={() => setShowSizeChartModal(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50 px-3 py-1 rounded-xl hover:bg-green-100 transition-colors uppercase tracking-wider"
                        >
                          <Ruler className="w-3.5 h-3.5" /> Size Chart
                        </button>
                      )}
                    </div>
                  )}

                  {/* Color Selection */}
                  {activeVariants.some(v => v.color || v.colorName) && (
                    <div className="space-y-2">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider block">
                        Color: <span className="text-gray-900 font-extrabold">{currentVariant?.color || currentVariant?.colorName || 'Select Color'}</span>
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {activeVariants.map((v) => {
                          if (!v.color && !v.colorName) return null;
                          const isSelected = selectedVariant === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVariant(v.id)}
                              disabled={v.stock === 0}
                              className={`px-3 py-2 rounded-xl border-2 font-bold text-xs transition-all flex items-center gap-2 ${
                                isSelected
                                  ? 'border-green-600 bg-green-50 text-green-700 shadow-xs'
                                  : v.stock === 0
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed'
                                    : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'
                              }`}
                            >
                              {v.image ? (
                                <img src={v.image} alt={v.color || v.colorName} className="w-6 h-6 object-contain rounded-md border border-gray-200 bg-white shrink-0" />
                              ) : v.colorHex ? (
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block shrink-0 shadow-xs"
                                  style={{ backgroundColor: v.colorHex }}
                                />
                              ) : null}
                              <span>{v.color || v.colorName}</span>
                              {v.stock === 0 && <span className="text-[8px] text-rose-500 uppercase">(Out of stock)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Selection */}
                  {activeVariants.some(v => v.size || v.shoeSize) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                          Size: <span className="text-gray-900 font-extrabold">{currentVariant?.size || currentVariant?.shoeSize || 'Select Size'}</span>
                        </span>
                        {product.sizeChart && !activeVariants.some(v => v.color) && (
                          <button
                            type="button"
                            onClick={() => setShowSizeChartModal(true)}
                            className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50 px-3 py-1 rounded-xl hover:bg-green-100 transition-colors uppercase tracking-wider"
                          >
                            <Ruler className="w-3.5 h-3.5" /> Size Chart
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {activeVariants.map((v) => {
                          if (!v.size && !v.shoeSize) return null;
                          const isSelected = selectedVariant === v.id;
                          const displaySize = v.size || v.shoeSize;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVariant(v.id)}
                              disabled={v.stock === 0}
                              className={`min-w-[44px] px-3.5 py-2.5 rounded-xl border-2 text-xs font-black transition-all ${
                                isSelected
                                  ? 'border-green-600 bg-green-600 text-white shadow-xs'
                                  : v.stock === 0
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-40 cursor-not-allowed'
                                    : 'border-gray-200 text-gray-800 hover:border-gray-300 bg-white'
                              }`}
                            >
                              {displaySize}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Storage / RAM / Shade / Volume / Material / Model Variants */}
                  {activeVariants.some(v => v.storage || v.ram || v.shade || v.volume || v.material || v.model) && (
                    <div className="space-y-2">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider block">Options & Configuration</span>
                      <div className="flex flex-wrap gap-2">
                        {activeVariants.map((v) => {
                          const label = getComboLabel(v);
                          if (!label) return null;
                          const isSelected = selectedVariant === v.id;
                          return (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVariant(v.id)}
                              disabled={v.stock === 0}
                              className={`px-3.5 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                                isSelected
                                  ? 'border-green-600 bg-green-50 text-green-700 shadow-xs'
                                  : v.stock === 0
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-40 cursor-not-allowed'
                                    : 'border-gray-200 text-gray-800 hover:border-gray-300 bg-white'
                              }`}
                            >
                              {label}
                              {v.stock === 0 && <span className="block text-[8px] uppercase text-rose-500">Out of Stock</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Variant Pricing & Options Cards */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider block">
                      Variant Pricing & Options
                    </span>
                    <div
                      className="flex gap-2.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x scroll-smooth touch-pan-x w-full"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    >
                      {activeVariants.map((v) => {
                        const isSelected = selectedVariant === v.id;
                        const vBasePrice = (v.price && v.price > 0) ? v.price : (product.discountPrice || product.price);
                        const vTotalPrice = vBasePrice + (v.extraPrice || 0);
                        const label = v.color || v.colorName || getComboLabel(v);

                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariant(v.id)}
                            disabled={v.stock === 0}
                            className={`flex-shrink-0 min-w-[130px] p-2.5 rounded-xl border-2 text-left transition-all snap-start flex flex-col justify-between gap-1.5 ${
                              isSelected
                                ? 'border-green-600 bg-green-50/80 shadow-xs'
                                : v.stock === 0
                                  ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              {v.image ? (
                                <img src={v.image} alt={label} className="w-7 h-7 object-contain rounded-md border border-gray-200 bg-white shrink-0" />
                              ) : v.colorHex ? (
                                <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: v.colorHex }} />
                              ) : null}
                              <span className="text-xs font-black truncate max-w-[90px]">{label}</span>
                            </div>
                            <div>
                              <span className="text-sm font-black text-gray-900 block">₹{vTotalPrice.toLocaleString()}</span>
                              {v.stock === 0 ? (
                                <span className="text-[9px] font-extrabold text-rose-500 uppercase">Out of Stock</span>
                              ) : v.stock <= 5 ? (
                                <span className="text-[9px] font-extrabold text-amber-700 uppercase">{v.stock} Left</span>
                              ) : (
                                <span className="text-[9px] font-extrabold text-green-600 uppercase">In Stock</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Add to Cart & Buy Now */}
              <div className="pt-2 border-t border-gray-100">
                {currentStock > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        if (isInCart) {
                          navigate('/cart');
                        } else {
                          handleAddToCart();
                        }
                      }}
                      disabled={!isLocationAvailable}
                      className={`flex touch-target min-h-[48px] items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-xs ${
                        !isLocationAvailable
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                          : 'bg-yellow-400 text-gray-950 hover:bg-yellow-300 active:scale-[0.98]'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" /> {isInCart ? 'Go to Cart' : 'Add to Cart'}
                    </button>
                    <button
                      onClick={handleBuyNow}
                      disabled={!isLocationAvailable}
                      className={`flex touch-target min-h-[48px] items-center justify-center py-3.5 px-6 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-xs ${
                        !isLocationAvailable
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                          : 'bg-amber-500 text-gray-950 hover:bg-amber-400 active:scale-[0.98]'
                      }`}
                    >
                      Buy Now
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={isOnWaitlist ? undefined : handleJoinWaitlist}
                    disabled={isOnWaitlist}
                    className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black uppercase tracking-wider text-sm transition-all active:scale-[0.98] ${
                      isOnWaitlist
                        ? 'bg-green-50 text-green-600 border-2 border-green-200 cursor-default'
                        : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                    }`}
                  >
                    {isOnWaitlist ? <><Bell className="w-4 h-4" /> On Waitlist</> : <><Bell className="w-4 h-4" /> Notify Me When Available</>}
                  </button>
                )}
              </div>

              {/* Delivery Details Section */}
              <div className="space-y-2 pt-3 border-t border-gray-100 min-w-0 max-w-full">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Delivery Details</h3>

                {isLocationAvailable === false && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Product unavailable for delivery at selected address ({selectedAddress?.city ? selectedAddress.city + ', ' : ''}{selectedAddress?.zip}).</span>
                  </div>
                )}

                {selectedAddress ? (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-xs font-black text-gray-900 block">
                            Deliver to {selectedAddress.fullName || 'Customer'} — {selectedAddress.zip}
                          </span>
                          <p className="text-xs font-medium text-gray-600 mt-0.5 line-clamp-2">
                            {selectedAddress.house}, {selectedAddress.street}, {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.zip}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLocationPickerModal(true)}
                        className="text-xs font-black uppercase text-green-600 tracking-wider hover:underline shrink-0"
                      >
                        Change
                      </button>
                    </div>
                    <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                          {getShortDeliveryText()}
                        </span>
                      </div>
                      {product.isFreeDelivery !== false && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 uppercase tracking-wider">
                          Free Delivery
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-gray-800 block">No delivery address selected</span>
                        <span className="text-[10px] text-gray-500">Select address to view exact delivery dates</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLocationPickerModal(true)}
                      className="px-3.5 py-1.5 bg-green-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-xs shrink-0"
                    >
                      Select Address
                    </button>
                  </div>
                )}

                {/* Service Cards directly below Delivery Details */}
                <DeliveryAndServiceDetails product={product} settings={settings} />
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Similar Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <SimilarProducts categoryId={product.categoryId} currentProductId={product.id} />
      </div>

      {/* Product Information Details Tabs Section */}
      {availableTabs.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 italic tracking-tight">Product Details</h2>

            {/* Compact horizontal scrollable tabs in one row */}
            <div className="flex flex-nowrap overflow-x-auto gap-2 pb-2 scrollbar-none border-b border-gray-100">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInfoTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                    activeTabId === tab.id
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected Tab Content */}
            {activeTabId === 'specifications' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {specsList.map((spec, i) => (
                    <div key={i} className="flex flex-col sm:flex-row p-3.5 sm:p-4 hover:bg-white transition-colors">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-1 sm:mb-0">{spec.key}</span>
                      <span className="text-sm font-bold text-gray-900 sm:flex-1">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTabId === 'description' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 sm:p-6">
                  <p className="text-gray-700 leading-relaxed font-medium whitespace-pre-line text-sm">
                    {product.fullDescription || product.description}
                  </p>
                </div>
              </div>
            )}

            {activeTabId === 'warranty' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    <h3 className="text-base font-black text-gray-900 tracking-tight">Warranty Coverage</h3>
                  </div>
                  <p className="text-sm font-bold text-gray-800">
                    {rawWarranty}
                  </p>
                  {product.brandSupportText && (
                    <p className="text-xs text-gray-500 font-medium">
                      Brand Support: {product.brandSupportText}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTabId === 'manufacturer' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {manufacturerDetails.map((item, i) => (
                    <div key={i} className="flex flex-col sm:flex-row p-3.5 sm:p-4 hover:bg-white transition-colors">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-1 sm:mb-0">{item.key}</span>
                      <span className="text-sm font-bold text-gray-900 sm:flex-1">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recently Viewed Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <RecentlyViewed currentProductId={product.id} />
      </div>

      {/* Size Chart Modal */}
      {showSizeChartModal && product.sizeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Size Chart</h3>
              </div>
              <button
                onClick={() => setShowSizeChartModal(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[70vh] overflow-y-auto">
              <img src={product.sizeChart} alt="Size Chart" className="max-w-full h-auto rounded-xl object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPickerModal}
        onClose={() => setShowLocationPickerModal(false)}
      />
    </div>
  );
}

function SimilarProducts({ categoryId, currentProductId }: { categoryId: string, currentProductId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilar = async () => {
      setLoading(true);
      try {
        if (!categoryId) {
          setProducts([]);
          setLoading(false);
          return;
        }
        const q = query(
          collection(db, 'products'),
          where('categoryId', '==', categoryId),
          where('status', '==', 'active'),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const rewardIds = await getRewardProductIds();
        const fetchedProducts = filterOutRewardProducts(
          snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => {
              if (!p) return false;
              const pid = p.id;
              const pDocId = (p as any).id;
              const code = (p as any).productCode;
              const slug = getProductSlug(p);
              return (
                pid !== currentProductId &&
                pDocId !== currentProductId &&
                (!code || code !== currentProductId) &&
                (!slug || slug !== currentProductId)
              );
            }),
          rewardIds
        ).slice(0, 4);
        setProducts(fetchedProducts);
      } catch (err) {
        console.error('Error fetching similar products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [categoryId, currentProductId]);

  if (!loading && products.length === 0) return null;

  return (
    <div className="pt-8 border-t border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Similar Products</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Recommendations from same category</p>
        </div>
        <Link to="/products" className="group flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-primary tracking-[0.2em] transition-colors">See All</span>
          <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
      <div className="flex overflow-x-auto gap-4 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="w-[170px] sm:w-[190px] shrink-0 animate-pulse bg-gray-50 rounded-2xl aspect-[4/5] border border-gray-100" />
          ))
        ) : (
          products.map(p => (
            <div key={p.id} className="w-[170px] sm:w-[190px] shrink-0 snap-start flex flex-col">
              <ProductCard product={p} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecent = async () => {
      setLoading(true);
      const fetched = await fetchRecentlyViewedProducts(currentProductId, 8);
      if (isMounted) {
        setProducts(fetched);
        setLoading(false);
      }
    };

    fetchRecent();

    const handleUpdate = () => {
      fetchRecent();
    };
    window.addEventListener('viba_recently_viewed_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('viba_recently_viewed_updated', handleUpdate);
    };
  }, [currentProductId]);

  if (!loading && products.length === 0) return null;

  return (
    <div className="pt-8 border-t border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Recently Viewed</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Products you looked at recently</p>
        </div>
      </div>
      <div className="flex overflow-x-auto gap-4 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="w-[170px] sm:w-[190px] shrink-0 animate-pulse bg-gray-50 rounded-2xl aspect-[4/5] border border-gray-100" />
          ))
        ) : (
          products.map(p => (
            <div key={p.id} className="w-[170px] sm:w-[190px] shrink-0 snap-start flex flex-col">
              <ProductCard product={p} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ServiceIcon({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-gray-50 p-2 rounded-xl">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div>
        <p className="text-xs font-black text-gray-900 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-[10px] font-bold text-gray-500 tracking-wider leading-none uppercase">{desc}</p>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { Product, ProductVariant, WaitlistItem, FamilyColorVariant } from '../../shared/types';
import { Star, ShoppingCart, ShieldCheck, Truck, RefreshCcw, ChevronRight, Heart, Share2, Bell, MapPin, PackageCheck, Clock, CheckCircle2, XCircle, HelpCircle, Ruler, X, Check, ChevronLeft } from 'lucide-react';
import { useCartStore, useAuthStore, useCategoryStore, useSettingsStore } from '../../backend/store';
import DeliveryAndServiceDetails from '../../shared/components/DeliveryAndServiceDetails';
import UniversalVariantSelector from '../../shared/components/UniversalVariantSelector';
import {
  getBestInitialSelection,
  extractVariantAttributes,
  getVariantCombinationTitle,
  getProductVariantAttributes,
  normalizeAttributeKey,
  fetchFamilyColorMatrix,
  getProductSpecificationsForSize,
  getProductSpecificationsForSelection
} from '../../shared/utilities/variantMatrixUtils';
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
import { isProductAssignedToCategory } from '../../shared/utilities/productCategoryFilter';
import { addRecentlyViewedId } from '../../shared/utilities/recentlyViewedUtils';
import TrendingProductsTwoRowSection from '../../shared/components/TrendingProductsTwoRowSection';
import MoreProductsForYouSection from '../../shared/components/MoreProductsForYouSection';

export default function ProductDetail() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetSlugOrId = params.id || params.slug;
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const { addItem, items } = useCartStore();
  const { user, orderedProductIds } = useAuthStore();
  const { categories } = useCategoryStore();
  const { settings } = useSettingsStore();
  const { selectedAddress } = useLocationStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [familyColorVariants, setFamilyColorVariants] = useState<FamilyColorVariant[]>([]);
  const galleryRef = React.useRef<HTMLDivElement>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isLocationAvailable, setIsLocationAvailable] = useState<boolean | null>(true);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState<'specifications' | 'description' | 'warranty' | 'manufacturer'>('specifications');

  const isProgrammaticScroll = React.useRef(false);
  const scrollTimeoutRef = React.useRef<any>(null);

  const handleGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isImageModalOpen || isProgrammaticScroll.current) return;
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
      isProgrammaticScroll.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      const width = galleryRef.current.clientWidth;
      galleryRef.current.scrollTo({ left: idx * width, behavior: 'smooth' });
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 400);
    }
  };

  const currentDisplayListRef = React.useRef<string[]>([]);
  const touchStartX = React.useRef<number | null>(null);
  const touchStartY = React.useRef<number | null>(null);

  useEffect(() => {
    if (!isImageModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImageModalOpen(false);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const len = currentDisplayListRef.current.length || 1;
        setSelectedImage(prev => (prev - 1 + len) % len);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const len = currentDisplayListRef.current.length || 1;
        setSelectedImage(prev => (prev + 1) % len);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isImageModalOpen]);

  const handleVariantSelection = (variantId: string, updatedAttributes: Record<string, string>) => {
    setSelectedVariant(variantId);
    setSelectedAttributes(updatedAttributes);
    setSelectedImage(0);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('variant', variantId);
      return next;
    }, { replace: true });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(true);
    setProduct(null);
    setNotFound(false);
    setFetchError(false);

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

          // Fetch family color matrix if familyId is set
          if (foundProduct.familyId) {
            try {
              const matrix = await fetchFamilyColorMatrix(foundProduct.familyId, foundProduct);
              setFamilyColorVariants(matrix);
            } catch (err) {
              console.error('Failed to load family color matrix:', err);
              setFamilyColorVariants([]);
            }
          } else {
            setFamilyColorVariants([]);
          }

          // Combination-aware best initial variant selection & URL restoration
          const urlVariantId = searchParams.get('variant') || undefined;
          const queryAttributeParams: Record<string, string> = {};
          searchParams.forEach((val, key) => {
            if (key !== 'variant') {
              queryAttributeParams[key] = val;
            }
          });
          const initialParam = urlVariantId || (Object.keys(queryAttributeParams).length > 0 ? queryAttributeParams : undefined);
          const initialSelection = getBestInitialSelection(foundProduct, initialParam);
          if (initialSelection.variant) {
            setSelectedVariant(initialSelection.variant.id);
            setSelectedAttributes(initialSelection.selectedAttributes);
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
            navigate(`/products/${canonicalSlug}${urlVariantId ? `?variant=${urlVariantId}` : ''}`, { replace: true });
          }
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error fetching product details:", err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [targetSlugOrId, navigate, retryTrigger]);

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
          addRecentlyViewedId(product.id);
        } catch (err) {
          console.error("Error updating recently viewed:", err);
        }
      }
    };
    trackRecent();
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white select-none animate-pulse">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Breadcrumb Skeleton */}
          <div className="h-4 bg-gray-100 rounded w-48" />

          {/* Main Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Gallery */}
            <div className="lg:col-span-6 space-y-4">
              <div className="aspect-square w-full bg-gray-100 rounded-3xl border border-gray-100" />
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-16 h-16 bg-gray-100 rounded-xl" />
                ))}
              </div>
            </div>

            {/* Right Column: Info & Actions */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <div className="h-3.5 bg-gray-100 rounded w-24" />
                <div className="h-7 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>

              {/* Price Box */}
              <div className="p-4 bg-gray-50 rounded-2xl space-y-2 border border-gray-100">
                <div className="h-8 bg-gray-200 rounded w-40" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>

              {/* Variants Box */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-20" />
                <div className="flex gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 w-24 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              </div>

              {/* Delivery Skeleton */}
              <div className="h-28 bg-gray-50 rounded-2xl border border-gray-100" />

              {/* Buttons */}
              <div className="flex gap-4">
                <div className="h-14 flex-1 bg-gray-100 rounded-2xl" />
                <div className="h-14 flex-1 bg-gray-200 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError && !product) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-gray-100 shadow-xl text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <RefreshCcw className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Failed to load product</h3>
          <p className="text-sm text-gray-500 mb-6">Could not load product details due to a network error. Please try again.</p>
          <button
            onClick={() => setRetryTrigger(k => k + 1)}
            className="w-full py-3 px-4 font-black text-white bg-emerald-600 rounded-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !product) return <Navigate to="/product-not-found" replace />;

  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');
  const currentVariant = activeVariants.find(v => v.id === selectedVariant);
  const basePrice = (currentVariant?.price && currentVariant.price > 0)
    ? currentVariant.price
    : (currentVariant?.discountPrice && currentVariant.discountPrice > 0)
    ? currentVariant.discountPrice
    : (product.discountPrice || product.price);
  const totalPrice = basePrice + (currentVariant?.extraPrice || 0);
  const originalPrice = currentVariant?.mrp || product.mrp || product.price;
  const discountPercentage = originalPrice > totalPrice ? Math.round(((originalPrice - totalPrice) / originalPrice) * 100) : 0;
  const isInCart = items.some(item => item.productId === product.id && item.variantId === selectedVariant);
  const currentStock = currentVariant ? (currentVariant.stock ?? 0) : product.stock;

  const validateVariantSelection = (): boolean => {
    if (activeVariants.length > 0 && !selectedVariant) {
      const attributes = getProductVariantAttributes(product);
      const missingAttr = attributes.find(a => !selectedAttributes[normalizeAttributeKey(a.name)]);
      if (missingAttr) {
        toast.error(`Please select ${missingAttr.name}`);
      } else {
        toast.error('Please select an available variant combination.');
      }
      return false;
    }
    return true;
  };

  const handleBuyNow = () => {
    if (isInCart) {
      navigate('/checkout');
      return;
    }
    if (!validateVariantSelection()) return;
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
    if (!validateVariantSelection()) return;
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

  // Resolve specifications: universal variant-specific if available for selected attributes/variant, otherwise default
  const rawSpecs = getProductSpecificationsForSelection(
    product,
    selectedAttributes,
    currentVariant?.id || selectedVariant,
    currentVariant
  );

  // Build specifications list excluding empty fields
  const specsList: { key: string; value: string; values?: string[] }[] = [];
  if (rawSpecs && Array.isArray(rawSpecs)) {
    rawSpecs.forEach(s => {
      const rawVals = Array.isArray(s.values) && s.values.length > 0
        ? s.values
        : (s.value ? s.value.split('\n') : []);
      const cleanedVals = rawVals.map(v => (v || '').trim()).filter(Boolean);
      const v = cleanedVals.length > 0 ? cleanedVals.join('\n') : (s.value || '').trim();

      if (s.key && s.key.trim() && (cleanedVals.length > 0 || v)) {
        specsList.push({
          key: s.key.trim(),
          value: v,
          values: cleanedVals.length > 0 ? cleanedVals : (v ? [v] : [])
        });
      }
    });
  }

  // Fallback specs from top-level fields / selected attributes if not in specsList
  if (product.brand && !specsList.some(s => s.key.toLowerCase() === 'brand')) {
    specsList.unshift({ key: 'Brand', value: product.brand, values: [product.brand] });
  }
  if (product.color && !specsList.some(s => s.key.toLowerCase() === 'color')) {
    specsList.push({ key: 'Color', value: product.color, values: [product.color] });
  }
  if (selectedAttributes) {
    Object.entries(selectedAttributes).forEach(([attrKey, attrVal]) => {
      if (attrVal && !specsList.some(s => s.key.toLowerCase() === attrKey.toLowerCase())) {
        specsList.push({ key: attrKey, value: String(attrVal), values: [String(attrVal)] });
      }
    });
  } else {
    const currentSize = currentVariant?.size || currentVariant?.shoeSize || product.size;
    if (currentSize && !specsList.some(s => s.key.toLowerCase() === 'size')) {
      specsList.push({ key: 'Size', value: String(currentSize), values: [String(currentSize)] });
    }
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
  if (rawSpecs && Array.isArray(rawSpecs)) {
    rawSpecs.forEach(s => {
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

  const variantImages = (currentVariant?.images && currentVariant.images.length > 0)
    ? currentVariant.images
    : (currentVariant?.image ? [currentVariant.image] : []);
  const displayImages = variantImages.length > 0
    ? [...variantImages, ...(product.images || []).filter(img => !variantImages.includes(img))]
    : (product.images || []);
  const currentDisplayList = displayImages.length > 0 ? displayImages : [activeImageSrc];
  currentDisplayListRef.current = currentDisplayList;

  const handleModalPrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedImage(prev => (prev - 1 + currentDisplayList.length) % currentDisplayList.length);
  };

  const handleModalNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedImage(prev => (prev + 1) % currentDisplayList.length);
  };

  const handleCloseModal = () => {
    setIsImageModalOpen(false);
    if (galleryRef.current) {
      galleryRef.current.scrollLeft = selectedImage * galleryRef.current.clientWidth;
    }
  };

  const handleModalTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleModalTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = (touchStartY.current || 0) - touchEndY;
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      const len = currentDisplayListRef.current.length || 1;
      if (diffX > 0) {
        setSelectedImage(prev => (prev + 1) % len);
      } else {
        setSelectedImage(prev => (prev - 1 + len) % len);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="bg-gray-50/50 min-h-screen py-4 sm:py-6 pb-10">

      {/* Main Product Card: Left Image Gallery + Right Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            
            {/* Left: Image Gallery */}
            <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-24">
              <div className="relative aspect-square w-full max-h-[480px] overflow-hidden rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-2 sm:p-3 shadow-xs group">
                <div
                  ref={galleryRef}
                  onScroll={handleGalleryScroll}
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth touch-pan-x cursor-pointer"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {currentDisplayList.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setIsImageModalOpen(true)}
                      title="Click to view larger image"
                      className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center bg-white cursor-zoom-in"
                    >
                      <img
                        src={img}
                        alt={`${product.name} - ${idx + 1}`}
                        className="w-full h-full max-h-full max-w-full object-contain transition-all duration-300 bg-white select-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Left and Right Scroll Controls for Desktop (Hidden on mobile mode) */}
                {currentDisplayList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const prevIdx = (selectedImage - 1 + currentDisplayList.length) % currentDisplayList.length;
                        scrollToImage(prevIdx);
                      }}
                      aria-label="Previous image"
                      title="Previous image"
                      className="hidden md:flex absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-white text-gray-700 hover:text-gray-950 shadow-md hover:shadow-lg border border-gray-200/80 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIdx = (selectedImage + 1) % currentDisplayList.length;
                        scrollToImage(nextIdx);
                      }}
                      aria-label="Next image"
                      title="Next image"
                      className="hidden md:flex absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-white text-gray-700 hover:text-gray-950 shadow-md hover:shadow-lg border border-gray-200/80 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Image Counter Indicator */}
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full bg-black/50 backdrop-blur-xs text-[11px] font-bold text-white tracking-wider pointer-events-none">
                      {selectedImage + 1} / {currentDisplayList.length}
                    </div>
                  </>
                )}

                {/* Discount Tag on Image */}
                {discountPercentage > 0 && (
                  <div className="absolute top-3 left-3 z-10 pointer-events-none">
                    <span className="bg-green-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm tracking-wider uppercase">
                      {discountPercentage}% OFF
                    </span>
                  </div>
                )}

                {/* Top Right Floating Actions: Wishlist & Share */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleWishlist();
                    }}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    className={`p-2.5 rounded-full border transition-all active:scale-95 flex items-center justify-center shadow-sm cursor-pointer ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-200 text-rose-500'
                        : 'bg-white/95 backdrop-blur-xs border-gray-100 text-gray-500 hover:text-rose-500 hover:bg-rose-50'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product) {
                        const currentImg = currentDisplayList[selectedImage] || currentDisplayList[0] || (product as any).image;
                        shareProduct(product, {
                          specificImage: currentImg,
                          variantName: currentVariant?.name
                        });
                      }
                    }}
                    aria-label="Share product"
                    title="Share product"
                    className="p-2.5 rounded-full bg-white/95 backdrop-blur-xs border border-gray-100 text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all shadow-sm flex items-center justify-center active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Info, Variants, Actions, Delivery */}
            <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-2.5 min-w-0">
              
              {/* Brand & Seller Meta */}
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
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
                  {currentVariant?.sku && (
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      SKU: {currentVariant.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing & Savings Card */}
              <div className="p-3 sm:p-3.5 bg-gray-50/80 rounded-xl border border-gray-100 space-y-0.5">
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

              {/* Universal Variant Selector */}
              {(activeVariants.length > 0 || familyColorVariants.length > 0) && (
                <div className="space-y-3 pt-2.5 border-t border-gray-100 min-w-0 max-w-full overflow-hidden">
                  <UniversalVariantSelector
                    product={product}
                    selectedAttributes={selectedAttributes}
                    selectedVariantId={selectedVariant}
                    familyColorVariants={familyColorVariants}
                    onSelectVariant={handleVariantSelection}
                    onOpenSizeChart={() => setShowSizeChartModal(true)}
                    showSizeChartButton={true}
                  />
                </div>
              )}

              {/* Action Buttons: Add to Cart & Buy Now */}
              <div className="pt-2.5 border-t border-gray-100">
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
                      className={`flex touch-target min-h-[46px] items-center justify-center gap-2 py-3 px-5 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-xs ${
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
                      className={`flex touch-target min-h-[46px] items-center justify-center py-3 px-5 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-xs ${
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
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase tracking-wider text-sm transition-all active:scale-[0.98] ${
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
              <div className="space-y-2 pt-2.5 border-t border-gray-100 min-w-0 max-w-full">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Delivery Details</h3>

                {isLocationAvailable === false && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Product unavailable for delivery at selected address ({selectedAddress?.city ? selectedAddress.city + ', ' : ''}{selectedAddress?.zip}).</span>
                  </div>
                )}

                {selectedAddress ? (
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1.5">
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
                    <div className="pt-1.5 border-t border-gray-200/60 flex items-center justify-between gap-2 flex-wrap">
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
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <SimilarProducts
          categoryId={product.categoryId}
          subCategoryId={product.subCategoryId}
          currentProductId={product.id}
          product={product}
        />
      </div>

      {/* Product Information Details Tabs Section */}
      {availableTabs.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-xs space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 italic tracking-tight">Product Details</h2>

            {/* Compact horizontal scrollable tabs in one row */}
            <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1.5 scrollbar-none border-b border-gray-100">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInfoTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
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
                  {specsList.map((spec, i) => {
                    const valuesToDisplay = Array.isArray(spec.values) && spec.values.length > 0
                      ? spec.values
                      : (spec.value ? spec.value.split('\n') : []);

                    return (
                      <div key={i} className="flex flex-col sm:flex-row p-3 sm:p-3.5 hover:bg-white transition-colors">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-1 sm:mb-0 pt-0.5">{spec.key}</span>
                        <div className="sm:flex-1 space-y-1">
                          {valuesToDisplay.map((val, vIdx) => (
                            <div key={vIdx} className="text-sm font-bold text-gray-900 leading-snug">
                              {val}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTabId === 'description' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 sm:p-5">
                  <p className="text-gray-700 leading-relaxed font-medium whitespace-pre-line text-sm">
                    {product.fullDescription || product.description}
                  </p>
                </div>
              </div>
            )}

            {activeTabId === 'warranty' && (
              <div>
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-2">
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
                    <div key={i} className="flex flex-col sm:flex-row p-2.5 sm:p-3 hover:bg-white transition-colors">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-0.5 sm:mb-0">{item.key}</span>
                      <span className="text-sm font-bold text-gray-900 sm:flex-1">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* Enlarged Image Lightbox Modal */}
      <AnimatePresence>
        {isImageModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-white flex items-center justify-center p-4 select-none"
            onClick={handleCloseModal}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseModal}
              aria-label="Close enlarged view"
              className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-950 border border-gray-200 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Previous Button in Modal (Desktop only) */}
            {currentDisplayList.length > 1 && (
              <button
                type="button"
                onClick={handleModalPrev}
                aria-label="Previous image"
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-950 border border-gray-200 shadow-md transition-all hover:scale-110 active:scale-95 cursor-pointer items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Enlarged Image Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center bg-white"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleModalTouchStart}
              onTouchEnd={handleModalTouchEnd}
            >
              <img
                src={currentDisplayList[selectedImage] || activeImageSrc}
                alt={product.name}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl bg-white select-none"
              />

              {/* Image Counter in Modal */}
              {currentDisplayList.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900/80 backdrop-blur-xs text-xs font-semibold text-white tracking-wider shadow-sm">
                  {selectedImage + 1} / {currentDisplayList.length}
                </div>
              )}
            </motion.div>

            {/* Next Button in Modal (Desktop only) */}
            {currentDisplayList.length > 1 && (
              <button
                type="button"
                onClick={handleModalNext}
                aria-label="Next image"
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-950 border border-gray-200 shadow-md transition-all hover:scale-110 active:scale-95 cursor-pointer items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trending Products (Scrollable, Two-Row Section on every page without visible scrollbars) */}
      <TrendingProductsTwoRowSection
        categoryId={product?.categoryId}
      />

      {/* More Products for You (LAST SECTION ON EVERY PAGE) */}
      <MoreProductsForYouSection
        categoryId={product?.categoryId}
      />
    </div>
  );
}

function SimilarProducts({
  categoryId,
  subCategoryId,
  currentProductId,
  product
}: {
  categoryId?: string;
  subCategoryId?: string;
  currentProductId?: string;
  product?: Product;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const effectiveCatId = (product?.categoryId || categoryId || '').trim();
  const effectiveSubId = (product?.subCategoryId || subCategoryId || '').trim();
  const effectiveNestedId = (product?.nestedSubCategoryId || '').trim();
  const currentProdId = product?.id || currentProductId;
  const currentCode = product?.productCode;
  const currentSlug = product ? getProductSlug(product) : '';

  useEffect(() => {
    let isCancelled = false;

    const fetchSimilar = async () => {
      setLoading(true);
      try {
        if (!effectiveCatId) {
          if (!isCancelled) {
            setProducts([]);
            setLoading(false);
          }
          return;
        }

        const categories = useCategoryStore.getState().categories || [];

        // Resolve category object for ID vs slug mapping
        const catObj = categories.find(c => {
          if (!c) return false;
          const lower = effectiveCatId.toLowerCase();
          return (
            String(c.id || '').toLowerCase() === lower ||
            String(c.slug || '').toLowerCase() === lower ||
            String((c as any).seoSlug || '').toLowerCase() === lower ||
            String(getCategorySlug(c) || '').toLowerCase() === lower ||
            String(c.name || '').toLowerCase() === lower
          );
        });

        const targetCat = catObj?.id || effectiveCatId;
        const targetCatSlug = catObj?.slug || effectiveCatId;

        // Fetch category & subcategory products in parallel
        const queryPromises: Promise<any>[] = [
          getDocs(query(collection(db, 'products'), where('categoryId', '==', targetCat), limit(50))).catch(() => null)
        ];

        if (targetCatSlug && targetCatSlug !== targetCat) {
          queryPromises.push(
            getDocs(query(collection(db, 'products'), where('categoryId', '==', targetCatSlug), limit(50))).catch(() => null)
          );
        }

        if (effectiveSubId) {
          queryPromises.push(
            getDocs(query(collection(db, 'products'), where('subCategoryId', '==', effectiveSubId), limit(50))).catch(() => null)
          );
        }

        const [snaps, rewardIds] = await Promise.all([
          Promise.all(queryPromises),
          getRewardProductIds()
        ]);

        const candidateMap = new Map<string, Product>();
        snaps.forEach(snap => {
          if (snap?.docs) {
            snap.docs.forEach((d: any) => {
              candidateMap.set(d.id, { id: d.id, ...d.data() } as Product);
            });
          }
        });

        // Fallback scan if category queries returned empty
        if (candidateMap.size === 0) {
          try {
            const allSnap = await getDocs(query(collection(db, 'products'), limit(50)));
            allSnap.docs.forEach(d => {
              candidateMap.set(d.id, { id: d.id, ...d.data() } as Product);
            });
          } catch (e) {
            console.warn('Fallback similar products query error:', e);
          }
        }

        const rawCandidates = Array.from(candidateMap.values());

        // Filter out: current product, inactive / invisible, reward products
        const eligible = filterOutRewardProducts(
          rawCandidates.filter(p => {
            if (!p) return false;
            if (p.isVisible === false || p.status === 'inactive') return false;
            const pid = p.id;
            const pDocId = (p as any).id;
            const code = (p as any).productCode;
            const slug = getProductSlug(p);
            return (
              (!currentProdId || (pid !== currentProdId && pDocId !== currentProdId)) &&
              (!currentCode || !code || cleanProductCode(code) !== cleanProductCode(currentCode)) &&
              (!currentSlug || !slug || slug !== currentSlug)
            );
          }),
          rewardIds
        );

        // Strict category validation: Never show products from outside the assigned category
        const inCategory = eligible.filter(p => isProductAssignedToCategory(p, effectiveCatId, categories));

        // Subcategory & Nested Subcategory relevance
        const sameSub = effectiveSubId
          ? inCategory.filter(p => isProductAssignedToCategory(p, effectiveCatId, categories, effectiveSubId))
          : [];

        const sameNested = (effectiveSubId && effectiveNestedId)
          ? sameSub.filter(p => isProductAssignedToCategory(p, effectiveCatId, categories, effectiveSubId, effectiveNestedId))
          : [];

        // Sort same-subcategory products: nested matches first, then by rating
        sameSub.sort((a, b) => {
          const aNested = sameNested.includes(a);
          const bNested = sameNested.includes(b);
          if (aNested && !bNested) return -1;
          if (!aNested && bNested) return 1;
          return (b.rating || 0) - (a.rating || 0);
        });

        // If at least 4 items match the subcategory, show only subcategory matches.
        // Otherwise, prioritize subcategory matches first, supplemented with other items from the same category.
        let finalProducts: Product[] = [];
        if (sameSub.length >= 4) {
          finalProducts = sameSub;
        } else if (sameSub.length > 0) {
          const remainingInCat = inCategory.filter(p => !sameSub.includes(p));
          remainingInCat.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          finalProducts = [...sameSub, ...remainingInCat];
        } else {
          const inCatSorted = [...inCategory];
          inCatSorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          finalProducts = inCatSorted;
        }

        if (!isCancelled) {
          setProducts(finalProducts.slice(0, 10));
        }
      } catch (err) {
        console.error('Error fetching similar products:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchSimilar();

    return () => {
      isCancelled = true;
    };
  }, [effectiveCatId, effectiveSubId, effectiveNestedId, currentProdId, currentCode, currentSlug]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  if (!loading && products.length === 0) return null;

  const seeAllLink = effectiveSubId && effectiveCatId
    ? `/products?category=${encodeURIComponent(effectiveCatId)}&subCategory=${encodeURIComponent(effectiveSubId)}`
    : (effectiveCatId ? `/products?category=${encodeURIComponent(effectiveCatId)}` : '/products');

  return (
    <div className="pt-8 border-t border-gray-100">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Similar Products</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Recommendations from same category</p>
        </div>
        <div className="flex items-center gap-2">
          {products.length > 4 && (
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={handleScrollLeft}
                aria-label="Previous similar products"
                className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleScrollRight}
                aria-label="Next similar products"
                className="w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <Link to={seeAllLink} className="group flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-gray-400 group-hover:text-primary tracking-[0.2em] transition-colors">See All</span>
            <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
      <div ref={scrollRef} className="flex overflow-x-auto gap-4 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
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

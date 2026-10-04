import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Heart, Share2, Star, ShoppingCart, Truck, ShieldCheck, RefreshCcw,
  ChevronRight, Check, MapPin, MessageSquare, ThumbsUp, Sparkles, ArrowLeft, HelpCircle, Ruler, X
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, getDocs, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Review, Address, ProductVariant, FamilyColorVariant } from '../../shared/types';
import { useCartStore, useAuthStore, useSettingsStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import LocationPickerModal from '../../desktop/components/LocationPickerModal';
import { getProductSlug, createSlug } from '../../shared/utilities/slug';
import { cleanProductCode, formatProductCode } from '../../shared/utilities/productCode';
import { shareProduct, updateOpenGraphTags } from '../../shared/utilities/shareUtils';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { getShortDeliveryText } from '../../shared/utilities/dateUtils';
import ProductCard from '../../desktop/components/ProductCard';
import DeliveryAndServiceDetails from '../../shared/components/DeliveryAndServiceDetails';
import UniversalVariantSelector from '../../shared/components/UniversalVariantSelector';
import { getBestInitialSelection, getProductVariantAttributes, normalizeAttributeKey, fetchFamilyColorMatrix } from '../../shared/utilities/variantMatrixUtils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { addRecentlyViewedId, fetchRecentlyViewedProducts } from '../../shared/utilities/recentlyViewedUtils';

export default function MobileProductDetailScreen() {
  const params = useParams<{ id?: string; slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetSlugOrId = params.id || params.slug;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const { addItem, items: cartItems } = useCartStore();
  const { selectedAddress } = useLocationStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [familyColorVariants, setFamilyColorVariants] = useState<FamilyColorVariant[]>([]);
  const mobileGalleryRef = React.useRef<HTMLDivElement>(null);
  const [activeInfoTab, setActiveInfoTab] = useState<'specifications' | 'description' | 'warranty' | 'manufacturer'>('specifications');

  const handleMobileGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const width = e.currentTarget.clientWidth;
    if (width > 0) {
      const idx = Math.round(e.currentTarget.scrollLeft / width);
      if (idx >= 0 && idx !== activeImageIndex) {
        setActiveImageIndex(idx);
      }
    }
  };

  const scrollToMobileImage = (idx: number) => {
    setActiveImageIndex(idx);
    if (mobileGalleryRef.current) {
      const width = mobileGalleryRef.current.clientWidth;
      mobileGalleryRef.current.scrollTo({ left: idx * width, behavior: 'smooth' });
    }
  };

  const handleVariantSelection = (variantId: string, updatedAttributes: Record<string, string>) => {
    setSelectedVariantId(variantId);
    setSelectedAttributes(updatedAttributes);
    
    // Check if variant has a specific image matching one in the product gallery
    const targetVariant = product?.variants?.find(v => v.id === variantId);
    const targetImg = targetVariant?.images?.[0] || targetVariant?.image;
    if (targetImg && typeof targetImg === 'string' && targetImg.trim()) {
      const trimmed = targetImg.trim();
      const foundIdx = images.indexOf(trimmed);
      if (foundIdx >= 0) {
        scrollToMobileImage(foundIdx);
      } else {
        scrollToMobileImage(0);
      }
    } else {
      scrollToMobileImage(0);
    }

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('variant', variantId);
      return next;
    }, { replace: true });
  };
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);

  useEffect(() => {
    if (user?.wishlist && product?.id) {
      setIsWishlisted(user.wishlist.includes(product.id));
    } else {
      setIsWishlisted(false);
    }
  }, [user?.wishlist, product?.id]);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  const productId = product?.id || targetSlugOrId || '';

  // Check if item is already in cart
  const isInCart = cartItems.some(i => i.productId === productId && i.variantId === selectedVariantId);

  // Fetch product & reviews
  useEffect(() => {
    if (!targetSlugOrId) return;
    setLoading(true);

    const fetchProduct = async () => {
      try {
        let foundProduct: Product | null = null;
        const cleanTargetCode = cleanProductCode(targetSlugOrId);

        // 1. Direct doc ID
        try {
          const docRef = doc(db, 'products', targetSlugOrId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            foundProduct = { id: snap.id, ...snap.data() } as Product;
          }
        } catch (_) { }

        // 2. Query slug field
        if (!foundProduct) {
          const qSlug = query(collection(db, 'products'), where('slug', '==', targetSlugOrId));
          const snapSlug = await getDocs(qSlug);
          if (!snapSlug.empty) {
            const firstDoc = snapSlug.docs[0];
            foundProduct = { id: firstDoc.id, ...firstDoc.data() } as Product;
          }
        }

        // 3. Query productCode
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
          setActiveImageIndex(0);
          if (mobileGalleryRef.current) {
            mobileGalleryRef.current.scrollTo({ left: 0 });
          }

          // Fetch family color matrix if familyId is set
          if (foundProduct.familyId) {
            try {
              const matrix = await fetchFamilyColorMatrix(foundProduct.familyId, foundProduct);
              setFamilyColorVariants(matrix);
            } catch (err) {
              console.error("Failed to load mobile family color matrix:", err);
              setFamilyColorVariants([]);
            }
          } else {
            setFamilyColorVariants([]);
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

          try {
            const rewardIds = await getRewardProductIds();
            if (!rewardIds.has(foundProduct.id) && !(foundProduct as any).isRewardProduct) {
              addRecentlyViewedId(foundProduct.id);
            }
          } catch (err) {
            console.error("Error updating recently viewed:", err);
          }

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
            setSelectedVariantId(initialSelection.variant.id);
            setSelectedAttributes(initialSelection.selectedAttributes);
          }

          if (targetSlugOrId !== canonicalSlug && (
            targetSlugOrId === foundProduct.id ||
            /^\d+$/.test(targetSlugOrId) ||
            (cleanTargetCode && foundProduct.productCode && cleanProductCode(foundProduct.productCode) === cleanTargetCode)
          )) {
            navigate(`/products/${canonicalSlug}${urlVariantId ? `?variant=${urlVariantId}` : ''}`, { replace: true });
          }

          const qReviews = query(collection(db, 'reviews'), where('productId', '==', foundProduct.id));
          return onSnapshot(qReviews, (snap) => {
            const revs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
            setReviews(revs);
          });
        } else {
          toast.error("Product not found");
          navigate('/products');
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [targetSlugOrId, navigate]);

  const handleToggleWishlist = async () => {
    if (!user) {
      toast.error("Please login to manage wishlist");
      navigate('/login');
      return;
    }
    const userRef = doc(db, 'users', user.uid);
    const currentlyWishlisted = isWishlisted;
    setIsWishlisted(!currentlyWishlisted);

    const currentWishlist = user.wishlist || [];
    const updatedWishlist = currentlyWishlisted
      ? currentWishlist.filter(id => id !== productId)
      : Array.from(new Set([...currentWishlist, productId]));

    useAuthStore.getState().setUser({
      ...user,
      wishlist: updatedWishlist
    });

    try {
      await updateDoc(userRef, {
        wishlist: currentlyWishlisted ? arrayRemove(productId) : arrayUnion(productId)
      });
      toast.success(currentlyWishlisted ? "Removed from Wishlist" : "Saved to Wishlist");
    } catch (err) {
      console.error("Wishlist error:", err);
      setIsWishlisted(currentlyWishlisted);
      useAuthStore.getState().setUser({
        ...user,
        wishlist: currentWishlist
      });
      toast.error("Failed to update wishlist");
    }
  };

  const handleShare = () => {
    if (product) {
      shareProduct(product);
    }
  };

  const validateVariantSelection = (): boolean => {
    if (product && product.variants && product.variants.some(v => !v.disabled && v.status !== 'disabled') && !selectedVariantId) {
      const attributes = getProductVariantAttributes(product);
      const missingAttr = attributes.find(a => !selectedAttributes[normalizeAttributeKey(a.name)]);
      if (missingAttr) {
        toast.error(`Please select ${missingAttr.name}`);
      } else {
        toast.error('Please select an available variant.');
      }
      return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (isInCart) {
      navigate('/cart');
      return;
    }
    if (!validateVariantSelection()) return;
    const result = addItem(product, 1, selectedVariantId);
    if (result.success) {
      toast.success("Added to Cart!", { icon: '🛒' });
    } else if (result.exists) {
      navigate('/cart');
    } else if (result.limitReached) {
      toast.error("Cart limit reached (100 items max)");
    } else {
      toast.error("Could not add to cart. Out of stock");
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (isInCart) {
      navigate('/checkout');
      return;
    }
    if (!validateVariantSelection()) return;
    const result = addItem(product, 1, selectedVariantId);
    if (result.success || result.exists) {
      navigate('/checkout');
    } else {
      toast.error("Could not proceed to checkout. Out of stock.");
    }
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading Product...</span>
        </div>
      </div>
    );
  }

  const activeVariants = (product.variants || []).filter(v => !v.disabled && v.status !== 'disabled');
  const selectedVariant = activeVariants.find(v => v.id === selectedVariantId);
  const basePrice = (selectedVariant?.price && selectedVariant.price > 0) ? selectedVariant.price : (product.discountPrice || product.price);
  const finalPrice = (selectedVariant?.price && selectedVariant.price > 0) ? selectedVariant.price : (basePrice + (selectedVariant?.extraPrice || 0));
  const originalPrice = selectedVariant?.mrp || product.mrp || product.price;
  const discountAmount = originalPrice > finalPrice ? originalPrice - finalPrice : 0;
  const discountPct = originalPrice > 0 && discountAmount > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
  // Load and display every valid product image saved for the current product
  const rawProductImages = (Array.isArray(product.images) ? product.images : [])
    .filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
    .map(img => img.trim());

  const allProductImages: string[] = [...rawProductImages];
  if (product.primaryImage && typeof product.primaryImage === 'string' && product.primaryImage.trim()) {
    const pImg = product.primaryImage.trim();
    if (!allProductImages.includes(pImg)) {
      allProductImages.unshift(pImg);
    }
  }
  if ((product as any).image && typeof (product as any).image === 'string' && (product as any).image.trim()) {
    const legacyImg = (product as any).image.trim();
    if (!allProductImages.includes(legacyImg)) {
      allProductImages.push(legacyImg);
    }
  }

  // Variant-specific images if any additional exist
  const variantImages: string[] = [];
  if (selectedVariant) {
    if (Array.isArray(selectedVariant.images)) {
      selectedVariant.images.forEach(img => {
        if (typeof img === 'string' && img.trim()) {
          const trimmed = img.trim();
          if (!variantImages.includes(trimmed)) {
            variantImages.push(trimmed);
          }
        }
      });
    }
    if (selectedVariant.image && typeof selectedVariant.image === 'string' && selectedVariant.image.trim()) {
      const vImg = selectedVariant.image.trim();
      if (!variantImages.includes(vImg)) {
        variantImages.push(vImg);
      }
    }
  }

  const combinedImages: string[] = [...allProductImages];
  variantImages.forEach(vImg => {
    if (!combinedImages.includes(vImg)) {
      combinedImages.push(vImg);
    }
  });

  const images = combinedImages.length > 0 ? combinedImages : ['https://via.placeholder.com/600?text=No+Image'];
  const activeImageSrc = images[activeImageIndex] || images[0];
  const currentStock = selectedVariant ? (selectedVariant.stock ?? 0) : product.stock;

  // Build specifications list excluding empty fields
  const specsList: { key: string; value: string }[] = [];
  if (product.specifications && Array.isArray(product.specifications)) {
    product.specifications.forEach(s => {
      if (s.key && s.value && s.key.trim() && s.value.trim()) {
        specsList.push({ key: s.key.trim(), value: s.value.trim() });
      }
    });
  }

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

  return (
    <div className="min-h-screen bg-white pb-44 font-sans select-none space-y-3">
      {/* Top Gallery */}
      <div className="bg-white relative">
        <div className="aspect-square w-full relative overflow-hidden bg-white">
          <div
            ref={mobileGalleryRef}
            onScroll={handleMobileGalleryScroll}
            className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth touch-pan-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {images.map((img, idx) => (
              <div key={idx} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center p-1 bg-white">
                <img
                  src={img}
                  alt={`${product.name} - ${idx + 1}`}
                  className="w-full h-full object-contain bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600?text=Image+Unavailable';
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 pointer-events-auto">
            <button
              onClick={handleToggleWishlist}
              aria-label="Add to wishlist"
              className="p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-md text-gray-700 hover:text-rose-500"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              aria-label="Share product"
              className="p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-md text-gray-700 hover:text-emerald-700"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {images.length > 1 && (
          <div className="flex justify-center gap-2 p-3 overflow-x-auto scrollbar-none snap-x touch-pan-x">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToMobileImage(idx)}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 snap-start ${
                  activeImageIndex === idx ? 'border-emerald-600 scale-105 shadow' : 'border-gray-200'
                }`}
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Info Box */}
      <div className="bg-white rounded-2xl p-4 shadow-xs space-y-5">
        <div className="space-y-3 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              {product.brand || 'ViBa Select'}
            </span>
          </div>

          <h1 className="text-base font-extrabold text-gray-900 leading-snug">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100 flex-wrap">
            <span className="text-2xl font-black text-gray-900">
              ₹{finalPrice.toLocaleString()}
            </span>
            {originalPrice > finalPrice && (
              <span className="text-sm text-gray-400 line-through">
                ₹{originalPrice.toLocaleString()}
              </span>
            )}
            {discountPct > 0 && (
              <span className="text-xs font-black text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded">
                {discountPct}% OFF
              </span>
            )}
            {discountAmount > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Save ₹{discountAmount.toLocaleString()}
              </span>
            )}
          </div>

          {currentStock > 0 && currentStock <= 5 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black">
              Only {currentStock} left in stock
            </div>
          )}
        </div>

        {/* Universal Variant Selector */}
        {(activeVariants.length > 0 || familyColorVariants.length > 0) && (
          <div className="pb-4 border-b border-gray-100 space-y-4">
            <UniversalVariantSelector
              product={product}
              selectedAttributes={selectedAttributes}
              selectedVariantId={selectedVariantId}
              familyColorVariants={familyColorVariants}
              onSelectVariant={handleVariantSelection}
              onOpenSizeChart={() => setShowSizeChartModal(true)}
              showSizeChartButton={true}
            />
          </div>
        )}

        {/* Delivery Details & Service Section (Requirement 4 & 5) */}
        <div className="space-y-2 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Delivery Details</span>
          </div>

          {selectedAddress ? (
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-gray-900 block">
                      Deliver to {selectedAddress.fullName || 'Customer'} — {selectedAddress.zip}
                    </span>
                    <p className="text-[11px] font-bold text-gray-600 line-clamp-1">
                      {selectedAddress.house}, {selectedAddress.street}, {selectedAddress.city}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationPickerModal(true)}
                  className="text-[10px] font-black uppercase text-emerald-800 tracking-wider hover:underline shrink-0 ml-2"
                >
                  Change
                </button>
              </div>
              <div className="pt-1 border-t border-emerald-200/60 flex items-center gap-1.5">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                  {getShortDeliveryText()}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-700">No delivery address selected</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPickerModal(true)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-wider"
              >
                Select Address
              </button>
            </div>
          )}

          {/* Service Cards directly below Delivery Details with compact spacing */}
          <DeliveryAndServiceDetails product={product} settings={settings} />
        </div>

        {/* Questions FAQ link */}
        <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-600">Have questions about this item?</span>
          <button
            onClick={() => navigate('/faq')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gray-950" /> Help
          </button>
        </div>

        {/* Similar Products Section (Requirement 6) */}
        <div className="pb-4 border-b border-gray-100 space-y-3">
          <MobileSimilarProducts categoryId={product.categoryId} currentProductId={product.id} />
        </div>

        {/* Product Information Details (Requirements 7 & 8) */}
        {availableTabs.length > 0 && (
          <div className="pb-4 border-b border-gray-100 space-y-3">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
              Product Information Details
            </h3>

            {/* Compact horizontal scrollable buttons row */}
            <div className="flex flex-nowrap overflow-x-auto gap-2 pb-1 scrollbar-none">
              {availableTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveInfoTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                    activeTabId === tab.id
                      ? 'bg-green-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected Tab Content */}
            {activeTabId === 'specifications' && (
              <div>
                <div className="divide-y divide-gray-100 bg-gray-50 rounded-xl p-2.5">
                  {specsList.map((spec, i) => (
                    <div key={i} className="py-1.5 flex justify-between text-xs">
                      <span className="font-bold text-gray-500">{spec.key}</span>
                      <span className="font-extrabold text-gray-900 text-right ml-2">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTabId === 'description' && (
              <div>
                <p className="text-xs font-medium text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-3 rounded-xl">
                  {product.fullDescription || product.description}
                </p>
              </div>
            )}

            {activeTabId === 'warranty' && (
              <div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-black text-gray-900">Warranty Coverage</span>
                  </div>
                  <p className="text-xs font-extrabold text-gray-800">
                    {rawWarranty}
                  </p>
                  {product.brandSupportText && (
                    <p className="text-[10px] text-gray-500 font-medium">
                      Brand Support: {product.brandSupportText}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTabId === 'manufacturer' && (
              <div>
                <div className="divide-y divide-gray-100 bg-gray-50 rounded-xl p-2.5">
                  {manufacturerDetails.map((item, i) => (
                    <div key={i} className="py-1.5 flex justify-between text-xs">
                      <span className="font-bold text-gray-500">{item.key}</span>
                      <span className="font-extrabold text-gray-900 text-right ml-2">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recently Viewed */}
        <div className="space-y-6 pt-2 pb-6">
          <MobileRecentlyViewed currentProductId={product.id} />
        </div>

      </div>

      {/* Fixed Mobile Bottom Action Bar */}
      <div className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-yellow-100 p-3 shadow-lg flex items-center gap-2 max-w-md mx-auto">
        <button
          onClick={handleAddToCart}
          className="flex-1 py-3.5 px-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-emerald-50 text-emerald-800 border border-emerald-200"
        >
          <ShoppingCart className="w-4 h-4 text-emerald-700" />
          {isInCart ? 'Go to Cart' : 'Add to Cart'}
        </button>

        <button
          onClick={handleBuyNow}
          className="flex-1 py-3.5 px-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-950 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95"
        >
          Buy Now
        </button>
      </div>

      {/* Size Chart Modal */}
      {showSizeChartModal && product.sizeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-gray-900">Size Chart</h3>
              </div>
              <button
                onClick={() => setShowSizeChartModal(false)}
                className="p-1.5 bg-gray-100 rounded-full text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-1 flex items-center justify-center max-h-[60vh] overflow-y-auto">
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

function MobileRecentlyViewed({ currentProductId }: { currentProductId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchRecent = async () => {
      setLoading(true);
      const fetched = await fetchRecentlyViewedProducts(currentProductId, 4);
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
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">
          Recently Viewed
        </span>
      </div>
      <div className="flex overflow-x-auto gap-2.5 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
        {products.map(p => (
          <div key={`recent-${p.id}`} className="w-[145px] sm:w-[165px] shrink-0 snap-start flex flex-col">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileSimilarProducts({ categoryId, currentProductId }: { categoryId: string, currentProductId: string }) {
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
        ).slice(0, 8);
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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">
          Similar Products
        </span>
        <Link to="/products" className="text-[10px] font-black uppercase text-emerald-700">
          See All →
        </Link>
      </div>
      <div className="flex overflow-x-auto gap-2.5 hide-scrollbar scroll-smooth snap-x py-1 min-w-0 w-full">
        {products.map(p => (
          <div key={p.id} className="w-[145px] sm:w-[165px] shrink-0 snap-start flex flex-col">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

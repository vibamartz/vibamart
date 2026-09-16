import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { Product, ProductVariant, WaitlistItem } from '../../shared/types';
import { Star, ShoppingCart, ShieldCheck, Truck, RefreshCcw, ChevronRight, Heart, Share2, Bell, MapPin, PackageCheck, Clock, CheckCircle2, XCircle, HelpCircle, Ruler, X, Check } from 'lucide-react';
import { useCartStore, useAuthStore, useCategoryStore } from '../../backend/store';
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

export default function ProductDetail() {
  const params = useParams();
  const targetSlugOrId = params.id || params.slug;
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem, items } = useCartStore();
  const { user, orderedProductIds } = useAuthStore();
  const { categories } = useCategoryStore();
  const { selectedAddress } = useLocationStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isLocationAvailable, setIsLocationAvailable] = useState<boolean | null>(true);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

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

        if (foundProduct) {
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
      if (product) {
        try {
          const rewardIds = await getRewardProductIds();
          if (rewardIds.has(product.id) || (product as any).isRewardProduct) {
            return;
          }
          const existing: string[] = JSON.parse(localStorage.getItem('viba_recently_viewed') || '[]');
          const updated = Array.from(new Set([product.id, ...existing.filter(pid => pid !== product.id)])).slice(0, 8);
          localStorage.setItem('viba_recently_viewed', JSON.stringify(updated));
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
    if (result.success) {
      navigate('/checkout');
    } else {
      toast.error(result.exists ? 'Product already added to cart' : 'Could not add to cart. Out of stock.');
    }
  };

  const handleAddToCart = () => {
    const result = addItem(product, 1, selectedVariant);
    if (result.success) {
      toast.success('Product added to cart');
    } else {
      toast.error(result.exists ? 'Product already added to cart' : 'Could not add to cart. Out of stock.');
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

  const activeImageSrc = currentVariant?.image || product.images?.[selectedImage] || 'https://via.placeholder.com/400x500?text=No+Image';

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 flex-wrap">
        <Link to="/" className="hover:text-green-600 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/products" className="hover:text-green-600 transition-colors">Shop</Link>
        {categoryObj && (
          <>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/category/${getCategorySlug(categoryObj)}`} className="hover:text-green-600 transition-colors">{categoryObj.name}</Link>
          </>
        )}
        {subCategoryObj && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-400">{subCategoryObj.name}</span>
          </>
        )}
        {nestedSubCategoryObj && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-400">{nestedSubCategoryObj.name}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 truncate max-w-[200px]">{product.name}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 bg-white sm:rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-8 lg:gap-12 mb-12">
        {/* Left: Image Gallery */}
        <div className="w-full lg:flex-1 space-y-4">
          <div className="relative aspect-[1/1] sm:aspect-[4/5] overflow-hidden rounded-2xl bg-gray-50/80 border border-gray-100 lg:sticky lg:top-24 flex items-center justify-center p-3 sm:p-4">
            <img
              src={activeImageSrc}
              alt={product.name}
              className="w-full h-full object-contain drop-shadow-sm"
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
              <button
                onClick={handleToggleWishlist}
                aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                className={`p-3 touch-target min-h-[44px] backdrop-blur shadow-sm rounded-full transition-all active:scale-95 flex items-center justify-center ${isWishlisted ? 'bg-rose-50 text-rose-500' : 'bg-white/90 text-gray-400 hover:text-rose-500'
                  }`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
              </button>
              <button
                onClick={() => product && shareProduct(product)}
                aria-label="Share product"
                className="p-3 touch-target min-h-[44px] flex items-center justify-center bg-white/90 backdrop-blur shadow-sm rounded-full text-gray-400 hover:text-green-600 transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {(product.images || []).map((img, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(idx)}
                className={`aspect-square rounded-xl overflow-hidden border-2 transition-all bg-gray-50/50 p-1 flex items-center justify-center ${selectedImage === idx && !currentVariant?.image ? 'border-green-600' : 'border-transparent opacity-60'}`}
              >
                <img src={img} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Info & Variants */}
        <div className="flex-1 space-y-8 py-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-4 flex-wrap">
                <span className="text-5xl font-black text-gray-900">₹{totalPrice.toLocaleString()}</span>
                {originalPrice > totalPrice && (
                  <span className="text-2xl text-gray-400 line-through font-medium">₹{originalPrice.toLocaleString()}</span>
                )}
                {discountPercentage > 0 && <span className="text-2xl font-black text-green-600 uppercase">{discountPercentage}% OFF</span>}
              </div>
              {originalPrice > totalPrice && (
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-[0.2em] bg-green-50 px-3 py-1.5 rounded-lg w-max">
                  You save ₹{(originalPrice - totalPrice).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-black text-green-600 uppercase tracking-widest mb-2">Verified Merchant</p>
            <h1 className="text-3xl font-black text-gray-900 leading-tight mb-4 tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-4 py-4 border-b border-gray-100">
              <div className="group flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Seller:</span>
                <span className="text-sm font-black text-primary hover:underline">{product.brand || 'ViBa Mart'} Retail</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6">
            {product.isStockVisible !== false && (
              currentStock > 0 ? (
                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full uppercase tracking-wider">In Stock</span>
              ) : (
                <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Out of Stock</span>
              )
            )}
          </div>

          {/* Variants Section */}
          {activeVariants.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-gray-100">
              {/* Selected Variant Summary */}
              {currentVariant && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    Selected Variant: <span className="text-gray-900 font-extrabold">{currentVariant.name || currentVariant.color || currentVariant.size || 'Default'}</span>
                  </span>
                  {product.sizeChart && (
                    <button
                      type="button"
                      onClick={() => setShowSizeChartModal(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-colors uppercase tracking-wider"
                    >
                      <Ruler className="w-4 h-4" /> Size Chart
                    </button>
                  )}
                </div>
              )}

              {/* Color Selection */}
              {activeVariants.some(v => v.color || v.colorName) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      Color: <span className="text-gray-900 font-extrabold">{currentVariant?.color || currentVariant?.colorName || 'Select Color'}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {activeVariants.map((v) => {
                      if (!v.color && !v.colorName) return null;
                      const isSelected = selectedVariant === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v.id)}
                          disabled={v.stock === 0}
                          className={`px-4 py-2.5 rounded-xl border-2 font-bold text-xs transition-all flex items-center gap-2 ${
                            isSelected
                              ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
                              : v.stock === 0
                              ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {v.colorHex && (
                            <span
                              className="w-4 h-4 rounded-full border border-gray-300 inline-block shrink-0 shadow-xs"
                              style={{ backgroundColor: v.colorHex }}
                            />
                          )}
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
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      Size: <span className="text-gray-900 font-extrabold">{currentVariant?.size || currentVariant?.shoeSize || 'Select Size'}</span>
                    </span>
                    {product.sizeChart && !activeVariants.some(v => v.color) && (
                      <button
                        type="button"
                        onClick={() => setShowSizeChartModal(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-green-600 bg-green-50 px-3 py-1 rounded-xl hover:bg-green-100 transition-colors uppercase tracking-wider"
                      >
                        <Ruler className="w-4 h-4" /> Size Chart
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
                          className={`min-w-[48px] px-4 py-3 rounded-xl border-2 text-xs font-black transition-all ${
                            isSelected
                              ? 'border-green-600 bg-green-600 text-white shadow-md'
                              : v.stock === 0
                              ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-40 cursor-not-allowed'
                              : 'border-gray-200 text-gray-800 hover:border-gray-300'
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
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Options & Configuration</span>
                  <div className="flex flex-wrap gap-2">
                    {activeVariants.map((v) => {
                      const label = [v.name, v.storage, v.ram, v.shade, v.volume, v.material, v.model].filter(Boolean).join(' • ');
                      if (!label) return null;
                      const isSelected = selectedVariant === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVariant(v.id)}
                          disabled={v.stock === 0}
                          className={`px-4 py-3 rounded-xl border-2 text-xs font-bold transition-all ${
                            isSelected
                              ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
                              : v.stock === 0
                              ? 'border-gray-100 bg-gray-50 text-gray-300 opacity-40 cursor-not-allowed'
                              : 'border-gray-200 text-gray-800 hover:border-gray-300'
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
            </div>
          )}

          {/* Add to Cart / Buy Now Actions */}
          <div className="flex flex-col gap-4 items-stretch mt-6">
            <div className="flex-1 w-full flex flex-col gap-3">
              {currentStock > 0 ? (
                <>
                  <button
                    onClick={() => {
                      if (isInCart) {
                        navigate('/cart');
                      } else {
                        handleAddToCart();
                      }
                    }}
                    disabled={!isLocationAvailable}
                    className={`flex-1 flex touch-target min-h-[44px] items-center justify-center gap-2 py-5 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${
                      !isLocationAvailable
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-yellow-400 text-gray-950 shadow-yellow-100 hover:bg-yellow-300 active:scale-95'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5" /> {isInCart ? 'Go to Cart' : 'Add to Cart'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!isLocationAvailable}
                    className={`flex-1 touch-target min-h-[44px] py-5 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${
                      !isLocationAvailable
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-amber-500 text-gray-950 shadow-amber-200 hover:bg-amber-400 active:scale-95'
                    }`}
                  >
                    Buy Now
                  </button>
                </>
              ) : (
                <button
                  onClick={isOnWaitlist ? undefined : handleJoinWaitlist}
                  disabled={isOnWaitlist}
                  className={`w-full flex items-center justify-center gap-2 py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${
                    isOnWaitlist ? 'bg-green-50 text-green-600 border-2 border-green-100 cursor-default shadow-none' : 'bg-green-600 text-white shadow-green-100 hover:bg-green-700'
                  }`}
                >
                  {isOnWaitlist ? <><Bell className="w-5 h-5" /> On Waitlist</> : <><Bell className="w-5 h-5" /> Notify Me When Available</>}
                </button>
              )}
            </div>
          </div>

          {/* Delivery Details Section */}
          <div className="space-y-4 pt-8 border-t border-gray-100">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Delivery Details</h3>

            {isLocationAvailable === false && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Product unavailable for delivery at selected address ({selectedAddress?.city ? selectedAddress.city + ', ' : ''}{selectedAddress?.zip}).</span>
              </div>
            )}

            {selectedAddress ? (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
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
                    className="text-xs font-black uppercase text-green-600 tracking-wider hover:underline shrink-0 ml-3"
                  >
                    Change
                  </button>
                </div>
                <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                    {getShortDeliveryText()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <span className="text-xs font-bold text-gray-700 block">No delivery address selected</span>
                    <span className="text-[10px] text-gray-400">Select address to view exact delivery dates</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationPickerModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-sm"
                >
                  Select Address
                </button>
              </div>
            )}
          </div>

          {/* Offers & Warranties */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
            <ServiceIcon icon={ShieldCheck} title="Warranty" desc="1 Year Brand Warranty" />
            <ServiceIcon icon={RefreshCcw} title="Return Benefit" desc="7-day return" />
            {product.isCodAllowed !== false ? (
              <ServiceIcon icon={PackageCheck} title="Payment Option" desc="Cash on Delivery" />
            ) : (
              <ServiceIcon icon={Truck} title="Delivery" desc="Free Home Delivery" />
            )}
          </div>
        </div>
      </div>

      {/* Similar Products Section (Requirement 6) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <SimilarProducts categoryId={product.categoryId} currentProductId={product.id} />
      </div>

      {/* Product Information Details Section (Requirements 7 & 8) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-8">
          <h2 className="text-2xl font-black text-gray-900 italic tracking-tight">Product Information Details</h2>

          {/* Specifications */}
          {specsList.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-black text-gray-900 tracking-tight">Specifications</h3>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {specsList.map((spec, i) => (
                  <div key={i} className="flex flex-col sm:flex-row p-4 hover:bg-white transition-colors">
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-1 sm:mb-0">{spec.key}</span>
                    <span className="text-sm font-black text-gray-900 sm:flex-1">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Description</h3>
            <p className="text-gray-600 leading-relaxed font-medium whitespace-pre-line text-sm">
              {product.fullDescription || product.description}
            </p>
          </div>
        </div>
      </div>

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
            .filter(p => p.id !== currentProductId),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-50 rounded-[2.5rem] aspect-[4/5] border border-gray-100" />
          ))
        ) : (
          products.map(p => (
            <ProductCard key={p.id} product={p} />
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
    const fetchRecent = async () => {
      const savedIds = JSON.parse(localStorage.getItem('viba_recently_viewed') || '[]');
      const targetIds = savedIds.filter((pid: string) => pid !== currentProductId).slice(0, 4);
      if (targetIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'products'),
          where(documentId(), 'in', targetIds)
        );
        const snapshot = await getDocs(q);
        const rewardIds = await getRewardProductIds();
        const fetchedProducts = filterOutRewardProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)), rewardIds);
        fetchedProducts.sort((a, b) => targetIds.indexOf(a.id) - targetIds.indexOf(b.id));
        setProducts(fetchedProducts);
      } catch (err) {
        console.error('Error fetching recently viewed products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecent();
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-50 rounded-[2.5rem] aspect-[4/5] border border-gray-100" />
          ))
        ) : (
          products.map(p => (
            <ProductCard key={p.id} product={p} />
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

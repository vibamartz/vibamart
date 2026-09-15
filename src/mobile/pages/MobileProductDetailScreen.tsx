import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Heart, Share2, Star, ShoppingCart, Truck, ShieldCheck, RefreshCcw,
  ChevronRight, Check, MapPin, MessageSquare, ThumbsUp, Sparkles, ArrowLeft, HelpCircle, Ruler, X
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, getDocs, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Review, Address, ProductVariant } from '../../shared/types';
import { useCartStore, useAuthStore, useSettingsStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import LocationPickerModal from '../../desktop/components/LocationPickerModal';
import { getProductSlug, createSlug } from '../../shared/utilities/slug';
import { cleanProductCode, formatProductCode } from '../../shared/utilities/productCode';
import { shareProduct, updateOpenGraphTags } from '../../shared/utilities/shareUtils';
import { getRewardProductIds, filterOutRewardProducts } from '../../shared/utilities/rewardUtils';
import { getShortDeliveryText } from '../../shared/utilities/dateUtils';
import ProductCard from '../../desktop/components/ProductCard';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProductDetailScreen() {
  const params = useParams<{ id?: string; slug?: string }>();
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
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
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

        if (foundProduct) {
          setProduct(foundProduct);
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
              const existing: string[] = JSON.parse(localStorage.getItem('viba_recently_viewed') || '[]');
              const updated = Array.from(new Set([foundProduct.id, ...existing.filter((pid: string) => pid !== foundProduct.id)])).slice(0, 8);
              localStorage.setItem('viba_recently_viewed', JSON.stringify(updated));
            }
          } catch (err) {
            console.error("Error updating recently viewed:", err);
          }

          const firstValidVariant = foundProduct.variants?.find(v => !v.disabled);
          if (firstValidVariant) {
            setSelectedVariantId(firstValidVariant.id);
          }

          if (targetSlugOrId !== canonicalSlug && (
            targetSlugOrId === foundProduct.id ||
            /^\d+$/.test(targetSlugOrId) ||
            (cleanTargetCode && foundProduct.productCode && cleanProductCode(foundProduct.productCode) === cleanTargetCode)
          )) {
            navigate(`/products/${canonicalSlug}`, { replace: true });
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

  const handleAddToCart = () => {
    if (!product) return;
    if (isInCart) {
      navigate('/cart');
      return;
    }
    const result = addItem(product, 1, selectedVariantId);
    if (result.success) {
      toast.success("Added to Cart!", { icon: '🛒' });
    } else if (result.exists) {
      navigate('/cart');
    } else {
      toast.error("Out of stock");
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!isInCart) {
      addItem(product, 1, selectedVariantId);
    }
    navigate('/checkout');
  };

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Loading Product...</span>
        </div>
      </div>
    );
  }

  const activeVariants = (product.variants || []).filter(v => !v.disabled);
  const selectedVariant = activeVariants.find(v => v.id === selectedVariantId);
  const basePrice = (selectedVariant?.price && selectedVariant.price > 0) ? selectedVariant.price : (product.discountPrice || product.price);
  const finalPrice = basePrice + (selectedVariant?.extraPrice || 0);
  const originalPrice = product.mrp || product.price;
  const discountAmount = originalPrice > finalPrice ? originalPrice - finalPrice : 0;
  const discountPct = originalPrice > 0 && discountAmount > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;
  const images = product.images?.length > 0 ? product.images : ['https://via.placeholder.com/600'];
  const activeImageSrc = selectedVariant?.image || images[activeImageIndex];
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

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-44 font-sans select-none space-y-3">
      {/* Top Gallery */}
      <div className="bg-white relative">
        <div className="aspect-square w-full relative overflow-hidden bg-gray-50">
          <img
            src={activeImageSrc}
            alt={product.name}
            className="w-full h-full object-cover"
          />

          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={handleShare}
              aria-label="Share product"
              className="p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-md text-gray-700 hover:text-emerald-700"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleToggleWishlist}
              aria-label="Add to wishlist"
              className="p-2.5 bg-white/90 backdrop-blur-md rounded-full shadow-md text-gray-700 hover:text-rose-500"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          {discountPct > 0 && (
            <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow">
              {discountPct}% OFF
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex justify-center gap-2 p-3 overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${activeImageIndex === idx && !selectedVariant?.image ? 'border-emerald-600 scale-105 shadow' : 'border-gray-200'
                  }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
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

            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-extrabold text-amber-900">{product.rating || 4.5}</span>
              <span className="text-[10px] text-gray-400">({product.numReviews || reviews.length || 12})</span>
            </div>
          </div>

          <h1 className="text-base font-extrabold text-gray-900 leading-snug">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100">
            <span className="text-2xl font-black text-gray-900">
              ₹{finalPrice.toLocaleString()}
            </span>
            {originalPrice > finalPrice && (
              <span className="text-sm text-gray-400 line-through">
                ₹{originalPrice.toLocaleString()}
              </span>
            )}
            {discountAmount > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Save ₹{discountAmount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end pt-1">
            {product.isStockVisible !== false && currentStock > 0 && currentStock <= 5 && (
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 animate-pulse">
                Only {currentStock} left
              </span>
            )}
          </div>
        </div>

        {/* Product Variants (Requirement 1 & 2) */}
        {activeVariants.length > 0 && (
          <div className="pb-4 border-b border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">
                Select Option / Variant
              </span>
              {product.sizeChart && (
                <button
                  type="button"
                  onClick={() => setShowSizeChartModal(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 uppercase"
                >
                  <Ruler className="w-3.5 h-3.5" /> Size Chart
                </button>
              )}
            </div>

            {/* Color Selector */}
            {activeVariants.some(v => v.color || v.colorName) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-gray-500">
                  Color: <span className="text-gray-900 font-extrabold">{selectedVariant?.color || selectedVariant?.colorName || 'Select'}</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((v) => {
                    if (!v.color && !v.colorName) return null;
                    const isSelected = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        disabled={v.stock === 0}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : v.stock === 0
                            ? 'bg-gray-50 text-gray-300 border-gray-100 opacity-40 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        {v.colorHex && (
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block shrink-0"
                            style={{ backgroundColor: v.colorHex }}
                          />
                        )}
                        <span>{v.color || v.colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {activeVariants.some(v => v.size || v.shoeSize) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-gray-500">
                  Size: <span className="text-gray-900 font-extrabold">{selectedVariant?.size || selectedVariant?.shoeSize || 'Select'}</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((v) => {
                    if (!v.size && !v.shoeSize) return null;
                    const isSelected = selectedVariantId === v.id;
                    const displaySize = v.size || v.shoeSize;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        disabled={v.stock === 0}
                        className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : v.stock === 0
                            ? 'bg-gray-50 text-gray-300 border-gray-100 opacity-40 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        {displaySize}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Storage / RAM / Shade / Volume / Material / Model Selectors */}
            {activeVariants.some(v => v.storage || v.ram || v.shade || v.volume || v.material || v.model) && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-gray-500">Configuration</span>
                <div className="flex flex-wrap gap-2">
                  {activeVariants.map((v) => {
                    const label = [v.name, v.storage, v.ram, v.shade, v.volume, v.material, v.model].filter(Boolean).join(' • ');
                    if (!label) return null;
                    const isSelected = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariantId(v.id)}
                        disabled={v.stock === 0}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                            : v.stock === 0
                            ? 'bg-gray-50 text-gray-300 border-gray-100 opacity-40 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-800 border-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delivery Details Section (Requirement 4 & 5) */}
        <div className="pb-4 border-b border-gray-100 space-y-2.5">
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
        </div>

        {/* Return Notice & Services */}
        <div className="pb-4 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl shrink-0 border border-amber-200">
                <RefreshCcw className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-gray-900">7-day return</span>
            </div>

            {product.isCodAllowed !== false && (
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 uppercase tracking-wider">
                Cash on Delivery
              </span>
            )}
          </div>
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-600">Have questions about this item?</span>
            <button
              onClick={() => navigate('/faq')}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-gray-950 rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-gray-950" /> Help
            </button>
          </div>
        </div>

        {/* Similar Products Section (Requirement 6) */}
        <div className="pb-4 border-b border-gray-100 space-y-3">
          <MobileSimilarProducts categoryId={product.categoryId} currentProductId={product.id} />
        </div>

        {/* Product Information Details (Requirements 7 & 8) */}
        <div className="pb-4 border-b border-gray-100 space-y-4">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
            Product Information Details
          </h3>

          {/* Specifications */}
          {specsList.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-gray-400">Specifications</span>
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

          {/* Description */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-gray-400">Description</span>
            <p className="text-xs font-medium text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-3 rounded-xl">
              {product.fullDescription || product.description}
            </p>
          </div>
        </div>

        {/* Customer Reviews */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Customer Reviews ({reviews.length})</span>
            </div>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-3 divide-y divide-gray-100">
              {reviews.slice(0, 5).map((rev) => (
                <div key={rev.id} className="pt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-gray-900">{rev.userName}</span>
                    <div className="flex items-center text-amber-400">
                      {Array(rev.rating).fill(0).map((_, idx) => (
                        <Star key={idx} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-700">{rev.comment}</p>
                  <span className="text-[9px] text-gray-400">
                    {new Date(rev.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 font-bold text-center py-2">
              No reviews yet. Be the first to review this product!
            </p>
          )}
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

function MobileSimilarProducts({ categoryId, currentProductId }: { categoryId: string, currentProductId: string }) {
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
          limit(6)
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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">
          Similar Products
        </span>
        <Link to="/products" className="text-[10px] font-black uppercase text-emerald-700">
          See All →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

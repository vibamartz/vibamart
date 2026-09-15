import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, Share2, Star, ShoppingCart, Truck, ShieldCheck, RefreshCcw, 
  ChevronRight, Check, MapPin, MessageSquare, ThumbsUp, Sparkles, ArrowLeft, HelpCircle 
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Review, Address } from '../../shared/types';
import { useCartStore, useAuthStore, useSettingsStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import { lookupZipcode } from '../../backend/services/zipcode';
import { getProductSlug, createSlug } from '../../shared/utilities/slug';
import { cleanProductCode, formatProductCode } from '../../shared/utilities/productCode';
import { shareProduct, updateOpenGraphTags } from '../../shared/utilities/shareUtils';
import { getRewardProductIds } from '../../shared/utilities/rewardUtils';
import { getDynamicExpectedDeliveryDate } from '../../shared/utilities/dateUtils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProductDetailScreen() {
  const params = useParams<{ id?: string; slug?: string }>();
  const targetSlugOrId = params.id || params.slug;
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const { addItem, items: cartItems } = useCartStore();
  const { selectedAddress, selectAddress } = useLocationStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Delivery check state
  const [pincode, setPincode] = useState(selectedAddress?.zip || '');
  const [deliveryStatus, setDeliveryStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');

  useEffect(() => {
    if (selectedAddress?.zip) {
      setPincode(selectedAddress.zip);
    }
  }, [selectedAddress]);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  const productId = product?.id || targetSlugOrId || '';

  // Check if item is already in cart
  const isInCart = cartItems.some(i => i.productId === productId && i.variantId === selectedVariantId);

  // Fetch product & reviews with slug, ID or Product Code resolution and canonical redirect
  useEffect(() => {
    if (!targetSlugOrId) return;
    setLoading(true);

    const fetchProduct = async () => {
      try {
        let foundProduct: Product | null = null;
        const cleanTargetCode = cleanProductCode(targetSlugOrId);

        // 1. Check direct doc ID
        try {
          const docRef = doc(db, 'products', targetSlugOrId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            foundProduct = { id: snap.id, ...snap.data() } as Product;
          }
        } catch (_) {}

        // 2. Query slug field
        if (!foundProduct) {
          const qSlug = query(collection(db, 'products'), where('slug', '==', targetSlugOrId));
          const snapSlug = await getDocs(qSlug);
          if (!snapSlug.empty) {
            const firstDoc = snapSlug.docs[0];
            foundProduct = { id: firstDoc.id, ...firstDoc.data() } as Product;
          }
        }

        // 3. Query by productCode
        if (!foundProduct) {
          const qCode = query(collection(db, 'products'), where('productCode', '==', formatProductCode(targetSlugOrId)));
          const snapCode = await getDocs(qCode);
          if (!snapCode.empty) {
            const firstDoc = snapCode.docs[0];
            foundProduct = { id: firstDoc.id, ...firstDoc.data() } as Product;
          }
        }

        // 4. Fallback scan by slug helper or cleaned Product Code
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
          if (foundProduct.variants && foundProduct.variants.length > 0) {
            setSelectedVariantId(foundProduct.variants[0].id);
          }

          // Canonical redirect check
          if (targetSlugOrId !== canonicalSlug && (
            targetSlugOrId === foundProduct.id || 
            /^\d+$/.test(targetSlugOrId) ||
            (cleanTargetCode && foundProduct.productCode && cleanProductCode(foundProduct.productCode) === cleanTargetCode)
          )) {
            navigate(`/products/${canonicalSlug}`, { replace: true });
          }

          // Subscribe to reviews for found product
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

  // Auto check delivery status if address is present
  useEffect(() => {
    if (selectedAddress?.zip) {
      setPincode(selectedAddress.zip);
      if (product?.serviceablePincodes && product.serviceablePincodes.length > 0) {
        const isServiced = product.serviceablePincodes.includes(selectedAddress.zip);
        setDeliveryStatus(isServiced ? 'available' : 'unavailable');
      } else {
        setDeliveryStatus('available');
      }
    }
  }, [selectedAddress, product]);

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

  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincode || pincode.length !== 6) {
      toast.error("Enter a valid 6-digit pincode");
      return;
    }
    setDeliveryStatus('checking');
    setTimeout(() => {
      if (product?.serviceablePincodes && product.serviceablePincodes.length > 0) {
        const isServiced = product.serviceablePincodes.includes(pincode);
        setDeliveryStatus(isServiced ? 'available' : 'unavailable');
      } else {
        setDeliveryStatus('available');
      }
    }, 400);
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

  const checkCanReview = async () => {
    if (!user) {
      toast.error("Only verified buyers of delivered orders can write a review.");
      return false;
    }
    try {
      const q = query(
        collection(db, 'orders'),
        where('customerId', '==', user.uid),
        where('status', '==', 'delivered')
      );
      const snap = await getDocs(q);
      const hasPurchased = snap.docs.some(doc => {
        const data = doc.data();
        return data.items?.some((i: any) => i.productId === productId);
      });

      if (!hasPurchased) {
        toast.error("Only verified buyers of delivered orders can write a review.");
        return false;
      }
      return true;
    } catch (err) {
      toast.error("Only verified buyers of delivered orders can write a review.");
      return false;
    }
  };

  const handleOpenWriteReviewModal = async () => {
    const canReview = await checkCanReview();
    if (canReview) {
      setShowReviewModal(true);
    }
  };

  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const canReview = await checkCanReview();
    if (!canReview) return;

    if (!newComment.trim()) {
      toast.error("Please add a review comment");
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        productId: productId,
        userId: user!.uid,
        userName: user!.displayName || user!.email?.split('@')[0] || 'Customer',
        userPhoto: user!.photoURL || '',
        rating: newRating,
        comment: newComment.trim(),
        createdAt: new Date().toISOString(),
        status: 'approved'
      });
      toast.success("Review submitted! Thank you.");
      setNewComment('');
      setShowReviewModal(false);
    } catch (err) {
      toast.error("Failed to submit review");
    }
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

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId);
  const basePrice = product.discountPrice || product.price;
  const finalPrice = basePrice + (selectedVariant?.extraPrice || 0);
  const discountAmount = product.price - basePrice;
  const discountPct = product.price > 0 ? Math.round((discountAmount / product.price) * 100) : 0;
  const images = product.images?.length > 0 ? product.images : ['https://via.placeholder.com/600'];

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-44 font-sans select-none space-y-3">
      {/* Top Media & Image Gallery */}
      <div className="bg-white relative">
        <div className="aspect-square w-full relative overflow-hidden bg-gray-50">
          <img
            src={images[activeImageIndex]}
            alt={product.name}
            className="w-full h-full object-cover"
          />

          {/* Action Overlay Floating Icons */}
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

          {/* Discount Tag */}
          {discountPct > 0 && (
            <span className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow">
              {discountPct}% OFF
            </span>
          )}
        </div>

        {/* Thumbnail Selector Dots */}
        {images.length > 1 && (
          <div className="flex justify-center gap-2 p-3 overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  activeImageIndex === idx ? 'border-emerald-600 scale-105 shadow' : 'border-gray-200'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Seamless Flowing Product Details Layout */}
      <div className="bg-white rounded-2xl p-4 shadow-xs space-y-5">
        {/* Main Info */}
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

          {/* Price & Discounts */}
          <div className="flex items-baseline gap-2 pt-1 border-t border-gray-100">
            <span className="text-2xl font-black text-gray-900">
              ₹{finalPrice.toLocaleString()}
            </span>
            {product.price > finalPrice && (
              <span className="text-sm text-gray-400 line-through">
                ₹{product.price.toLocaleString()}
              </span>
            )}
            {discountAmount > 0 && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                Save ₹{discountAmount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-end pt-1">
            {product.isStockVisible !== false && (selectedVariant ? selectedVariant.stock : product.stock) > 0 && (selectedVariant ? selectedVariant.stock : product.stock) <= 5 && (
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 animate-pulse">
                Only {selectedVariant ? selectedVariant.stock : product.stock} left
              </span>
            )}
          </div>
        </div>

        {/* Product Variants */}
        {product.variants && product.variants.length > 0 && (
          <div className="pb-4 border-b border-gray-100 space-y-2">
            <label className="text-xs font-black text-gray-800 uppercase tracking-wider block">
              Select Option / Variant
            </label>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedVariantId === variant.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow'
                      : 'bg-gray-50 text-gray-800 border-gray-200'
                  }`}
                >
                  {variant.name || variant.color || variant.size || `Variant ${variant.id}`}
                  {variant.extraPrice ? ` (+₹${variant.extraPrice})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delivery Details & Pincode Checker */}
        <div className="pb-4 border-b border-gray-100 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-gray-800 uppercase tracking-wider">
            <Truck className="w-4 h-4 text-emerald-600" />
            <span>Delivery Options & Availability</span>
          </div>

          <form onSubmit={handleCheckPincode} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit Pincode"
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <MapPin className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
            </div>
            <button
              type="submit"
              className="px-4 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Check
            </button>
          </form>

          {deliveryStatus === 'available' && (() => {
            const { expectedBy } = getDynamicExpectedDeliveryDate();
            return (
              <div className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-black uppercase text-[10px] tracking-wider text-emerald-900">Delivery in 4–7 days</span>
                </div>
                <p className="text-xs font-black text-emerald-700 ml-5.5">{expectedBy}</p>
              </div>
            );
          })()}
          {deliveryStatus === 'unavailable' && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
              Sorry, delivery is currently unavailable to {pincode}.
            </p>
          )}
        </div>

        {/* 7-day return Notice & COD badge */}
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

        {/* Product Details & Specifications */}
        <div className="pb-4 border-b border-gray-100 space-y-3">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
            Product Description & Specs
          </h3>
          <p className="text-xs font-medium text-gray-700 leading-relaxed">
            {product.fullDescription || product.description}
          </p>

          {product.specifications && product.specifications.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-gray-100">
              <span className="text-[10px] font-black uppercase text-gray-400">Specifications</span>
              <div className="divide-y divide-gray-100 bg-gray-50 rounded-xl p-2">
                {product.specifications.map((spec, i) => (
                  <div key={i} className="py-1.5 flex justify-between text-xs">
                    <span className="font-bold text-gray-500">{spec.key}</span>
                    <span className="font-extrabold text-gray-900">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ratings & Reviews */}
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
          className={`flex-1 py-3.5 px-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
            isInCart
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
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

    </div>
  );
}

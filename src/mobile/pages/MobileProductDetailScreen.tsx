import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, Share2, Star, ShoppingCart, Truck, ShieldCheck, RefreshCcw, 
  ChevronRight, Check, MapPin, MessageSquare, ThumbsUp, Sparkles, ArrowLeft 
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Product, Review } from '../../shared/types';
import { useCartStore, useAuthStore, useSettingsStore } from '../../backend/store';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProductDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { settings } = useSettingsStore();
  const { addItem, items: cartItems } = useCartStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Delivery check state
  const [pincode, setPincode] = useState('560064');
  const [deliveryStatus, setDeliveryStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');

  // Check if item is already in cart
  const isInCart = cartItems.some(i => i.productId === id && i.variantId === selectedVariantId);

  // Fetch product & reviews
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const prodData = { id: snap.id, ...snap.data() } as Product;
          setProduct(prodData);
          if (prodData.variants && prodData.variants.length > 0) {
            setSelectedVariantId(prodData.variants[0].id);
          }
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

    // Subscribe to reviews
    const qReviews = query(collection(db, 'reviews'), where('productId', '==', id));
    const unsubscribeReviews = onSnapshot(qReviews, (snap) => {
      const revs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
      setReviews(revs);
    });

    return () => unsubscribeReviews();
  }, [id, navigate]);

  // Wishlist check
  useEffect(() => {
    if (user?.wishlist && id) {
      setIsWishlisted(user.wishlist.includes(id));
    }
  }, [user, id]);

  const handleToggleWishlist = () => {
    if (!user) {
      toast.error("Please login to manage wishlist");
      navigate('/login');
      return;
    }
    setIsWishlisted(!isWishlisted);
    toast.success(isWishlisted ? "Removed from Wishlist" : "Saved to Wishlist");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name || 'ViBa Mart Product',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
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

  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to write a review");
      navigate('/login');
      return;
    }
    if (!newComment.trim()) {
      toast.error("Please add a review comment");
      return;
    }

    try {
      await addDoc(collection(db, 'reviews'), {
        productId: id,
        userId: user.uid,
        userName: user.displayName || user.email.split('@')[0],
        userPhoto: user.photoURL || '',
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
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none space-y-3">
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

      {/* Main Info Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
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
        <p className="text-[10px] font-bold text-gray-500">Inclusive of all taxes (GST included)</p>
      </div>

      {/* Product Variants (Colors / Sizes / Extra Options) */}
      {product.variants && product.variants.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2">
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

      {/* Pincode & Delivery Checker */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2.5">
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

        {deliveryStatus === 'available' && (
          <p className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Fast Delivery Available to <strong>{pincode}</strong> (Expected: 2-4 Days)</span>
          </p>
        )}
        {deliveryStatus === 'unavailable' && (
          <p className="text-xs font-bold text-rose-700 bg-rose-50 p-2 rounded-xl border border-rose-200">
            Sorry, delivery is currently unavailable to {pincode}.
          </p>
        )}
      </div>

      {/* 7-Day Return Policy Notice */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 flex items-start gap-3">
        <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shrink-0 border border-amber-200">
          <RefreshCcw className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-black text-gray-900">
            {settings.returnWindowDays || 7}-Day Hassle-Free Returns
          </h4>
          <p className="text-[11px] font-medium text-gray-600 mt-0.5 leading-relaxed">
            Eligible for return or replacement within 7 days of delivery for defective, wrong, or damaged products with valid image proof.
          </p>
        </div>
      </div>

      {/* Product Description & Specifications */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
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

      {/* Customer Reviews Section */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Customer Reviews ({reviews.length})</span>
          </div>
          <button
            onClick={() => setShowReviewModal(true)}
            className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"
          >
            Write Review
          </button>
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

      {/* Fixed Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-yellow-100 p-3 shadow-lg flex items-center gap-2 max-w-md mx-auto">
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

      {/* Write Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4"
            >
              <h3 className="text-base font-black text-gray-900">Write Product Review</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1"
                    >
                      <Star className={`w-6 h-6 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Your Review</label>
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Tell us what you like or dislike about this product..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddReviewSubmit}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

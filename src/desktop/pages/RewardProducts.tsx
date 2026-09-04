import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Tag, Gift, ArrowLeft, ShoppingCart, Star, Clock, ExternalLink,
  ShieldCheck, AlertCircle, CheckCircle2, ChevronRight, ShoppingBag, Eye, Lock
} from 'lucide-react';
import { useRewardsStore, useCartStore, useAuthStore } from '../../backend/store';
import { BrandCoupon, Product } from '../../shared/types';
import { db } from '../../backend/firebase/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { getValidBrandUrl } from '../../shared/utils/url';
import toast from 'react-hot-toast';

function ExpiryCountdown({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isExpired: boolean }>({
    days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false
  });

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiryDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [expiryDate]);

  if (timeLeft.isExpired) {
    return <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-md">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
      <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
      <span>{String(timeLeft.days).padStart(2, '0')}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s</span>
    </div>
  );
}

export default function RewardProducts() {
  const { rewardId } = useParams<{ rewardId: string }>();
  const navigate = useNavigate();
  const { offers, initRewards } = useRewardsStore();
  const { addItem, items: cartItems } = useCartStore();
  const { user } = useAuthStore();

  const [rewardCard, setRewardCard] = useState<BrandCoupon | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initRewards(user?.uid);
  }, [user]);

  useEffect(() => {
    if (!rewardId) return;
    const matched = offers.find(o => o.id === rewardId);
    if (matched) {
      setRewardCard(matched);
    } else {
      const docRef = doc(db, 'reward_offers', rewardId);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          setRewardCard({ id: snap.id, ...snap.data() } as BrandCoupon);
        }
      });
    }
  }, [rewardId, offers]);

  useEffect(() => {
    if (!rewardCard) return;

    const fetchAssignedProducts = async () => {
      setLoading(true);
      try {
        const prodColRef = collection(db, 'products');
        const snap = await getDocs(query(prodColRef));
        const allProds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));

        let resultProds: Product[] = [];

        // 1. Explicitly assigned product IDs
        if (rewardCard.productIds && rewardCard.productIds.length > 0) {
          resultProds = rewardCard.productIds
            .map(id => allProds.find(p => p.id === id))
            .filter((p): p is Product => Boolean(p));
        }

        // 2. Fallback if no custom products assigned yet: match brand name or category
        if (resultProds.length === 0) {
          const brandLower = (rewardCard.brandName || '').toLowerCase();
          const categoryLower = (rewardCard.category || '').toLowerCase();

          resultProds = allProds.filter(p => {
            const prodBrand = (p.brand || '').toLowerCase();
            const prodDesc = (p.description || '').toLowerCase();
            const prodName = (p.name || '').toLowerCase();
            return (
              (prodBrand && prodBrand.includes(brandLower)) ||
              prodName.includes(brandLower) ||
              prodDesc.includes(brandLower) ||
              (categoryLower && p.categoryId.toLowerCase().includes(categoryLower))
            );
          });

          // Fallback to all active products if none match
          if (resultProds.length === 0) {
            resultProds = allProds;
          }
        }

        // Exclude products explicitly disabled for this reward card
        if (rewardCard.disabledProductIds && rewardCard.disabledProductIds.length > 0) {
          resultProds = resultProds.filter(p => !rewardCard.disabledProductIds?.includes(p.id));
        }

        setProducts(resultProds);
      } catch (err) {
        console.error("Error fetching reward products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignedProducts();
  }, [rewardCard]);

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0 || product.inStock === false || product.status === 'out_of_stock' || product.status === 'inactive') {
      toast.error('This item is currently Out of Stock.');
      return;
    }

    const res = addItem(product, 1);
    if (res.success) {
      toast.success(`"${product.name}" added to cart!`);
    } else {
      if (res.exists) {
        toast.error('Product already in your cart.');
      } else {
        toast.error('Could not add to cart. Stock limit reached.');
      }
    }
  };

  const handleBuyNow = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0 || product.inStock === false || product.status === 'out_of_stock' || product.status === 'inactive') {
      toast.error('This item is currently Out of Stock.');
      return;
    }

    const isInCart = cartItems.some(i => i.productId === product.id);

    if (isInCart) {
      navigate('/checkout');
      return;
    }

    const res = addItem(product, 1);
    if (res.success || res.exists) {
      navigate('/checkout');
    } else {
      toast.error('Could not add to cart for checkout.');
    }
  };

  if (loading && !rewardCard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!rewardCard) {
    return (
      <div className="max-w-4xl mx-auto my-16 p-12 bg-white rounded-3xl border border-gray-100 shadow-xl text-center space-y-4 font-sans">
        <Lock className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-2xl font-black text-gray-900">Reward Card Not Found</h2>
        <p className="text-sm text-gray-500">The requested reward card may have been removed or deactivated.</p>
        <button
          onClick={() => navigate('/rewards')}
          className="px-6 py-2.5 bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-amber-600 transition-colors"
        >
          Back to Rewards
        </button>
      </div>
    );
  }

  const discountBadgeText = rewardCard.discountType === 'percent'
    ? `${rewardCard.discountValue}% OFF`
    : `₹${rewardCard.discountValue} OFF`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
        <Link to="/" className="hover:text-amber-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <Link to="/rewards" className="hover:text-amber-600 transition-colors">Rewards</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-900">{rewardCard.title}</span>
      </div>

      {/* Top Reward Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-4">
            <img
              src={rewardCard.brandLogo || 'https://via.placeholder.com/100'}
              alt={rewardCard.brandName}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-xl bg-white shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-3 py-0.5 bg-amber-500 text-white font-black text-xs rounded-full">
                  {discountBadgeText}
                </span>
                <span className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                  {rewardCard.category || 'Brand Offer'}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-black text-white leading-tight">
                {rewardCard.title}
              </h1>
              <p className="text-xs text-slate-300 max-w-xl">
                {rewardCard.description || rewardCard.terms || 'Products eligible for this exclusive reward deal.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <ExpiryCountdown expiryDate={rewardCard.expiryDate} />
            {getValidBrandUrl(rewardCard.brandWebsiteUrl) && (
              <a
                href={getValidBrandUrl(rewardCard.brandWebsiteUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-amber-300 border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                Visit Official Brand <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Section Title */}
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-amber-500" />
            Reward Products ({products.length})
          </h2>
          <p className="text-xs text-gray-500">
            Browse and buy products assigned under <strong>{rewardCard.brandName}</strong>. Add to cart or instant checkout.
          </p>
        </div>

        <button
          onClick={() => navigate('/rewards')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to All Rewards
        </button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mx-auto" />
          <p className="text-xs text-gray-400 mt-3 font-bold">Loading reward products...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 space-y-3">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900">No products available for this Reward Card</h3>
          <p className="text-xs text-gray-500">Check back later as new products are assigned by the store admin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const isOutOfStock = product.stock <= 0 || product.inStock === false || product.status === 'out_of_stock' || product.status === 'inactive';
            const sellingPrice = product.discountPrice || product.price;
            const mrpPrice = product.price || product.mrp;
            const discountPercent = (mrpPrice && mrpPrice > sellingPrice)
              ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
              : 0;

            const isInCart = cartItems.some(i => i.productId === product.id);

            return (
              <motion.div
                key={product.id}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Product Image */}
                  <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-gray-50">
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/400?text=No+Image'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Discount % Badge */}
                    {discountPercent > 0 && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-rose-500 text-white font-black text-[10px] rounded-lg shadow-sm">
                        {discountPercent}% OFF
                      </span>
                    )}

                    {/* Availability Tag */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black shadow-sm ${
                        isOutOfStock ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-500 text-white'
                      }`}>
                        {isOutOfStock ? 'OUT OF STOCK' : `IN STOCK (${product.stock})`}
                      </span>
                    </div>
                  </Link>

                  {/* Body Content */}
                  <div className="p-4 space-y-2">
                    <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                      {product.brand || rewardCard.brandName}
                    </div>

                    <Link to={`/product/${product.id}`} className="block">
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-2 hover:text-amber-600 transition-colors leading-snug">
                        {product.name}
                      </h3>
                    </Link>

                    {/* Rating */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-0.5">
                      <div className="flex items-center text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="ml-1 font-bold text-gray-900">{product.rating || 4.5}</span>
                      </div>
                      <span className="text-[11px] text-gray-400">({product.numReviews || 12} reviews)</span>
                    </div>

                    {/* Price Block */}
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-lg font-black text-gray-900">₹{sellingPrice}</span>
                      {mrpPrice && mrpPrice > sellingPrice && (
                        <span className="text-xs text-gray-400 line-through font-medium">₹{mrpPrice}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-50/60 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={isOutOfStock}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      isOutOfStock
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : isInCart
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-100 shadow-sm'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {isOutOfStock ? 'Unavailable' : isInCart ? 'In Cart' : 'Add to Cart'}
                  </button>

                  <button
                    onClick={(e) => handleBuyNow(product, e)}
                    disabled={isOutOfStock}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-400 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

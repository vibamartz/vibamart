import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft, ShoppingCart, Star, Clock, ExternalLink,
  ShieldCheck, AlertCircle, ShoppingBag, Lock, Tag, ChevronRight
} from 'lucide-react';
import { useRewardsStore, useCartStore, useAuthStore } from '../../backend/store';
import { BrandCoupon, Product } from '../../shared/types';
import { db } from '../../backend/firebase/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { getValidBrandUrl } from '../../shared/utils/url';
import { getRewardSlug, getProductSlug, createSlug } from '../../shared/utilities/slug';
import toast from 'react-hot-toast';

function ExpiryCountdownMobile({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; isExpired: boolean }>({
    days: 0, hours: 0, minutes: 0, isExpired: false
  });

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiryDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, isExpired: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      setTimeLeft({ days, hours, minutes, isExpired: false });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [expiryDate]);

  if (timeLeft.isExpired) {
    return <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
      <Clock className="w-3 h-3 text-amber-500" />
      <span>{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m</span>
    </div>
  );
}

export default function MobileRewardProductsScreen() {
  const params = useParams<{ rewardId?: string; rewardSlug?: string }>();
  const targetRewardSlugOrId = params.rewardId || params.rewardSlug;
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
    if (!targetRewardSlugOrId) return;

    const findReward = async () => {
      let matched = offers.find(o => o.id === targetRewardSlugOrId || o.slug === targetRewardSlugOrId || getRewardSlug(o) === targetRewardSlugOrId);

      if (!matched) {
        try {
          const docRef = doc(db, 'reward_offers', targetRewardSlugOrId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            matched = { id: snap.id, ...snap.data() } as BrandCoupon;
          }
        } catch (_) {}
      }

      if (!matched) {
        try {
          const qSnap = await getDocs(collection(db, 'reward_offers'));
          const foundDoc = qSnap.docs.find(d => {
            const data = { id: d.id, ...d.data() } as BrandCoupon;
            return getRewardSlug(data) === targetRewardSlugOrId || data.slug === targetRewardSlugOrId || createSlug(data.title) === targetRewardSlugOrId;
          });
          if (foundDoc) {
            matched = { id: foundDoc.id, ...foundDoc.data() } as BrandCoupon;
          }
        } catch (_) {}
      }

      if (matched) {
        setRewardCard(matched);
        const canonicalSlug = getRewardSlug(matched);
        if (targetRewardSlugOrId !== canonicalSlug && (targetRewardSlugOrId === matched.id || /^\d+$/.test(targetRewardSlugOrId))) {
          navigate(`/rewards/${canonicalSlug}`, { replace: true });
        }
      }
      setLoading(false);
    };

    findReward();
  }, [targetRewardSlugOrId, offers, navigate]);

  useEffect(() => {
    if (!rewardCard) return;

    const fetchAssignedProducts = async () => {
      setLoading(true);
      try {
        const prodColRef = collection(db, 'products');
        const snap = await getDocs(query(prodColRef));
        const allProds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));

        let resultProds: Product[] = [];

        // 1. Explicitly assigned product IDs (if productIds array exists)
        if (Array.isArray(rewardCard.productIds)) {
          resultProds = rewardCard.productIds
            .map(id => allProds.find(p => p.id === id))
            .filter((p): p is Product => Boolean(p));
        } else {
          // 2. Fallback only if productIds array was never set on this offer
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
        }

        // Exclude products explicitly disabled or unassigned for this reward card
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
      toast.error('Item is Out of Stock');
      return;
    }

    const res = addItem(product, 1);
    if (res.success) {
      toast.success(`"${product.name}" added to cart!`);
    } else {
      if (res.exists) {
        toast.error('Product already in your cart.');
      } else {
        toast.error('Stock limit reached.');
      }
    }
  };

  const handleBuyNow = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.stock <= 0 || product.inStock === false || product.status === 'out_of_stock' || product.status === 'inactive') {
      toast.error('Item is Out of Stock');
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
      toast.error('Could not add for checkout.');
    }
  };

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  if (loading && !rewardCard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF3EB]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!rewardCard) {
    return (
      <div className="p-6 text-center space-y-4 font-sans min-h-screen bg-[#FFF3EB] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Reward Card Unavailable</h2>
        <p className="text-xs text-gray-500 max-w-xs">This reward card may have expired or been disabled.</p>
        <button
          onClick={() => navigate('/rewards')}
          className="px-5 py-2.5 bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md"
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
    <div className="min-h-screen bg-[#FFF3EB] font-sans pb-24">
      {/* Mobile Top Header Bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-amber-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => navigate('/rewards')}
          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="text-sm font-black text-gray-900 truncate max-w-[200px]">
          {rewardCard.brandName} Products
        </h1>

        <button
          onClick={() => navigate('/cart')}
          className="relative p-2 text-gray-700 hover:text-amber-600 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          {totalCartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">
              {totalCartCount}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Top Mobile Reward Summary Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-4 text-white shadow-xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={rewardCard.brandLogo || 'https://via.placeholder.com/50'}
                alt={rewardCard.brandName}
                className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 bg-white"
              />
              <div>
                <span className="text-xs font-black text-amber-300 block">{rewardCard.brandName}</span>
                <span className="text-[10px] text-slate-300 uppercase tracking-wider">{rewardCard.category || 'Official Deal'}</span>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-amber-500 text-white font-black text-xs rounded-full shadow">
              {discountBadgeText}
            </span>
          </div>

          <h2 className="text-base font-black text-white leading-tight">
            {rewardCard.title}
          </h2>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10 text-slate-300">
            <ExpiryCountdownMobile expiryDate={rewardCard.expiryDate} />
            {getValidBrandUrl(rewardCard.brandWebsiteUrl) && (
              <a
                href={getValidBrandUrl(rewardCard.brandWebsiteUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-amber-300 hover:underline flex items-center gap-1"
              >
                Official Site <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Section Header */}
        <div className="flex justify-between items-center pt-2">
          <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            Reward Products ({products.length})
          </h3>
          <span className="text-[11px] font-bold text-gray-500">Live Inventory</span>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
            <p className="text-xs text-gray-400 mt-2 font-bold">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl p-6 border border-amber-100 space-y-2">
            <ShoppingBag className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-800">No products found for this Reward Card.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
                  whileTap={{ scale: 0.98 }}
                  className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Image */}
                    <Link to={`/products/${getProductSlug(product)}`} className="block relative aspect-square bg-gray-50 overflow-hidden">
                      <img
                        src={product.images?.[0] || 'https://via.placeholder.com/300?text=No+Image'}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {discountPercent > 0 && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-md">
                          {discountPercent}% OFF
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black rounded-md border border-rose-200">
                          OUT OF STOCK
                        </span>
                      )}
                    </Link>

                    {/* Content */}
                    <div className="p-3 space-y-1.5">
                      <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block">
                        {product.brand || rewardCard.brandName}
                      </span>
                      <Link to={`/products/${getProductSlug(product)}`} className="block">
                        <h4 className="font-bold text-gray-900 text-xs line-clamp-2 leading-tight">
                          {product.name}
                        </h4>
                      </Link>

                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <Star className="w-3 h-3 text-amber-400 fill-current" />
                        <span className="font-bold text-gray-900">{product.rating || 4.5}</span>
                        <span>({product.numReviews || 8})</span>
                      </div>

                      <div className="flex items-baseline gap-1.5 pt-0.5">
                        <span className="text-sm font-black text-gray-900">₹{sellingPrice}</span>
                        {mrpPrice && mrpPrice > sellingPrice && (
                          <span className="text-[10px] text-gray-400 line-through">₹{mrpPrice}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2 bg-gray-50 border-t border-amber-100 flex flex-col gap-1.5">
                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={isOutOfStock}
                      className={`w-full py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 ${
                        isOutOfStock
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isInCart
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-white border border-gray-300 text-gray-800'
                      }`}
                    >
                      <ShoppingCart className="w-3 h-3" />
                      {isOutOfStock ? 'Unavailable' : isInCart ? 'In Cart' : 'Add to Cart'}
                    </button>

                    <button
                      onClick={(e) => handleBuyNow(product, e)}
                      disabled={isOutOfStock}
                      className={`w-full py-1.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-400 cursor-not-allowed'
                          : 'bg-amber-500 text-white shadow'
                      }`}
                    >
                      <ShoppingBag className="w-3 h-3" />
                      {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

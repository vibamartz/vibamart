import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { Product, WaitlistItem } from '../types';
import { Star, ShoppingCart, ShieldCheck, Truck, RefreshCcw, ChevronRight, Heart, Share2, Bell, MapPin, PackageCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useCartStore, useAuthStore, useCategoryStore } from '../store';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import PincodeChecker from '../components/PincodeChecker';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc,
  arrayUnion, arrayRemove, limit, documentId 
} from 'firebase/firestore';
import ProductCard from '../components/ProductCard';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const { addItem, items } = useCartStore();
  const { user, orderedProductIds } = useAuthStore();
  const { categories } = useCategoryStore();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [isLocationAvailable, setIsLocationAvailable] = useState(true);
  const [associatedOrder, setAssociatedOrder] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  const hasBeenOrdered = product ? orderedProductIds?.includes(product.id) : false;

  useEffect(() => {
    const fetchAssociatedOrder = async () => {
      if (!user || !id || !hasBeenOrdered) return;
      try {
        const q = query(
          collection(db, "orders"),
          where("customerId", "==", user.uid)
        );
        const snap = await getDocs(q);
        const matches: any[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.items?.some((item: any) => item.productId === id)) {
            matches.push({ id: docSnap.id, ...data });
          }
        });
        if (matches.length > 0) {
          matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setAssociatedOrder(matches[0]);
        }
      } catch (err) {
        console.error("Error fetching order status:", err);
      }
    };
    fetchAssociatedOrder();
  }, [user, id, hasBeenOrdered]);

  // Fetch product by ID only — no user dependency to avoid double-fetch race condition
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setProduct(null);
    setNotFound(false);

    const fetchProduct = async () => {
      try {
        const prodRef = doc(db, 'products', id);
        const snap = await getDoc(prodRef);
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as Product;
          setProduct(data);
          setSelectedVariant(data.variants?.[0]?.id);
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
  }, [id]);

  // Check waitlist separately when user is available
  useEffect(() => {
    if (!user || !id || !product || product.stock > 0) return;
    const checkWaitlist = async () => {
      try {
        const wq = query(collection(db, 'waitlist'), where('userId', '==', user.uid), where('productId', '==', id));
        const wsnap = await getDocs(wq);
        setIsOnWaitlist(!wsnap.empty);
      } catch (err) {
        console.error("Error checking waitlist:", err);
      }
    };
    checkWaitlist();
  }, [user, id, product]);

  // Track recently viewed products
  useEffect(() => {
    if (product) {
      try {
        const existing = JSON.parse(localStorage.getItem('viba_recently_viewed') || '[]');
        const updated = [product.id, ...existing.filter((pid: string) => pid !== product.id)].slice(0, 8);
        localStorage.setItem('viba_recently_viewed', JSON.stringify(updated));
      } catch (err) {
        console.error("Error updating recently viewed:", err);
      }
    }
  }, [product]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !product) return <Navigate to="/product-not-found" replace />;

  const handleBuyNow = () => {
    const success = addItem(product, quantity, selectedVariant);
    if (success) {
      navigate('/checkout');
    } else {
      toast.error('Could not add to cart. Out of stock or limit reached.');
    }
  };

  const handleAddToCart = () => {
    const success = addItem(product, quantity, selectedVariant);
    if (success) {
      toast.success('Added to cart!');
    } else {
      toast.error('Could not add to cart. Out of stock or limit reached.');
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
      toast.success('You have been added to the waitlist!', {
        icon: '🔔'
      });
    } catch (err) {
      toast.error('Failed to join waitlist');
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to use wishlist');
      return;
    }

    const isWishlisted = user.wishlist?.includes(product.id);
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

  const currentVariant = product.variants?.find(v => v.id === selectedVariant);
  const basePrice = product.discountPrice || product.price;
  const totalPrice = basePrice + (currentVariant?.extraPrice || 0);
  const discountPercentage = Math.round(((product.price - basePrice) / product.price) * 100);
  const isInCart = items.some(item => item.productId === product.id && item.variantId === selectedVariant);

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
             <Link to={`/products?category=${categoryObj.id}`} className="hover:text-green-600 transition-colors">{categoryObj.name}</Link>
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
           <div className="relative aspect-[1/1] sm:aspect-[4/5] overflow-hidden rounded-2xl bg-gray-50 border border-gray-100 lg:sticky lg:top-24">
              <img 
                src={product.images?.[selectedImage] || 'https://via.placeholder.com/400x500?text=No+Image'} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                 <button 
                  onClick={handleToggleWishlist}
                  aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  className={`p-3 touch-target min-h-[44px] backdrop-blur shadow-sm rounded-full transition-all active:scale-95 flex items-center justify-center ${
                    isWishlisted ? 'bg-rose-50 text-rose-500' : 'bg-white/90 text-gray-400 hover:text-rose-500'
                  }`}
                 >
                    <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-rose-500' : ''}`} />
                 </button>
                 <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: product.name,
                        text: product.description,
                        url: window.location.href,
                      }).catch(err => console.error('Error sharing:', err));
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied to clipboard!');
                    }
                  }}
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
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-green-600' : 'border-transparent opacity-60'}`}
                >
                  <img src={img} className="w-full h-full object-cover" />
                </button>
              ))}
           </div>
        </div>

        {/* Right: Info */}
        <div className="flex-1 space-y-8 py-4">
           <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-4 flex-wrap">
                   <span className="text-5xl font-black text-gray-900">₹{totalPrice.toLocaleString()}</span>
                   {product.discountPrice && (
                      <span className="text-2xl text-gray-400 line-through font-medium">₹{(product.price + (currentVariant?.extraPrice || 0)).toLocaleString()}</span>
                   )}
                   {discountPercentage > 0 && <span className="text-2xl font-black text-green-600 uppercase">{discountPercentage}% OFF</span>}
                </div>
                {product.discountPrice && (
                  <p className="text-sm font-bold text-green-600">
                    You save ₹{(product.price - product.discountPrice).toLocaleString()}
                  </p>
                )}
              </div>
              <p className="text-sm font-bold text-gray-500">Free delivery on this item. Usually delivered in 2-3 days.</p>
           </div>

           <div>
              <p className="text-sm font-black text-green-600 uppercase tracking-widest mb-2">Verified Merchant</p>
              <h1 className="text-3xl font-black text-gray-900 leading-tight mb-4 tracking-tight">{product.name}</h1>
              {/* Seller Info */}
              <div className="flex items-center gap-4 py-4 border-b border-gray-100">
                   <div className="group flex items-center gap-2 cursor-pointer">
                     <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Seller:</span>
                     <span className="text-sm font-black text-primary hover:underline">{product.brand} Retail</span>
                     <div className="bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded tracking-tighter uppercase">4.8 ★</div>
                   </div>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-6">
                <div className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-sm shadow-green-100">
                   {product.rating} <Star className="w-4 h-4 fill-current" />
                </div>
                <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{product.numReviews} Ratings & Reviews</span>
                {product.stock > 0 ? (
                  <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full uppercase tracking-wider">In Stock</span>
                ) : (
                  <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-full uppercase tracking-wider">Out of Stock</span>
                )}
              </div>

            {/* Variants */}
            {product.variants && product.variants.length > 0 && (
               <div className="space-y-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Variant</h3>
                  <div className="flex flex-wrap gap-2">
                     {product.variants.map((v) => (
                       <button 
                         key={v.id}
                         onClick={() => setSelectedVariant(v.id)}
                         disabled={v.stock === 0}
                         className={`px-6 py-3 rounded-xl border-2 font-bold transition-all ${
                           selectedVariant === v.id 
                             ? 'border-green-600 bg-green-50 text-green-600' 
                             : v.stock === 0
                               ? 'border-gray-50 bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed'
                               : 'border-gray-100 text-gray-500 hover:border-gray-200'
                         }`}
                       >
                         {v.name}
                         {v.stock === 0 && <span className="block text-[8px] uppercase tracking-tighter">Out of Stock</span>}
                       </button>
                     ))}
                  </div>
               </div>
            )}

           {hasBeenOrdered && associatedOrder && (
             /* ── Order Status Panel — ONLY shown after order placement ── */
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.4, ease: 'easeOut' }}
               className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-200/60 rounded-2xl p-5 space-y-4"
             >
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-200">
                   <PackageCheck className="w-5 h-5 text-white" />
                 </div>
                 <div>
                   <p className="text-xs font-black text-green-800 uppercase tracking-widest">Order Placed</p>
                   <p className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider">You have ordered this item</p>
                 </div>
               </div>

               {/* Status Pill */}
               <div className="flex items-center gap-3 flex-wrap">
                 <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                   associatedOrder.status === 'delivered' ? 'bg-green-600 text-white' :
                   associatedOrder.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                   associatedOrder.status === 'shipped' ? 'bg-blue-100 text-blue-600' :
                   associatedOrder.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                   'bg-emerald-100 text-emerald-700'
                 }`}>
                   {associatedOrder.status === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> :
                    associatedOrder.status === 'cancelled' ? <XCircle className="w-3 h-3" /> :
                    associatedOrder.status === 'shipped' ? <Truck className="w-3 h-3" /> :
                    <Clock className="w-3 h-3" />}
                   {associatedOrder.status || 'Confirmed'}
                 </div>
                 {associatedOrder.createdAt && (
                   <span className="text-[10px] font-bold text-green-600/60 uppercase tracking-wider">
                     {new Date(associatedOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                   </span>
                 )}
               </div>

               {/* Order ID + Track Order Button */}
               <div className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3">
                 <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</p>
                   <p className="text-xs font-black text-gray-900 tracking-tight">#{associatedOrder.id.slice(-8).toUpperCase()}</p>
                 </div>
                 <Link 
                   to={`/track-order/${associatedOrder.id}`}
                   className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-200"
                 >
                   <Truck className="w-3.5 h-3.5" />
                   Track Order
                 </Link>
               </div>
             </motion.div>
           )}

           {/* ── Add to Cart / Buy Now ── */}
           <div className="flex flex-col gap-4 items-stretch mt-6">
             {product.stock > 0 && (
               <div className="bg-gray-50 border border-gray-100 rounded-xl flex items-center p-1 w-full sm:w-auto self-stretch">
                   <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-full sm:w-10 h-12 sm:h-10 touch-target min-h-[44px] flex items-center justify-center text-xl font-bold hover:text-green-600 transition-colors" aria-label="Decrease quantity">-</button>
                   <span className="w-12 text-center font-black text-lg">{quantity}</span>
                   <button onClick={() => setQuantity(quantity + 1)} className="w-full sm:w-10 h-12 sm:h-10 touch-target min-h-[44px] flex items-center justify-center text-xl font-bold hover:text-green-600 transition-colors" aria-label="Increase quantity">+</button>
               </div>
             )}
             <div className="flex-1 w-full flex flex-col gap-3">
                 {product.stock > 0 ? (
                  <>
                   <button 
                       onClick={() => {
                         if (isInCart) {
                           navigate('/cart');
                         } else {
                           handleAddToCart();
                         }
                       }}
                       disabled={!isLocationAvailable || (!isInCart && (currentVariant ? currentVariant.stock === 0 : product.stock === 0))}
                       className={`flex-1 flex touch-target min-h-[44px] items-center justify-center gap-2 py-5 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${
                           (!isLocationAvailable || (!isInCart && (currentVariant ? currentVariant.stock === 0 : product.stock === 0)))
                           ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                           : 'bg-[#ff9f00] text-white shadow-orange-100 hover:bg-[#f39700] active:scale-95'
                       }`}
                   >
                       <ShoppingCart className="w-5 h-5" /> {isInCart ? 'Go to Cart' : 'Add to Cart'}
                    </button>
                    <button 
                        onClick={handleBuyNow}
                       disabled={!isLocationAvailable || (currentVariant ? currentVariant.stock === 0 : product.stock === 0)}
                       className={`flex-1 touch-target min-h-[44px] py-5 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all ${
                           (!isLocationAvailable || (currentVariant ? currentVariant.stock === 0 : product.stock === 0))
                           ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                           : 'bg-[#fb641b] text-white shadow-orange-200 hover:bg-[#f15e17] active:scale-95'
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
            <div className="space-y-8 pt-8 border-t border-gray-100 mb-8">
              <div className="space-y-4">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Delivery Details</h3>
                 <PincodeChecker 
                   serviceablePincodes={product.serviceablePincodes} 
                   onAvailabilityChange={(available) => setIsLocationAvailable(available)}
                   savedAddresses={user?.addresses}
                 />
              </div>

              {user?.addresses && user.addresses.length > 0 && (
                 <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deliver to Saved Addresses</h3>
                     <Link to="/profile" className="text-[10px] font-black uppercase text-primary tracking-widest hover:underline">Manage</Link>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {user.addresses.slice(0, 2).map((addr, idx) => (
                       <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 group hover:bg-white hover:shadow-xl transition-all duration-500 cursor-pointer">
                         <MapPin className="w-4 h-4 text-primary mt-1" />
                         <div>
                           <p className="text-xs font-black text-gray-900 line-clamp-1">{addr.street}</p>
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                             {addr.city}, {addr.zip}
                           </p>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>

            {/* Offers & Services */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
              <ServiceIcon icon={ShieldCheck} title="Warranty" desc="1 Year Brand Warranty" />
              <ServiceIcon icon={RefreshCcw} title="Replacement" desc="7 Days Policy" />
              <ServiceIcon icon={Truck} title="Delivery" desc="Free Home Delivery" />
           </div>

           {/* Description */}
           <div className="pt-8 border-t border-gray-100">
              <h3 className="text-xl font-black text-gray-900 mb-4">Product Description</h3>
              <p className="text-gray-600 leading-relaxed font-medium">{product.description}</p>
           </div>

           {/* Highlights (Flipkart style) */}
           <div className="pt-8 border-t border-gray-100">
             <h3 className="text-xl font-black text-gray-900 mb-6">Product Highlights</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
               {[
                 '100% Authentic Quality',
                 'Premium Build Materials',
                 'Tested for Durability',
                 'Fast Reliable Shipping',
                 'Eco-friendly Packaging',
                 'Secured Payment Options'
               ].map((highlight, i) => (
                  <div key={i} className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-sm font-bold text-gray-600 tracking-tight">{highlight}</span>
                 </div>
               ))}
             </div>
           </div>

           {/* Full Description / Specs */}
           {product.fullDescription && (
             <div className="pt-8 border-t border-gray-100">
               <h3 className="text-xl font-black text-gray-900 mb-6">Technical Specifications</h3>
               <div className="bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden">
                 <div className="divide-y divide-gray-100">
                   {product.fullDescription.split('\n').filter(l => l.includes(':')).map((spec, i) => {
                     const [key, val] = spec.split(':');
                     return (
                       <div key={i} className="flex flex-col sm:flex-row p-4 sm:p-6 hover:bg-white transition-colors">
                         <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest sm:w-1/3 mb-1 sm:mb-0">{key}</span>
                         <span className="text-sm font-black text-gray-900 sm:flex-1">{val}</span>
                       </div>
                     );
                   })}
                   {/* Fallback if no colons found */}
                   {!product.fullDescription.includes(':') && (
                     <p className="p-6 text-sm font-medium text-gray-600 leading-relaxed whitespace-pre-line">{product.fullDescription}</p>
                   )}
                 </div>
               </div>
             </div>
           )}
         </div>
      </div>

      {/* Similar Products Section */}
      <SimilarProducts categoryId={product.categoryId} currentProductId={product.id} />

      {/* Recently Viewed Section */}
      <RecentlyViewed currentProductId={product.id} />
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
        const fetchedProducts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.id !== currentProductId)
          .slice(0, 4);
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
    <div className="mt-24 border-t border-gray-100 pt-24 pb-12">
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Recommended for You</h2>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Based on your current view</p>
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
        const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        // Sort to match order in localStorage targetIds
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
    <div className="mt-12 border-t border-gray-100 pt-12 pb-20">
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-gray-900 italic tracking-tighter uppercase leading-none">Recently Viewed</h2>
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

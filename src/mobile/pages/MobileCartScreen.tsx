import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Tag, ShoppingCart 
} from 'lucide-react';
import { useCartStore, useAuthStore } from '../../backend/store';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileCartScreen() {
  const { items, updateQuantity, removeItem, clearCart, total } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const cartTotal = total();
  const totalSavings = items.reduce((acc, item) => {
    const origPrice = item.product.price || 0;
    const actualPrice = item.product.discountPrice || origPrice;
    return acc + (origPrice - actualPrice) * item.quantity;
  }, 0);

  const deliveryCharge = cartTotal > 500 || items.length === 0 ? 0 : 40;
  const grandTotal = cartTotal + deliveryCharge;

  const handleDecreaseQuantity = (productId: string, currentQty: number, variantId?: string) => {
    if (currentQty <= 1) {
      removeItem(productId, variantId);
      toast.success("Item removed from cart");
    } else {
      updateQuantity(productId, currentQty - 1, variantId);
    }
  };

  const handleIncreaseQuantity = (productId: string, currentQty: number, maxStock: number, variantId?: string) => {
    if (currentQty >= maxStock) {
      toast.error(`Maximum available stock reached (${maxStock})`);
      return;
    }
    updateQuantity(productId, currentQty + 1, variantId);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-orange-100/70 border border-orange-200 flex items-center justify-center mb-4 text-orange-600 shadow-inner">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-black text-gray-900">Your Cart is Empty</h2>
        <p className="text-xs text-gray-500 font-medium max-w-xs mt-1 mb-6">
          Looks like you haven't added any products to your cart yet.
        </p>
        <button
          onClick={() => navigate('/products')}
          className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2"
        >
          Explore Products <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-32 font-sans select-none p-3 space-y-3">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-orange-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-900">
            Shopping Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
          </h2>
          <p className="text-[10px] text-gray-500 font-bold">
            Account: {user?.displayName || user?.email || 'Guest User'}
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear Cart
        </button>
      </div>

      {/* Free Delivery Banner */}
      {deliveryCharge === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>🎉 You unlocked <strong>FREE Delivery</strong> on this order!</span>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs font-bold text-amber-800">
          Add ₹{(500 - cartTotal).toLocaleString()} more to get <strong>FREE Delivery</strong>!
        </div>
      )}

      {/* Cart Items List */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const product = item.product;
          const variant = item.variantId ? product.variants?.find(v => v.id === item.variantId) : null;
          const basePrice = product.discountPrice || product.price;
          const unitPrice = basePrice + (variant?.extraPrice || 0);
          const maxStock = variant ? variant.stock : product.stock;

          return (
            <motion.div
              key={`${item.productId}-${item.variantId || 'default'}`}
              layout
              className="bg-white rounded-2xl p-3 shadow-sm border border-orange-100 flex gap-3 relative"
            >
              {/* Product Image */}
              <div 
                onClick={() => navigate(`/product/${product.id}`)}
                className="w-20 h-20 rounded-xl bg-gray-50 overflow-hidden shrink-0 border border-gray-100 cursor-pointer"
              >
                <img 
                  src={variant?.image || product.images?.[0] || 'https://via.placeholder.com/150'} 
                  alt={product.name} 
                  className="w-full h-full object-cover" 
                />
              </div>

              {/* Product Info */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="pr-6">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block truncate">
                    {product.brand || 'ViBa Select'}
                  </span>
                  <h4 
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight cursor-pointer"
                  >
                    {product.name}
                  </h4>
                  {variant && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                      Variant: {variant.name || variant.color || variant.size}
                    </span>
                  )}
                </div>

                {/* Price & Quantity Controls */}
                <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-gray-100">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-black text-gray-900">
                      ₹{(unitPrice * item.quantity).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      (₹{unitPrice}/ea)
                    </span>
                  </div>

                  {/* Quantity Incrementor */}
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200">
                    <button
                      onClick={() => handleDecreaseQuantity(product.id, item.quantity, item.variantId)}
                      className="w-6 h-6 rounded-lg bg-white text-gray-700 flex items-center justify-center shadow-xs active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black text-gray-900 min-w-[16px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleIncreaseQuantity(product.id, item.quantity, maxStock, item.variantId)}
                      className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Remove Item Icon Button */}
              <button
                onClick={() => removeItem(product.id, item.variantId)}
                className="absolute top-2 right-2 text-gray-300 hover:text-rose-500 p-1 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Bill Details Summary Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-2.5">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
          Price Details & Bill Breakdown
        </h3>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-600 font-medium">
            <span>Item Subtotal ({items.length} items)</span>
            <span className="font-bold text-gray-900">₹{cartTotal.toLocaleString()}</span>
          </div>

          {totalSavings > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Total Product Savings</span>
              <span>-₹{totalSavings.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-gray-600 font-medium">
            <span>Delivery Charges</span>
            {deliveryCharge === 0 ? (
              <span className="font-black text-emerald-600 uppercase">FREE</span>
            ) : (
              <span className="font-bold text-gray-900">₹{deliveryCharge}</span>
            )}
          </div>

          <div className="flex justify-between text-gray-600 font-medium">
            <span>Estimated Taxes & GST</span>
            <span className="font-bold text-gray-900">Included</span>
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between items-baseline text-sm">
            <span className="font-black text-gray-900">Total Payable Amount</span>
            <span className="text-base font-black text-emerald-700">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-orange-100 p-3 shadow-lg flex items-center justify-between max-w-md mx-auto">
        <div>
          <span className="text-[10px] font-black uppercase text-gray-400">Total</span>
          <p className="text-base font-black text-gray-900">₹{grandTotal.toLocaleString()}</p>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-2 active:scale-95"
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

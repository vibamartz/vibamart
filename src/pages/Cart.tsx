import React from 'react';
import { useCartStore } from '../store';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getProductUrl } from '../utils/product';
import { motion } from 'motion/react';

export default function Cart() {
  const { items, removeItem, updateQuantity, total } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-md w-full border border-gray-100">
           <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-10 h-10 text-primary" />
           </div>
           <h2 className="text-3xl font-black text-gray-900 mb-2">Your cart is empty</h2>
           <p className="text-gray-500 mb-8 font-medium">Looks like you haven't added anything to your cart yet. Let's find something amazing for you!</p>
           <Link to="/products" className="inline-block bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-blue-100">
              Start Shopping
           </Link>
        </div>
      </div>
    );
  }

  const subtotal = total();
  const tax = subtotal * 0.18; // 18% GST
  const shipping = subtotal > 500 ? 0 : 50;
  const grandTotal = subtotal + tax + shipping;

  return (
    <div className="bg-gray-50 min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Cart Items List */}
        <div className="flex-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-900 mb-6">Shopping Cart ({items.length})</h2>
             <div className="divide-y divide-gray-100 font-medium">
                {items.map((item) => (
                  <div key={`${item.productId}-${item.variantId}`} className="py-6 flex gap-4 sm:gap-6">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 flex-shrink-0">
                      <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-xl bg-gray-50" />
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                       <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <Link to={getProductUrl(item.product)} className="text-base sm:text-lg font-bold text-gray-800 hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1">{item.product.name}</Link>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">Official Store</p>
                            {item.variantId && (() => {
                              const variant = item.product.variants?.find(v => v.id === item.variantId);
                              return (
                                <p className="text-[10px] sm:text-xs text-gray-500 mt-1 font-bold">
                                  Option: <span className="text-primary">{variant?.name || item.variantId}</span>
                                </p>
                              );
                            })()}
                          </div>
                          <button onClick={() => removeItem(item.productId, item.variantId)} className="text-gray-400 hover:text-red-500 p-2.5 touch-target transition-colors flex-shrink-0" aria-label="Remove item">
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                       </div>
                       
                       <div className="mt-4 sm:mt-auto flex items-end justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 bg-gray-50 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-gray-100">
                             <button 
                                onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1), item.variantId)}
                                className="text-gray-500 hover:text-primary p-2 touch-target transition-colors"
                                aria-label="Decrease quantity"
                             >
                               <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             </button>
                             <span className="text-xs sm:text-sm font-black w-4 text-center">{item.quantity}</span>
                             <button 
                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                                className="text-gray-500 hover:text-primary p-2 touch-target transition-colors"
                                aria-label="Increase quantity"
                             >
                               <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             </button>
                          </div>
                          <div className="text-right">
                             {(() => {
                               const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
                               const basePrice = item.product.discountPrice || item.product.price;
                               const itemPrice = basePrice + (variant?.extraPrice || 0);
                               const savings = (item.product.price - (item.product.discountPrice || item.product.price)) * item.quantity;
                               return (
                                 <>
                                   <p className="text-lg sm:text-xl font-black text-gray-900">₹{(itemPrice * item.quantity).toLocaleString()}</p>
                                   {savings > 0 && <p className="text-[10px] sm:text-xs text-green-600 font-black">SAVE ₹{savings.toLocaleString()}</p>}
                                 </>
                               );
                             })()}
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
             <div className="flex items-center gap-4 text-gray-600">
               <ShoppingBag className="w-6 h-6" />
               <p className="font-medium">Add more items to unlock free gifts! 🎁</p>
             </div>
             <Link to="/products" className="text-primary font-bold text-sm hover:underline">Continue Shopping</Link>
          </div>
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-96 space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
             <h3 className="text-xl font-black text-gray-900 mb-6">Price Details</h3>
             <div className="space-y-4 text-sm font-medium border-b border-gray-100 pb-6 mb-6">
                <div className="flex justify-between text-gray-600">
                   <span>Price ({items.length} items)</span>
                   <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                   <span>GST (18%)</span>
                   <span>+ ₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                   <span>Delivery Charges</span>
                   <span className={shipping === 0 ? 'text-blue-600' : 'text-gray-900'}>
                     {shipping === 0 ? 'FREE' : `₹${shipping}`}
                   </span>
                </div>
             </div>
             <div className="flex justify-between text-xl font-black text-gray-900 mb-8 px-1">
                <span>Total Amount</span>
                <span>₹{grandTotal.toLocaleString()}</span>
             </div>
             <Link to="/checkout" className="w-full touch-target min-h-[44px] bg-primary text-white py-5 rounded-2xl font-black text-center flex items-center justify-center gap-2 hover:bg-primary-hover shadow-lg shadow-blue-100 transition-all uppercase tracking-widest">
                Place Order <ArrowRight className="w-5 h-5" />
             </Link>
             <p className="mt-4 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest leading-relaxed">
               Secure SSL Encrypted Payment <br/> 100% Buyer Protection Guaranteed
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}

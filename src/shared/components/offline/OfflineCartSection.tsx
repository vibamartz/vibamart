import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, RotateCw, ShoppingBag } from 'lucide-react';
import Logo from '../../../desktop/components/Logo';
import { ShoppingCartOfflineIllustration, DecorativeBackgroundElements } from './illustrations';
import { useNetworkStore } from '../../utilities/networkStatus';
import { useCartStore } from '../../../backend/store';

export interface OfflineCartSectionProps {
  className?: string;
  onContinueShopping?: () => void;
  onRetrySuccess?: () => void;
}

/**
 * OfflineCartSection - Embedded offline banner/section inside the Cart Screen
 * Preserves the existing cart layout and displays the offline notification
 */
export function OfflineCartSection({
  className = '',
  onContinueShopping,
  onRetrySuccess,
}: OfflineCartSectionProps) {
  const { isChecking, checkConnectivity } = useNetworkStore();
  const { items: cartItems } = useCartStore();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetrySuccess) {
      onRetrySuccess();
    }
  };

  return (
    <div
      className={`bg-gradient-to-br from-[#FAF7F2] via-[#FFFDF9] to-[#FEF3C7]/30 border border-emerald-200/70 rounded-3xl p-6 sm:p-8 shadow-sm mb-6 sm:mb-8 text-center relative overflow-hidden select-none ${className}`}
    >
      {/* Decorative soft orange & green background blobs */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-orange-200/30 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-200/30 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
        {/* Shopping cart illustration with a disconnected Wi-Fi icon */}
        <ShoppingCartOfflineIllustration className="w-36 h-36 xs:w-44 xs:h-44 sm:w-52 sm:h-52 mb-3 sm:mb-4 shrink-0" />

        {/* Heading: “You’re Offline” */}
        <h2 className="text-xl xs:text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">
          You’re Offline
        </h2>

        {/* Message: “Your cart is saved. Some features may be limited until you’re back online.” */}
        <p className="text-gray-600 font-medium text-xs xs:text-sm sm:text-base leading-relaxed max-w-md mb-3 sm:mb-4 px-2">
          Your cart is saved. Some features may be limited until you’re back online.
        </p>

        {/* Confirmation message: “Your cart items are safely saved on your device.” */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs sm:text-sm font-semibold mb-5 sm:mb-6 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Your cart items are safely saved on your device.{cartItems.length > 0 ? ` (${cartItems.length} ${cartItems.length === 1 ? 'item' : 'items'})` : ''}
          </span>
        </div>

        {/* Action Buttons: Green "Continue Shopping" button and retry check button */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Green “Continue Shopping” button */}
          <Link
            to="/"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3 bg-[#15803d] hover:bg-[#166534] active:scale-95 text-white font-bold text-xs sm:text-base rounded-full shadow-md shadow-emerald-900/15 transition-all duration-200 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </Link>

          {/* Try Again / Check Connection button */}
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-white hover:bg-emerald-50 active:scale-95 text-emerald-800 font-bold text-xs sm:text-base rounded-full border border-emerald-200 shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Try Again'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * OfflineCartScreen - Standalone Cart Screen (Offline)
 * Preserves the existing cart layout and saved cart items with full page styling
 */
export default function OfflineCartScreen({
  className = '',
  onContinueShopping,
  onRetrySuccess,
}: OfflineCartSectionProps) {
  const { items: cartItems } = useCartStore();

  return (
    <div className={`min-h-screen bg-[#FAF7F2] py-6 px-4 sm:py-10 sm:px-6 relative overflow-hidden select-none ${className}`}>
      {/* Decorative background elements */}
      <DecorativeBackgroundElements />

      <div className="max-w-4xl mx-auto relative z-10 space-y-6">
        {/* Top: ViBa Mart Logo */}
        <div className="flex justify-center pb-2">
          <Logo showTextOnMobile={true} className="scale-105 sm:scale-110" />
        </div>

        {/* Offline Cart Banner */}
        <OfflineCartSection
          onContinueShopping={onContinueShopping}
          onRetrySuccess={onRetrySuccess}
        />

        {/* Preserved Saved Cart Items Section */}
        {cartItems.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 sm:p-7 border border-emerald-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-base sm:text-lg text-gray-900">
                Saved Cart Items ({cartItems.length})
              </h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Saved Locally
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {cartItems.map((item, idx) => {
                const price = item.product?.discountPrice || item.product?.price || 0;
                return (
                  <div key={item.id || idx} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.product?.image ? (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-12 h-12 rounded-xl object-cover bg-gray-50 border border-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-700">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          {item.product?.name || 'Product'}
                        </p>
                        <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                          Qty: {item.quantity}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs sm:text-sm font-black text-gray-900">
                        ₹{(price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { Product } from '../types';

export interface CartItemLike {
  product: Product;
}

/**
 * Checks if all items in cart are marked as free delivery by admin.
 */
export function isCartEligibleForFreeDelivery(items: CartItemLike[]): boolean {
  if (!items || items.length === 0) return true;
  return items.every(item => item.product?.isFreeDelivery !== false);
}

/**
 * Calculates the shipping / delivery fee for cart items.
 * If all items have free delivery enabled (isFreeDelivery !== false) OR cart total >= 600, shipping is 0.
 * Otherwise standard shipping fee (49) applies.
 */
export function calculateShippingFee(items: CartItemLike[], subtotal: number): number {
  if (!items || items.length === 0) return 0;

  const deal259Items = items.filter(item => item.product?.isDeal259 === true);
  if (deal259Items.length > 0) {
    const deal259Subtotal = deal259Items.reduce((acc, item) => {
      const product = item.product;
      const variant = (item as any).variantId ? product?.variants?.find((v: any) => v.id === (item as any).variantId) : null;
      const basePrice = product?.discountPrice || product?.price || 0;
      const extra = variant?.extraPrice || 0;
      const qty = (item as any).quantity || 1;
      return acc + (basePrice + extra) * qty;
    }, 0);

    return deal259Subtotal >= 599 ? 0 : 49;
  }

  if (isCartEligibleForFreeDelivery(items)) return 0;
  return subtotal >= 600 ? 0 : 49;
}


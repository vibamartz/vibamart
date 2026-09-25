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
  if (isCartEligibleForFreeDelivery(items)) return 0;
  return subtotal >= 600 ? 0 : 49;
}

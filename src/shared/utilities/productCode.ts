import { Product } from '../types';

export const FIXED_PRODUCT_CODE_PREFIX = "89000996";

/**
 * Formats a 12-digit numeric product code into "8900 0996 XXXX" display format.
 */
export function formatProductCode(code?: string): string {
  if (!code) return '';
  const digits = code.replace(/\D/g, '');
  if (digits.length === 12) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  return code.trim();
}

/**
 * Strips non-digit characters to obtain the clean 12-digit numeric string for comparison.
 */
export function cleanProductCode(code?: string): string {
  if (!code) return '';
  return code.replace(/\D/g, '');
}

/**
 * Checks whether a candidate product code is unique across all existing products.
 */
export function isProductCodeUnique(candidateCode: string, products: Product[], excludeProductId?: string): boolean {
  const cleanCandidate = cleanProductCode(candidateCode);
  if (!cleanCandidate) return false;
  return !products.some(p => {
    if (excludeProductId && p.id === excludeProductId) return false;
    return cleanProductCode(p.productCode) === cleanCandidate;
  });
}

/**
 * Automatically generates a unique 12-digit numeric Product Code in format "8900 0996 XXXX".
 * - First 8 digits remain fixed as: 89000996
 * - Last 4 digits are numeric and unique across all products in DB.
 */
export function generateUniqueProductCode(existingProducts: Product[] = []): string {
  const usedCodes = new Set<string>();
  existingProducts.forEach(p => {
    const clean = cleanProductCode(p.productCode);
    if (clean) usedCodes.add(clean);
  });

  // Try random 4-digit numbers first
  for (let attempt = 0; attempt < 5000; attempt++) {
    const random4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const fullCodeDigits = `${FIXED_PRODUCT_CODE_PREFIX}${random4}`;
    if (!usedCodes.has(fullCodeDigits)) {
      return formatProductCode(fullCodeDigits);
    }
  }

  // Fallback to sequential scanning 0000-9999
  for (let i = 0; i < 10000; i++) {
    const seq4 = i.toString().padStart(4, '0');
    const fullCodeDigits = `${FIXED_PRODUCT_CODE_PREFIX}${seq4}`;
    if (!usedCodes.has(fullCodeDigits)) {
      return formatProductCode(fullCodeDigits);
    }
  }

  // Extreme timestamp fallback
  const ts4 = Date.now().toString().slice(-4);
  return formatProductCode(`${FIXED_PRODUCT_CODE_PREFIX}${ts4}`);
}

/**
 * Validates product code input:
 * - Must contain exactly 12 numeric digits
 * - Must start with fixed prefix 89000996
 */
export function validateProductCode(code: string): { valid: boolean; error?: string } {
  const clean = cleanProductCode(code);
  if (clean.length !== 12) {
    return { valid: false, error: "Product Code must be exactly 12 numeric digits." };
  }
  if (!clean.startsWith(FIXED_PRODUCT_CODE_PREFIX)) {
    return { valid: false, error: `Product Code must start with fixed prefix ${FIXED_PRODUCT_CODE_PREFIX}.` };
  }
  return { valid: true };
}

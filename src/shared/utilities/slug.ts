import { Product, Category, SubCategory, BrandCoupon } from '../types';

/**
 * Generates a clean URL-friendly slug from any string.
 * e.g. "iPhone 15 Pro Max (128GB)" -> "iphone-15-pro-max-128gb"
 */
export const createSlug = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-')     // replace spaces, underscores, hyphens with a single hyphen
    .replace(/^-+|-+$/g, '');     // trim leading/trailing hyphens
};

/**
 * Alias for backward compatibility
 */
export const getProductSlug = (product: { name?: string; slug?: string; id?: string } | string): string => {
  if (typeof product === 'string') {
    return createSlug(product);
  }
  if (product.slug) return product.slug;
  if (product.name) return createSlug(product.name);
  return product.id || '';
};

/**
 * Generates category slug
 */
export const getCategorySlug = (category: { name?: string; seoSlug?: string; slug?: string; id?: string } | string): string => {
  if (typeof category === 'string') {
    return createSlug(category);
  }
  if (category.seoSlug) return category.seoSlug;
  if (category.slug) return category.slug;
  if (category.name) return createSlug(category.name);
  return category.id || '';
};

/**
 * Generates subcategory slug
 */
export const getSubcategorySlug = (sub: { name?: string; slug?: string; id?: string } | string): string => {
  if (typeof sub === 'string') {
    return createSlug(sub);
  }
  if (sub.slug) return sub.slug;
  if (sub.name) return createSlug(sub.name);
  return sub.id || '';
};

/**
 * Generates reward item slug
 */
export const getRewardSlug = (reward: { title?: string; brandName?: string; slug?: string; id?: string } | string): string => {
  if (typeof reward === 'string') {
    return createSlug(reward);
  }
  if (reward.slug) return reward.slug;
  if (reward.title) return createSlug(reward.title);
  if (reward.brandName) return createSlug(reward.brandName);
  return reward.id || '';
};

/**
 * Generates offer slug
 */
export const getOfferSlug = (nameOrTitle: string): string => {
  return createSlug(nameOrTitle);
};

/**
 * Generates brand slug
 */
export const getBrandSlug = (brandName: string): string => {
  return createSlug(brandName);
};

/**
 * Ensures unique slug among existing slugs array.
 * If conflict exists, appends numeric suffix like "-1", "-2".
 */
export const generateUniqueSlug = (name: string, existingSlugs: string[], currentSlug?: string): string => {
  const baseSlug = createSlug(name) || 'item';
  if (currentSlug && currentSlug === baseSlug) {
    return currentSlug;
  }
  let uniqueSlug = baseSlug;
  let counter = 1;
  while (existingSlugs.includes(uniqueSlug)) {
    uniqueSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return uniqueSlug;
};

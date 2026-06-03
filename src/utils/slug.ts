/**
 * Generates a URL-friendly slug from a product name.
 * e.g. "iPhone 15 Pro Max" -> "iphone-15-pro-max"
 */
export const getProductSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')     // remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-')     // replace spaces, underscores, hyphens with a single hyphen
    .replace(/^-+|-+$/g, '');     // trim leading/trailing hyphens
};

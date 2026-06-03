export function generateProductSlug(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric, spaces, or hyphens
    .replace(/[\s_]+/g, '-')   // replace spaces and underscores with hyphens
    .replace(/-+/g, '-')       // remove duplicate hyphens
    .replace(/^-+|-+$/g, '');  // trim hyphens from start/end
}

export function getProductUrl(product: { id: string; name: string; slug?: string }): string {
  const slug = product.slug || generateProductSlug(product.name);
  return `/product/${slug}`;
}

/**
 * Validates and formats a brand website URL.
 * Returns a valid URL string starting with http:// or https://, or null if invalid/empty.
 */
export function getValidBrandUrl(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'https://' || trimmed === 'http://') return null;

  try {
    let fullUrl = trimmed;
    if (!/^https?:\/\//i.test(fullUrl)) {
      fullUrl = `https://${fullUrl}`;
    }
    const parsed = new URL(fullUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (e) {
    return null;
  }
  return null;
}

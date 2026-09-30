import { Product, BrandCoupon, Deal259PageConfig } from '../types';
import { getProductSlug, getRewardSlug } from './slug';
import { useDesktopShareStore } from '../../desktop/components/useDesktopShareStore';
import toast from 'react-hot-toast';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  customToastMessage?: string;
}

/**
 * Dynamically updates Open Graph and Twitter meta tags in the document head
 * for rich social card previews when shared links are crawled.
 */
export function updateOpenGraphTags(title: string, description?: string, imageUrl?: string, url?: string): void {
  if (typeof document === 'undefined') return;

  const setMetaTag = (property: string, content: string) => {
    if (!content) return;
    let element = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(property.startsWith('og:') ? 'property' : 'name', property);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  if (title) {
    document.title = title;
    setMetaTag('og:title', title);
    setMetaTag('twitter:title', title);
  }
  if (description) {
    setMetaTag('og:description', description);
    setMetaTag('twitter:description', description);
  }
  if (imageUrl) {
    setMetaTag('og:image', imageUrl);
    setMetaTag('twitter:image', imageUrl);
  }
  if (url) {
    setMetaTag('og:url', url);
  }
  setMetaTag('twitter:card', 'summary_large_image');
}

/**
 * Normalizes and deduplicates URLs in share text content.
 * Guarantees the shared content contains EXACTLY ONE canonical destination link.
 * Prevents the same destination URL from appearing multiple times.
 */
export function deduplicateShareContent(text: string | undefined | null, canonicalUrl: string): {
  cleanText: string;
  combinedTextWithSingleUrl: string;
  canonicalUrl: string;
} {
  const targetUrl = (canonicalUrl || '').trim();
  if (!text) {
    return {
      cleanText: '',
      combinedTextWithSingleUrl: targetUrl,
      canonicalUrl: targetUrl,
    };
  }

  // Normalize URL for comparison (removes protocol, trailing slashes, www, lowercase)
  const normalizeUrl = (u: string) => {
    return u
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase();
  };

  const targetNormalized = normalizeUrl(targetUrl);

  // Match all URLs in text
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const seenUrls = new Set<string>();

  let cleaned = text.replace(urlRegex, (match) => {
    const stripped = match.replace(/[.,;:!?)\]]+$/, '');
    const trailingPunct = match.slice(stripped.length);
    const normalized = normalizeUrl(stripped);

    // If matches target canonical destination URL or is duplicate, strip from body text
    if (
      normalized === targetNormalized ||
      (targetNormalized && (targetNormalized.endsWith(normalized) || normalized.endsWith(targetNormalized)))
    ) {
      return trailingPunct.replace(/[()\[\]]/g, '');
    }

    // If duplicate of an already seen URL in the text, strip it
    if (seenUrls.has(normalized)) {
      return trailingPunct.replace(/[()\[\]]/g, '');
    }
    seenUrls.add(normalized);

    return match;
  });

  // Clean up whitespace, empty parentheses, and extra newlines
  const cleanedLines = cleaned
    .replace(/\(\s*\)|\[\s*\]/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((line, idx, arr) => {
      if (!line && idx > 0 && !arr[idx - 1]) return false;
      return true;
    });

  const cleanText = cleanedLines.join('\n').trim();

  const combinedTextWithSingleUrl = cleanText
    ? (targetUrl ? `${cleanText}\n\n${targetUrl}` : cleanText)
    : targetUrl;

  return {
    cleanText,
    combinedTextWithSingleUrl,
    canonicalUrl: targetUrl,
  };
}

/**
 * Main share function supporting Web Share API with native share sheet,
 * optional image attachments, and automatic copy-to-clipboard fallback.
 * Strictly guarantees only ONE canonical destination link is shared.
 */
export async function shareItem(options: ShareOptions): Promise<void> {
  const { title, text, url, imageUrl, customToastMessage } = options;

  // Deduplicate and ensure exactly ONE canonical URL
  const { cleanText, combinedTextWithSingleUrl, canonicalUrl } = deduplicateShareContent(text, url);

  // 1. Try native Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    let filesToShare: File[] = [];

    if (imageUrl && typeof navigator.canShare === 'function') {
      try {
        let blob: Blob | null = null;
        let mimeType = 'image/png';
        let ext = 'png';

        if (imageUrl.startsWith('data:')) {
          const arr = imageUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          blob = new Blob([u8arr], { type: mimeType });
        } else {
          const response = await fetch(imageUrl, { mode: 'cors' });
          if (response.ok) {
            blob = await response.blob();
            mimeType = blob.type || 'image/png';
            ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
          }
        }

        if (blob) {
          const file = new File([blob], `share-preview.${ext}`, { type: mimeType });
          if (navigator.canShare({ files: [file], title, text: combinedTextWithSingleUrl })) {
            filesToShare = [file];
          } else if (navigator.canShare({ files: [file] })) {
            filesToShare = [file];
          }
        }
      } catch (_) {
        // Fallback to text/url sharing if image fetch fails (e.g., CORS)
      }
    }

    try {
      if (filesToShare.length > 0) {
        // When sharing with attached files, include the single canonical URL in text
        // without passing a separate 'url' field to prevent native share sheets from duplicating the link
        await navigator.share({
          title,
          text: combinedTextWithSingleUrl,
          files: filesToShare,
        });
        return;
      } else {
        // When sharing without files, provide cleanText as text and canonicalUrl as url.
        // The Web Share API will combine them natively with exactly ONE canonical link.
        await navigator.share({
          title,
          text: cleanText,
          url: canonicalUrl,
        });
        return;
      }
    } catch (err: any) {
      // User cancelled native share sheet
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        return;
      }

      // If sharing with files failed on this platform, retry without files
      if (filesToShare.length > 0) {
        try {
          await navigator.share({
            title,
            text: cleanText,
            url: canonicalUrl,
          });
          return;
        } catch (retryErr: any) {
          if (retryErr && (retryErr.name === 'AbortError' || retryErr.code === 20)) {
            return;
          }
        }
      }
    }
  }

  // 2. Fallback to copy link to clipboard (for browsers without Web Share API)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(canonicalUrl);
      toast.success(customToastMessage || 'Share link copied to clipboard!');
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = canonicalUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(customToastMessage || 'Share link copied to clipboard!');
    }
  } catch (err) {
    toast.error('Failed to copy share link.');
  }
}

export interface ProductShareOptions {
  specificUrl?: string;
  specificImage?: string;
  variantName?: string;
}

/**
 * Shares a product with its permanent human-readable URL, product image,
 * title, and product details. Guarantees ONLY ONE canonical destination link.
 */
export async function shareProduct(product: Product, options?: ProductShareOptions): Promise<void> {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  const slug = getProductSlug(product);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = options?.specificUrl || `${origin}/products/${slug}`;

  const image = options?.specificImage || ((product.images && product.images.length > 0) ? product.images[0] : (product as any).image);
  const effectivePrice = product.discountPrice || product.price;
  const priceDisplay = effectivePrice ? ` - ₹${effectivePrice.toLocaleString()}` : '';
  const variantDisplay = options?.variantName ? ` (${options.variantName})` : '';
  const descSnippet = product.description ? `\n\n${product.description.slice(0, 150)}` : '';

  const title = `${product.name}${variantDisplay} | ViBa Mart`;
  const text = `Check out ${product.name}${variantDisplay}${priceDisplay} on ViBa Mart!${descSnippet}`;

  // Update head tags for crawlers
  updateOpenGraphTags(title, product.description || text, image, shareUrl);

  // Desktop mode: open dedicated Desktop Share Modal with full links, image download/copy, and social share
  if (isDesktop) {
    useDesktopShareStore.getState().openShare(product, options);
    return;
  }

  // Mobile mode
  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
    customToastMessage: 'Product link copied to clipboard!',
  });
}

/**
 * Shares a coupon/reward with its permanent human-readable URL, reward image,
 * title, and discount details. Strictly omits any coupon code.
 * Guarantees ONLY ONE canonical destination link.
 */
export async function shareReward(reward: BrandCoupon): Promise<void> {
  const slug = getRewardSlug(reward);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/rewards/${slug}`;

  const image = reward.productImage || reward.brandLogo;
  const discountText = reward.discountType === 'percent'
    ? `${reward.discountValue}% OFF`
    : `₹${reward.discountValue} OFF`;

  const title = `${reward.title} - ${reward.brandName} | ViBa Mart`;
  const text = `Claim ${reward.title} (${discountText}) by ${reward.brandName} on ViBa Mart! Exclusive brand deal.`;

  // Update head tags for crawlers
  updateOpenGraphTags(title, reward.description || reward.terms || text, image, shareUrl);

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
    customToastMessage: 'Reward link copied to clipboard!',
  });
}

/**
 * Shares the Deal 259 Super Store page with title, description, and link.
 * Allows anyone (visitors/customers) to share the Deal 259 store.
 * Guarantees ONLY ONE canonical destination link.
 */
export async function shareDeal259Store(config?: Deal259PageConfig): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/deal259`;
  const title = config?.title ? `${config.title} | ViBa Mart` : 'Deal 259 Super Store | ViBa Mart';
  const text = config?.subtitle || 'Check out Deal 259 Super Store for exclusive deals, mega savings, and unbeatable budget picks on ViBa Mart!';

  updateOpenGraphTags(title, text, undefined, shareUrl);

  await shareItem({
    title,
    text,
    url: shareUrl,
    customToastMessage: 'Deal 259 Store link copied to clipboard!',
  });
}

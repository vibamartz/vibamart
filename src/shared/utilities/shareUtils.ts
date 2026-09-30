import { Product, BrandCoupon, Deal259PageConfig } from '../types';
import { getProductSlug, getRewardSlug } from './slug';
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
 * Main share function supporting Web Share API with native share sheet,
 * optional image attachments, and automatic copy-to-clipboard fallback.
 */
export async function shareItem(options: ShareOptions): Promise<void> {
  const { title, text, url, imageUrl, customToastMessage } = options;

  // Build full text ensuring the canonical URL is explicitly embedded within the message.
  // This ensures desktop and mobile share targets (WhatsApp, Telegram, Discord, Mail, Windows Share, etc.)
  // include the product URL even when the platform prioritizes image file attachments or drops the standalone URL field.
  const textWithUrl = text ? (text.includes(url) ? text : `${text}\n\n${url}`) : url;

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
          const file = new File([blob], `product-share.${ext}`, { type: mimeType });
          if (navigator.canShare({ files: [file], title, text: textWithUrl, url })) {
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
        await navigator.share({
          title,
          text: textWithUrl,
          url,
          files: filesToShare,
        });
        return;
      } else {
        await navigator.share({
          title,
          text: textWithUrl,
          url,
        });
        return;
      }
    } catch (err: any) {
      // User cancelled native share sheet
      if (err && (err.name === 'AbortError' || err.code === 20)) {
        return;
      }

      // If sharing with files failed on this platform, retry without files
      // to ensure the product URL and description are successfully shared.
      if (filesToShare.length > 0) {
        try {
          await navigator.share({
            title,
            text: textWithUrl,
            url,
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
      await navigator.clipboard.writeText(url);
      toast.success(customToastMessage || 'Product link copied to clipboard!');
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(customToastMessage || 'Product link copied to clipboard!');
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
 * title, and product details.
 */
export async function shareProduct(product: Product, options?: ProductShareOptions): Promise<void> {
  const slug = getProductSlug(product);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = options?.specificUrl || `${origin}/products/${slug}`;

  const image = options?.specificImage || ((product.images && product.images.length > 0) ? product.images[0] : (product as any).image);
  const priceDisplay = product.price ? ` - ₹${product.price}` : '';
  const variantDisplay = options?.variantName ? ` (${options.variantName})` : '';
  const descSnippet = product.description ? `\n\n${product.description.slice(0, 150)}` : '';

  const title = `${product.name}${variantDisplay} | ViBa Mart`;
  const text = `Check out ${product.name}${variantDisplay}${priceDisplay} on ViBa Mart!${descSnippet}`;

  // Update head tags for crawlers
  updateOpenGraphTags(title, product.description || text, image, shareUrl);

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



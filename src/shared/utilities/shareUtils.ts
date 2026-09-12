import { Product, BrandCoupon } from '../types';
import { getProductSlug, getRewardSlug } from './slug';
import toast from 'react-hot-toast';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
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
  const { title, text, url, imageUrl } = options;

  // 1. Try native Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    let filesToShare: File[] = [];

    if (imageUrl && navigator.canShare) {
      try {
        const response = await fetch(imageUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], `share-preview.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
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
          text,
          url,
          files: filesToShare,
        });
        return;
      } else {
        await navigator.share({
          title,
          text,
          url,
        });
        return;
      }
    } catch (err: any) {
      // User cancelled native share sheet
      if (err.name === 'AbortError') {
        return;
      }
    }
  }

  // 2. Fallback to copy link to clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
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
      toast.success('Link copied to clipboard!');
    }
  } catch (err) {
    toast.error('Failed to copy share link.');
  }
}

/**
 * Shares a product with its permanent human-readable URL, product image,
 * title, and product details.
 */
export async function shareProduct(product: Product): Promise<void> {
  const slug = getProductSlug(product);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/products/${slug}`;

  const image = (product.images && product.images.length > 0) ? product.images[0] : (product as any).image;
  const priceDisplay = product.price ? ` - ₹${product.price}` : '';
  const descSnippet = product.description ? `\n\n${product.description.slice(0, 150)}` : '';

  const title = `${product.name} | ViBa Mart`;
  const text = `Check out ${product.name}${priceDisplay} on ViBa Mart!${descSnippet}`;

  // Update head tags for crawlers
  updateOpenGraphTags(title, product.description || text, image, shareUrl);

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
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
  });
}

import { Product, BrandCoupon, Deal259PageConfig, Banner } from '../types';
import { getProductSlug, getRewardSlug, getBannerSlug } from './slug';
import toast from 'react-hot-toast';

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

/**
 * Normalizes any relative or partial image URL to a full absolute URL.
 */
export function toAbsoluteUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${cleanPath}`;
}

/**
 * Normalizes any path or relative link to a full canonical destination URL.
 */
export function toCanonicalDestinationUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return typeof window !== 'undefined' ? window.location.origin : '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('www.')) {
    return `https://${pathOrUrl}`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin}${cleanPath}`;
}

/**
 * Dynamically updates Open Graph and Twitter meta tags in the document head
 * for rich social card previews when shared links are crawled.
 */
export function updateOpenGraphTags(title: string, description?: string, imageUrl?: string, url?: string): void {
  if (typeof document === 'undefined') return;

  const fullUrl = toCanonicalDestinationUrl(url);
  const fullImageUrl = imageUrl ? toAbsoluteUrl(imageUrl) : undefined;

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
  if (fullImageUrl) {
    setMetaTag('og:image', fullImageUrl);
    setMetaTag('og:image:secure_url', fullImageUrl);
    setMetaTag('twitter:image', fullImageUrl);
  }
  if (fullUrl) {
    setMetaTag('og:url', fullUrl);
    setMetaTag('twitter:url', fullUrl);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', fullUrl);
  }
  setMetaTag('og:type', 'website');
  setMetaTag('twitter:card', 'summary_large_image');
}

/**
 * Main share function supporting Web Share API with native share sheet,
 * image attachments, clickable canonical destination links, and copy-to-clipboard fallback.
 */
export async function shareItem(options: ShareOptions): Promise<void> {
  const { title, text, url, imageUrl } = options;
  const fullUrl = toCanonicalDestinationUrl(url);
  const fullImageUrl = imageUrl ? toAbsoluteUrl(imageUrl) : undefined;

  // Update head Open Graph and Twitter tags for social previews
  updateOpenGraphTags(title, text, fullImageUrl, fullUrl);

  const shareTextPayload = text.includes(fullUrl) ? text : `${text}\n\n${fullUrl}`;

  // 1. Try native Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    let filesToShare: File[] = [];

    if (fullImageUrl && navigator.canShare) {
      try {
        const response = await fetch(fullImageUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split('/')[1]?.split(';')[0] || 'png';
          const file = new File([blob], `share-preview.${ext}`, { type: blob.type || 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            filesToShare = [file];
          }
        }
      } catch (_) {
        // Fallback to text/url sharing if image fetch fails (e.g. CORS)
      }
    }

    try {
      if (filesToShare.length > 0) {
        await navigator.share({
          title,
          text: shareTextPayload,
          url: fullUrl,
          files: filesToShare,
        });
        return;
      } else {
        await navigator.share({
          title,
          text: shareTextPayload,
          url: fullUrl,
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
      await navigator.clipboard.writeText(fullUrl);
      toast.success(`${title || 'Link'} copied to clipboard!`);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`${title || 'Link'} copied to clipboard!`);
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
  const shareUrl = `/products/${slug}`;

  const image = (product.images && product.images.length > 0)
    ? product.images[0]
    : ((product as any).image || (product as any).imageUrl || '');
  const priceDisplay = product.price ? ` - ₹${product.price}` : '';
  const descSnippet = product.description ? `\n\n${product.description.slice(0, 150)}` : '';

  const title = `${product.name} | ViBa Mart`;
  const text = `Check out ${product.name}${priceDisplay} on ViBa Mart!${descSnippet}`;

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
  const shareUrl = `/rewards/${slug}`;

  const image = reward.productImage || reward.imageUrl || reward.brandLogo || '';
  const discountText = (reward.discountType === 'percent' || reward.discountType === 'percentage')
    ? `${reward.discountValue}% OFF`
    : `₹${reward.discountValue} OFF`;

  const title = `${reward.title} - ${reward.brandName} | ViBa Mart`;
  const text = `Claim ${reward.title} (${discountText}) by ${reward.brandName} on ViBa Mart! Exclusive brand deal.`;

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
  });
}

/**
 * Shares a banner/promotional banner/reward banner with its actual banner image,
 * title, and configured destination link.
 */
export async function shareBanner(banner: Banner): Promise<void> {
  let shareUrl = '';
  if (banner.link) {
    shareUrl = banner.link;
  } else {
    const slug = banner.slug || getBannerSlug(banner);
    shareUrl = `/offers/${slug}`;
  }

  const image = banner.image;
  const title = `${banner.title || 'Exclusive Offer'} | ViBa Mart`;
  const text = banner.subtitle
    ? `${banner.title ? banner.title + ' - ' : ''}${banner.subtitle} on ViBa Mart!`
    : `Check out ${banner.title || 'this exclusive offer'} on ViBa Mart!`;

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
  });
}

/**
 * Shares the Deal 259 Super Store page with title, description, banner image, and link.
 * Allows anyone (visitors/customers) to share the Deal 259 store.
 */
export async function shareDeal259Store(config?: Deal259PageConfig): Promise<void> {
  const shareUrl = '/deal259';
  const title = config?.title ? `${config.title} | ViBa Mart` : 'Deal 259 Super Store | ViBa Mart';
  const text = config?.subtitle || 'Check out Deal 259 Super Store for exclusive deals, mega savings, and unbeatable budget picks on ViBa Mart!';
  const image = config?.bannerImage || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&h=400&fit=crop';

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
  });
}



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
  setMetaTag('og:site_name', 'ViBa Mart');
  setMetaTag('twitter:card', 'summary_large_image');
}

/**
 * Fallback social share modal when native Web Share API is unavailable or un-supported.
 */
export function showShareFallbackModal(options: ShareOptions): void {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('viba-share-modal');
  if (existing) {
    existing.remove();
  }

  const fullUrl = toCanonicalDestinationUrl(options.url);
  const fullImageUrl = options.imageUrl ? toAbsoluteUrl(options.imageUrl) : '';
  const cleanText = options.text.replace(fullUrl, '').trim();

  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'viba-share-modal';
  modalOverlay.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200';

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${cleanText}\n\n${fullUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(cleanText)}&url=${encodeURIComponent(fullUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(cleanText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(options.title)}&body=${encodeURIComponent(`${cleanText}\n\n${fullUrl}`)}`;

  modalOverlay.innerHTML = `
    <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col transform transition-all duration-200 scale-100" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900 leading-tight">Share</h3>
            <p class="text-xs text-gray-500">Choose how you want to share</p>
          </div>
        </div>
        <button id="viba-share-close-btn" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer" title="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-4 bg-gray-50/70 border-b border-gray-100">
        <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200/80 shadow-sm">
          ${fullImageUrl ? `<img src="${fullImageUrl}" alt="${options.title}" class="w-14 h-14 object-cover rounded-lg border border-gray-100 shrink-0" />` : ''}
          <div class="min-w-0 flex-1">
            <h4 class="text-sm font-semibold text-gray-900 truncate">${options.title}</h4>
            <p class="text-xs text-gray-500 line-clamp-2 mt-0.5">${cleanText}</p>
            <span class="inline-block text-[11px] text-rose-600 font-medium truncate mt-1">${fullUrl}</span>
          </div>
        </div>
      </div>

      <div class="p-4">
        <div class="grid grid-cols-3 gap-3">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="viba-share-option flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-100 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
            </div>
            <span class="text-xs font-semibold">WhatsApp</span>
          </a>

          <a href="${twitterUrl}" target="_blank" rel="noopener noreferrer" class="viba-share-option flex flex-col items-center justify-center p-3 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors border border-sky-100 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </div>
            <span class="text-xs font-semibold">X / Twitter</span>
          </a>

          <a href="${facebookUrl}" target="_blank" rel="noopener noreferrer" class="viba-share-option flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </div>
            <span class="text-xs font-semibold">Facebook</span>
          </a>

          <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" class="viba-share-option flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 transition-colors border border-cyan-100 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-cyan-500 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.56 8.16l-1.97 9.28c-.15.67-.54.83-1.1.52l-3.04-2.24-1.47 1.41c-.16.16-.3.3-.61.3l.22-3.1 5.64-5.1c.25-.22-.05-.34-.38-.12l-6.97 4.39-3.01-.94c-.65-.2-.67-.65.14-.97l11.76-4.53c.54-.2 1.02.14.83.97z"/></svg>
            </div>
            <span class="text-xs font-semibold">Telegram</span>
          </a>

          <a href="${emailUrl}" class="viba-share-option flex flex-col items-center justify-center p-3 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors border border-purple-100 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <span class="text-xs font-semibold">Email</span>
          </a>

          <button id="viba-share-copy-btn" class="flex flex-col items-center justify-center p-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200 text-center group cursor-pointer">
            <div class="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center mb-1.5 shadow-sm group-hover:scale-105 transition-transform">
              <svg class="w-4 h-4 fill-none stroke-current" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </div>
            <span class="text-xs font-semibold">Copy Link</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const closeModal = () => {
    modalOverlay.style.opacity = '0';
    setTimeout(() => {
      modalOverlay.remove();
    }, 150);
  };

  const closeBtn = document.getElementById('viba-share-close-btn');
  if (closeBtn) closeBtn.onclick = closeModal;

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };

  const copyBtn = document.getElementById('viba-share-copy-btn');
  if (copyBtn) {
    copyBtn.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = fullUrl;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        toast.success('Link copied to clipboard!');
        closeModal();
      } catch (_) {
        toast.error('Failed to copy link.');
      }
    };
  }

  const optionLinks = modalOverlay.querySelectorAll('.viba-share-option');
  optionLinks.forEach(link => {
    link.addEventListener('click', () => {
      setTimeout(closeModal, 300);
    });
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Main share function supporting native Web Share API (mobile share sheet & desktop Web Share API)
 * with image/banner file attachments when available, single canonical URL sharing, and social modal fallback.
 */
export async function shareItem(options: ShareOptions): Promise<void> {
  const { title, text, url, imageUrl } = options;
  const fullUrl = toCanonicalDestinationUrl(url);
  const fullImageUrl = imageUrl ? toAbsoluteUrl(imageUrl) : undefined;

  // Update head Open Graph and Twitter meta tags for crawler/social previews
  updateOpenGraphTags(title, text, fullImageUrl, fullUrl);

  // Clean share text (ensuring URL is not duplicated in text string)
  const cleanText = text.replace(fullUrl, '').trim();

  // 1. Try native Web Share API (Mobile system share sheet / Desktop Web Share API)
  if (typeof navigator !== 'undefined' && navigator.share) {
    let fileToShare: File | null = null;

    if (fullImageUrl) {
      try {
        const response = await fetch(fullImageUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const mimeType = blob.type || 'image/png';
          const ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
          const file = new File([blob], `share-preview.${ext}`, { type: mimeType });
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            fileToShare = file;
          }
        }
      } catch (_) {
        // Image fetch failed (e.g. CORS); proceed with text/url share
      }
    }

    try {
      if (fileToShare) {
        const payload = {
          title,
          text: cleanText,
          url: fullUrl,
          files: [fileToShare]
        };
        if (typeof navigator.canShare === 'function' && navigator.canShare(payload)) {
          await navigator.share(payload);
          return;
        }
      }
      await navigator.share({
        title,
        text: cleanText,
        url: fullUrl,
      });
      return;
    } catch (err: any) {
      // User cancelled native share sheet
      if (err && err.name === 'AbortError') {
        return;
      }
      // If native share with file failed, try share without file
      if (fileToShare) {
        try {
          await navigator.share({
            title,
            text: cleanText,
            url: fullUrl,
          });
          return;
        } catch (err2: any) {
          if (err2 && err2.name === 'AbortError') return;
        }
      }
    }
  }

  // 2. Fallback to social share modal when native sharing is unavailable or fails
  showShareFallbackModal(options);
}

/**
 * Shares a product with its permanent human-readable URL, product image,
 * title, and product details.
 */
export async function shareProduct(product: Product): Promise<void> {
  if (!product) return;
  const slug = getProductSlug(product);
  const shareUrl = `/products/${slug}`;

  const image = (product.images && product.images.length > 0)
    ? product.images[0]
    : ((product as any).image || (product as any).imageUrl || (product as any).bannerImage || '');
  const priceDisplay = product.price ? ` - ₹${product.price}` : '';

  const title = `${product.name} | ViBa Mart`;
  const text = `Check out ${product.name}${priceDisplay} on ViBa Mart! ${product.description ? product.description.slice(0, 120) + '...' : ''}`;

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
  });
}

/**
 * Shares a coupon/reward with its permanent human-readable URL, reward banner image,
 * title, and discount details.
 */
export async function shareReward(reward: BrandCoupon): Promise<void> {
  if (!reward) return;
  const slug = getRewardSlug(reward);
  const shareUrl = `/rewards/${slug}`;

  const image = reward.productImage || reward.imageUrl || (reward.catalogImages && reward.catalogImages.length > 0 ? reward.catalogImages[0] : '') || reward.brandLogo || '';
  const discountText = (reward.discountType === 'percent' || reward.discountType === 'percentage')
    ? `${reward.discountValue}% OFF`
    : `₹${reward.discountValue} OFF`;

  const title = `${reward.title} - ${reward.brandName} | ViBa Mart`;
  const infoText = reward.description || reward.terms || `Get ${discountText} on ${reward.brandName}`;
  const text = `Claim ${reward.title} (${discountText}) by ${reward.brandName} on ViBa Mart! ${infoText}`;

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
  if (!banner) return;
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
  const image = config?.bannerImage || '';

  await shareItem({
    title,
    text,
    url: shareUrl,
    imageUrl: image,
  });
}




import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Copy, Download, Share2, Mail, ExternalLink, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Product } from '../../shared/types';
import { getProductSlug } from '../../shared/utilities/slug';
import { deduplicateShareContent } from '../../shared/utilities/shareUtils';
import { useDesktopShareStore } from './useDesktopShareStore';

export { useDesktopShareStore };

export default function DesktopShareModal() {
  const { isOpen, product, options, closeShare } = useDesktopShareStore();
  const [copied, setCopied] = useState(false);
  const [imageDownloading, setImageDownloading] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);

  if (!isOpen || !product) return null;

  const slug = getProductSlug(product);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = options?.specificUrl || `${origin}/products/${slug}`;
  const image = options?.specificImage || (product.images && product.images.length > 0 ? product.images[0] : (product as any).image);
  
  const variantDisplay = options?.variantName ? ` (${options.variantName})` : '';
  const priceDisplay = product.price ? `₹${(product.discountPrice || product.price).toLocaleString()}` : '';
  const originalPriceDisplay = product.discountPrice && product.price > product.discountPrice ? `₹${product.price.toLocaleString()}` : '';
  const discountPercent = product.discountPrice && product.price > product.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const title = `${product.name}${variantDisplay} | ViBa Mart`;
  const rawText = `Check out ${product.name}${variantDisplay}${priceDisplay ? ` at ${priceDisplay}` : ''} on ViBa Mart!`;

  // Deduplicate and enforce strictly ONE canonical destination link
  const { cleanText, combinedTextWithSingleUrl, canonicalUrl } = deduplicateShareContent(rawText, shareUrl);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = canonicalUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Specific product link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy link.');
    }
  };

  const handleDownloadImage = async () => {
    if (!image) {
      toast.error('No image available to download.');
      return;
    }

    try {
      setImageDownloading(true);
      let blobUrl = image;

      if (!image.startsWith('data:')) {
        const res = await fetch(image, { mode: 'cors' });
        if (res.ok) {
          const blob = await res.blob();
          blobUrl = URL.createObjectURL(blob);
        }
      }

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `vibamart-${slug}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Product image downloaded!');
    } catch {
      // Direct anchor click fallback
      const link = document.createElement('a');
      link.href = image;
      link.target = '_blank';
      link.download = `vibamart-${slug}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Opening image for download...');
    } finally {
      setImageDownloading(false);
    }
  };

  const handleCopyImage = async () => {
    if (!image) return;
    try {
      if (typeof window !== 'undefined' && 'ClipboardItem' in window && navigator.clipboard?.write) {
        let blob: Blob | null = null;
        if (image.startsWith('data:')) {
          const arr = image.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          blob = new Blob([u8arr], { type: mimeType });
        } else {
          const res = await fetch(image, { mode: 'cors' });
          if (res.ok) {
            blob = await res.blob();
          }
        }

        if (blob) {
          const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
          await navigator.clipboard.write([item]);
          setImageCopied(true);
          toast.success('Product image copied to clipboard!');
          setTimeout(() => setImageCopied(false), 2500);
          return;
        }
      }
      handleDownloadImage();
    } catch {
      handleDownloadImage();
    }
  };

  const handleSystemShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        // Share text + url directly (without files array) so OS/Windows doesn't drop the canonical link
        await navigator.share({
          title,
          text: cleanText,
          url: canonicalUrl,
        });
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.code === 20)) return;
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  // Pre-configured social share URLs ensuring ONLY ONE canonical link
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedText = encodeURIComponent(cleanText);
  const encodedFullMessage = encodeURIComponent(combinedTextWithSingleUrl);

  const shareChannels = [
    {
      name: 'WhatsApp Web',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      ),
      bg: 'bg-emerald-500 hover:bg-emerald-600 text-white',
      url: `https://web.whatsapp.com/send?text=${encodedFullMessage}`,
    },
    {
      name: 'Telegram',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.197 1.006.128.828.942z" />
        </svg>
      ),
      bg: 'bg-sky-500 hover:bg-sky-600 text-white',
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    },
    {
      name: 'Twitter / X',
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 23.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      bg: 'bg-black hover:bg-gray-800 text-white',
      url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.374 14.5 5 15.667 5H18V0h-3.889C10.556 0 9 1.444 9 4.333V8z" />
        </svg>
      ),
      bg: 'bg-blue-600 hover:bg-blue-700 text-white',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      icon: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
        </svg>
      ),
      bg: 'bg-[#0077b5] hover:bg-[#006097] text-white',
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Email',
      icon: <Mail className="w-5 h-5" />,
      bg: 'bg-amber-600 hover:bg-amber-700 text-white',
      url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodedFullMessage}`,
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeShare}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-gray-900">Share Product</h3>
            </div>
            <button
              onClick={closeShare}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Product Card Preview */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-200/80">
              <div className="w-20 h-20 bg-white rounded-xl p-1.5 border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={image || 'https://via.placeholder.com/150'}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
                  {product.name}
                </h4>
                {options?.variantName && (
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">
                    Variant: {options.variantName}
                  </p>
                )}
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-black text-gray-900">{priceDisplay}</span>
                  {originalPriceDisplay && (
                    <span className="text-xs text-gray-400 line-through font-bold">{originalPriceDisplay}</span>
                  )}
                  {discountPercent > 0 && (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Direct Specific URL Copy Box */}
            <div>
              <label className="text-xs font-black text-gray-700 uppercase tracking-wider block mb-1.5">
                Product Specific Link
              </label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-1.5 pl-3 focus-within:border-emerald-500 focus-within:bg-white transition-all">
                <input
                  type="text"
                  readOnly
                  value={canonicalUrl}
                  className="w-full text-xs text-gray-700 font-mono bg-transparent outline-none truncate select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-900 hover:bg-emerald-600 text-white active:scale-95'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social Share Channels Grid */}
            <div>
              <label className="text-xs font-black text-gray-700 uppercase tracking-wider block mb-2">
                Share Directly to Platforms
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {shareChannels.map((channel) => (
                  <a
                    key={channel.name}
                    href={channel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-xs font-bold transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer ${channel.bg}`}
                  >
                    {channel.icon}
                    <span className="truncate">{channel.name.split(' ')[0]}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Image Actions Row */}
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={imageDownloading}
                className="flex-1 py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>{imageDownloading ? 'Downloading...' : 'Save Product Image'}</span>
              </button>

              <button
                onClick={handleCopyImage}
                className="flex-1 py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
                <span>{imageCopied ? 'Image Copied!' : 'Copy Image'}</span>
              </button>

              {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
                <button
                  onClick={handleSystemShare}
                  title="System Share"
                  className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

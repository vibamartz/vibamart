import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Copy, Check, Share2, Download, ExternalLink, MessageCircle, 
  Send, Facebook, Twitter, Mail, Image as ImageIcon, Sparkles
} from 'lucide-react';
import { useShareModalStore } from '../../shared/utilities/useShareModalStore';
import toast from 'react-hot-toast';

export default function ShareModal() {
  const { isOpen, data, closeModal } = useShareModalStore();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const title = data?.title || '';
  const text = data?.text || '';
  const url = data?.url || '';
  const imageUrl = data?.imageUrl;
  const price = data?.price;
  const discountPrice = data?.discountPrice;
  const textWithUrl = text ? (text.includes(url) ? text : `${text}\n\n${url}`) : url;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('Link copied to clipboard!', { icon: '🔗' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleCopyImageLink = async () => {
    if (!imageUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(imageUrl);
      }
      toast.success('Image link copied to clipboard!', { icon: '🖼️' });
    } catch {
      toast.error('Failed to copy image link');
    }
  };

  const handleDownloadImage = async () => {
    if (!imageUrl) return;
    setDownloading(true);
    try {
      let downloadUrl = imageUrl;
      if (imageUrl.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}-image.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const res = await fetch(imageUrl, { mode: 'cors' });
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}-image.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
      toast.success('Product image downloaded!', { icon: '📥' });
    } catch {
      window.open(imageUrl, '_blank');
      toast('Opening image in a new tab...', { icon: '↗️' });
    } finally {
      setDownloading(false);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: textWithUrl,
          url,
        });
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err && err.name !== 'AbortError' && err.code !== 20) {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Social share channels with specific deep-links
  const shareChannels = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      bg: 'bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white',
      border: 'hover:border-[#25D366]',
      action: () => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(textWithUrl)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      name: 'Telegram',
      icon: Send,
      bg: 'bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc] hover:text-white',
      border: 'hover:border-[#0088cc]',
      action: () => {
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        window.open(tgUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      name: 'Facebook',
      icon: Facebook,
      bg: 'bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2] hover:text-white',
      border: 'hover:border-[#1877F2]',
      action: () => {
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        window.open(fbUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      name: 'X (Twitter)',
      icon: Twitter,
      bg: 'bg-black/5 text-gray-900 hover:bg-black hover:text-white',
      border: 'hover:border-black',
      action: () => {
        const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(twUrl, '_blank', 'noopener,noreferrer');
      },
    },
    {
      name: 'Email',
      icon: Mail,
      bg: 'bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white',
      border: 'hover:border-slate-800',
      action: () => {
        const mailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(textWithUrl)}`;
        window.location.href = mailUrl;
      },
    },
    {
      name: 'Device Share',
      icon: Share2,
      bg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white',
      border: 'hover:border-emerald-600',
      action: handleNativeShare,
    },
  ];

  const displayPrice = discountPrice || price;

  return (
    <AnimatePresence>
      {isOpen && data && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            key="share-modal-container"
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Share2 className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-gray-900 tracking-tight">Share Product</h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close share dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Product Card Preview */}
              <div className="flex items-center gap-4 p-3.5 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 shadow-sm">
                {imageUrl && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-white border border-gray-200/80 p-1 shrink-0 flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> ViBa Mart
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1 leading-snug">
                    {title.replace(' | ViBa Mart', '')}
                  </h3>
                  {displayPrice ? (
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-sm font-black text-gray-900">₹{displayPrice.toLocaleString()}</span>
                      {price && discountPrice && price > discountPrice && (
                        <span className="text-xs text-gray-400 line-through">₹{price.toLocaleString()}</span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Quick Share Targets */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3 block">
                  Share via
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {shareChannels.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <button
                        key={channel.name}
                        onClick={channel.action}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border border-gray-100 transition-all duration-200 active:scale-95 group ${channel.bg} ${channel.border}`}
                      >
                        <Icon className="w-5 h-5 mb-1.5 transition-transform group-hover:scale-110" />
                        <span className="text-[10px] font-bold text-gray-700 group-hover:text-inherit">
                          {channel.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Copy Specific Link Box */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2 block">
                  Product Link
                </label>
                <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    className="flex-1 bg-transparent px-3 text-xs font-medium text-gray-700 select-all outline-none truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-900 text-white hover:bg-black active:scale-95'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Image Actions */}
              {imageUrl && (
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> Image included in shared links
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyImageLink}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1 border border-gray-200"
                    >
                      <ExternalLink className="w-3 h-3 text-gray-500" /> Copy Image URL
                    </button>
                    <button
                      onClick={handleDownloadImage}
                      disabled={downloading}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-1 border border-emerald-200"
                    >
                      <Download className="w-3 h-3 text-emerald-600" />
                      {downloading ? 'Downloading...' : 'Download Image'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

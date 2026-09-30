import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, ExternalLink, Mail, Send, Globe, MessageCircle, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ShareData {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
}

export const SHARE_MODAL_EVENT = 'viba:open-share-modal';

export function triggerShareModal(data: ShareData) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SHARE_MODAL_EVENT, { detail: data }));
  }
}

export default function GlobalShareModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<ShareData>;
      if (customEvent.detail) {
        setShareData(customEvent.detail);
        setIsOpen(true);
        setCopied(false);
      }
    };

    window.addEventListener(SHARE_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(SHARE_MODAL_EVENT, handleOpen);
  }, []);

  if (!isOpen || !shareData) return null;

  const { title, text, url, imageUrl } = shareData;

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
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Failed to copy share link.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
        setIsOpen(false);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Native share failed:', err);
        }
      }
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(title);
  const fullWhatsAppMsg = encodeURIComponent(`${text}\n\n${url}`);

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      href: `https://api.whatsapp.com/send?text=${fullWhatsAppMsg}`,
      bgColor: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-500 text-white',
    },
    {
      name: 'X (Twitter)',
      icon: Send,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      bgColor: 'bg-slate-900 hover:bg-black text-white border-slate-800',
      iconBg: 'bg-slate-800 text-white',
    },
    {
      name: 'Facebook',
      icon: Globe,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      bgColor: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-600 text-white',
    },
    {
      name: 'Telegram',
      icon: Send,
      href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      bgColor: 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200',
      iconBg: 'bg-sky-500 text-white',
    },
    {
      name: 'Email',
      icon: Mail,
      href: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`,
      bgColor: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-600 text-white',
    },
  ];

  const hasNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-snug">Share Item</h3>
                <p className="text-xs text-gray-500 font-medium">Choose a channel or copy the link below</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Preview Card */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80 flex gap-3.5 items-center group relative overflow-hidden">
              {imageUrl ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white border border-gray-200 block group-hover:opacity-90 transition-opacity"
                  title="Click to view product/reward page"
                >
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-4 h-4 text-white drop-shadow" />
                  </div>
                </a>
              ) : null}

              <div className="flex-1 min-w-0">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sm text-gray-900 line-clamp-1 hover:text-rose-600 transition-colors flex items-center gap-1"
                >
                  <span className="truncate">{title}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                </a>
                <p className="text-xs text-gray-600 line-clamp-2 mt-0.5 font-medium leading-relaxed">
                  {text}
                </p>
                <p className="text-[11px] text-gray-400 truncate mt-1 font-mono">
                  {url}
                </p>
              </div>
            </div>

            {/* Link Copy Box */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
                Direct Link
              </label>
              <div className="flex items-center gap-2 bg-gray-100/80 p-1.5 pl-3 rounded-xl border border-gray-200">
                <input
                  type="text"
                  readOnly
                  value={url}
                  className="bg-transparent text-xs text-gray-700 font-mono flex-1 outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-900 hover:bg-gray-800 text-white shadow'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
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

            {/* Sharing Options Grid */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Share Options
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {shareOptions.map((opt) => (
                  <a
                    key={opt.name}
                    href={opt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm hover:shadow ${opt.bgColor}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${opt.iconBg}`}>
                      <opt.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{opt.name}</span>
                  </a>
                ))}

                {hasNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shadow-sm"
                  >
                    <Share2 className="w-4 h-4 text-rose-600" />
                    <span>More Options (System Share Sheet)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

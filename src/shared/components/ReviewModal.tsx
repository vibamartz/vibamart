import React, { useState, useEffect } from 'react';
import { Star, Upload, X, Camera, Video, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../backend/firebase/firebase';
import { Order } from '../types';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  user: { uid: string; displayName?: string; email?: string; photoURL?: string } | null;
  initialProductId?: string;
}

const RATING_LABELS: Record<number, { label: string; stars: string }> = {
  1: { label: 'Terrible', stars: '⭐' },
  2: { label: 'Bad', stars: '⭐⭐' },
  3: { label: 'Okay', stars: '⭐⭐⭐' },
  4: { label: 'Good', stars: '⭐⭐⭐⭐' },
  5: { label: 'Excellent', stars: '⭐⭐⭐⭐⭐' },
};

export default function ReviewModal({ isOpen, onClose, order, user, initialProductId }: ReviewModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [mediaFiles, setMediaFiles] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [existingReviews, setExistingReviews] = useState<Record<string, boolean>>({});
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);

  useEffect(() => {
    if (order && order.items && order.items.length > 0) {
      if (initialProductId && order.items.some(i => i.productId === initialProductId)) {
        setSelectedProductId(initialProductId);
      } else {
        setSelectedProductId(order.items[0].productId);
      }
    }
  }, [order, initialProductId]);

  // Check which products in this order have already been reviewed by user
  useEffect(() => {
    if (!user || !order || !isOpen) return;

    const fetchExistingReviews = async () => {
      setCheckingEligibility(true);
      try {
        const q = query(
          collection(db, 'reviews'),
          where('userId', '==', user.uid),
          where('orderId', '==', order.id)
        );
        const snap = await getDocs(q);
        const reviewedMap: Record<string, boolean> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.productId) {
            reviewedMap[data.productId] = true;
          }
        });
        setExistingReviews(reviewedMap);
      } catch (err) {
        console.error("Error fetching user reviews for order:", err);
      } finally {
        setCheckingEligibility(false);
      }
    };

    fetchExistingReviews();
  }, [user, order, isOpen]);

  if (!isOpen || !order) return null;

  const currentItem = order.items?.find(i => i.productId === selectedProductId) || order.items?.[0];
  const isAlreadyReviewed = selectedProductId ? !!existingReviews[selectedProductId] : false;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setMediaFiles(prev => [
            ...prev,
            { url: reader.result as string, type: isVideo ? 'video' : 'image' }
          ].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
    toast.success("Attachment added!");
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please login to submit a review");
      return;
    }
    if (!selectedProductId || !currentItem) {
      toast.error("Please select a product to review");
      return;
    }
    if (order.status !== 'delivered') {
      toast.error("Reviews are only allowed for delivered orders.");
      return;
    }
    if (isAlreadyReviewed) {
      toast.error("You have already submitted a review for this product on this order.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload media if Firebase Storage bucket exists, otherwise keep data URL
      const uploadedMediaUrls = await Promise.all(
        mediaFiles.map(async (media, idx) => {
          if (!storage?.app?.options?.storageBucket) {
            return media.url;
          }
          try {
            const ext = media.type === 'video' ? 'mp4' : 'jpg';
            const mediaRef = ref(storage, `reviews/${order.id}_${selectedProductId}_${Date.now()}_${idx}.${ext}`);
            await uploadString(mediaRef, media.url, 'data_url');
            return await getDownloadURL(mediaRef);
          } catch {
            return media.url;
          }
        })
      );

      const reviewData = {
        orderId: order.id,
        productId: currentItem.productId,
        productName: currentItem.name,
        productImage: currentItem.image || '',
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Customer',
        userPhoto: user.photoURL || '',
        rating: rating,
        comment: comment.trim(),
        images: uploadedMediaUrls,
        createdAt: new Date().toISOString(),
        status: 'approved'
      };

      await addDoc(collection(db, 'reviews'), reviewData);

      toast.success("Thank you! Your review has been submitted.");
      setExistingReviews(prev => ({ ...prev, [selectedProductId]: true }));
      setComment('');
      setMediaFiles([]);
      onClose();
    } catch (err: any) {
      console.error("Error submitting review:", err);
      toast.error(err.message || "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-black text-gray-900">Rate your Experience</h3>
              <p className="text-xs text-gray-500 font-medium">Delivered Order Review</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Selector if multiple items */}
          {order.items && order.items.length > 1 && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">
                Select Product to Review
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {order.items.map(item => {
                  const isReviewed = !!existingReviews[item.productId];
                  const isSelected = item.productId === selectedProductId;
                  return (
                    <button
                      key={item.productId}
                      type="button"
                      onClick={() => setSelectedProductId(item.productId)}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all shrink-0 text-left ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/50 text-gray-900 shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <img src={item.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                      <div className="max-w-[120px]">
                        <p className="text-xs font-bold truncate">{item.name}</p>
                        {isReviewed && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Reviewed
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected Item Preview Header */}
          {currentItem && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <img src={currentItem.image} alt={currentItem.name} className="w-14 h-14 rounded-xl object-cover border border-gray-200" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-gray-900 truncate">{currentItem.name}</h4>
                <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                  Quantity: {currentItem.quantity} · ₹{currentItem.price.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {isAlreadyReviewed ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-black text-emerald-900">Review Submitted</h4>
              <p className="text-xs text-emerald-700 font-medium">
                You have already shared your experience for this item. Thank you for your feedback!
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Star Rating Section */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wider block">
                  Overall Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-2 rounded-xl transition-all transform active:scale-90 ${
                        rating >= star ? 'text-amber-400 bg-amber-50 scale-105' : 'text-gray-300 bg-gray-50 hover:text-amber-300'
                      }`}
                    >
                      <Star className={`w-7 h-7 ${rating >= star ? 'fill-amber-400' : ''}`} />
                    </button>
                  ))}
                </div>
                {/* Rating Label display */}
                <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/80 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900">
                    {RATING_LABELS[rating]?.stars} {rating} Star{rating > 1 ? 's' : ''} — <span className="font-black text-amber-800 uppercase tracking-wider">{RATING_LABELS[rating]?.label}</span>
                  </span>
                </div>
              </div>

              {/* Photo / Video Section */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wider block">
                  Add Photo / Video
                </label>
                <p className="text-[10px] text-gray-500 font-medium">
                  Attach photos or videos of the product to help other buyers.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer bg-gray-50 hover:bg-emerald-50/30 transition-all min-w-[100px] h-20">
                    <Upload className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-[10px] font-bold text-gray-600">Upload Media</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {mediaFiles.map((media, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shrink-0 bg-black group">
                      {media.type === 'video' ? (
                        <video src={media.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={media.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <span className="absolute bottom-1 left-1 bg-black/60 text-white p-0.5 rounded text-[9px]">
                        {media.type === 'video' ? <Video className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review Text Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wider block">
                  Tell us more
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about this product"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || checkingEligibility}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

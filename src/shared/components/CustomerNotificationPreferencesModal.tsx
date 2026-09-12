import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Tag, Sparkles, ShoppingBag, Heart, Gift, Zap, ShieldCheck, Check } from 'lucide-react';
import { useAuthStore } from '../../backend/store';
import { db } from '../../backend/firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CustomerNotificationPreferences } from '../types/notifications';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export default function CustomerNotificationPreferencesModal({ isOpen, onClose }: Props) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<CustomerNotificationPreferences>({
    userId: user?.uid || '',
    offers: true,
    newProducts: true,
    priceDrops: true,
    wishlist: true,
    cart: true,
    coupons: true,
    flashSales: true,
    personalizedOffers: true,
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    const fetchPrefs = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'user_notification_preferences', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPrefs(prev => ({ ...prev, ...(snap.data() as CustomerNotificationPreferences) }));
        }
      } catch (err) {
        console.warn('Failed loading preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [isOpen, user]);

  const handleToggle = (key: keyof Omit<CustomerNotificationPreferences, 'userId' | 'updatedAt'>) => {
    setPrefs(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user?.uid) {
      toast.error('Please log in to save preferences.');
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(db, 'user_notification_preferences', user.uid);
      const updatedData = {
        ...prefs,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, updatedData, { merge: true });
      toast.success('Notification preferences updated!');
      onClose();
    } catch (err) {
      console.error('Failed to save preferences:', err);
      toast.error('Failed to save notification preferences.');
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    {
      key: 'offers' as const,
      label: 'Special Offers & Discounts',
      desc: 'Exclusive promo codes, seasonal sales, and storewide discounts.',
      icon: Tag,
      color: 'text-amber-500 bg-amber-50',
    },
    {
      key: 'personalizedOffers' as const,
      label: 'Personalized Recommendations',
      desc: 'AI-curated product deals matching your shopping interests.',
      icon: Sparkles,
      color: 'text-purple-500 bg-purple-50',
    },
    {
      key: 'priceDrops' as const,
      label: 'Price Drop Alerts',
      desc: 'Instant notifications when items you browsed or saved drop in price.',
      icon: Zap,
      color: 'text-rose-500 bg-rose-50',
    },
    {
      key: 'wishlist' as const,
      label: 'Wishlist & In-Stock Updates',
      desc: 'Alerts when out-of-stock wishlist items become available.',
      icon: Heart,
      color: 'text-pink-500 bg-pink-50',
    },
    {
      key: 'cart' as const,
      label: 'Cart Reminders',
      desc: 'Reminders about items in your shopping bag before they sell out.',
      icon: ShoppingBag,
      color: 'text-blue-500 bg-blue-50',
    },
    {
      key: 'flashSales' as const,
      label: 'Flash Sales & Limited Deals',
      desc: 'High-urgency timed deals with deep discounts.',
      icon: Zap,
      color: 'text-indigo-500 bg-indigo-50',
    },
    {
      key: 'coupons' as const,
      label: 'Coupon & Reward Expiry',
      desc: 'Timely reminders before your reward vouchers or earned points expire.',
      icon: Gift,
      color: 'text-emerald-500 bg-emerald-50',
    },
    {
      key: 'newProducts' as const,
      label: 'New Product Launches',
      desc: 'Be the first to know when trending products and new arrivals drop.',
      icon: Bell,
      color: 'text-teal-500 bg-teal-50',
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="bg-white rounded-[2rem] p-6 max-w-lg w-full relative z-10 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-2xl">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 leading-tight">Notification Preferences</h3>
                  <p className="text-xs text-gray-500 font-medium">Choose what alerts you want to receive</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Essential notice */}
            <div className="my-3 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start gap-2.5 shrink-0">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 font-medium leading-relaxed">
                <strong className="font-bold">Important Order & Security Updates</strong> (tracking, delivery, payment confirmations) are always sent to ensure safe deliveries.
              </p>
            </div>

            {/* Scrollable preference list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin py-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isEnabled = prefs[cat.key];
                return (
                  <div
                    key={cat.key}
                    onClick={() => handleToggle(cat.key)}
                    className="p-3.5 bg-gray-50/80 hover:bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between gap-3 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${cat.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 leading-tight">{cat.label}</h4>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-snug">{cat.desc}</p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                        isEnabled ? 'bg-primary' : 'bg-gray-300'
                      }`}
                    >
                      <motion.div
                        layout
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer actions */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || loading}
                onClick={handleSave}
                className="px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Check className="w-4 h-4" /> Save Preferences
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

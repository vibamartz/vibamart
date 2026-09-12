import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Trash2, Tag, ShoppingBag, ShieldCheck, SlidersHorizontal, ArrowRight, Sparkles, Heart, Zap, CheckCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { useAuthStore } from '../../backend/store';
import { CustomerNotification, NotificationCategory } from '../../shared/types/notifications';
import { PushService } from '../../backend/services/pushService';
import PermissionPromptModal from '../../shared/components/PermissionPromptModal';
import CustomerNotificationPreferencesModal from '../../shared/components/CustomerNotificationPreferencesModal';
import toast from 'react-hot-toast';

export default function MobileNotificationsScreen() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'orders' | 'offers' | 'price_drops' | 'cart_wishlist'>('all');
  const [permissionStatus, setPermissionStatus] = useState<string>(() => {
    return PushService.getPermission();
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    PushService.registerDevice(user.uid);

    const q = query(
      collection(db, 'user_notifications'),
      where('userId', 'in', [user.uid, 'all']),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerNotification));
      setNotifications(docs);
    });
    return () => unsub();
  }, [user]);

  const handleRequestNotificationPermission = async () => {
    const res = await PushService.requestPermission();
    setPermissionStatus(res);
    if (res === 'granted') {
      toast.success('Notification permissions enabled!');
      if (user?.uid) PushService.registerDevice(user.uid);
    } else if (res === 'denied') {
      setShowPermissionModal(true);
    }
  };

  const handleNotificationClick = async (notif: CustomerNotification) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'user_notifications', notif.id), {
          read: true,
          clickedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Failed marking read:', err);
    }

    if (notif.destinationSlug) {
      navigate(notif.destinationSlug);
    } else if (notif.orderId) {
      navigate(`/track-order/${notif.orderId}`);
    } else if (notif.productId) {
      navigate(`/products/${notif.productId}`);
    } else if (notif.category === 'offers') {
      navigate('/offers');
    } else if (notif.category === 'coupons') {
      navigate('/rewards');
    } else if (notif.category === 'cart') {
      navigate('/cart');
    } else if (notif.category === 'wishlist') {
      navigate('/wishlist');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      for (const n of unread) {
        await updateDoc(doc(db, 'user_notifications', n.id), { read: true });
      }
      toast.success('All notifications marked as read');
    } catch (e) {
      toast.error('Failed to mark read');
    }
  };

  const handleClearRead = async () => {
    const readOnes = notifications.filter(n => n.read);
    if (readOnes.length === 0) return;
    try {
      for (const n of readOnes) {
        await deleteDoc(doc(db, 'user_notifications', n.id));
      }
      toast.success('Cleared read notifications');
    } catch (e) {
      toast.error('Failed to clear');
    }
  };

  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    if (activeCategory === 'orders') return notifications.filter(n => n.category === 'orders');
    if (activeCategory === 'offers') return notifications.filter(n => n.category === 'offers' || n.category === 'coupons' || n.category === 'flash_sales');
    if (activeCategory === 'price_drops') return notifications.filter(n => n.category === 'price_drops');
    if (activeCategory === 'cart_wishlist') return notifications.filter(n => n.category === 'cart' || n.category === 'wishlist');
    return notifications;
  }, [notifications, activeCategory]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-36 sm:pb-40 font-sans select-none p-3 space-y-3 text-left">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 font-bold mt-0.5">Stay updated with orders, deals & alerts</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowPreferencesModal(true)}
            className="p-2 text-gray-500 hover:text-gray-800 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-1 text-[10px] font-bold"
            title="Preferences"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Permission Warning Banner if disabled */}
      {permissionStatus !== 'granted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Push Alerts Disabled</p>
              <p className="text-[10px] text-gray-500 font-medium">Turn on alerts to get live order tracking.</p>
            </div>
          </div>
          <button
            onClick={handleRequestNotificationPermission}
            className="py-1.5 px-3 bg-primary text-white font-bold rounded-xl text-xs shrink-0 hover:bg-primary-hover shadow-sm"
          >
            Enable
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All' },
          { id: 'orders', label: '📦 Orders' },
          { id: 'offers', label: '🏷️ Deals & Offers' },
          { id: 'price_drops', label: '⚡ Price Drops' },
          { id: 'cart_wishlist', label: '🛒 Bag & Saved' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
              activeCategory === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-600 border border-yellow-100 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Actions Bar */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-gray-500">
          <span>{filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="text-primary hover:underline flex items-center gap-1 font-black">
                <CheckCheck className="w-3.5 h-3.5" /> Mark read
              </button>
            )}
            {notifications.some(n => n.read) && (
              <button onClick={handleClearRead} className="text-gray-400 hover:text-rose-600 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Clear read
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notification List */}
      <div className="space-y-2.5">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all cursor-pointer relative group ${
                notif.read
                  ? 'bg-white border-yellow-100'
                  : 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    notif.category === 'orders' ? 'bg-blue-100 text-blue-700' :
                    notif.category === 'price_drops' ? 'bg-rose-100 text-rose-700' :
                    notif.category === 'cart' ? 'bg-amber-100 text-amber-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {notif.category}
                  </span>
                  {!notif.read && <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse shrink-0" />}
                </div>
                <span className="text-[9px] text-gray-400 font-bold shrink-0">
                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-start gap-3 pt-0.5">
                {notif.image && (
                  <img src={notif.image} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-gray-100" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-extrabold text-gray-900 leading-snug">{notif.title}</h4>
                  <p className="text-gray-600 font-medium leading-relaxed mt-0.5 text-[11px]">{notif.message}</p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <span className="text-[10px] font-black text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  {notif.ctaText || 'View Details'} <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-3xl p-12 text-center border border-yellow-100 space-y-2">
            <Bell className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-xs font-bold text-gray-600">No notifications in this category</p>
            <p className="text-[10px] text-gray-400">Order updates and promotional offers will show up here.</p>
          </div>
        )}
      </div>

      <PermissionPromptModal
        isOpen={showPermissionModal}
        type="notifications"
        onClose={() => setShowPermissionModal(false)}
        onAllowAccess={handleRequestNotificationPermission}
      />

      <CustomerNotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </div>
  );
}

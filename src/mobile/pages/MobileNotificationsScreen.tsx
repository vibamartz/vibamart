import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Tag, ShoppingBag, ShieldCheck } from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { useAuthStore } from '../../backend/store';
import toast from 'react-hot-toast';

import PermissionPromptModal from '../../shared/components/PermissionPromptModal';

export default function MobileNotificationsScreen() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<string>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'granted';
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'user_notifications'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(docs);
    });
    return () => unsub();
  }, [user]);

  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setPermissionStatus(res);
        if (res === 'denied') {
          setShowPermissionModal(true);
        } else if (res === 'granted') {
          toast.success('Notification permissions enabled!');
        }
      } catch (err) {
        setShowPermissionModal(true);
      }
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'user_notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-36 sm:pb-40 font-sans select-none p-3 space-y-3">
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900">Notifications ({notifications.length})</h2>
        <Bell className="w-5 h-5 text-emerald-600" />
      </div>

      {permissionStatus !== 'granted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Notifications Disabled</p>
              <p className="text-[10px] text-gray-500 font-medium">Enable notifications to receive order status updates.</p>
            </div>
          </div>
          <button
            onClick={handleRequestNotificationPermission}
            className="py-2 px-3 bg-primary text-white font-bold rounded-xl text-xs shrink-0 hover:bg-primary-hover shadow-sm"
          >
            Allow Access
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`p-3.5 rounded-2xl border text-xs space-y-1 transition-all cursor-pointer ${
                notif.read ? 'bg-white border-yellow-100' : 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-gray-900">{notif.title || 'ViBa Mart Alert'}</span>
                <span className="text-[9px] text-gray-400 font-bold">{new Date(notif.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 font-medium">{notif.message}</p>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-yellow-100">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500">No new notifications.</p>
          </div>
        )}
      </div>

      <PermissionPromptModal
        isOpen={showPermissionModal}
        type="notifications"
        onClose={() => setShowPermissionModal(false)}
        onAllowAccess={handleRequestNotificationPermission}
      />
    </div>
  );
}

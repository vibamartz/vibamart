import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Package, Heart, MapPin, RefreshCcw, Bell, HelpCircle,
  LogOut, Shield, ChevronRight, Sparkles, Phone, Mail, Gift, Sliders,
  CheckCircle2, Clock, Edit2, ShieldCheck, Check, X, LayoutDashboard
} from 'lucide-react';
import { useAuthStore } from '../../backend/store';
import { auth, db, handleFirestoreError, OperationType } from '../../backend/firebase/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileProfileScreen() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(user?.displayName || '');
  const [editedPhone, setEditedPhone] = useState(user?.phone || '');
  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [showOverview, setShowOverview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEditedName(user.displayName || '');
    setEditedPhone(user.phone || '');

    const fetchOrdersCount = async () => {
      try {
        const q = query(collection(db, 'orders'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setOrdersCount(snap.size);
      } catch (err) {
        console.error("Error fetching user orders count:", err);
      }
    };

    fetchOrdersCount();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: editedName,
        phone: editedPhone
      });
      setUser({ ...user, displayName: editedName, phone: editedPhone });
      setIsEditingProfile(false);
      toast.success("Profile overview updated successfully");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      toast.success("Logged out successfully");
      navigate('/');
    } catch (err) {
      toast.error("Logout failed");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFF3EB] pb-24 font-sans select-none flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-4 text-blue-600 shadow-sm">
          <User className="w-10 h-10" />
        </div>
        <h2 className="text-lg font-black text-gray-900">Welcome to ViBa Mart</h2>
        <p className="text-xs text-gray-500 font-medium max-w-xs mt-1 mb-6">
          Sign in to access your orders, wishlist, saved addresses, and personal recommendations.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg"
        >
          Login / Sign Up
        </button>
      </div>
    );
  }

  const accountName = user.displayName || user.email.split('@')[0];
  const userPhoto = user.photoURL || 'https://via.placeholder.com/150';
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Recently Joined';

  interface MenuItem {
    title: string;
    icon: any;
    path?: string;
    badge: any;
    color: string;
    action?: () => void;
  }

  const menuItems: MenuItem[] = [
    { title: 'Account Overview', icon: User, badge: 'Profile', color: 'text-emerald-700 bg-emerald-50', action: () => setShowOverview(prev => !prev) },
    { title: 'ViBa Rewards', icon: Gift, path: '/rewards', badge: 'Bonus', color: 'text-amber-600 bg-amber-50' },
    { title: 'My Orders', icon: Package, path: '/orders', badge: ordersCount > 0 ? ordersCount : null, color: 'text-blue-600 bg-blue-50' },
    { title: 'My Wishlist', icon: Heart, path: '/wishlist', badge: user.wishlist?.length || null, color: 'text-rose-600 bg-rose-50' },
    { title: 'Saved Addresses', icon: MapPin, path: '/addresses', badge: user.addresses?.length || null, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Notifications', icon: Bell, path: '/notifications', badge: null, color: 'text-purple-600 bg-purple-50' },
    { title: 'Help & FAQ', icon: HelpCircle, path: '/faq', badge: null, color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <div className="min-h-0 bg-[#FFFDF5] pb-20 font-sans select-none p-3 space-y-3">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-yellow-500 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-full bg-white/20 p-1 backdrop-blur-md border-2 border-white/50 overflow-hidden shrink-0">
            <img src={userPhoto} alt={accountName} className="w-full h-full object-cover rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-black truncate">{accountName}</h2>
              <span className="text-[9px] font-black uppercase bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full">
                {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Verified'}
              </span>
            </div>
            <p className="text-xs text-emerald-100 font-medium truncate mt-0.5">{user.email}</p>
            {user.phone && <p className="text-[10px] text-emerald-200 font-bold">{user.phone}</p>}
          </div>
        </div>

        {(user.role === 'admin' || user.role === 'super_admin') && (
          <div className="mt-4 pt-3 border-t border-white/20 flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-100">Administrator System Dashboard</span>
            <button
              onClick={() => navigate('/admin')}
              className="px-3 py-1 bg-white text-emerald-900 rounded-xl text-xs font-black uppercase shadow-sm"
            >
              Open Admin
            </button>
          </div>
        )}
      </div>

      {/* Account Overview Section */}
      <AnimatePresence>
        {showOverview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl p-4 shadow-sm border border-yellow-100 space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Account Overview</h3>
                  <p className="text-[10px] text-gray-400 font-medium">Personal & Contact Info</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-gray-200 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {/* Account Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Email Address</span>
                  <span className="text-xs font-bold text-gray-900 truncate block">{user.email}</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                <User className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Full Name</span>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={editedName}
                      onChange={e => setEditedName(e.target.value)}
                      className="w-full text-xs font-bold text-gray-900 bg-white border border-emerald-300 rounded-lg px-2 py-1 outline-none mt-0.5"
                    />
                  ) : (
                    <span className="text-xs font-bold text-gray-900 truncate block">{user.displayName || 'Not provided'}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Phone Number</span>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={editedPhone}
                      onChange={e => setEditedPhone(e.target.value)}
                      className="w-full text-xs font-bold text-gray-900 bg-white border border-emerald-300 rounded-lg px-2 py-1 outline-none mt-0.5"
                    />
                  ) : (
                    <span className="text-xs font-bold text-gray-900 truncate block">{user.phone || 'Not provided'}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider block">Member Since</span>
                  <span className="text-xs font-bold text-gray-900 truncate block">{memberSince}</span>
                </div>
              </div>

              {isEditingProfile && (
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-emerald-700 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Navigation Grid */}
      <div className="bg-white rounded-3xl p-2 shadow-sm border border-yellow-100 divide-y divide-gray-100">
        {menuItems.map((item, idx) => (
          <motion.div
            key={idx}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (item.action) {
                item.action();
              } else if (item.path) {
                navigate(item.path);
              }
            }}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-yellow-50/50 rounded-2xl transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl ${item.color}`}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-extrabold text-gray-900">{item.title}</span>
            </div>

            <div className="flex items-center gap-2">
              {item.badge !== null && item.badge !== undefined && item.badge !== 0 && (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-900 text-[10px] font-black rounded-full">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Logout Trigger Card */}
      <div className="bg-white rounded-3xl p-2 shadow-sm border border-yellow-100">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          className="w-full p-3.5 flex items-center justify-between text-rose-600 rounded-2xl hover:bg-rose-50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider">Log Out of Account</span>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400" />
        </motion.button>
      </div>
    </div>
  );
}

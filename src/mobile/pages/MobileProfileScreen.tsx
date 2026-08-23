import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Package, Heart, MapPin, RefreshCcw, Bell, HelpCircle, 
  LogOut, Shield, ChevronRight, Sparkles, Phone, Mail, Gift 
} from 'lucide-react';
import { useAuthStore } from '../../backend/store';
import { auth } from '../../backend/firebase/firebase';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';

export default function MobileProfileScreen() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

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

  const menuItems = [
    { title: 'ViBa Rewards & Points', icon: Gift, path: '/rewards', badge: 'Bonus', color: 'text-amber-600 bg-amber-50' },
    { title: 'My Orders & Tracking', icon: Package, path: '/orders', badge: null, color: 'text-blue-600 bg-blue-50' },
    { title: 'My Wishlist', icon: Heart, path: '/wishlist', badge: user.wishlist?.length || null, color: 'text-rose-600 bg-rose-50' },
    { title: 'Saved Addresses', icon: MapPin, path: '/addresses', badge: user.addresses?.length || null, color: 'text-emerald-600 bg-emerald-50' },
    { title: 'Returns & Refund Requests', icon: RefreshCcw, path: '/requests', badge: null, color: 'text-amber-600 bg-amber-50' },
    { title: 'Notifications', icon: Bell, path: '/notifications', badge: null, color: 'text-purple-600 bg-purple-50' },
    { title: 'Help & FAQ', icon: HelpCircle, path: '/faq', badge: null, color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <div className="min-h-screen bg-[#FFFDF5] pb-28 font-sans select-none p-3 space-y-3">
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

      {/* Account Navigation Grid */}
      <div className="bg-white rounded-3xl p-2 shadow-sm border border-yellow-100 divide-y divide-gray-100">
        {menuItems.map((item, idx) => (
          <motion.div
            key={idx}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(item.path)}
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

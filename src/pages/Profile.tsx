import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Package, MapPin, Settings, Heart, Bell, 
  CreditCard, ChevronRight, LogOut, Edit2, CheckCircle2,
  Clock, ShieldCheck, Mail, Phone, Trash2, Plus, LayoutDashboard, Truck
} from 'lucide-react';
import { useAuthStore } from '../store';
import { db, auth } from '../lib/firebase';
import { 
  getAuth, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { 
  collection, query, where, getDocs, orderBy, 
  updateDoc, doc, onSnapshot, deleteDoc, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { Order, Address, UserProfile, WaitlistItem, Product } from '../types';
import { lookupZipcode } from '../services/zipcode';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { getProductUrl } from '../utils/product';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'addresses' | 'waitlist' | 'wishlist' | 'settings'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [waitlist, setWaitlist] = useState<(WaitlistItem & { product?: Product })[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedName, setEditedName] = useState(user?.displayName || '');
  const [editedPhone, setEditedPhone] = useState(user?.phone || '');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState<Address>({
    fullName: user?.displayName || '',
    phone: user?.phone || '',
    house: '',
    street: '',
    landmark: '',
    city: '',
    state: '',
    zip: '',
    country: 'India',
    label: 'Home'
  });
  const navigate = useNavigate();

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success('Password reset email sent to your inbox!');
    } catch (err) {
      toast.error('Failed to send reset email');
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!newAddress.fullName || !newAddress.phone || !newAddress.house || !newAddress.street || !newAddress.city || !newAddress.state || !newAddress.zip) {
      toast.error('Please fill all required address fields');
      return;
    }
    try {
      const userRef = doc(db, 'users', user.uid);
      let updatedAddresses = [...(user.addresses || [])];
      
      if (editingAddressIndex !== null) {
        updatedAddresses[editingAddressIndex] = newAddress;
      } else {
        updatedAddresses.push(newAddress);
      }

      await updateDoc(userRef, {
        addresses: updatedAddresses,
        // If it's the first address, also set it as default
        ...(!user.address ? { address: newAddress } : {})
      });

      setUser({ ...user, addresses: updatedAddresses, ...(!user.address ? { address: newAddress } : {}) });
      setShowAddressModal(false);
      setEditingAddressIndex(null);
      setNewAddress({
        fullName: user?.displayName || '',
        phone: user?.phone || '',
        house: '',
        street: '',
        landmark: '',
        city: '',
        state: '',
        zip: '',
        country: 'India',
        label: 'Home'
      });
      toast.success(editingAddressIndex !== null ? 'Address updated' : 'Address added');
    } catch (err) {
      toast.error('Failed to save address');
    }
  };

  const handleRemoveAddress = async (index: number) => {
    if (!user || !user.addresses) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedAddresses = user.addresses.filter((_, i) => i !== index);
      await updateDoc(userRef, {
        addresses: updatedAddresses
      });
      setUser({ ...user, addresses: updatedAddresses });
      toast.success('Address removed');
    } catch (err) {
      toast.error('Failed to remove address');
    }
  };

  const handleSetDefaultAddress = async (address: Address) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        address: address
      });
      setUser({ ...user, address: address });
      toast.success('Default address updated');
    } catch (err) {
      toast.error('Failed to set default address');
    }
  };

  useEffect(() => {
    // Read tab from query parameter
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['overview', 'orders', 'addresses', 'waitlist', 'wishlist', 'settings'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [window.location.search]);

  useEffect(() => {
    if (!user) return;

    // Fetch Orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    // Fetch Waitlist with product details
    const waitlistQuery = query(
      collection(db, 'waitlist'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubWaitlist = onSnapshot(waitlistQuery, async (snapshot) => {
      const waitlistData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WaitlistItem));
      
      const enrichedWaitlist = await Promise.all(waitlistData.map(async (item) => {
        const prodSnap = await getDocs(query(collection(db, 'products'), where('id', '==', item.productId)));
        const product = prodSnap.docs[0]?.data() as Product;
        return { ...item, product };
      }));
      
      setWaitlist(enrichedWaitlist);
    });

    // Fetch Wishlist products
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      const data = snapshot.data() as UserProfile;
      const validWishlist = data?.wishlist?.filter(id => id && String(id).trim() !== '') || [];
      if (validWishlist.length > 0) {
        const productsQuery = query(
          collection(db, 'products'),
          where('id', 'in', validWishlist)
        );
        const prodSnap = await getDocs(productsQuery);
        setWishlistProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      } else {
        setWishlistProducts([]);
      }
    });

    return () => {
      unsubOrders();
      unsubWaitlist();
      unsubProfile();
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <User className="w-16 h-16 text-gray-200" />
        <h2 className="text-xl font-bold text-gray-900">Please login to view your profile</h2>
        <Link to="/login" className="bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:bg-primary-hover shadow-xl shadow-primary/20">
          Sign In
        </Link>
      </div>
    );
  }

  const handleUpdateProfile = async () => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: editedName,
        phone: editedPhone
      });
      setUser({ ...user, displayName: editedName, phone: editedPhone });
      setIsEditingProfile(false);
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Failed to update profile');
    }
  };

  const handleRemoveFromWaitlist = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'waitlist', id));
      toast.success('Removed from waitlist');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  const handleLogout = async () => {
      await auth.signOut();
      navigate('/');
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'orders', label: 'My Orders', icon: Package },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'waitlist', label: 'Waitlist', icon: Bell },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pt-10 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
              <div className="flex flex-col items-center text-center relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 p-1 mb-4 relative group">
                  <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-black shadow-inner">
                    {user.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <button aria-label="Edit Profile Avatar" className="absolute bottom-0 right-0 p-3 bg-white rounded-full shadow-lg border border-gray-100 text-gray-400 hover:text-primary transition-colors touch-target min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">{user.displayName}</h3>
                <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-widest">{user.role}</p>
              </div>

              <div className="mt-8 space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full touch-target min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                      activeTab === item.id 
                      ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                    {activeTab === item.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
                <button 
                  onClick={handleLogout}
                  className="w-full touch-target min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all mt-4"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>

            <div className="bg-gray-900 rounded-3xl p-6 text-white overflow-hidden relative group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150" />
               <ShieldCheck className="w-8 h-8 text-blue-400 mb-4" />
               <p className="text-sm font-bold opacity-80 leading-relaxed">Your data is secured with ViBa Mart Vault protection.</p>
               <button className="mt-4 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:underline">Learn More</button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Account Overview</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage your public profile and verified information</p>
                      </div>
                      <button 
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="px-4 py-2 touch-target min-h-[44px] bg-gray-50 text-gray-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors border border-gray-100"
                      >
                        {isEditingProfile ? 'Cancel' : 'Edit Profile'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-primary/20 transition-colors group">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Mail className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</span>
                              <span className="text-sm font-bold text-gray-900">{user.email}</span>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />
                          </div>

                          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-primary/20 transition-colors group">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Phone className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col flex-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Phone Number</span>
                              {isEditingProfile ? (
                                <input 
                                  value={editedPhone} 
                                  onChange={e => setEditedPhone(e.target.value)}
                                  className="text-sm font-bold text-gray-900 bg-white border border-primary/20 rounded-lg px-2 py-1 outline-none mt-1"
                                />
                              ) : (
                                <span className="text-sm font-bold text-gray-900">{user.phone || 'Not provided'}</span>
                              )}
                            </div>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-primary/20 transition-colors group">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col flex-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Full Name</span>
                              {isEditingProfile ? (
                                <input 
                                  value={editedName} 
                                  onChange={e => setEditedName(e.target.value)}
                                  className="text-sm font-bold text-gray-900 bg-white border border-primary/20 rounded-lg px-2 py-1 outline-none mt-1"
                                />
                              ) : (
                                <span className="text-sm font-bold text-gray-900">{user.displayName}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-primary/20 transition-colors group">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Clock className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Member Since</span>
                              <span className="text-sm font-bold text-gray-900">{new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                            </div>
                          </div>
                       </div>
                    </div>

                    {isEditingProfile && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex justify-end">
                        <button 
                          onClick={handleUpdateProfile}
                          className="px-8 py-3 touch-target min-h-[44px] bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          Save Changes
                        </button>
                      </motion.div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Total Orders</span>
                       <span className="text-3xl font-black text-gray-900">{orders.length}</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Waitlisted</span>
                       <span className="text-3xl font-black text-blue-500">{waitlist.length}</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-2">Wishlist Items</span>
                       <span className="text-3xl font-black text-rose-500">{wishlistProducts.length}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'orders' && (
                <motion.div
                  key="orders"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-8">Purchase History</h2>
                    
                    {orders.length === 0 ? (
                      <div className="py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                          <Package className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-medium">You haven't placed any orders yet.</p>
                        <Link to="/products" className="text-primary font-black uppercase tracking-widest text-xs hover:underline">Start Shopping</Link>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {orders.map(order => (
                          <Link 
                            key={order.id} 
                            to={`/track-order/${order.id}`}
                            className="group block bg-gray-50/50 hover:bg-white rounded-3xl p-6 border border-transparent hover:border-primary/10 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5 active:scale-[0.99]"
                          >
                             <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Order ID</span>
                                 <span className="text-sm font-black text-gray-900 italic">#{order.id.slice(-8).toUpperCase()}</span>
                               </div>
                               <div className="flex gap-4">
                                 <div className="flex flex-col items-end">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Date</span>
                                   <span className="text-xs font-bold text-gray-600">{new Date(order.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                 </div>
                                 <div className="flex flex-col items-end">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Status</span>
                                   <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                                     order.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' :
                                     order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                     'bg-blue-100 text-blue-600'
                                   }`}>
                                     {order.status}
                                   </span>
                                 </div>
                               </div>
                             </div>

                             <div className="flex items-center gap-4 overflow-x-auto pb-4 hide-scrollbar">
                               {order.items.map((item, idx) => (
                                 <div key={idx} className="flex-shrink-0 w-16 h-16 rounded-2xl border border-gray-100 overflow-hidden relative bg-white group-hover:border-primary/20 transition-colors">
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    {item.quantity > 1 && (
                                      <span className="absolute bottom-1 right-1 bg-primary text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-lg">
                                        {item.quantity}
                                      </span>
                                    )}
                                 </div>
                               ))}
                             </div>

                             {order.trackingId && (
                               <div className="mb-6 p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="p-2 bg-white rounded-xl shadow-sm">
                                        <Truck className="w-4 h-4 text-purple-600" />
                                     </div>
                                     <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Tracking Information</p>
                                        <p className="text-xs font-black text-purple-700">{order.carrier}: {order.trackingId}</p>
                                     </div>
                                  </div>
                                  {order.estimatedDelivery && (
                                    <div className="text-right">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Est. Delivery</p>
                                       <p className="text-xs font-black text-purple-700">{new Date(order.estimatedDelivery).toLocaleDateString()}</p>
                                    </div>
                                  )}
                               </div>
                             )}

                             <div className="pt-6 border-t border-gray-100 flex justify-between items-center mt-2">
                               <div className="flex gap-8">
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Price</span>
                                    <span className="text-lg font-black text-gray-900 tracking-tight">₹{order.total.toLocaleString()}</span>
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payment</span>
                                    <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">{order.paymentMethod}</span>
                                 </div>
                               </div>
                                <div className="flex gap-2">
                                  <div className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-primary transition-all shadow-lg flex items-center gap-2">
                                    View Details <ChevronRight className="w-3 h-3" />
                                  </div>
                                </div>
                             </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'wishlist' && (
                <WishlistSection 
                  products={wishlistProducts} 
                  onRemove={async (pid) => {
                    if (!user) return;
                    try {
                      const userRef = doc(db, 'users', user.uid);
                      await updateDoc(userRef, {
                        wishlist: arrayRemove(pid)
                      });
                      toast.success('Removed from wishlist');
                    } catch (err) {
                      toast.error('Failed to remove');
                    }
                  }}
                />
              )}

              {activeTab === 'waitlist' && (
                <motion.div
                  key="waitlist"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <div className="mb-8">
                       <h2 className="text-2xl font-black text-gray-900 tracking-tight">Active Waitlist</h2>
                       <p className="text-sm text-gray-500 mt-1">We'll notify you the moment these items are back in stock!</p>
                    </div>

                    {waitlist.length === 0 ? (
                      <div className="py-20 text-center space-y-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                          <Bell className="w-10 h-10 text-gray-200" />
                        </div>
                        <p className="text-gray-400 font-medium">Your waitlist is empty.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {waitlist.map(item => (
                          <div key={item.id} className="group p-5 bg-gray-50 rounded-3xl border border-transparent hover:border-primary/20 transition-all flex gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-white p-1 border border-gray-100 overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                              {item.product?.images[0] && <img src={item.product.images[0]} className="w-full h-full object-contain" alt="" />}
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="text-sm font-black text-gray-900 line-clamp-1">{item.product?.name || 'Product'}</h4>
                                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Added on {new Date(item.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center justify-between mt-4">
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500">
                                   <Clock className="w-3 h-3" /> Pending Notification
                                </span>
                                <button 
                                  onClick={() => handleRemoveFromWaitlist(item.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'addresses' && (
                <motion.div
                  key="addresses"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                       <div>
                         <h2 className="text-2xl font-black text-gray-900 tracking-tight">My Addresses</h2>
                         <p className="text-sm text-gray-500 mt-1">Manage your shipping and billing addresses</p>
                       </div>
                       <button 
                         onClick={() => {
                           setEditingAddressIndex(null);
                           setNewAddress({
                             fullName: user?.displayName || '',
                             phone: user?.phone || '',
                             house: '',
                             street: '',
                             landmark: '',
                             city: '',
                             state: '',
                             zip: '',
                             country: 'India',
                             label: 'Home'
                           });
                           setShowAddressModal(true);
                         }}
                         className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                       >
                          <Plus className="w-5 h-5" />
                       </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {user.addresses && user.addresses.length > 0 ? (
                        user.addresses.map((addr, idx) => {
                          const isDefault = JSON.stringify(addr) === JSON.stringify(user.address);
                          return (
                            <div key={idx} className={`p-6 rounded-3xl border-2 transition-all relative group overflow-hidden ${
                              isDefault ? 'bg-gray-50 border-primary/20' : 'bg-white border-gray-100 hover:border-gray-200'
                            }`}>
                               <div className="absolute top-0 right-0 p-3 flex gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingAddressIndex(idx);
                                      setNewAddress(addr);
                                      setShowAddressModal(true);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-primary transition-colors border border-gray-50"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleRemoveAddress(idx)}
                                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                               </div>
                               <div className="flex items-center gap-3 mb-4">
                                 <div className={`p-2 rounded-xl ${isDefault ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                                   <MapPin className="w-5 h-5" />
                                 </div>
                                 <span className="text-xs font-black uppercase tracking-widest text-gray-900">
                                   {addr.label || (isDefault ? 'Default Address' : 'Saved Address')}
                                 </span>
                               </div>
                               <div className="space-y-1">
                                  <p className="text-sm font-black text-gray-900">{addr.fullName}</p>
                                  <p className="text-xs font-bold text-gray-500">{addr.phone}</p>
                                  <p className="text-sm text-gray-600 mt-2">{addr.house}, {addr.street}</p>
                                  {addr.landmark && <p className="text-xs text-gray-400">Landmark: {addr.landmark}</p>}
                                  <p className="text-sm text-gray-600">{addr.city}, {addr.state}, {addr.country} - {addr.zip}</p>
                               </div>
                               {!isDefault && (
                                 <button 
                                   onClick={() => handleSetDefaultAddress(addr)}
                                   className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                                 >
                                   Set as Default
                                 </button>
                               )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                           <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-4" />
                           <p className="text-gray-400 font-bold">Add your first shipping address</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-8">Account Settings</h2>
                    
                    <div className="space-y-6">
                      <div className="p-6 bg-gray-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:border-primary/20 border border-transparent transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                            <ShieldCheck className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-gray-900">Account Security</h4>
                            <p className="text-xs text-gray-500 mt-1">Manage your password and authentication</p>
                          </div>
                        </div>
                        <button 
                          onClick={handlePasswordReset}
                          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                        >
                          Reset Password
                        </button>
                      </div>

                      <div className="p-6 bg-gray-50 rounded-3xl flex items-center justify-between group hover:bg-white hover:border-primary/20 border border-transparent transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                            <Bell className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-gray-900">Notifications</h4>
                            <p className="text-xs text-gray-500 mt-1">Configure how you receive updates</p>
                          </div>
                        </div>
                        <button className="px-6 py-2.5 bg-white text-gray-900 border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
                          Manage
                        </button>
                      </div>

                      {user?.role === 'admin' && (
                        <div className="p-6 bg-primary/5 rounded-3xl flex items-center justify-between group hover:bg-white hover:border-primary/20 border border-transparent transition-all">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-2xl shadow-sm text-primary">
                              <LayoutDashboard className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-primary">Admin Access</h4>
                              <p className="text-xs text-gray-500 mt-1">Visit the administration dashboard</p>
                            </div>
                          </div>
                          <Link 
                            to="/admin"
                            className="px-6 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                          >
                            Go to Admin
                          </Link>
                        </div>
                      )}

                      <div className="p-8 bg-red-50 rounded-3xl mt-12">
                        <h4 className="text-sm font-black text-red-600 mb-2">Danger Zone</h4>
                        <p className="text-xs text-red-500/70 mb-6">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        <button className="px-8 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all">
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      <AddressModal 
        show={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        address={newAddress}
        setAddress={setNewAddress}
        onSave={handleSaveAddress}
        isEditing={editingAddressIndex !== null}
      />
    </div>
  );
}

function AddressModal({ 
  show, 
  onClose, 
  address, 
  setAddress, 
  onSave,
  isEditing
}: { 
  show: boolean; 
  onClose: () => void; 
  address: Address; 
  setAddress: (a: Address) => void;
  onSave: () => void;
  isEditing: boolean;
}) {
  const [zipLoading, setZipLoading] = useState(false);

  if (!show) return null;

  const handleZipcodeLookup = async (zipCode: string, countryVal: string) => {
    const cleanZip = zipCode.trim();
    if (!cleanZip || cleanZip.length < 5) return;
    setZipLoading(true);
    try {
      const info = await lookupZipcode(cleanZip, countryVal);
      setAddress({
        ...address,
        city: info.city,
        state: info.state,
        country: info.country
      });
      toast.success(`Zipcode detected: ${info.city}, ${info.state}, ${info.country}`);
    } catch (err: any) {
      toast.error(err.message || 'Invalid zipcode');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[40px] w-full max-w-lg p-8 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
          {isEditing ? 'Edit Address' : 'Add New Address'}
        </h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">Please provide your complete shipping details</p>

        <div className="space-y-4">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Address Label</label>
              <div className="flex gap-2 mb-2">
                {['Home', 'Work', 'Other'].map(lbl => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setAddress({ ...address, label: lbl })}
                    className={`px-4 py-2 touch-target min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                      (address.label || 'Home') === lbl 
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                        : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name *</label>
                <input 
                  value={address.fullName || ''}
                  onChange={e => setAddress({ ...address, fullName: e.target.value })}
                  placeholder="Full Name" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Phone Number *</label>
                <input 
                  value={address.phone || ''}
                  onChange={e => setAddress({ ...address, phone: e.target.value })}
                  placeholder="Phone Number" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">House / Apartment *</label>
                <input 
                  value={address.house || ''}
                  onChange={e => setAddress({ ...address, house: e.target.value })}
                  placeholder="Flat / House No. / Villa" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Street Address *</label>
                <input 
                  value={address.street || ''}
                  onChange={e => setAddress({ ...address, street: e.target.value })}
                  placeholder="Street / Area / Locality" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Zipcode *</label>
                <div className="relative">
                  <input 
                    value={address.zip || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setAddress({ ...address, zip: val });
                      if (/^\d{6}$/.test(val.trim()) || (/^\d{5}$/.test(val.trim()) && address.country.toLowerCase() === 'us')) {
                        handleZipcodeLookup(val, address.country);
                      }
                    }}
                    onBlur={() => handleZipcodeLookup(address.zip, address.country)}
                    placeholder="Zip / Pin code" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-4 pr-10 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                    required
                  />
                  {zipLoading && (
                    <div className="absolute right-3 top-3.5 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Country *</label>
                <input 
                  value={address.country || ''}
                  onChange={e => setAddress({ ...address, country: e.target.value })}
                  placeholder="Country" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Landmark</label>
                <input 
                  value={address.landmark || ''}
                  onChange={e => setAddress({ ...address, landmark: e.target.value })}
                  placeholder="e.g. Near Temple" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">City *</label>
                <input 
                  value={address.city || ''}
                  onChange={e => setAddress({ ...address, city: e.target.value })}
                  placeholder="City" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">State *</label>
                <input 
                  value={address.state || ''}
                  onChange={e => setAddress({ ...address, state: e.target.value })}
                  placeholder="State" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" 
                  required
                />
             </div>
           </div>
        </div>

        <div className="mt-8 flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 py-4 touch-target min-h-[44px] rounded-2xl font-black uppercase tracking-widest text-[10px] border border-gray-100 text-gray-400 hover:bg-gray-50 transition-all"
           >
             Cancel
           </button>
           <button 
             onClick={onSave}
             className="flex-2 py-4 touch-target min-h-[44px] bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
           >
             {isEditing ? 'Update Address' : 'Save Address'}
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function WishlistSection({ products, onRemove }: { products: Product[], onRemove: (id: string) => void }) {
  return (
    <motion.div key="wishlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">My Wishlist</h2>
          <p className="text-sm text-gray-500 mt-1">Items you've saved for later</p>
        </div>
        <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest">
          {products.length} Items
        </div>
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm flex gap-4 group hover:border-primary/20 transition-all">
              <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-50 flex-shrink-0">
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                  <h3 className="font-bold text-gray-900 truncate text-sm">{product.name}</h3>
                  <p className="text-lg font-black text-primary mt-1 tracking-tight">₹{product.discountPrice?.toLocaleString() || product.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={getProductUrl(product)} className="flex-1 bg-gray-50 touch-target min-h-[44px] text-gray-900 py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-wider hover:bg-gray-100 transition-colors flex items-center justify-center">
                    View Specs
                  </Link>
                  <button 
                    onClick={() => onRemove(product.id)}
                    className="p-3 touch-target min-h-[44px] min-w-[44px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] p-20 text-center border-2 border-dashed border-gray-100">
           <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
             <Heart className="w-10 h-10 text-gray-200" />
           </div>
           <h3 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h3>
           <p className="text-gray-500 mb-8 max-w-sm mx-auto">Found something amazing? Tap the heart icon to save it here!</p>
           <Link to="/products" className="bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all inline-block">
             Start Exploring
           </Link>
        </div>
      )}
    </motion.div>
  );
}

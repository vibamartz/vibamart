import React, { useState } from 'react';
import { useCartStore, useAuthStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { MapPin, CreditCard, ChevronRight, ShieldCheck, Truck, Smartphone, Building2, Globe, Save, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../backend/firebase/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { Order, OrderItem, Address } from '../../shared/types';
import axios from 'axios';
import { lookupZipcode } from '../../backend/services/zipcode';

import { processPayment } from '../../shared/utils/razorpay';

declare global {
  interface Window {
    Razorpay: any;
  }
}

async function generateUniqueOrderId(): Promise<string> {
  const prefix = "VBM";
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  
  let isUnique = false;
  let attempts = 0;
  let orderId = "";
  
  while (!isUnique && attempts < 100) {
    attempts++;
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    orderId = `${prefix}${dateStr}${randomDigits}`;
    
    const docRef = doc(db, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      isUnique = true;
    }
  }
  
  if (!isUnique) {
    throw new Error("Failed to generate a unique Order ID. Please try again.");
  }
  
  return orderId;
}

export default function Checkout() {
  const { items, total, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [address, setAddress] = useState<Address>({
    fullName: "",
    phone: "",
    house: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    country: "India",
    zip: "",
    label: "Home"
  });
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [saveAddress, setSaveAddress] = useState(false);
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(null);
  const [editAddressForm, setEditAddressForm] = useState<Address>({
    fullName: "",
    phone: "",
    house: "",
    street: "",
    landmark: "",
    city: "",
    state: "",
    country: "India",
    zip: "",
    label: "Home"
  });
  const [zipLoading, setZipLoading] = useState(false);

  const handleZipcodeLookup = async (zipCode: string, countryVal: string) => {
    const cleanZip = zipCode.trim().replace(/\D/g, '');
    if (!cleanZip || cleanZip.length !== 6) return;
    setZipLoading(true);
    try {
      const info = await lookupZipcode(cleanZip, countryVal);
      setEditAddressForm(prev => ({
        ...prev,
        street: info.area || info.city,
        city: info.city,
        state: info.state,
        country: info.country
      }));
      toast.success(`Pincode detected: ${info.city}, ${info.state}, ${info.country}`);
    } catch (err: any) {
      toast.error(err.message || 'Invalid pincode');
    } finally {
      setZipLoading(false);
    }
  };

  const [guestInfo, setGuestInfo] = useState({
    email: '',
    name: '',
    phone: ''
  });

  // Load default address from user profile or location store when available
  React.useEffect(() => {
    const storeSelected = useLocationStore.getState().selectedAddress;
    if (user) {
      if (!user.displayName || user.displayName.startsWith('User ') || !user.phone) {
        toast.error("Please complete your Name and Contact Number before placing an order.", { duration: 5000 });
        navigate('/profile?tab=overview&edit=true');
        return;
      }

      if (step === 1) {
        setStep(2);
      }
      if (storeSelected) {
        setAddress(storeSelected);
        setIsEditingAddress(false);
      } else if (user.addresses && user.addresses.length > 0) {
        setAddress(user.addresses[0]);
        setIsEditingAddress(false);
      } else if (user.address) {
        setAddress(user.address);
        setIsEditingAddress(false);
      } else {
        setAddress({
          fullName: user.displayName || "",
          phone: user.phone || "",
          house: "",
          street: "",
          landmark: "",
          city: "",
          state: "",
          country: "India",
          zip: "",
          label: "Home"
        });
        setIsEditingAddress(true);
      }
    } else if (storeSelected) {
      setAddress(storeSelected);
      setIsEditingAddress(false);
    } else {
      setIsEditingAddress(true);
    }
  }, [user]);

  const handleSaveFormAddress = async () => {
    if (!editAddressForm.fullName || editAddressForm.fullName.trim() === "") {
      toast.error("Full Name is required.");
      return;
    }
    if (!editAddressForm.phone || editAddressForm.phone.trim().length < 7) {
      toast.error("A valid Contact Number is required.");
      return;
    }
    if (!editAddressForm.house || !editAddressForm.street || !editAddressForm.city || !editAddressForm.state || !editAddressForm.zip) {
      toast.error("Please fill all required address fields");
      return;
    }

    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let updatedAddresses = [...(user.addresses || [])];

        if (editingAddressIndex !== null) {
          updatedAddresses[editingAddressIndex] = editAddressForm;
          toast.success("Address updated in your profile!");
        } else if (saveAddress) {
          updatedAddresses.push(editAddressForm);
          toast.success("Address saved to your profile!");
        }

        if (editingAddressIndex !== null || saveAddress) {
          await updateDoc(userRef, {
            addresses: updatedAddresses,
            ...(!user.address ? { address: editAddressForm } : {})
          });
        }
      }

      setAddress(editAddressForm);
      setIsEditingAddress(false);
      setEditingAddressIndex(null);
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address to profile");
    }
  };

  if (items.length === 0) return <Navigate to="/cart" />;

  const subtotal = total();
  const tax = items.reduce((sum, item) => {
    const isEnabled = item.product?.enableGst !== false && (item.product?.gst || 0) > 0;
    if (!isEnabled) return sum;
    const rate = item.product?.gst || 18;
    return sum + (item.product.price * item.quantity * (rate / 100));
  }, 0);
  const shipping = subtotal > 500 ? 0 : 50;
  const grandTotal = subtotal + tax + shipping;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    const toastId = toast.loading('Detecting your location...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};

            setEditAddressForm({
              fullName: editAddressForm.fullName || user?.displayName || '',
              phone: editAddressForm.phone || user?.phone || '',
              house: addr.house_number || '',
              street: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || data.display_name?.split(',')[0] || '',
              landmark: addr.suburb || '',
              city: addr.city || addr.town || addr.village || addr.county || '',
              state: addr.state || '',
              zip: addr.postcode || '',
              country: addr.country || 'India',
              label: 'Home'
            });
            toast.success('Location detected successfully!', { id: toastId });
          } else {
            setEditAddressForm(prev => ({
              ...prev,
              street: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
            }));
            toast.success('Location coordinates captured. Please fill in the details.', { id: toastId });
          }
        } catch (error) {
          try {
            const { latitude, longitude } = position.coords;
            setEditAddressForm(prev => ({
              ...prev,
              street: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
            }));
            toast.success('Location coordinates captured. Please fill in the details.', { id: toastId });
          } catch {
            toast.error('Could not retrieve location details. Please enter address manually.', { id: toastId });
          }
        }
      },
      (error) => {
        let message = 'Location access denied.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable. Please check your device settings.';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out. Please try again.';
            break;
        }
        toast.error(message, { id: toastId });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      }
    );
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async () => {
    // Validate stock for all cart items before proceeding
    const invalidItems = items.filter(item => {
      const p = item.product;
      const variant = item.variantId ? p?.variants?.find(v => v.id === item.variantId) : null;
      const stock = variant ? variant.stock : p?.stock;
      return !p || p.inStock === false || p.status === 'out_of_stock' || p.status === 'inactive' || stock === undefined || stock <= 0 || item.quantity > stock;
    });

    if (invalidItems.length > 0) {
      const validItems = items.filter(item => !invalidItems.includes(item));
      useCartStore.getState().setItems(validItems);
      toast.error("Some out-of-stock items were automatically removed from your cart.");
      return;
    }

    if (paymentMethod === 'razorpay' && !window.Razorpay) {
      const res = await loadRazorpay();
      if (!res) {
        toast.error('Razorpay SDK failed to load. Are you online?');
        return;
      }
    }

    setLoading(true);

    try {
      const orderItems: OrderItem[] = items.map(item => {
        const basePrice = item.product.discountPrice || item.product.price;
        const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
        const finalPrice = basePrice + (variant?.extraPrice || 0);

        const oi: OrderItem = {
          productId: item.productId,
          name: item.product.name,
          price: finalPrice,
          quantity: item.quantity,
          image: item.product.images?.[0] || "",
          gst: item.product.gst || 0,
          enableGst: item.product.enableGst !== false
        };

        if (item.variantId) {
          oi.variantId = item.variantId;
        }

        return oi;
      });

      const finalizeOrder = async (pMethod: string, pStatus: string) => {
        const orderAddress: Address = {
          fullName: address.fullName || user?.displayName || guestInfo.name || "",
          phone: address.phone || user?.phone || guestInfo.phone || "",
          house: address.house || "",
          street: address.street || "",
          landmark: address.landmark || "",
          city: address.city || "",
          state: address.state || "",
          country: address.country || "India",
          zip: address.zip || "",
          label: address.label || "Home"
        };

        const orderData: any = {
          customerId: user ? user.uid : 'guest',
          items: orderItems,
          total: grandTotal,
          status: "pending",
          paymentStatus: pStatus,
          paymentMethod: pMethod,
          address: orderAddress,
          createdAt: new Date().toISOString(),
          statusHistory: [
            {
              status: "pending",
              timestamp: new Date().toISOString(),
              message: "Order placed successfully",
              location: address.city || "Unknown"
            }
          ]
        };

        const contactEmail = user ? user.email : guestInfo.email;
        const contactName = user ? user.displayName : guestInfo.name;
        const contactPhone = user ? user.phone : guestInfo.phone;

        if (contactEmail) orderData.contactEmail = contactEmail;
        if (contactName) orderData.contactName = contactName;
        if (contactPhone) orderData.contactPhone = contactPhone;

        const uniqueId = await generateUniqueOrderId();
        orderData.customOrderId = uniqueId;
        await setDoc(doc(db, 'orders', uniqueId), orderData);

        if (user && address.street) {
          const isDuplicate = user.addresses?.some(
            a => a.street === address.street && a.house === address.house && a.city === address.city && a.zip === address.zip
          );
          if (!isDuplicate) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              addresses: arrayUnion(orderAddress),
              ...(!user.address ? { address: orderAddress } : {})
            });
          }
        }

        clearCart();
        toast.success('Order placed successfully!');
        navigate('/order-success', { state: { orderId: uniqueId } });
      };

      if (paymentMethod === 'cod') {
        await finalizeOrder('cod', 'pending');
      } else {
        const result = await processPayment({
          amount: grandTotal,
          currency: 'INR',
          name: 'ViBa Mart',
          description: 'Store Purchase Payment',
          prefill: {
            name: address.fullName || user?.displayName || guestInfo.name || '',
            email: user?.email || guestInfo.email || '',
            contact: address.phone || user?.phone || guestInfo.phone || '',
          }
        });

        if (result.success) {
          await finalizeOrder(result.method || 'razorpay', 'paid');
        } else {
          setLoading(false);
          if (result.error && result.error !== 'Payment cancelled by user') {
            toast.error(result.error);
          } else if (result.error === 'Payment cancelled by user') {
            toast.error('Payment cancelled');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to place order. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Checkout Steps */}
        <div className="flex-1 space-y-4">
          
          {/* STEP 1: LOGIN / ACCOUNT */}
          <CheckoutStep
            number={1}
            title="LOGIN / ACCOUNT"
            isActive={step === 1}
            isCompleted={step > 1 || !!user}
            summary={user ? `${user.displayName || 'User'} (${user.email})` : guestInfo.email ? `Guest (${guestInfo.email})` : ''}
            onClickHeader={() => setStep(1)}
          >
            {user ? (
              <div className="flex items-center justify-between bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary text-white font-black flex items-center justify-center text-lg">
                    {user.displayName?.[0] || user.email?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{user.displayName || 'User'}</h4>
                    <p className="text-xs text-gray-500 font-medium">{user.email}</p>
                    {user.phone && <p className="text-xs text-gray-400 font-bold mt-0.5">{user.phone}</p>}
                  </div>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-primary-hover transition-all"
                >
                  Continue to Delivery
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div>
                    <h4 className="font-bold text-gray-900">Have an account?</h4>
                    <p className="text-xs text-gray-500 mt-1">Sign in for a faster checkout experience and to track your orders.</p>
                  </div>
                  <Link
                    to="/login"
                    className="w-full sm:w-auto bg-gray-900 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center hover:bg-black transition-all"
                  >
                    Login / Sign Up
                  </Link>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-xs uppercase font-black text-gray-400"><span className="bg-white px-4">Or continue as guest</span></div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={guestInfo.email}
                      onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                      className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3.5 text-sm font-bold focus:border-primary outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3.5 text-sm font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase text-gray-400 tracking-wider mb-2">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 9876543210"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3.5 text-sm font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!guestInfo.email || !guestInfo.name || !guestInfo.phone) {
                        toast.error("Please fill all required guest info fields.");
                        return;
                      }
                      setStep(2);
                    }}
                    className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100 hover:bg-primary-hover transition-all"
                  >
                    Continue as Guest
                  </button>
                </div>
              </div>
            )}
          </CheckoutStep>

          {/* STEP 2: DELIVERY ADDRESS */}
          <CheckoutStep
            number={2}
            title="DELIVERY ADDRESS"
            isActive={step === 2}
            isCompleted={step > 2 && !!address.street}
            summary={address.street ? `${address.fullName}, ${address.house} ${address.street}, ${address.city} - ${address.zip}` : ''}
            onClickHeader={() => setStep(2)}
          >
            <div className="space-y-6">
              {/* List of Saved Addresses for logged in user */}
              {user && user.addresses && user.addresses.length > 0 && !isEditingAddress && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Saved Address</h4>
                    <button
                      onClick={() => {
                        setEditingAddressIndex(null);
                        setEditAddressForm({
                          fullName: user.displayName || "",
                          phone: user.phone || "",
                          house: "",
                          street: "",
                          landmark: "",
                          city: "",
                          state: "",
                          country: "India",
                          zip: "",
                          label: "Home"
                        });
                        setIsEditingAddress(true);
                      }}
                      className="text-xs font-bold text-primary hover:underline uppercase tracking-wider"
                    >
                      + Add New Address
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.addresses.map((addr, idx) => {
                      const isSelected = address.street === addr.street && address.house === addr.house && address.zip === addr.zip;
                      return (
                        <div
                          key={idx}
                          onClick={() => setAddress(addr)}
                          className={`p-5 rounded-2xl border-2 cursor-pointer transition-all relative ${
                            isSelected ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                              {addr.label || 'Home'}
                            </span>
                            {isSelected && (
                              <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">✓</div>
                            )}
                          </div>
                          <h5 className="font-bold text-gray-900 text-sm">{addr.fullName}</h5>
                          <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                            {addr.house}, {addr.street}, {addr.landmark ? `${addr.landmark}, ` : ''}{addr.city}, {addr.state} - {addr.zip}
                          </p>
                          <p className="text-xs font-bold text-gray-700 mt-2">Mobile: {addr.phone}</p>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddressIndex(idx);
                              setEditAddressForm(addr);
                              setIsEditingAddress(true);
                            }}
                            className="mt-3 text-[10px] font-bold text-primary hover:underline uppercase tracking-wider"
                          >
                            Edit Address
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Edit or Add Address Form */}
              {(isEditingAddress || !user || !user.addresses || user.addresses.length === 0) && (
                <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                      {editingAddressIndex !== null ? 'Edit Address' : 'Enter Delivery Address'}
                    </h4>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm transition-all hover:shadow"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Use Current Location
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.fullName}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, fullName: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Mobile Number *</label>
                      <input
                        type="tel"
                        required
                        value={editAddressForm.phone}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Flat, House No., Building *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.house}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, house: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Street Address, Colony *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.street}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Landmark (Optional)</label>
                      <input
                        type="text"
                        value={editAddressForm.landmark || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, landmark: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Pincode / Zipcode *</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="6-digit Pincode"
                          value={editAddressForm.zip}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setEditAddressForm({ ...editAddressForm, zip: val });
                            if (val.length === 6) {
                              handleZipcodeLookup(val, editAddressForm.country || 'India');
                            }
                          }}
                          className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none pr-8"
                        />
                        {zipLoading && (
                          <div className="absolute right-2.5 top-3 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">City / District *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.city}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, city: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">State *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.state}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, state: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-gray-400 tracking-wider mb-1">Country *</label>
                      <input
                        type="text"
                        required
                        value={editAddressForm.country}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, country: e.target.value })}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  {user && editingAddressIndex === null && (
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="saveAddress"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="saveAddress" className="text-xs font-bold text-gray-600 cursor-pointer">
                        Save this address to my profile for future checkouts
                      </label>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveFormAddress}
                      className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-hover transition-all"
                    >
                      Save & Use This Address
                    </button>
                    {user && user.addresses && user.addresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingAddress(false);
                          setEditingAddressIndex(null);
                        }}
                        className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-gray-50 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Proceed to Payment Button */}
              {address.street && !isEditingAddress && (
                <button
                  onClick={() => setStep(3)}
                  className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100 hover:bg-primary-hover transition-all"
                >
                  Deliver Here & Proceed to Payment
                </button>
              )}
            </div>
          </CheckoutStep>

          {/* STEP 3: PAYMENT METHOD */}
          <CheckoutStep
            number={3}
            title="PAYMENT OPTIONS"
            isActive={step === 3}
            isCompleted={false}
            onClickHeader={() => setStep(3)}
          >
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PaymentOption
                  icon={CreditCard}
                  label="Razorpay (UPI / Card / NetBanking)"
                  isActive={paymentMethod === 'razorpay'}
                  onClick={() => setPaymentMethod('razorpay')}
                />
                <PaymentOption
                  icon={Truck}
                  label="Cash on Delivery (COD)"
                  isActive={paymentMethod === 'cod'}
                  onClick={() => setPaymentMethod('cod')}
                />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl text-xs font-bold text-gray-500 mb-6">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <span>By placing your order, you agree to ViBa Mart's terms of use and privacy policy.</span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-lg shadow-2xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : `Confirm Order - ₹${grandTotal.toLocaleString()}`}
                </button>
              </div>
            </div>
          </CheckoutStep>
        </div>

        {/* Price Details */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 pb-4">Order Summary</h3>
            <div className="space-y-4 mb-6 border-b border-gray-100 pb-6">
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Price ({items.length} items)</span>
                <span className="text-gray-900">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Tax (GST)</span>
                <span className="text-gray-900">+₹{tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-500">
                <span>Shipping</span>
                <span className="text-primary">{shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
              </div>
            </div>
            <div className="flex justify-between text-lg font-black text-gray-900 mb-6">
              <span>Payable</span>
              <span>₹{grandTotal.toLocaleString()}</span>
            </div>
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <p className="text-[10px] font-black text-primary uppercase tracking-wider leading-relaxed">Safe and Secure Payments. 100% Authentic Products.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutStep({ number, title, isActive, isCompleted, summary, children, onClickHeader }: any) {
  return (
    <div className={`overflow-hidden transition-all duration-300 ${isActive ? 'bg-white shadow-xl rounded-2xl border border-gray-100' : isCompleted ? 'bg-white/80 rounded-xl border border-gray-100 hover:shadow-md' : 'bg-gray-50/50 grayscale opacity-60 rounded-xl'}`}>
      <div
        className={`px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between ${isActive ? 'bg-gray-900 text-white' : ''} ${isCompleted && onClickHeader ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
        onClick={isCompleted && onClickHeader ? onClickHeader : undefined}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isActive ? 'bg-primary text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {isCompleted ? '✓' : number}
          </div>
          <h3 className="font-black uppercase tracking-widest text-[10px] sm:text-xs">{title}</h3>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 hidden sm:inline">{summary}</span>
            {onClickHeader && <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Change</span>}
          </div>
        )}
      </div>
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 sm:p-8"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentOption({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-5 rounded-2xl border-2 flex items-center gap-5 cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}>
      <div className={`p-2 rounded-xl ${isActive ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={`font-black text-sm uppercase tracking-widest ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
      {isActive && <div className="ml-auto w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-blue-200"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
    </div>
  );
}

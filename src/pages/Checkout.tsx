import React, { useState } from 'react';
import { useCartStore, useAuthStore } from '../store';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { MapPin, CreditCard, ChevronRight, ShieldCheck, Truck, Smartphone, Building2, Globe, Save, Check } from 'lucide-react';

const UPI_APPS = [
  { id: 'bhim', name: 'BHIM UPI', icon: 'https://logo.clearbit.com/bhimupi.org.in' },
  { id: 'paytm', name: 'Paytm', icon: 'https://logo.clearbit.com/paytm.com' },
  { id: 'gpay', name: 'Google Pay', icon: 'https://logo.clearbit.com/pay.google.com' },
  { id: 'phonepe', name: 'PhonePe', icon: 'https://logo.clearbit.com/phonepe.com' },
  { id: 'navi', name: 'Navi', icon: 'https://logo.clearbit.com/navi.com' },
  { id: 'amazon', name: 'Amazon Pay', icon: 'https://logo.clearbit.com/amazon.in' },
  { id: 'bharatpe', name: 'BharatPe', icon: 'https://logo.clearbit.com/bharatpe.com' },
  { id: 'cred', name: 'CRED', icon: 'https://logo.clearbit.com/cred.club' },
  { id: 'mobikwik', name: 'Mobikwik', icon: 'https://logo.clearbit.com/mobikwik.com' },
  { id: 'whatsapp', name: 'WhatsApp Pay', icon: 'https://logo.clearbit.com/whatsapp.com' },
  { id: 'freecharge', name: 'Freecharge', icon: 'https://logo.clearbit.com/freecharge.in' },
];
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { Order, OrderItem, Address } from '../types';
import axios from 'axios';
import { lookupZipcode } from '../services/zipcode';

declare global {
  interface Window {
    Razorpay: any;
  }
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
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod' | 'upi_apps'>('razorpay');
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay');
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
    const cleanZip = zipCode.trim();
    if (!cleanZip || cleanZip.length < 5) return;
    setZipLoading(true);
    try {
      const info = await lookupZipcode(cleanZip, countryVal);
      setEditAddressForm(prev => ({
        ...prev,
        city: info.city,
        state: info.state,
        country: info.country
      }));
      toast.success(`Zipcode detected: ${info.city}, ${info.state}, ${info.country}`);
    } catch (err: any) {
      toast.error(err.message || 'Invalid zipcode');
    } finally {
      setZipLoading(false);
    }
  };

  const [guestInfo, setGuestInfo] = useState({
    email: '',
    name: '',
    phone: ''
  });

  // Load default address from user profile when available
  React.useEffect(() => {
    if (user) {
      // Auto-advance past login step for logged-in users
      if (step === 1) {
        setStep(2);
      }
      if (user.addresses && user.addresses.length > 0) {
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
        setIsEditingAddress(true); // default to edit form if no address
      }
    } else {
      setIsEditingAddress(true); // default to edit form for guests
    }
  }, [user]);

  const handleSaveFormAddress = async () => {
    if (!editAddressForm.fullName || !editAddressForm.phone || !editAddressForm.house || !editAddressForm.street || !editAddressForm.city || !editAddressForm.state || !editAddressForm.zip) {
      toast.error("Please fill all required address fields");
      return;
    }

    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let updatedAddresses = [...(user.addresses || [])];

        if (editingAddressIndex !== null) {
          // Editing existing address
          updatedAddresses[editingAddressIndex] = editAddressForm;
          toast.success("Address updated in your profile!");
        } else if (saveAddress) {
          // Adding new address and saveAddress is checked
          updatedAddresses.push(editAddressForm);
          toast.success("Address saved to your profile!");
        }

        // Write to Firestore if we updated addresses or saveAddress is checked
        if (editingAddressIndex !== null || saveAddress) {
          await updateDoc(userRef, {
            addresses: updatedAddresses,
            ...(!user.address ? { address: editAddressForm } : {})
          });
        }
      }

      // Update selected address state
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
  const tax = subtotal * 0.18;
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

          // Use OpenStreetMap Nominatim API for free reverse geocoding (no API key needed)
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
            // If the API call fails, still fill in coordinates as a fallback
            setEditAddressForm(prev => ({
              ...prev,
              street: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
            }));
            toast.success('Location coordinates captured. Please fill in the details.', { id: toastId });
          }
        } catch (error) {
          // Network error during reverse geocoding — still use raw coordinates
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
          image: item.product.images?.[0] || ""
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

        const docRef = await addDoc(collection(db, 'orders'), orderData);

        // Always save the order address to the user's profile for future checkouts
        if (user && address.street) {
          const isDuplicate = user.addresses?.some(
            a => a.street === address.street && a.house === address.house && a.city === address.city && a.zip === address.zip
          );
          if (!isDuplicate) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              addresses: arrayUnion(orderAddress),
              // Also set the primary address if not already set
              ...(!user.address ? { address: orderAddress } : {})
            });
          }
        }

        clearCart();
        toast.success('Order placed successfully!');
        navigate('/order-success', { state: { orderId: docRef.id } });
      };

      if (paymentMethod === 'cod') {
        await finalizeOrder('cod', 'pending');
      } else {
        // Razorpay flow
        const { data } = await axios.post('/api/payment/create-order', {
          amount: grandTotal,
          currency: 'INR'
        });

        if (!data.success) throw new Error(data.error || 'Order creation failed');

        const options = {
          key: data.key_id,
          amount: data.order.amount,
          currency: data.order.currency,
          name: "ViBa Mart",
          description: "Premium Shopping Experience",
          image: "/logo.png",
          order_id: data.order.id,
          handler: async function (response: any) {
            console.log("Razorpay Success:", response);
            await finalizeOrder('razorpay', 'paid');
          },
          prefill: {
            name: user?.displayName || guestInfo.name || undefined,
            email: user?.email || guestInfo.email || undefined,
            contact: user?.phone || guestInfo.phone || undefined,
            method: "upi"
          },
          config: {
            display: {
              blocks: {
                qr: {
                  name: "Show QR Code",
                  instruments: [
                    {
                      method: "upi",
                      flows: ["qr"]
                    }
                  ]
                },
                upi: {
                  name: "Pay via UPI ID / Apps",
                  instruments: [
                    {
                      method: "upi",
                      flows: ["collect", "intent"]
                    }
                  ]
                }
              },
              sequence: ["block.qr", "block.upi"],
              preferences: {
                show_default_blocks: true
              }
            }
          },
          theme: {
            color: "#16a34a" // primary green
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          console.error(response.error);
          toast.error(response.error.description || 'Payment failed. Please try again.');
          setLoading(false);
        });
        rzp.open();
      }
    } catch (error: any) {
      console.error("Payment Error:", error);
      const errorMessage = error.response?.data?.error || error.message || 'Payment initialization failed';
      toast.error(errorMessage);
    } finally {
      if (paymentMethod === 'cod') setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-6 sm:py-12 px-4">
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Checkout Steps */}
        <div className="flex-1 space-y-4 sm:space-y-6">
          {/* Step 1: Login Check / Guest Info */}
          <CheckoutStep
            number={1}
            title={user ? "Account Verified" : "Login or Continue as Guest"}
            isActive={step === 1}
            isCompleted={step > 1}
            summary={user ? user.email || user.phone : guestInfo.email || "Guest"}
          >
            {user ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-500">You are logged in as <span className="text-gray-900 font-bold">{user.displayName}</span></p>
                <button onClick={() => setStep(2)} className="bg-primary text-white px-8 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-blue-100">Continue Checkout</button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Express Checkout</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none focus:border-primary/30"
                      />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={guestInfo.email}
                        onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none focus:border-primary/30"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none focus:border-primary/30"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!guestInfo.email || !guestInfo.name) {
                          toast.error("Please fill name and email");
                          return;
                        }
                        setStep(2);
                      }}
                      className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-100"
                    >
                      Continue as Guest
                    </button>
                  </div>
                  <div className="border-l border-gray-100 pl-6 space-y-4 hidden md:block">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Already have an account?</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">Log in to your account for a faster checkout and to track your orders easily.</p>
                    <Link to="/login" className="inline-block text-primary font-black uppercase tracking-widest text-xs hover:underline mt-2">Login to Account</Link>
                  </div>
                </div>
              </div>
            )}
          </CheckoutStep>

          {/* Step 2: Delivery Address */}
          <CheckoutStep
            number={2}
            title="Delivery Address"
            isActive={step === 2}
            isCompleted={step > 2}
            summary={address.city ? `${address.city}, ${address.state}` : "No address selected"}
            onClickHeader={() => setStep(2)}
          >
            <div className="space-y-4">
              {isEditingAddress ? (
                // Elegant inline edit / add form
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-white rounded-2xl border-2 border-primary space-y-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {editingAddressIndex !== null ? "Edit Shipping Address" : "Add New Shipping Address"}
                    </h4>
                    <button
                      onClick={handleUseCurrentLocation}
                      className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Use My Location
                    </button>
                  </div>

                  <div className="space-y-2 mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Address Label</label>
                    <div className="flex gap-2">
                      {['Home', 'Work', 'Other'].map(lbl => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setEditAddressForm({ ...editAddressForm, label: lbl })}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${(editAddressForm.label || 'Home') === lbl
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                            : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'
                            }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={editAddressForm.fullName || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, fullName: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number *"
                        value={editAddressForm.phone || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="House / Apartment / Suite *"
                        value={editAddressForm.house || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, house: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Street / Area / Locality *"
                        value={editAddressForm.street || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, street: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Zipcode / Pincode *"
                          value={editAddressForm.zip || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditAddressForm({ ...editAddressForm, zip: val });
                            if (/^\d{6}$/.test(val.trim()) || (/^\d{5}$/.test(val.trim()) && editAddressForm.country.toLowerCase() === 'us')) {
                              handleZipcodeLookup(val, editAddressForm.country);
                            }
                          }}
                          onBlur={() => handleZipcodeLookup(editAddressForm.zip, editAddressForm.country)}
                          className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                          required
                        />
                        {zipLoading && (
                          <div className="absolute right-3 top-3.5 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Country *"
                        value={editAddressForm.country || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, country: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Landmark (Optional)"
                        value={editAddressForm.landmark || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, landmark: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="City *"
                        value={editAddressForm.city || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, city: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={editAddressForm.state || ''}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, state: e.target.value })}
                        className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                        required
                      />
                    </div>
                  </div>
                  {user && editingAddressIndex === null && (
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                      Save this address to my profile
                    </label>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveFormAddress}
                      className="flex-1 bg-primary text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px]"
                    >
                      {editingAddressIndex !== null ? "Update Address" : "Save Address"}
                    </button>
                    {(user?.addresses && user.addresses.length > 0) && (
                      <button
                        onClick={() => {
                          setIsEditingAddress(false);
                          setEditingAddressIndex(null);
                        }}
                        className="px-6 py-3 border-2 border-gray-100 text-gray-400 rounded-xl font-black uppercase tracking-widest text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                // Grid of Saved Address Cards
                <div className="space-y-4">
                  {user && user.addresses && user.addresses.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {user.addresses.map((addr, idx) => {
                        const isSelected = JSON.stringify(addr) === JSON.stringify(address);
                        return (
                          <div
                            key={idx}
                            onClick={() => setAddress(addr)}
                            className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all relative group flex flex-col justify-between ${isSelected
                              ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                              : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-sm'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-md tracking-widest uppercase">
                                  {addr.label || 'Home'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingAddressIndex(idx);
                                      setEditAddressForm(addr);
                                      setIsEditingAddress(true);
                                    }}
                                    className="text-[9px] font-black text-gray-400 hover:text-primary uppercase tracking-widest bg-gray-50 hover:bg-primary/10 p-1.5 rounded"
                                  >
                                    Edit
                                  </button>
                                  {isSelected && (
                                    <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white">
                                      <ShieldCheck className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="font-bold text-gray-900 text-xs mb-1">{addr.fullName || user.displayName}</p>
                              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                                {addr.house}, {addr.street}, {addr.landmark ? `Landmark: ${addr.landmark}, ` : ''}{addr.city}, <br /> {addr.state}, {addr.country} - {addr.zip}
                              </p>
                            </div>
                            <p className="text-xs font-bold text-gray-900 mt-2">{addr.phone || user.phone || ''}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add New Address dashed trigger */}
                  <button
                    onClick={() => {
                      setEditingAddressIndex(null);
                      setEditAddressForm({
                        fullName: user?.displayName || '',
                        phone: user?.phone || '',
                        house: '',
                        street: '',
                        landmark: '',
                        city: '',
                        state: '',
                        country: 'India',
                        zip: '',
                        label: 'Home'
                      });
                      setSaveAddress(true);
                      setIsEditingAddress(true);
                    }}
                    className="w-full border-2 border-dashed border-gray-200 p-5 rounded-2xl flex items-center justify-center gap-3 text-gray-400 hover:text-primary hover:border-primary transition-all group bg-white"
                  >
                    <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-blue-50">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="font-black uppercase tracking-widest text-[9px]">Add New Delivery Address</span>
                  </button>

                  {/* Proceed Deliver Here button */}
                  {address.street ? (
                    <button
                      onClick={() => setStep(3)}
                      className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/15 hover:scale-[1.01] transition-all"
                    >
                      Deliver Here & Continue
                    </button>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center text-xs font-bold text-amber-600">
                      Please add or select a delivery address to continue.
                    </div>
                  )}
                </div>
              )}
            </div>
          </CheckoutStep>

          {/* Step 3: Order Summary */}
          <CheckoutStep
            number={3}
            title="Order Summary"
            isActive={step === 3}
            isCompleted={step > 3}
            summary={`${items.length} Items`}
            onClickHeader={() => setStep(3)}
          >
            <div className="space-y-6">
              {items.map((item) => {
                const variant = item.variantId ? item.product.variants?.find(v => v.id === item.variantId) : null;
                const basePrice = item.product.discountPrice || item.product.price;
                const itemPrice = basePrice + (variant?.extraPrice || 0);
                return (
                  <div key={`${item.productId}-${item.variantId}`} className="flex gap-4 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <img src={item.product.images[0]} className="w-16 h-16 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.product.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        ₹{itemPrice.toLocaleString()} x {item.quantity}
                        {variant && <span className="ml-2 text-primary font-black">[{variant.name}]</span>}
                      </p>
                    </div>
                    <p className="text-sm font-black text-gray-900">₹{(itemPrice * item.quantity).toLocaleString()}</p>
                  </div>
                );
              })}
              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10">
                <p className="text-[10px] font-bold text-primary">Order confirmation will be sent to <span className="underline">{user?.email || guestInfo.email}</span></p>
                <button onClick={() => setStep(4)} className="bg-primary text-white px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/10 transition-all">Proceed</button>
              </div>
            </div>
          </CheckoutStep>

          {/* Step 4: Payment Option */}
          <CheckoutStep
            number={4}
            title="Payment Method"
            isActive={step === 4}
            isCompleted={step > 4}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  Secure Online Payment
                </h4>
                <div onClick={() => setPaymentMethod('razorpay')}>
                  <PaymentOption
                    icon={Smartphone}
                    label="UPI / QR Code & Online Payment (Razorpay)"
                    isActive={paymentMethod === 'razorpay'}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <Smartphone className="w-3 h-3" />
                  UPI
                </h4>
                <div onClick={() => setPaymentMethod('upi_apps')} className="cursor-pointer">
                  <PaymentOption
                    icon={Smartphone}
                    label="Select specific UPI App"
                    isActive={paymentMethod === 'upi_apps'}
                  />
                </div>

                <AnimatePresence>
                  {paymentMethod === 'upi_apps' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                        {UPI_APPS.map(app => (
                          <label
                            key={app.id}
                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${selectedUpiApp === app.id ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'}`}
                          >
                            <input
                              type="radio"
                              name="upi_app"
                              value={app.id}
                              checked={selectedUpiApp === app.id}
                              onChange={() => setSelectedUpiApp(app.id)}
                              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 focus:ring-primary focus:ring-2 cursor-pointer"
                            />
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-50 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                              <img src={app.icon} alt={app.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name)}&background=random&color=fff&rounded=true&bold=true`; }} />
                            </div>
                            <span className="text-sm font-bold text-gray-800">{app.name}</span>
                          </label>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Truck className="w-3 h-3" />
                  Alternative Options
                </h4>
                <div onClick={() => setPaymentMethod('cod')}>
                  <PaymentOption
                    icon={Truck}
                    label="Cash on Delivery"
                    isActive={paymentMethod === 'cod'}
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-100 pt-8">
              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-lg shadow-2xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Confirm Order - ₹${grandTotal.toLocaleString()}`}
              </button>
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

function PaymentOption({ icon: Icon, label, isActive }: any) {
  return (
    <div className={`p-5 rounded-2xl border-2 flex items-center gap-5 cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}>
      <div className={`p-2 rounded-xl ${isActive ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className={`font-black text-sm uppercase tracking-widest ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
      {isActive && <div className="ml-auto w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-blue-200"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
    </div>
  );
}

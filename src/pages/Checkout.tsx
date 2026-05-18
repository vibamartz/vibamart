import React, { useState } from 'react';
import { useCartStore, useAuthStore } from '../store';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { MapPin, CreditCard, ChevronRight, ShieldCheck, Truck, Smartphone, Building2, Globe, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { Order, OrderItem, Address } from '../types';
import axios from 'axios';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Checkout() {
  const { items, total, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(user ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [address, setAddress] = useState({
    street: "#123, 4th Cross, 2nd Main Road",
    city: "Bangalore",
    state: "Karnataka",
    zip: "560064",
    country: "India"
  });
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [saveAddress, setSaveAddress] = useState(false);
  const [guestInfo, setGuestInfo] = useState({
    email: '',
    name: '',
    phone: ''
  });

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

    const toastId = toast.loading('Synchronizing with satellite coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            const response = await geocoder.geocode({ location: { lat: latitude, lng: longitude } });
            
            if (response.results && response.results[0]) {
              const res = response.results[0];
              const addressComponents = res.address_components;
              
              const getComp = (type: string) => addressComponents.find(c => c.types.includes(type))?.long_name || '';
              
              setAddress({
                street: res.formatted_address.split(',')[0] || getComp('route'),
                city: getComp('locality') || getComp('administrative_area_level_2'),
                state: getComp('administrative_area_level_1'),
                zip: getComp('postal_code'),
                country: getComp('country') || 'India'
              });
              toast.success('Exact location synchronized!', { id: toastId });
              return;
            }
          }

          // Fallback if Google Maps not loaded or failed
          setAddress(prev => ({
            ...prev,
            street: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
            city: "Bangalore",
            state: "Karnataka",
            zip: "560001",
            country: "India"
          }));
          toast.success('Approximate location acquired', { id: toastId });
        } catch (error) {
          toast.error('Signal acquisition failed', { id: toastId });
        }
      },
      (error) => {
        toast.error(`Access Denied: ${error.message}`, { id: toastId });
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
        const orderData: any = {
          customerId: user ? user.uid : 'guest',
          items: orderItems,
          total: grandTotal,
          status: "pending",
          paymentStatus: pStatus, 
          paymentMethod: pMethod,
          address: {
            street: address.street || "",
            city: address.city || "",
            state: address.state || "",
            zip: address.zip || "",
            country: address.country || "India"
          },
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
        
        if (user && saveAddress) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
              addresses: arrayUnion({
                  street: address.street,
                  city: address.city,
                  state: address.state,
                  zip: address.zip,
                  country: address.country
              } as Address)
          });
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
            name: user?.displayName || guestInfo.name,
            email: user?.email || guestInfo.email,
            contact: user?.phone || guestInfo.phone
          },
          theme: {
            color: "#16a34a" // primary green
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
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
            summary={user ? user.email : guestInfo.email || "Guest"}
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
                            onChange={(e) => setGuestInfo({...guestInfo, name: e.target.value})}
                            className="w-full text-xs font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none focus:border-primary/30"
                          />
                          <input 
                            type="email" 
                            placeholder="Email Address" 
                            value={guestInfo.email}
                            onChange={(e) => setGuestInfo({...guestInfo, email: e.target.value})}
                            className="w-full text-xs font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none focus:border-primary/30"
                          />
                           <input 
                            type="tel" 
                            placeholder="Phone Number" 
                            value={guestInfo.phone}
                            onChange={(e) => setGuestInfo({...guestInfo, phone: e.target.value})}
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
            summary={`${address.city}, ${address.state}`}
          >
             <div className="space-y-4">
                {user && user.addresses && user.addresses.length > 0 && (
                  <div className="mb-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Or Select Saved Address</label>
                    <select 
                      className="w-full text-sm font-bold border-2 border-gray-100 p-4 rounded-xl focus:outline-none"
                      onChange={(e) => {
                        const addr = user.addresses![parseInt(e.target.value)];
                        setAddress(addr);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select address</option>
                      {user.addresses.map((addr, idx) => (
                        <option key={idx} value={idx}>{addr.street}, {addr.city}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isEditingAddress ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-white rounded-2xl border-2 border-primary space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Update Shipping Address</h4>
                       <button 
                         onClick={handleUseCurrentLocation}
                         className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                       >
                         <MapPin className="w-3 h-3" />
                         Use My Location
                       </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                       <input 
                         type="text" 
                         placeholder="Street Address / Area" 
                         value={address.street}
                         onChange={(e) => setAddress({...address, street: e.target.value})}
                         className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                       />
                       <div className="grid grid-cols-2 gap-3">
                         <input 
                           type="text" 
                           placeholder="City" 
                           value={address.city}
                           onChange={(e) => setAddress({...address, city: e.target.value})}
                           className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                         />
                         <input 
                           type="text" 
                           placeholder="State" 
                           value={address.state}
                           onChange={(e) => setAddress({...address, state: e.target.value})}
                           className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                         />
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                         <input 
                           type="text" 
                           placeholder="Pincode" 
                           value={address.zip}
                           onChange={(e) => setAddress({...address, zip: e.target.value})}
                           className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                         />
                         <input 
                           type="text" 
                           placeholder="Country" 
                           value={address.country}
                           onChange={(e) => setAddress({...address, country: e.target.value})}
                           className="w-full text-xs font-bold border-2 border-gray-100 p-3 rounded-xl focus:outline-none focus:border-primary/30"
                         />
                       </div>
                    </div>
                    {user && (
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                        Save this address for future
                      </label>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setIsEditingAddress(false)}
                        className="flex-1 bg-primary text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px]"
                      >
                        Save Address
                      </button>
                      <button 
                         onClick={() => setIsEditingAddress(false)}
                         className="px-6 py-3 border-2 border-gray-100 text-gray-400 rounded-xl font-black uppercase tracking-widest text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="border-2 border-primary bg-primary/5 p-6 rounded-2xl relative text-left">
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">Home</span>
                      <button onClick={() => setIsEditingAddress(true)} className="text-[10px] font-black text-primary uppercase tracking-widest">Edit</button>
                    </div>
                    <p className="font-black text-gray-900 mb-1">{user?.displayName || guestInfo.name}</p>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed max-w-xs">
                      {address.street}, {address.city}, <br/> {address.state} - {address.zip}
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-2">{user?.phone || guestInfo.phone || '+91 98765 43210'}</p>
                    <button onClick={() => setStep(3)} className="mt-6 w-full bg-primary text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/10">Deliver Here</button>
                  </div>
                )}
                
                {!isEditingAddress && (
                  <button onClick={() => setIsEditingAddress(true)} className="w-full border-2 border-dashed border-gray-200 p-6 rounded-2xl flex items-center justify-center gap-3 text-gray-400 hover:text-primary hover:border-primary transition-all group">
                    <div className="bg-gray-50 p-2 rounded-lg group-hover:bg-blue-50">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <span className="font-bold uppercase tracking-widest text-[10px]">Add New Delivery Address</span>
                  </button>
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
                      label="Online Payment (UPI, Card, NetBanking)" 
                      isActive={paymentMethod === 'razorpay'} 
                    />
                  </div>
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

function CheckoutStep({ number, title, isActive, isCompleted, summary, children }: any) {
  return (
    <div className={`overflow-hidden transition-all duration-300 ${isActive ? 'bg-white shadow-xl rounded-2xl border border-gray-100' : 'bg-gray-50/50 grayscale opacity-60 rounded-xl'}`}>
       <div className={`px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between ${isActive ? 'bg-gray-900 text-white' : ''}`}>
          <div className="flex items-center gap-3 sm:gap-4">
             <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isActive ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
               {number}
             </div>
             <h3 className="font-black uppercase tracking-widest text-[10px] sm:text-xs">{title}</h3>
          </div>
          {isCompleted && <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 hidden sm:inline">{summary}</span>}
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

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Phone, CreditCard, Banknote, ShieldCheck, CheckCircle2, 
  ArrowRight, Plus, Check, Edit2, AlertCircle, ShoppingBag 
} from 'lucide-react';
import { collection, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { Address, Order } from '../../shared/types';
import { useCartStore, useAuthStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { processPayment } from '../../shared/utils/razorpay';

export default function MobileCheckoutScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, total, clearCart } = useCartStore();
  const { savedAddresses, selectedAddress: activeStoreAddress, addSavedAddress } = useLocationStore();

  const [addresses, setAddresses] = useState<Address[]>(savedAddresses.length > 0 ? savedAddresses : (user?.addresses || []));
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number>(0);
  const [contactPhone, setContactPhone] = useState<string>(user?.phone || user?.address?.phone || '');
  const [contactName, setContactName] = useState<string>(user?.displayName || '');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay' | 'upi' | 'wallet'>('cod');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Add address modal state
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newFullName, setNewFullName] = useState(user?.displayName || '');
  const [newPhone, setNewPhone] = useState(user?.phone || '');
  const [newHouse, setNewHouse] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newCountry, setNewCountry] = useState('India');
  const [newZip, setNewZip] = useState('');

  const cartTotal = total();
  const deliveryCharge = cartTotal > 500 || items.length === 0 ? 0 : 40;
  const grandTotal = cartTotal + deliveryCharge;

  useEffect(() => {
    if (savedAddresses.length > 0) {
      setAddresses(savedAddresses);
    } else if (user?.addresses && user.addresses.length > 0) {
      setAddresses(user.addresses);
    } else if (user?.address) {
      setAddresses([user.address]);
    }
  }, [savedAddresses, user]);

  const selectedAddress = addresses[selectedAddressIndex] || activeStoreAddress || user?.address || {
    fullName: contactName || user?.displayName || 'Customer',
    phone: contactPhone || user?.phone || '',
    house: '',
    street: '',
    city: '',
    state: '',
    country: 'India',
    zip: ''
  };

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newPhone || !newHouse || !newStreet || !newZip) {
      toast.error("Please fill in all address details");
      return;
    }

    const addr: Address = {
      id: Date.now().toString(),
      fullName: newFullName,
      phone: newPhone,
      house: newHouse,
      street: newStreet,
      city: newCity,
      state: newState,
      country: newCountry,
      zip: newZip,
      label: 'Home'
    };

    const updatedAddresses = [...addresses, addr];
    setAddresses(updatedAddresses);
    setSelectedAddressIndex(updatedAddresses.length - 1);
    setShowAddressModal(false);

    // Save to user profile if logged in
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { addresses: updatedAddresses }, { merge: true });
        toast.success("New address saved!");
      } catch (err) {
        console.error("Failed to save address:", err);
      }
    }
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!contactPhone || contactPhone.length < 10) {
      toast.error("Please provide a valid phone number");
      return;
    }

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

    setIsPlacingOrder(true);

    let payResult: any = { success: true, method: paymentMethod, paymentId: '' };

    if (paymentMethod !== 'cod') {
      payResult = await processPayment({
        amount: grandTotal,
        currency: 'INR',
        name: 'ViBa Mart Mobile',
        description: 'Mobile Order Checkout',
        prefill: {
          name: selectedAddress.fullName || contactName || user?.displayName || '',
          email: user?.email || '',
          contact: contactPhone || selectedAddress.phone || user?.phone || ''
        }
      });

      if (!payResult.success) {
        setIsPlacingOrder(false);
        if (payResult.error && payResult.error !== 'Payment cancelled by user') {
          toast.error(payResult.error);
        } else if (payResult.error === 'Payment cancelled by user') {
          toast.error('Payment cancelled');
        }
        return;
      }
    }

    const customId = `VBM${Date.now().toString().slice(-6)}`;

    const newOrder: Omit<Order, 'id'> = {
      customOrderId: customId,
      customerId: user?.uid || 'guest_' + Date.now(),
      contactEmail: user?.email || 'guest@vibamart.com',
      contactName: selectedAddress.fullName || contactName || 'Guest User',
      contactPhone: contactPhone || selectedAddress.phone,
      items: items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.product.name,
        price: i.product.discountPrice || i.product.price,
        quantity: i.quantity,
        image: i.product.images?.[0] || '',
        gst: i.product.gst || 0,
        enableGst: i.product.enableGst !== false
      })),
      total: grandTotal,
      status: 'pending',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      paymentMethod,
      paymentReference: payResult.paymentId || undefined,
      address: selectedAddress,
      createdAt: new Date().toISOString(),
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date().toISOString(),
          message: 'Order placed successfully'
        }
      ]
    };

    try {
      const docRef = await addDoc(collection(db, 'orders'), newOrder);
      clearCart();
      toast.success("Order placed successfully!", { icon: '🎉' });
      navigate('/order-success', { state: { orderId: docRef.id, customId, order: { id: docRef.id, ...newOrder } } });
    } catch (err) {
      console.error("Failed to place order:", err);
      toast.error("Failed to place order. Please try again.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-32 font-sans select-none p-3 space-y-3">
      {/* Checkout Title Header */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-yellow-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-gray-900">Checkout & Payment</h2>
          <p className="text-[10px] text-gray-500 font-bold">Fast & Encrypted Delivery</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-emerald-600" />
      </div>

      {/* Step 1: Delivery Address & Phone */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 uppercase tracking-wider">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Delivery Address</span>
          </div>
          <button
            onClick={() => setShowAddressModal(true)}
            className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add New
          </button>
        </div>

        {addresses.length > 0 ? (
          <div className="space-y-2">
            {addresses.map((addr, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedAddressIndex(idx)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between ${
                  selectedAddressIndex === idx
                    ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900">{addr.fullName}</span>
                    <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                      {addr.label || 'Home'}
                    </span>
                  </div>
                  <p className="text-gray-700 font-medium">{addr.house}, {addr.street}</p>
                  <p className="text-gray-500 font-medium">{addr.city}, {addr.state} - {addr.zip}</p>
                  <p className="text-gray-600 font-bold">Phone: {addr.phone}</p>
                </div>
                {selectedAddressIndex === idx && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 space-y-2">
            <p className="text-xs text-gray-500 font-bold">No saved addresses found.</p>
            <button
              onClick={() => setShowAddressModal(true)}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase"
            >
              Add Delivery Address
            </button>
          </div>
        )}

        {/* Contact Phone Field */}
        <div className="pt-2 border-t border-gray-100 space-y-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-600" /> Contact Phone Number
          </label>
          <input
            type="tel"
            maxLength={10}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="10-digit mobile number"
            className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Step 2: Payment Method Selector */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          <span>Select Payment Option</span>
        </div>

        <div className="space-y-2">
          {[
            { id: 'cod', title: 'Cash on Delivery (COD)', sub: 'Pay cash upon delivery', icon: Banknote, tag: 'Popular' },
            { id: 'upi', title: 'UPI Payment', sub: 'GPay, PhonePe, Paytm, BHIM', icon: CreditCard, tag: 'Instant' },
            { id: 'razorpay', title: 'Credit / Debit Card / NetBanking', sub: 'Razorpay Secure Checkout', icon: CreditCard, tag: 'Secure' },
          ].map((pm) => (
            <div
              key={pm.id}
              onClick={() => setPaymentMethod(pm.id as any)}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                paymentMethod === pm.id
                  ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${paymentMethod === pm.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  <pm.icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-gray-900">{pm.title}</span>
                    <span className="text-[8px] font-black uppercase bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                      {pm.tag}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium">{pm.sub}</p>
                </div>
              </div>

              {paymentMethod === pm.id && (
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: Order Items Summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">
          Order Items ({items.length})
        </h3>
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.productId} className="py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <img 
                  src={item.product.images?.[0] || 'https://via.placeholder.com/40'} 
                  alt={item.product.name} 
                  className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" 
                />
                <span className="font-bold text-gray-900 truncate max-w-[170px]">{item.product.name}</span>
                <span className="text-gray-400 font-semibold">x{item.quantity}</span>
              </div>
              <span className="font-extrabold text-gray-900">
                ₹{((item.product.discountPrice || item.product.price) * item.quantity).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 4: Final Price Breakdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 space-y-2 text-xs">
        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-1.5">
          Payment Breakdown
        </h3>
        <div className="flex justify-between text-gray-600">
          <span>Items Total</span>
          <span className="font-bold text-gray-900">₹{cartTotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Delivery Charge</span>
          {deliveryCharge === 0 ? (
            <span className="font-black text-emerald-600 uppercase">FREE</span>
          ) : (
            <span className="font-bold text-gray-900">₹{deliveryCharge}</span>
          )}
        </div>
        <div className="pt-2 border-t border-gray-100 flex justify-between items-baseline text-sm font-black">
          <span className="text-gray-900">Total Amount Payable</span>
          <span className="text-emerald-700">₹{grandTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Fixed Sticky Place Order Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-yellow-100 p-3 shadow-lg flex items-center justify-between max-w-md mx-auto">
        <div>
          <span className="text-[10px] font-black uppercase text-gray-400">Total Payable</span>
          <p className="text-base font-black text-gray-900">₹{grandTotal.toLocaleString()}</p>
        </div>

        <button
          disabled={isPlacingOrder}
          onClick={handlePlaceOrder}
          className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-2 disabled:opacity-50 active:scale-95"
        >
          {isPlacingOrder ? 'Placing Order...' : 'Place Order Now'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Add Address Modal */}
      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.form
              onSubmit={handleSaveNewAddress}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3"
            >
              <h3 className="text-base font-black text-gray-900">Add Delivery Address</h3>
              
              <input
                type="text"
                placeholder="Full Name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <input
                type="tel"
                maxLength={10}
                placeholder="Phone Number"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <input
                type="text"
                placeholder="Flat / House No. / Building"
                value={newHouse}
                onChange={(e) => setNewHouse(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <input
                type="text"
                placeholder="Street / Area / Colony"
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <input
                  type="text"
                  placeholder="PIN Code"
                  maxLength={6}
                  value={newZip}
                  onChange={(e) => setNewZip(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase"
                >
                  Save Address
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

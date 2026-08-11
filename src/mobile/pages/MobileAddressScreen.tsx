import React, { useState } from 'react';
import { MapPin, Plus, CheckCircle2, Trash2, Home as HomeIcon, Building } from 'lucide-react';
import { Address } from '../../shared/types';
import { useAuthStore } from '../../backend/store';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileAddressScreen() {
  const { user } = useAuthStore();
  const [addresses, setAddresses] = useState<Address[]>(user?.addresses || []);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Address Form
  const [fullName, setFullName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('Bangalore');
  const [state, setState] = useState('Karnataka');
  const [country, setCountry] = useState('India');
  const [zip, setZip] = useState('560064');

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !house || !street || !zip) {
      toast.error("Fill in all address details");
      return;
    }

    const newAddr: Address = {
      id: Date.now().toString(),
      fullName, phone, house, street, city, state, country, zip, label: 'Home'
    };

    const updated = [...addresses, newAddr];
    setAddresses(updated);
    setShowAddModal(false);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { addresses: updated }, { merge: true });
        toast.success("Saved address!");
      } catch (err) {
        console.error("Save error:", err);
      }
    }
  };

  const handleDeleteAddress = async (id?: string) => {
    const updated = addresses.filter(a => a.id !== id);
    setAddresses(updated);
    if (user) {
      await setDoc(doc(db, 'users', user.uid), { addresses: updated }, { merge: true });
      toast.success("Address deleted");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none p-3 space-y-3">
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-orange-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900">Saved Addresses ({addresses.length})</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Address
        </button>
      </div>

      <div className="space-y-3">
        {addresses.length > 0 ? (
          addresses.map((addr, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-1 relative">
              <div className="flex items-center justify-between">
                <span className="font-black text-xs text-gray-900">{addr.fullName}</span>
                <button onClick={() => handleDeleteAddress(addr.id)} className="text-gray-300 hover:text-rose-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-700 font-medium">{addr.house}, {addr.street}</p>
              <p className="text-xs text-gray-500 font-medium">{addr.city}, {addr.state} - {addr.zip}</p>
              <p className="text-xs text-emerald-700 font-bold">Phone: {addr.phone}</p>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-orange-100">
            <p className="text-xs font-bold text-gray-500">No saved addresses found.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.form
              onSubmit={handleSaveAddress}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3"
            >
              <h3 className="text-base font-black text-gray-900">Add New Address</h3>
              <input type="text" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
              <input type="tel" maxLength={10} placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
              <input type="text" placeholder="Flat / House No." value={house} onChange={(e) => setHouse(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
              <input type="text" placeholder="Street / Area" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
                <input type="text" placeholder="PIN Code" maxLength={6} value={zip} onChange={(e) => setZip(e.target.value)} className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold uppercase">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase">Save</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

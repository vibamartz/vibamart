import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Edit2, Star, Check, Home as HomeIcon, Building, Briefcase } from 'lucide-react';
import { Address } from '../../shared/types';
import { useAuthStore } from '../../backend/store';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileAddressScreen() {
  const { user } = useAuthStore();
  const { 
    savedAddresses, 
    selectedAddress, 
    selectAddress, 
    addSavedAddress, 
    updateSavedAddress, 
    deleteSavedAddress, 
    setDefaultAddress 
  } = useLocationStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // New/Edit Address Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [house, setHouse] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [zip, setZip] = useState('');
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [isDefault, setIsDefault] = useState(false);

  const openAddModal = () => {
    setEditingAddress(null);
    setFullName(user?.displayName || '');
    setPhone(user?.phone || '');
    setHouse('');
    setStreet('');
    setCity('');
    setState('');
    setCountry('India');
    setZip('');
    setLabel('Home');
    setIsDefault(savedAddresses.length === 0);
    setShowAddModal(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setFullName(addr.fullName || user?.displayName || '');
    setPhone(addr.phone || user?.phone || '');
    setHouse(addr.house || '');
    setStreet(addr.street || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setCountry(addr.country || 'India');
    setZip(addr.zip || '');
    setLabel((addr.label as any) || 'Home');
    setIsDefault(!!addr.isDefault);
    setShowAddModal(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !house.trim() || !street.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      toast.error("Please fill in all address details");
      return;
    }

    const payload: Address = {
      id: editingAddress?.id || `addr-${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      house: house.trim(),
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      zip: zip.trim(),
      label,
      isDefault
    };

    if (editingAddress) {
      await updateSavedAddress(editingAddress.id || 0, payload);
    } else {
      await addSavedAddress(payload);
    }

    setShowAddModal(false);
  };

  return (
    <div className="min-h-screen bg-[#FFF3EB] pb-28 font-sans select-none p-3 space-y-3">
      <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-yellow-100 flex items-center justify-between">
        <h2 className="text-sm font-black text-gray-900">My Saved Addresses ({savedAddresses.length})</h2>
        <button
          onClick={openAddModal}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Add Address
        </button>
      </div>

      <div className="space-y-3">
        {savedAddresses.length > 0 ? (
          savedAddresses.map((addr, idx) => {
            const isSelected = selectedAddress?.id === addr.id || (selectedAddress?.house === addr.house && selectedAddress?.zip === addr.zip);
            return (
              <div 
                key={addr.id || idx} 
                onClick={() => selectAddress(addr)}
                className={`bg-white rounded-2xl p-4 shadow-xs border space-y-2 relative transition-all cursor-pointer ${
                  isSelected ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-yellow-100 hover:border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase rounded-full border border-emerald-200">
                      {addr.label || 'Home'}
                    </span>
                    {addr.isDefault && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-black uppercase rounded-full border border-amber-200">
                        Default
                      </span>
                    )}
                    <span className="font-black text-xs text-gray-900">{addr.fullName}</span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!addr.isDefault && (
                      <button 
                        onClick={() => setDefaultAddress(addr.id || idx)}
                        className="text-gray-300 hover:text-amber-500 p-1"
                        title="Set Default"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => openEditModal(addr)}
                      className="text-gray-300 hover:text-emerald-600 p-1"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteSavedAddress(addr.id || idx)}
                      className="text-gray-300 hover:text-rose-500 p-1"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-700 font-medium">{addr.house}, {addr.street}</p>
                <p className="text-xs text-gray-500 font-medium">{addr.city}, {addr.state}, {addr.country} - <span className="font-bold text-gray-900">{addr.zip}</span></p>
                <p className="text-xs text-emerald-700 font-bold">📞 {addr.phone}</p>

                {isSelected && (
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-black pt-1">
                    <Check className="w-4 h-4 stroke-[3]" /> Selected Delivery Address
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-yellow-100 space-y-2">
            <p className="text-xs font-bold text-gray-500">No saved addresses found.</p>
            <p className="text-[11px] text-gray-400">Save an address to use across Mobile and Desktop.</p>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              + Add Address
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.form
              onSubmit={handleSaveAddress}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-base font-black text-gray-900">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h3>
              
              <input 
                type="text" 
                required 
                placeholder="Full Name *" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
              />
              <input 
                type="tel" 
                required 
                maxLength={10} 
                placeholder="Phone Number *" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
              />
              <input 
                type="text" 
                required 
                placeholder="Flat / House No. *" 
                value={house} 
                onChange={(e) => setHouse(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
              />
              <input 
                type="text" 
                required 
                placeholder="Street / Area *" 
                value={street} 
                onChange={(e) => setStreet(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  required 
                  placeholder="City *" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
                />
                <input 
                  type="text" 
                  required 
                  placeholder="State *" 
                  value={state} 
                  onChange={(e) => setState(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" 
                  required 
                  placeholder="Country *" 
                  value={country} 
                  onChange={(e) => setCountry(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
                />
                <input 
                  type="text" 
                  required 
                  maxLength={6} 
                  placeholder="PIN Code *" 
                  value={zip} 
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-semibold focus:border-emerald-600 outline-none" 
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                        label === lbl ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isDefault} 
                    onChange={(e) => setIsDefault(e.target.checked)} 
                    className="rounded text-emerald-600"
                  />
                  <span className="text-[11px] font-bold text-gray-700">Default</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
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

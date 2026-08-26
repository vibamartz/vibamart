import React, { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { 
  X, Navigation, Check, MapPin, Plus, Trash2, Edit2, 
  Home as HomeIcon, Building, Briefcase, Star, ChevronRight, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import GoogleMapsLoader from './GoogleMapsLoader';
import { Address } from '../../shared/types';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import { useAuthStore } from '../../backend/store';
import { reverseGeocodeCoords, GeocodedAddress } from '../../shared/utilities/reverseGeocode';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect?: (pincode: string, address: string, fullAddrObj?: Address) => void;
}

function LocationPickerContent({ onClose, onLocationSelect }: { 
  onClose: () => void; 
  onLocationSelect?: (pincode: string, address: string, fullAddrObj?: Address) => void 
}) {
  const { user } = useAuthStore();
  const { 
    selectedAddress: activeStoreAddress, 
    savedAddresses, 
    selectAddress, 
    addSavedAddress, 
    updateSavedAddress, 
    deleteSavedAddress, 
    setDefaultAddress 
  } = useLocationStore();

  const [activeTab, setActiveTab] = useState<'map' | 'saved'>('map');
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodedData, setGeocodedData] = useState<GeocodedAddress | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Add / Edit Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formName, setFormName] = useState(user?.displayName || '');
  const [formPhone, setFormPhone] = useState(user?.phone || '');
  const [formHouse, setFormHouse] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('India');
  const [formZip, setFormZip] = useState('');
  const [formLabel, setFormLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');

  const doReverseGeocode = useCallback(async (pos: google.maps.LatLngLiteral) => {
    setIsGeocoding(true);
    try {
      const result = await reverseGeocodeCoords(pos, geocodingLib);
      setGeocodedData(result);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  }, [geocodingLib]);

  const handleDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMarkerPosition(pos);
      await doReverseGeocode(pos);
    }
  }, [doReverseGeocode]);

  const useCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setMarkerPosition(pos);
        map?.panTo(pos);
        map?.setZoom(17);
        await doReverseGeocode(pos);
      },
      (error) => {
        setIsGeocoding(false);
        if (error.code === 1) {
          toast.error('Location permission denied. Please allow location access or select on map.');
        } else if (error.code === 2) {
          toast.error('GPS position unavailable. Try moving pin on map.');
        } else {
          toast.error('Location detection timed out.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [map, doReverseGeocode]);

  useEffect(() => {
    if (!markerPosition) {
      useCurrentLocation();
    }
  }, []);

  const handleConfirmGPSLocation = async () => {
    if (!geocodedData) {
      toast.error('Location details not detected yet.');
      return;
    }

    const newAddrObj: Address = {
      id: `gps-${Date.now()}`,
      fullName: user?.displayName || 'Customer',
      phone: user?.phone || '',
      house: geocodedData.house || 'GPS Location',
      street: geocodedData.street || geocodedData.fullAddress,
      city: geocodedData.city || 'City',
      state: geocodedData.state || 'State',
      country: geocodedData.country || 'India',
      zip: geocodedData.zip || '000000',
      label: 'Home',
      lat: geocodedData.lat,
      lng: geocodedData.lng
    };

    await selectAddress(newAddrObj);
    onLocationSelect?.(newAddrObj.zip, newAddrObj.street || geocodedData.fullAddress, newAddrObj);
    onClose();
  };

  const openFormWithGeocode = () => {
    setEditingAddress(null);
    setFormName(user?.displayName || '');
    setFormPhone(user?.phone || '');
    setFormHouse(geocodedData?.house || '');
    setFormStreet(geocodedData?.street || geocodedData?.fullAddress || '');
    setFormCity(geocodedData?.city || '');
    setFormState(geocodedData?.state || '');
    setFormCountry(geocodedData?.country || 'India');
    setFormZip(geocodedData?.zip || '');
    setFormLabel('Home');
    setFormIsDefault(savedAddresses.length === 0);
    setShowAddressForm(true);
  };

  const openFormForEdit = (addr: Address) => {
    setEditingAddress(addr);
    setFormName(addr.fullName || user?.displayName || '');
    setFormPhone(addr.phone || user?.phone || '');
    setFormHouse(addr.house || '');
    setFormStreet(addr.street || '');
    setFormCity(addr.city || '');
    setFormState(addr.state || '');
    setFormCountry(addr.country || 'India');
    setFormZip(addr.zip || '');
    setFormLabel((addr.label as any) || 'Home');
    setFormIsDefault(!!addr.isDefault);
    setShowAddressForm(true);
  };

  const handleSaveFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!formPhone.trim() || formPhone.trim().length < 7) {
      toast.error('Valid Phone Number is required');
      return;
    }
    if (!formHouse.trim() || !formStreet.trim() || !formCity.trim() || !formState.trim() || !formZip.trim()) {
      toast.error('Please fill in all address fields');
      return;
    }

    const payload: Address = {
      id: editingAddress?.id || `addr-${Date.now()}`,
      fullName: formName.trim(),
      phone: formPhone.trim(),
      house: formHouse.trim(),
      street: formStreet.trim(),
      city: formCity.trim(),
      state: formState.trim(),
      country: formCountry.trim(),
      zip: formZip.trim(),
      label: formLabel,
      isDefault: formIsDefault,
      lat: editingAddress?.lat || markerPosition?.lat,
      lng: editingAddress?.lng || markerPosition?.lng
    };

    if (editingAddress) {
      await updateSavedAddress(editingAddress.id || 0, payload);
    } else {
      await addSavedAddress(payload);
    }

    setShowAddressForm(false);
    onLocationSelect?.(payload.zip, `${payload.house}, ${payload.street}`, payload);
    onClose();
  };

  const handleSelectSaved = async (addr: Address) => {
    await selectAddress(addr);
    onLocationSelect?.(addr.zip, `${addr.house}, ${addr.street}`, addr);
    onClose();
  };

  return (
    <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] max-h-[660px] md:h-[620px]">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-all border border-gray-100"
      >
        <X className="w-5 h-5 text-gray-900" />
      </button>

      {/* Main Interactive Content */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header Tabs */}
        <div className="flex items-center gap-2 p-4 bg-gray-50 border-b border-gray-100 z-10">
          <button
            onClick={() => { setActiveTab('map'); setShowAddressForm(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'map' && !showAddressForm
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Use GPS Location
          </button>
          
          <button
            onClick={() => { setActiveTab('saved'); setShowAddressForm(false); }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeTab === 'saved' && !showAddressForm
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <HomeIcon className="w-3.5 h-3.5" /> Saved Addresses ({savedAddresses.length})
          </button>
        </div>

        {/* Tab 1: Map View */}
        {activeTab === 'map' && !showAddressForm && (
          <div className="flex-1 relative min-h-[300px]">
            <Map
              defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
              defaultZoom={5}
              mapId="DEMO_MAP_ID"
              onClick={handleDragEnd}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy'
              }}
            >
              {markerPosition && (
                <AdvancedMarker
                  position={markerPosition}
                  draggable={true}
                  onDragEnd={handleDragEnd}
                >
                  <div className="relative">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-500/20 rounded-full animate-ping" />
                    <MapPin className="w-10 h-10 text-emerald-600 fill-white stroke-[2.5px]" />
                  </div>
                </AdvancedMarker>
              )}
            </Map>

            <button 
              onClick={useCurrentLocation}
              aria-label="Locate me"
              className="absolute bottom-6 right-6 p-3.5 bg-white rounded-2xl shadow-xl hover:bg-gray-50 transition-all group border border-gray-200 z-10 flex items-center gap-2"
            >
              <Navigation className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-800 hidden sm:inline">Recenter GPS</span>
            </button>
          </div>
        )}

        {/* Tab 2: Saved Addresses View */}
        {activeTab === 'saved' && !showAddressForm && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Select Delivery Address</h3>
              <button
                onClick={() => {
                  setEditingAddress(null);
                  setFormName(user?.displayName || '');
                  setFormPhone(user?.phone || '');
                  setFormHouse('');
                  setFormStreet('');
                  setFormCity('');
                  setFormState('');
                  setFormCountry('India');
                  setFormZip('');
                  setFormLabel('Home');
                  setFormIsDefault(savedAddresses.length === 0);
                  setShowAddressForm(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:bg-emerald-700 transition-all"
              >
                <Plus className="w-4 h-4" /> Add Address
              </button>
            </div>

            {savedAddresses.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {savedAddresses.map((addr, idx) => {
                  const isSelected = activeStoreAddress?.id === addr.id || (activeStoreAddress?.house === addr.house && activeStoreAddress?.zip === addr.zip);
                  return (
                    <div 
                      key={addr.id || idx}
                      onClick={() => handleSelectSaved(addr)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white relative flex flex-col justify-between space-y-2 ${
                        isSelected 
                          ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-md' 
                          : 'border-gray-200 hover:border-emerald-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase rounded-full">
                            {addr.label || 'Home'}
                          </span>
                          {addr.isDefault && (
                            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase rounded-full">
                              Default
                            </span>
                          )}
                          <span className="font-bold text-sm text-gray-900">{addr.fullName}</span>
                        </div>

                        <div className="flex items-center gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                          {!addr.isDefault && (
                            <button
                              onClick={() => setDefaultAddress(addr.id || idx)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-100 transition-all"
                              title="Set as Default"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openFormForEdit(addr)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-gray-100 transition-all"
                            title="Edit Address"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteSavedAddress(addr.id || idx)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-100 transition-all"
                            title="Delete Address"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-700 font-semibold leading-relaxed">
                        {addr.house}, {addr.street}{addr.landmark ? `, ${addr.landmark}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {addr.city}, {addr.state}, {addr.country} - <span className="font-bold text-gray-800">{addr.zip}</span>
                      </p>
                      <p className="text-xs text-emerald-700 font-bold">
                        📞 {addr.phone}
                      </p>

                      {isSelected && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 text-emerald-600 text-xs font-black">
                          <Check className="w-4 h-4 stroke-[3]" /> Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300 space-y-3">
                <p className="text-sm font-bold text-gray-600">No saved addresses found.</p>
                <p className="text-xs text-gray-400">Save your addresses for faster checkout and delivery.</p>
                <button
                  onClick={() => {
                    setEditingAddress(null);
                    setShowAddressForm(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm"
                >
                  + Add Your First Address
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add / Edit Address Form View */}
        {showAddressForm && (
          <div className="flex-1 p-6 overflow-y-auto bg-white z-20">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-base font-black text-gray-900">
                {editingAddress ? 'Edit Saved Address' : 'Add New Address'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddressForm(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase"
              >
                Back
              </button>
            </div>

            <form onSubmit={handleSaveFormSubmit} className="space-y-3 max-w-lg mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Customer Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Full Name" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Phone Number *</label>
                  <input 
                    type="tel" 
                    required
                    maxLength={10} 
                    placeholder="Phone Number" 
                    value={formPhone} 
                    onChange={(e) => setFormPhone(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Flat / House No. / Building *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Flat 302, Green Apartments" 
                  value={formHouse} 
                  onChange={(e) => setFormHouse(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Street / Area / Landmark *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 5th Cross, Koramangala" 
                  value={formStreet} 
                  onChange={(e) => setFormStreet(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">City *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="City" 
                    value={formCity} 
                    onChange={(e) => setFormCity(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">State *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="State" 
                    value={formState} 
                    onChange={(e) => setFormState(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">Country *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Country" 
                    value={formCountry} 
                    onChange={(e) => setFormCountry(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1">PIN / ZIP Code *</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6} 
                    placeholder="6-digit PIN code" 
                    value={formZip} 
                    onChange={(e) => setFormZip(e.target.value.replace(/\D/g, ''))} 
                    className="w-full bg-gray-50 border border-gray-200 h-10 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 outline-none" 
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setFormLabel(lbl)}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                        formLabel === lbl 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formIsDefault} 
                    onChange={(e) => setFormIsDefault(e.target.checked)} 
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-gray-700">Set as Default</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddressForm(false)} 
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-emerald-700 transition-all"
                >
                  Save & Select Address
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Sidebar Info Section (for Map view) */}
      {activeTab === 'map' && !showAddressForm && (
        <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col justify-between bg-gray-50/50">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Detected Location</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Address</p>
                <p className="text-xs font-bold text-gray-900 leading-relaxed min-h-[3.5rem] bg-white p-3 rounded-2xl border border-gray-200">
                  {isGeocoding ? (
                    <span className="flex items-center gap-2 text-emerald-600 font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" /> Detecting location details...
                    </span>
                  ) : geocodedData?.fullAddress ? (
                    geocodedData.fullAddress
                  ) : (
                    'Click on the map or move the pin to detect location'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">City</p>
                  <p className="text-xs font-extrabold text-gray-900 truncate">{geocodedData?.city || '-'}</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">State</p>
                  <p className="text-xs font-extrabold text-gray-900 truncate">{geocodedData?.state || '-'}</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Country</p>
                  <p className="text-xs font-extrabold text-gray-900 truncate">{geocodedData?.country || 'India'}</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-gray-200">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Pincode/ZIP</p>
                  <p className="text-xs font-black text-emerald-600 truncate">{geocodedData?.zip || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-6">
            <button 
              disabled={isGeocoding || !geocodedData}
              onClick={handleConfirmGPSLocation}
              className="w-full bg-emerald-600 disabled:bg-gray-300 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              Confirm & Deliver Here
              <Check className="w-4 h-4" />
            </button>

            <button
              disabled={isGeocoding || !geocodedData}
              onClick={openFormWithGeocode}
              className="w-full bg-white text-gray-800 border border-gray-200 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" /> Save as New Address
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LocationPickerModal({ isOpen, onClose, onLocationSelect }: LocationPickerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl z-10"
          >
            <GoogleMapsLoader>
              <LocationPickerContent onClose={onClose} onLocationSelect={onLocationSelect} />
            </GoogleMapsLoader>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

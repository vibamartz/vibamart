import React, { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { 
  X, Navigation, Check, MapPin, Plus, Trash2, Edit2, 
  Home as HomeIcon, Building, Briefcase, Star, Search, Loader2, ArrowLeft, Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import GoogleMapsLoader from './GoogleMapsLoader';
import { Address } from '../../shared/types';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import { useAuthStore } from '../../backend/store';
import { reverseGeocodeCoords, GeocodedAddress } from '../../shared/utilities/reverseGeocode';
import { lookupZipcode } from '../../backend/services/zipcode';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodedData, setGeocodedData] = useState<GeocodedAddress | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsDetectedAddress, setGpsDetectedAddress] = useState<Address | null>(null);

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
  const [isFormPincodeLoading, setIsFormPincodeLoading] = useState(false);
  const [pincodeError, setPincodeError] = useState('');

  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');

  const doReverseGeocode = useCallback(async (pos: google.maps.LatLngLiteral) => {
    setIsGeocoding(true);
    try {
      const result = await reverseGeocodeCoords(pos, geocodingLib);
      setGeocodedData(result);
      if (result) {
        const detectedObj: Address = {
          id: `gps-${Date.now()}`,
          fullName: user?.displayName || 'Customer',
          phone: user?.phone || '',
          house: result.house || '',
          street: result.street || result.fullAddress || '',
          city: result.city || '',
          state: result.state || '',
          country: result.country || 'India',
          zip: result.zip || '',
          label: 'Home',
          lat: result.lat,
          lng: result.lng
        };
        setGpsDetectedAddress(detectedObj);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
    }
  }, [geocodingLib, user]);

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
        toast.success('Location detected successfully!');
      },
      (error) => {
        setIsGeocoding(false);
        if (error.code === 1) {
          toast.error('Location permission denied. Please allow location access in your browser settings.');
        } else if (error.code === 2) {
          toast.error('GPS position unavailable. Please try searching or entering address manually.');
        } else {
          toast.error('Location detection timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [map, doReverseGeocode]);

  const handleConfirmGPSLocation = async () => {
    if (!geocodedData || !gpsDetectedAddress) {
      toast.error('Location details not detected yet.');
      return;
    }

    await selectAddress(gpsDetectedAddress);
    onLocationSelect?.(gpsDetectedAddress.zip, gpsDetectedAddress.street || geocodedData.fullAddress, gpsDetectedAddress);
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
    setPincodeError('');
    setShowAddressForm(true);
  };

  const handleZipcodeAutoLookup = async (pin: string, country: string) => {
    const cleanPin = pin.trim().replace(/\D/g, '');
    if (cleanPin.length !== 6) return;

    setIsFormPincodeLoading(true);
    setPincodeError('');
    try {
      const info = await lookupZipcode(cleanPin, country);
      setFormCity(info.city);
      setFormState(info.state);
      setFormCountry(info.country || country);
      if (info.area) {
        setFormStreet(prev => prev || info.area || '');
      }
      toast.success(`Location found: ${info.area || info.city}, ${info.state}`);
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        setPincodeError('Unable to fetch address. Please try again.');
      } else {
        setPincodeError('Invalid pincode');
      }
    } finally {
      setIsFormPincodeLoading(false);
    }
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
      toast.error('Please fill in all required address fields');
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

  // Filter saved addresses based on top search query
  const filteredAddresses = savedAddresses.filter(addr => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (addr.fullName || '').toLowerCase().includes(q) ||
      (addr.house || '').toLowerCase().includes(q) ||
      (addr.street || '').toLowerCase().includes(q) ||
      (addr.city || '').toLowerCase().includes(q) ||
      (addr.state || '').toLowerCase().includes(q) ||
      (addr.zip || '').toLowerCase().includes(q) ||
      (addr.phone || '').toLowerCase().includes(q) ||
      (addr.label || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[640px] border border-gray-100">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          {showAddressForm || showMap ? (
            <button
              onClick={() => { setShowAddressForm(false); setShowMap(false); }}
              className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors mr-1"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </div>
          )}
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
              {showAddressForm
                ? (editingAddress ? 'Edit Address' : 'Add New Address')
                : showMap
                ? 'Confirm Location on Map'
                : 'Select Delivery Address'}
            </h2>
            <p className="text-[11px] text-gray-500 font-semibold">
              {showAddressForm
                ? 'Enter customer details and shipping location'
                : showMap
                ? 'Drag pin to your exact delivery location'
                : 'Choose or add your preferred delivery destination'}
            </p>
          </div>
        </div>

        <button 
          onClick={onClose}
          aria-label="Close"
          className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-all shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/50">

        {/* VIEW 1: Main Address Selection */}
        {!showAddressForm && !showMap && (
          <div className="p-4 sm:p-6 space-y-5">
            
            {/* 1. SEARCH FIELD */}
            <div className="relative w-full">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Search className="w-4 h-4 text-emerald-600" />
              </div>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, area, street or pincode"
                className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-9 py-3 text-xs sm:text-sm font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. LOCATION OPTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Use My Current Location */}
              <button
                onClick={() => {
                  useCurrentLocation();
                  setShowMap(true);
                }}
                className="flex items-center gap-3 p-3.5 bg-white border border-emerald-200/80 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-2xl transition-all shadow-xs text-left group"
              >
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Navigation className="w-4 h-4 fill-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-gray-900 block truncate">📍 Use My Current Location</span>
                  <span className="text-[10px] font-medium text-gray-500 block truncate">Detect via GPS geolocation</span>
                </div>
              </button>

              {/* Option B: Add New Address */}
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
                  setPincodeError('');
                  setShowAddressForm(true);
                }}
                className="flex items-center gap-3 p-3.5 bg-white border border-emerald-200/80 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-2xl transition-all shadow-xs text-left group"
              >
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-gray-900 block truncate">＋ Add New Address</span>
                  <span className="text-[10px] font-medium text-gray-500 block truncate">Enter custom address details</span>
                </div>
              </button>
            </div>

            {/* GPS Detected Quick Card (if geocoded recently) */}
            {gpsDetectedAddress && geocodedData && (
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3 h-3 fill-emerald-700" /> Current Detected Location
                  </span>
                  <button
                    onClick={handleConfirmGPSLocation}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-700 transition-all shadow-xs"
                  >
                    Select This Location
                  </button>
                </div>
                <p className="text-xs font-extrabold text-gray-900 leading-snug">
                  {geocodedData.fullAddress}
                </p>
                <p className="text-[11px] font-bold text-gray-600">
                  {geocodedData.city}, {geocodedData.state}, {geocodedData.country} - <span className="text-emerald-700 font-black">{geocodedData.zip}</span>
                </p>
              </div>
            )}

            {/* 3. SAVED ADDRESSES SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  Saved Addresses ({filteredAddresses.length})
                </h3>
              </div>

              {filteredAddresses.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {filteredAddresses.map((addr, idx) => {
                    const isSelected = activeStoreAddress?.id === addr.id || 
                      (activeStoreAddress?.house === addr.house && activeStoreAddress?.zip === addr.zip);

                    return (
                      <div 
                        key={addr.id || idx}
                        onClick={() => handleSelectSaved(addr)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer bg-white relative flex flex-col justify-between space-y-2.5 ${
                          isSelected 
                            ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-sm' 
                            : 'border-gray-200 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
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

                        <div className="space-y-0.5">
                          <p className="text-xs text-gray-800 font-bold leading-relaxed">
                            {addr.house}, {addr.street}{addr.landmark ? `, ${addr.landmark}` : ''}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            {addr.city}, {addr.state}, {addr.country} - <span className="font-extrabold text-gray-900">{addr.zip}</span>
                          </p>
                          <p className="text-xs text-emerald-700 font-bold pt-0.5">
                            📞 {addr.phone}
                          </p>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-emerald-600 text-xs font-black pt-1 border-t border-gray-100">
                            <Check className="w-4 h-4 stroke-[3]" /> Currently Selected Delivery Address
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300 space-y-3">
                  <p className="text-xs sm:text-sm font-bold text-gray-600">
                    {searchQuery ? `No saved addresses found matching "${searchQuery}".` : 'No saved addresses found.'}
                  </p>
                  <p className="text-xs text-gray-400">Save an address for faster checkout and delivery across devices.</p>
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
                      setPincodeError('');
                      setShowAddressForm(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-emerald-700 transition-all"
                  >
                    + Add New Address
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW 2: Interactive Map View */}
        {showMap && !showAddressForm && (
          <div className="flex flex-col h-full min-h-[420px] relative">
            <div className="flex-1 relative min-h-[320px]">
              <Map
                defaultCenter={{ lat: markerPosition?.lat || 20.5937, lng: markerPosition?.lng || 78.9629 }}
                defaultZoom={15}
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
                      <MapPin className="w-9 h-9 text-emerald-600 fill-white stroke-[2.5px]" />
                    </div>
                  </AdvancedMarker>
                )}
              </Map>

              <button 
                onClick={useCurrentLocation}
                aria-label="Locate me"
                className="absolute bottom-4 right-4 p-3 bg-white rounded-xl shadow-lg hover:bg-gray-50 transition-all border border-gray-200 z-10 flex items-center gap-2"
              >
                <Navigation className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-gray-800">GPS Recenter</span>
              </button>
            </div>

            <div className="p-4 bg-white border-t border-gray-200 space-y-3">
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase">Selected Location:</span>
                <p className="text-xs font-bold text-gray-900 truncate">
                  {isGeocoding ? 'Detecting location...' : (geocodedData?.fullAddress || 'Click map to place pin')}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={openFormWithGeocode}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold uppercase"
                >
                  Save as New Address
                </button>
                <button
                  disabled={!geocodedData || isGeocoding}
                  onClick={handleConfirmGPSLocation}
                  className="flex-1 py-2.5 bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl text-xs font-black uppercase shadow-sm"
                >
                  Deliver Here
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: Add / Edit Address Form */}
        {showAddressForm && (
          <div className="p-4 sm:p-6 bg-white min-h-full">
            <form onSubmit={handleSaveFormSubmit} className="space-y-3.5 max-w-lg mx-auto">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">PIN / ZIP Code *</label>
                    {isFormPincodeLoading && <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />}
                  </div>
                  <input 
                    type="text" 
                    required
                    maxLength={6} 
                    placeholder="6-digit PIN code" 
                    value={formZip} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setFormZip(val);
                      setPincodeError('');
                      if (val.length === 6) {
                        handleZipcodeAutoLookup(val, formCountry);
                      }
                    }} 
                    onBlur={() => {
                      if (formZip && formZip.length < 6) {
                        setPincodeError('Enter a 6-digit pincode');
                      }
                    }}
                    className={`w-full bg-gray-50 border h-10 rounded-xl px-3 text-xs font-bold outline-none transition-colors ${
                      pincodeError ? 'border-rose-400 focus:border-rose-600 text-rose-900' : 'border-gray-200 focus:border-emerald-600'
                    }`} 
                  />
                </div>
              </div>

              {pincodeError && (
                <p className="text-[11px] font-bold text-rose-500">{pincodeError}</p>
              )}

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

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setFormLabel(lbl)}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                        formLabel === lbl 
                          ? 'bg-emerald-600 text-white shadow-xs' 
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
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all"
                >
                  Save & Select Address
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
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
            className="relative w-full max-w-2xl z-10"
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

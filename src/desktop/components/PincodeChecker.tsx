import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, Navigation, Map as MapIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Address } from '../../shared/types';
import { useLocationStore } from '../../shared/utilities/useLocationStore';
import { reverseGeocodeCoords } from '../../shared/utilities/reverseGeocode';
import { lookupZipcode } from '../../backend/services/zipcode';
import GoogleMapsLoader from './GoogleMapsLoader';
import LocationPickerModal from './LocationPickerModal';

interface PincodeCheckerProps {
  serviceablePincodes?: string[];
  onAvailabilityChange?: (available: boolean) => void;
  savedAddresses?: Address[];
}

export default function PincodeChecker({ serviceablePincodes, onAvailabilityChange, savedAddresses: propsSaved }: PincodeCheckerProps) {
  const { selectedAddress, savedAddresses: storeSaved, selectAddress } = useLocationStore();
  const activeSavedAddresses = (propsSaved && propsSaved.length > 0) ? propsSaved : storeSaved;

  const [pincode, setPincode] = useState(selectedAddress?.zip || '');
  const [isEditing, setIsEditing] = useState(false);
  const [locationName, setLocationName] = useState(
    selectedAddress?.city 
      ? `${selectedAddress.street ? selectedAddress.street + ', ' : ''}${selectedAddress.city}, ${selectedAddress.state || ''}` 
      : ''
  );
  const [status, setStatus] = useState<'idle' | 'loading' | 'available' | 'unavailable'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMapOpen, setIsMapOpen] = useState(false);

  useEffect(() => {
    if (selectedAddress?.zip) {
      setPincode(selectedAddress.zip);
      if (selectedAddress.city) {
        setLocationName(`${selectedAddress.street ? selectedAddress.street + ', ' : ''}${selectedAddress.city}, ${selectedAddress.state || ''}`);
      }
      checkAvailability(selectedAddress.zip);
    } else if (activeSavedAddresses.length > 0 && !pincode) {
      const defaultPin = activeSavedAddresses[0].zip;
      setPincode(defaultPin);
      checkAvailability(defaultPin);
    }
  }, [selectedAddress, activeSavedAddresses]);

  const fetchLocationInfo = async (pin: string) => {
    if (!pin || pin.length < 6) return;
    try {
      const info = await lookupZipcode(pin, 'in');
      setLocationName(`${info.area ? info.area + ', ' : ''}${info.city}, ${info.state}`);
      setErrorMessage('');
      return info;
    } catch (error: any) {
      console.error('Error fetching location:', error);
      setLocationName('');
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        setErrorMessage('Unable to fetch address. Please try again.');
      } else {
        setErrorMessage('Invalid pincode');
      }
      throw error;
    }
  };

  const checkAvailability = async (code: string) => {
    const cleanPin = (code || '').trim().replace(/\D/g, '').slice(0, 6);
    if (!cleanPin) {
      setErrorMessage('');
      setStatus('idle');
      return;
    }
    if (cleanPin.length < 6) {
      setErrorMessage('Enter a 6-digit pincode');
      setStatus('idle');
      return;
    }
    
    setStatus('loading');
    setErrorMessage('');
    try {
      await fetchLocationInfo(cleanPin);
      const isAvailable = !serviceablePincodes || serviceablePincodes.length === 0 || serviceablePincodes.includes(cleanPin);
      setStatus(isAvailable ? 'available' : 'unavailable');
      onAvailabilityChange?.(isAvailable);
      setIsEditing(false);
    } catch {
      setStatus('idle');
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await reverseGeocodeCoords({ lat: latitude, lng: longitude });

          if (res.zip) {
            const cleanPincode = res.zip.replace(/\D/g, '').slice(0, 6);
            setPincode(cleanPincode);
            checkAvailability(cleanPincode);
            if (res.city) {
              setLocationName(`${res.city}, ${res.state}`);
              toast.success(`Detected: ${res.city}`);
            }
          } else {
            toast.error('Could not fetch pincode for your location. Please enter manually.');
            setStatus('idle');
          }
        } catch (error) {
          console.error('Location detection error:', error);
          toast.error('Unable to fetch address. Please try again.');
          setStatus('idle');
        }
      },
      (error) => {
        const errorMsg = error.code === 1 ? 'Location access denied' : 
                        error.code === 2 ? 'Location unavailable' : 
                        'Location request timed out';
        toast.error(errorMsg);
        setStatus('idle');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleLocationFromMap = (pin: string, address: string) => {
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    setPincode(cleanPin);
    checkAvailability(cleanPin);
    setLocationName(address);
  };

  return (
    <div className="py-6 border-y border-gray-100 mt-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-2 min-w-[80px]">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Delivery</span>
        </div>

        <div className="flex-1 min-w-[200px]">
          {!isEditing && pincode ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-black text-gray-900">
                  Delivery to {locationName ? locationName.split(',')[0] : 'your location'} {pincode}
                </span>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline ml-2"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 max-w-sm">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    maxLength={6}
                    autoFocus
                    placeholder="Enter 6-digit Pincode"
                    value={pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPincode(val);
                      setErrorMessage('');
                      if (val.length === 6) {
                        checkAvailability(val);
                      }
                    }}
                    onBlur={() => {
                      if (pincode && pincode.length < 6) {
                        setErrorMessage('Enter a 6-digit pincode');
                      }
                    }}
                    className={`w-full bg-gray-50 border-b-2 px-0 py-2 outline-none font-black text-sm transition-all ${
                      errorMessage ? 'border-rose-500 focus:border-rose-600 text-rose-900' : 'border-gray-200 focus:border-primary'
                    }`}
                  />
                  {status === 'loading' && (
                    <Loader2 className="absolute right-0 top-3 w-4 h-4 animate-spin text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={useMyLocation}
                    className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    title="Detect Pincode"
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setIsMapOpen(true)}
                    className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center gap-2"
                    title="Select on Map"
                  >
                    <MapIcon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Exact Location</span>
                  </button>
                </div>
              </div>
              {errorMessage && (
                <p className="text-[11px] font-bold text-rose-500 animate-in fade-in duration-200">
                  {errorMessage}
                </p>
              )}
            </div>
          )}
          
          <AnimateStatus status={status} locationName={locationName} />
        </div>
      </div>

      <LocationPickerModal 
        isOpen={isMapOpen} 
        onClose={() => setIsMapOpen(false)}
        onLocationSelect={handleLocationFromMap}
      />

      {activeSavedAddresses && activeSavedAddresses.length > 0 && isEditing && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Saved Addresses</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeSavedAddresses.map((addr, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPincode(addr.zip);
                  checkAvailability(addr.zip);
                }}
                className="flex flex-col items-start p-3 rounded-xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
              >
                <span className="text-xs font-black text-gray-900">{addr.street}</span>
                <span className="text-[10px] font-medium text-gray-500">{addr.city}, {addr.zip}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnimateStatus({ status, locationName }: { status: string, locationName?: string }) {
  if (status === 'idle') return null;

  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 3);
  const formattedDate = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="pt-2 animate-in fade-in slide-in-from-left-1 duration-500">
      {status === 'available' ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-gray-900">Delivery by {formattedDate}</p>
            <span className="text-xs text-gray-400 font-medium">|</span>
            <span className="text-xs font-black text-green-600 uppercase tracking-widest">Free</span>
          </div>
          {locationName && <p className="text-[10px] text-gray-400 font-medium tracking-tight">to {locationName}</p>}
        </div>
      ) : status === 'unavailable' ? (
        <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
          <AlertCircle className="w-3 h-3" />
          <p className="text-[10px] font-black uppercase tracking-widest">Not available in your area</p>
        </div>
      ) : null}
    </div>
  );
}

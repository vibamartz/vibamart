import React, { useState, useEffect } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, Navigation, Map as MapIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Address } from '../types';
import GoogleMapsLoader from './GoogleMapsLoader';
import LocationPickerModal from './LocationPickerModal';

interface PincodeCheckerProps {
  serviceablePincodes?: string[];
  onAvailabilityChange?: (available: boolean) => void;
  savedAddresses?: Address[];
}

export default function PincodeChecker({ serviceablePincodes, onAvailabilityChange, savedAddresses }: PincodeCheckerProps) {
  const [pincode, setPincode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'available' | 'unavailable'>('idle');
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Try to set default pincode from saved addresses
  useEffect(() => {
    if (savedAddresses && savedAddresses.length > 0 && !pincode) {
      const defaultPin = savedAddresses[0].zip;
      setPincode(defaultPin);
      checkAvailability(defaultPin);
    }
  }, [savedAddresses]);

  const fetchLocationInfo = async (pin: string) => {
    if (pin.length !== 6) return;
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await response.json();
      if (data[0]?.Status === 'Success') {
        const postOffice = data[0].PostOffice[0];
        setLocationName(`${postOffice.Name}, ${postOffice.District}, ${postOffice.State}`);
      } else {
        setLocationName('');
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationName('');
    }
  };

  const checkAvailability = (code: string) => {
    if (!code || code.length !== 6) return;
    
    setStatus('loading');
    fetchLocationInfo(code);
    
    setTimeout(() => {
      const isAvailable = !serviceablePincodes || serviceablePincodes.length === 0 || serviceablePincodes.includes(code);
      setStatus(isAvailable ? 'available' : 'unavailable');
      onAvailabilityChange?.(isAvailable);
      setIsEditing(false);
    }, 600);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Try multiple reverse geocoding services for accuracy
          let foundPincode = '';
          let detectedCity = '';

          try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            const data = await response.json();
            foundPincode = data.postcode;
            detectedCity = data.city || data.locality;
          } catch (e) {
            console.warn('BigDataCloud failed, trying Nominatim...');
          }

          // Fallback to Nominatim if needed
          if (!foundPincode) {
            const nomResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const nomData = await nomResponse.json();
            foundPincode = nomData.address?.postcode;
            detectedCity = detectedCity || nomData.address?.city || nomData.address?.town || nomData.address?.village;
          }

          if (foundPincode) {
            // Clean the pincode (remove spaces, etc.)
            const cleanPincode = foundPincode.replace(/\D/g, '').slice(0, 6);
            setPincode(cleanPincode);
            checkAvailability(cleanPincode);
            if (detectedCity) {
              toast.success(`Detected: ${detectedCity}`);
            }
          } else {
            toast.error('Could not fetch pincode for your location. Please enter it manually.');
            setStatus('idle');
          }
        } catch (error) {
          console.error('Location detection error:', error);
          toast.error('Failed to detect location accurately');
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
            <div className="flex items-center gap-2 max-w-sm">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  maxLength={6}
                  autoFocus
                  placeholder="Enter Pincode"
                  value={pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPincode(val);
                    if (val.length === 6) checkAvailability(val);
                  }}
                  className="w-full bg-gray-50 border-b-2 border-gray-200 focus:border-primary px-0 py-2 outline-none font-black text-sm transition-all"
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
          )}
          
          <AnimateStatus status={status} locationName={locationName} />
        </div>
      </div>

      <GoogleMapsLoader>
        <LocationPickerModal 
          isOpen={isMapOpen} 
          onClose={() => setIsMapOpen(false)}
          onLocationSelect={handleLocationFromMap}
        />
      </GoogleMapsLoader>

      {savedAddresses && savedAddresses.length > 0 && isEditing && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Saved Addresses</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {savedAddresses.map((addr, idx) => (
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

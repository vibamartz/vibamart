import React, { useState, useCallback, useEffect } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { X, Navigation, Check, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelect: (pincode: string, address: string) => void;
}

export default function LocationPickerModal({ isOpen, onClose, onLocationSelect }: LocationPickerModalProps) {
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedPincode, setSelectedPincode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const map = useMap();

  const handleDragEnd = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      setMarkerPosition(pos);
      await reverseGeocode(pos);
    }
  }, []);

  const reverseGeocode = async (pos: google.maps.LatLngLiteral) => {
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await geocoder.geocode({ location: pos });
      
      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        setSelectedAddress(result.formatted_address);
        
        const pincodeComp = result.address_components.find(comp => comp.types.includes('postal_code'));
        if (pincodeComp) {
          setSelectedPincode(pincodeComp.long_name);
        } else {
          // If no pincode in first result, try others
          const allPincodes = response.results
            .flatMap(res => res.address_components)
            .find(comp => comp.types.includes('postal_code'));
          if (allPincodes) setSelectedPincode(allPincodes.long_name);
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to get address for this location');
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setMarkerPosition(pos);
        map?.panTo(pos);
        map?.setZoom(17);
        await reverseGeocode(pos);
      },
      () => toast.error('Check location permissions'),
      { enableHighAccuracy: true }
    );
  };

  const handleConfirm = () => {
    if (selectedPincode) {
      onLocationSelect(selectedPincode, selectedAddress);
      onClose();
    } else {
      toast.error('Could not determine pincode for this location. Try moving the pin slightly.');
    }
  };

  useEffect(() => {
    if (isOpen && !markerPosition) {
      useCurrentLocation();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] md:h-[600px]"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 bg-white/80 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-all"
            >
              <X className="w-5 h-5 text-gray-900" />
            </button>

            {/* Map Section */}
            <div className="flex-1 relative">
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
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary/20 rounded-full animate-ping" />
                      <MapPin className="w-10 h-10 text-primary fill-white stroke-[2.5px]" />
                    </div>
                  </AdvancedMarker>
                )}
              </Map>

              <button 
                onClick={useCurrentLocation}
                className="absolute bottom-6 right-6 p-4 bg-white rounded-2xl shadow-xl hover:bg-gray-50 transition-all group border border-gray-100"
              >
                <Navigation className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </button>
            </div>

            {/* Address Info Section */}
            <div className="w-full md:w-80 p-8 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col justify-between bg-gray-50/50">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Select Location</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Picked Address</p>
                    <p className="text-sm font-bold text-gray-900 leading-relaxed min-h-[4.5rem]">
                      {selectedAddress || 'Click on the map or drag the pin to select your exact location'}
                    </p>
                  </div>

                  {selectedPincode && (
                    <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Detected Pincode</p>
                      <p className="text-xl font-black text-primary">{selectedPincode}</p>
                    </div>
                  )}
                </div>
              </div>

              <button 
                disabled={!selectedPincode}
                onClick={handleConfirm}
                className="w-full bg-primary disabled:bg-gray-300 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 mt-8"
              >
                Confirm Location
                <Check className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

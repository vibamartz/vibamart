import React from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

export const getGoogleMapsApiKey = (): string => {
  const metaEnv = (import.meta as any).env;
  if (metaEnv) {
    if (metaEnv.VITE_GOOGLE_MAPS_PLATFORM_KEY) return metaEnv.VITE_GOOGLE_MAPS_PLATFORM_KEY;
    if (metaEnv.GOOGLE_MAPS_PLATFORM_KEY) return metaEnv.GOOGLE_MAPS_PLATFORM_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY) return process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY;
    if (process.env.GOOGLE_MAPS_PLATFORM_KEY) return process.env.GOOGLE_MAPS_PLATFORM_KEY;
  }
  return '';
};

export const hasValidGoogleMapsKey = (): boolean => {
  const key = getGoogleMapsApiKey();
  return Boolean(
    key &&
    key.trim() !== '' &&
    !key.toLowerCase().includes('your_') &&
    key !== 'YOUR_API_KEY' &&
    key !== 'YOUR_GOOGLE_MAPS_KEY'
  );
};

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

export default function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
  const isKeyValid = hasValidGoogleMapsKey();
  const apiKey = getGoogleMapsApiKey();

  // If a valid Google Maps API Key is provided, wrap children with Google Maps APIProvider
  if (isKeyValid) {
    return (
      <APIProvider apiKey={apiKey} version="quarterly" libraries={['marker', 'places', 'geocoding']}>
        {children}
      </APIProvider>
    );
  }

  // Graceful fallback: render children directly so that delivery address selection,
  // GPS detection, pincode lookup, and address management operate smoothly without blocking
  return <>{children}</>;
}

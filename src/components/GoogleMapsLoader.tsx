import React from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

export default function GoogleMapsLoader({ children }: GoogleMapsLoaderProps) {
  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
        <h2 className="text-xl font-black text-gray-900 mb-4">Google Maps API Key Required</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          To enable exact location tracking, please add your Google Maps Platform API key in the app secrets.
        </p>
        <div className="bg-white p-6 rounded-2xl shadow-xl text-left text-sm space-y-4 max-w-lg">
          <p><strong>To add your API key:</strong></p>
          <ol className="list-decimal ml-4 space-y-2 text-gray-600">
            <li>Get an API key: <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">Console Cloud</a></li>
            <li>Open <strong>Settings</strong> (⚙️ gear icon, top-right corner)</li>
            <li>Select <strong>Secrets</strong></li>
            <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the name</li>
            <li>Paste your key as the value</li>
          </ol>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-4 italic">
            The app will rebuild automatically after saving.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="quarterly" libraries={['marker', 'places']}>
      {children}
    </APIProvider>
  );
}

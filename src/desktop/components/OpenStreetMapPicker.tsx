import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface OpenStreetMapPickerProps {
  center: { lat: number; lng: number };
  onCenterChange: (pos: { lat: number; lng: number }) => void;
  onDragEnd: (pos: { lat: number; lng: number }) => void;
}

declare global {
  interface Window {
    L?: any;
  }
}

export default function OpenStreetMapPicker({
  center,
  onCenterChange,
  onDragEnd,
}: OpenStreetMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initMap = () => {
      if (!containerRef.current || !window.L || mapInstanceRef.current) return;

      try {
        const map = window.L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
        }).addTo(map);

        map.on('movestart', () => {
          isDraggingRef.current = true;
        });

        map.on('move', () => {
          const c = map.getCenter();
          if (c) {
            onCenterChange({ lat: c.lat, lng: c.lng });
          }
        });

        map.on('moveend', () => {
          isDraggingRef.current = false;
          const c = map.getCenter();
          if (c) {
            onDragEnd({ lat: c.lat, lng: c.lng });
          }
        });

        mapInstanceRef.current = map;
        if (isMounted) setIsLoaded(true);
      } catch (err) {
        console.warn('Failed to initialize Leaflet map:', err);
      }
    };

    const loadLeaflet = () => {
      if (window.L) {
        initMap();
        return;
      }

      // 1. Inject Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // 2. Inject Leaflet JS
      let script = document.getElementById('leaflet-js') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'leaflet-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        document.head.appendChild(script);
      }

      if (window.L) {
        initMap();
      } else {
        script.addEventListener('load', () => {
          if (isMounted) initMap();
        });
      }
    };

    loadLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore cleanup errors
        }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center when props change and user isn't currently dragging
  useEffect(() => {
    if (!mapInstanceRef.current || isDraggingRef.current) return;
    try {
      const current = mapInstanceRef.current.getCenter();
      if (
        current &&
        (Math.abs(current.lat - center.lat) > 0.0001 || Math.abs(current.lng - center.lng) > 0.0001)
      ) {
        mapInstanceRef.current.setView([center.lat, center.lng], 16, { animate: true });
      }
    } catch {
      // ignore
    }
  }, [center.lat, center.lng]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        .leaflet-pane img {
          max-width: none !important;
        }
      `}</style>
      <div ref={containerRef} className="w-full h-full bg-emerald-50/20 z-0" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading Map...</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 z-[400] bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] font-semibold text-gray-500 shadow-2xs">
        Map data &copy;{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}

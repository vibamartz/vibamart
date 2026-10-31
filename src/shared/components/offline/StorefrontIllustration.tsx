import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

export default function StorefrontIllustration({ className = '', size = 180 }: IllustrationProps) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 via-amber-500/10 to-orange-500/10 blur-xl" />

      <svg
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="storeGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="storeOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="100%" stopColor="#F5EFE6" />
          </linearGradient>
          <linearGradient id="windowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ecfdf5" />
            <stop offset="100%" stopColor="#d1fae5" />
          </linearGradient>
        </defs>

        {/* Base Platform / Pavement */}
        <ellipse cx="110" cy="188" rx="84" ry="12" fill="#E8DFD5" opacity="0.8" />
        <rect x="36" y="180" width="148" height="6" rx="3" fill="#D6C7B8" />

        {/* Store Building Body */}
        <rect x="48" y="92" width="124" height="90" rx="6" fill="url(#wallGrad)" stroke="#E0D4C5" strokeWidth="2" />

        {/* Store Signboard / Fascia */}
        <rect x="42" y="80" width="136" height="22" rx="5" fill="url(#storeGreen)" />
        <text
          x="110"
          y="95"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="11"
          fontWeight="900"
          fontStyle="italic"
          letterSpacing="0.8"
        >
          ViBa Mart
        </text>

        {/* Striped Storefront Awning */}
        {/* Stripe 1 (Green) */}
        <path d="M 40 102 L 44 122 Q 49 126 54 122 L 51 102 Z" fill="#15803d" />
        {/* Stripe 2 (Orange) */}
        <path d="M 51 102 L 54 122 Q 60 126 66 122 L 63 102 Z" fill="url(#storeOrange)" />
        {/* Stripe 3 (Green) */}
        <path d="M 63 102 L 66 122 Q 72 126 78 122 L 75 102 Z" fill="#15803d" />
        {/* Stripe 4 (Orange) */}
        <path d="M 75 102 L 78 122 Q 84 126 90 122 L 87 102 Z" fill="url(#storeOrange)" />
        {/* Stripe 5 (Green) */}
        <path d="M 87 102 L 90 122 Q 96 126 102 122 L 99 102 Z" fill="#15803d" />
        {/* Stripe 6 (Orange) */}
        <path d="M 99 102 L 102 122 Q 108 126 114 122 L 111 102 Z" fill="url(#storeOrange)" />
        {/* Stripe 7 (Green) */}
        <path d="M 111 102 L 114 122 Q 120 126 126 122 L 123 102 Z" fill="#15803d" />
        {/* Stripe 8 (Orange) */}
        <path d="M 123 102 L 126 122 Q 132 126 138 122 L 135 102 Z" fill="url(#storeOrange)" />
        {/* Stripe 9 (Green) */}
        <path d="M 135 102 L 138 122 Q 144 126 150 122 L 147 102 Z" fill="#15803d" />
        {/* Stripe 10 (Orange) */}
        <path d="M 147 102 L 150 122 Q 156 126 162 122 L 159 102 Z" fill="url(#storeOrange)" />
        {/* Stripe 11 (Green) */}
        <path d="M 159 102 L 162 122 Q 166 126 170 122 L 168 102 Z" fill="#15803d" />

        {/* Display Window (Left) */}
        <rect x="58" y="132" width="46" height="42" rx="4" fill="url(#windowGlow)" stroke="#A7F3D0" strokeWidth="1.5" />
        {/* Display Shelf */}
        <line x1="62" y1="154" x2="100" y2="154" stroke="#6EE7B7" strokeWidth="1.5" />
        {/* Display items on shelf */}
        <rect x="66" y="142" width="7" height="11" rx="1.5" fill="#f97316" />
        <rect x="76" y="140" width="8" height="13" rx="1.5" fill="#15803d" />
        <circle cx="91" cy="148" r="4.5" fill="#f59e0b" />
        {/* Lower shelf items */}
        <rect x="65" y="160" width="10" height="10" rx="2" fill="#15803d" opacity="0.8" />
        <rect x="79" y="159" width="16" height="11" rx="2" fill="#fb923c" opacity="0.9" />

        {/* Storefront Door (Right) */}
        <rect x="116" y="128" width="44" height="52" rx="4" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1.5" />
        {/* Glass in door */}
        <rect x="122" y="134" width="32" height="26" rx="2" fill="#ecfdf5" stroke="#A7F3D0" strokeWidth="1" />
        {/* Door handle */}
        <line x1="122" y1="164" x2="122" y2="170" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />

        {/* Rooftop Disconnected Wi-Fi Antenna / Badge */}
        <g transform="translate(100, 32)">
          {/* Antenna Pole */}
          <line x1="10" y1="36" x2="10" y2="48" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
          
          {/* Badge Background */}
          <circle cx="10" cy="22" r="18" fill="#FAF7F2" />
          <circle cx="10" cy="22" r="16" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="1.5" />

          {/* Wi-Fi Arcs */}
          <path d="M 2 17 A 11 11 0 0 1 18 17" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
          <path d="M 5 21 A 7 7 0 0 1 15 21" stroke="#15803d" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="26" r="1.5" fill="#15803d" />

          {/* Slash across antenna signal */}
          <line x1="3" y1="12" x2="17" y2="30" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Little decorative shopping bag on the pavement */}
        <g transform="translate(166, 160)">
          <path d="M 4 8 L 18 8 L 16 22 L 6 22 Z" fill="url(#storeOrange)" />
          <path d="M 8 8 Q 11 3 14 8" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>

        {/* Decorative sparkles */}
        <circle cx="36" cy="68" r="3.5" fill="#f97316" opacity="0.8" />
        <circle cx="188" cy="82" r="4" fill="#15803d" opacity="0.7" />
        <circle cx="198" cy="148" r="3" fill="#f59e0b" opacity="0.6" />
      </svg>
    </div>
  );
}


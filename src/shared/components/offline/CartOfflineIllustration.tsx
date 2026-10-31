import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

export default function CartOfflineIllustration({ className = '', size = 160 }: IllustrationProps) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/10 via-amber-500/10 to-orange-500/10 blur-xl" />

      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="cartGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="cartOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <filter id="cartShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#15803d" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Soft shadow base plate */}
        <ellipse cx="100" cy="172" rx="66" ry="9" fill="#E8DFD5" opacity="0.7" />

        {/* Items inside Cart */}
        {/* Package 1 (Orange gift/box) */}
        <rect x="74" y="66" width="24" height="34" rx="3" fill="url(#cartOrange)" transform="rotate(-6 74 66)" />
        <rect x="71" y="76" width="24" height="4" fill="#fed7aa" transform="rotate(-6 71 76)" />

        {/* Package 2 (Green grocery carton) */}
        <rect x="94" y="58" width="26" height="42" rx="4" fill="url(#cartGreen)" transform="rotate(5 94 58)" />
        <circle cx="106" cy="74" r="5" fill="#86efac" />

        {/* Package 3 (Golden jar / cylinder) */}
        <rect x="116" y="70" width="20" height="28" rx="5" fill="#f59e0b" />
        <line x1="116" y1="76" x2="136" y2="76" stroke="#fef3c7" strokeWidth="2" />

        {/* Shopping Cart Body / Metal Wireframe */}
        {/* Handle */}
        <path
          d="M 40 76 L 56 76 L 68 132 L 146 132"
          stroke="#15803d"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Basket Contour */}
        <path
          d="M 58 88 L 152 88 L 138 130 L 68 130 Z"
          fill="#15803d"
          fillOpacity="0.08"
          stroke="#15803d"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Basket Grids */}
        <line x1="84" y1="88" x2="88" y2="130" stroke="#15803d" strokeWidth="2.5" strokeOpacity="0.4" />
        <line x1="108" y1="88" x2="108" y2="130" stroke="#15803d" strokeWidth="2.5" strokeOpacity="0.4" />
        <line x1="130" y1="88" x2="124" y2="130" stroke="#15803d" strokeWidth="2.5" strokeOpacity="0.4" />
        <line x1="62" y1="104" x2="148" y2="104" stroke="#15803d" strokeWidth="2.5" strokeOpacity="0.4" />
        <line x1="66" y1="118" x2="142" y2="118" stroke="#15803d" strokeWidth="2.5" strokeOpacity="0.4" />

        {/* Wheels */}
        {/* Back Wheel */}
        <circle cx="82" cy="154" r="11" fill="#FFFFFF" stroke="#15803d" strokeWidth="4" />
        <circle cx="82" cy="154" r="5" fill="url(#cartOrange)" />

        {/* Front Wheel */}
        <circle cx="134" cy="154" r="11" fill="#FFFFFF" stroke="#15803d" strokeWidth="4" />
        <circle cx="134" cy="154" r="5" fill="url(#cartOrange)" />

        {/* Disconnected Wi-Fi Icon Badge on the top right */}
        <g transform="translate(132, 26)">
          <circle cx="20" cy="20" r="22" fill="#FAF7F2" filter="url(#cartShadow)" />
          <circle cx="20" cy="20" r="20" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="2" />

          {/* Wi-Fi Arcs inside badge */}
          <path d="M 10 16 A 14 14 0 0 1 30 16" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" opacity="0.4" />
          <path d="M 14 20 A 8 8 0 0 1 26 20" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="20" cy="25" r="2" fill="#15803d" />

          {/* Disconnected Slash */}
          <line x1="10" y1="11" x2="30" y2="29" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Decorative sparkles */}
        <circle cx="48" cy="48" r="4" fill="#f97316" opacity="0.75" />
        <circle cx="172" cy="84" r="3" fill="#15803d" opacity="0.6" />
        <circle cx="42" cy="132" r="3.5" fill="#f59e0b" opacity="0.7" />
      </svg>
    </div>
  );
}


import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

export default function ShoppingBagWifiIllustration({ className = '', size = 160 }: IllustrationProps) {
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
          <linearGradient id="bagGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="bagOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <filter id="bagShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#15803d" floodOpacity="0.14" />
          </filter>
        </defs>

        {/* Soft Shadow Base Plate */}
        <ellipse cx="100" cy="176" rx="64" ry="8" fill="#E8DFD5" opacity="0.75" />

        {/* Bag Handles */}
        <path
          d="M 80 82 C 80 50 120 50 120 82"
          stroke="url(#bagOrange)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Shopping Bag Body */}
        <path
          d="M 64 82 L 136 82 L 146 168 C 146 172 142 174 138 174 L 62 174 C 58 174 54 172 54 168 Z"
          fill="url(#bagGreen)"
          filter="url(#bagShadow)"
        />

        {/* Bag Side Fold / Shading */}
        <path
          d="M 64 82 L 72 174 L 62 174 C 58 174 54 172 54 168 L 64 82 Z"
          fill="#14532d"
          opacity="0.3"
        />

        {/* Bag Top Rim Accent */}
        <rect x="62" y="80" width="76" height="5" rx="2" fill="#86efac" opacity="0.8" />

        {/* Subtle ViBa Mart brand curve on bag front */}
        <path
          d="M 80 128 Q 100 144 120 128"
          stroke="#86efac"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Prominent Disconnected Wi-Fi Symbol (centered in a badge on the bag) */}
        <g transform="translate(74, 98)">
          {/* Badge Background */}
          <circle cx="26" cy="26" r="26" fill="#FAF7F2" filter="url(#bagShadow)" />
          <circle cx="26" cy="26" r="24" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="2" />

          {/* Wi-Fi Arcs */}
          {/* Arc 1 */}
          <path
            d="M 12 21 A 18 18 0 0 1 40 21"
            stroke="#15803d"
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.4"
          />
          {/* Arc 2 */}
          <path
            d="M 18 26 A 11 11 0 0 1 34 26"
            stroke="#15803d"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Center Dot */}
          <circle cx="26" cy="33" r="2.8" fill="#15803d" />

          {/* Disconnected Slash */}
          <line
            x1="12"
            y1="13"
            x2="40"
            y2="39"
            stroke="url(#bagOrange)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Decorative Floating Elements (Green & Orange) */}
        <circle cx="44" cy="98" r="4" fill="#f97316" opacity="0.8" />
        <circle cx="158" cy="92" r="5" fill="#15803d" opacity="0.7" />
        <circle cx="40" cy="148" r="3.5" fill="#15803d" opacity="0.5" />
        <circle cx="162" cy="144" r="4" fill="#f59e0b" opacity="0.75" />
        <circle cx="142" cy="62" r="3" fill="#f97316" opacity="0.7" />
      </svg>
    </div>
  );
}


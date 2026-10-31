import React from 'react';

interface IllustrationProps {
  className?: string;
  size?: number;
}

export default function WifiDisconnectedIllustration({ className = '', size = 160 }: IllustrationProps) {
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
          <linearGradient id="wifiGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="wifiOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FAF7F2" />
            <stop offset="100%" stopColor="#F5EFE6" />
          </linearGradient>
          <filter id="softShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#15803d" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Soft Circular Base Plate */}
        <circle cx="100" cy="100" r="82" fill="url(#bubbleGrad)" stroke="#E8DFD5" strokeWidth="2" filter="url(#softShadow)" />

        {/* Outer Ring / Concentric Ripple */}
        <circle cx="100" cy="100" r="72" stroke="#15803d" strokeOpacity="0.08" strokeWidth="1.5" strokeDasharray="4 4" />

        {/* Decorative Floating Sparkles */}
        <circle cx="46" cy="62" r="4" fill="#f97316" opacity="0.75" />
        <circle cx="158" cy="74" r="5" fill="#15803d" opacity="0.6" />
        <circle cx="58" cy="142" r="3.5" fill="#15803d" opacity="0.5" />
        <circle cx="148" cy="138" r="4.5" fill="#f97316" opacity="0.7" />

        {/* Wi-Fi Waves */}
        {/* Arc 1 (Outer) - Disconnected/Broken */}
        <path
          d="M 52 74 A 68 68 0 0 1 148 74"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Arc 2 (Middle) */}
        <path
          d="M 68 96 A 46 46 0 0 1 132 96"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Arc 3 (Inner) */}
        <path
          d="M 84 118 A 23 23 0 0 1 116 118"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Wi-Fi Base Dot */}
        <circle cx="100" cy="142" r="6.5" fill="url(#wifiGreenGrad)" />

        {/* Modern Disconnect Indicator: Clean Diagonal Slash with Orange Accent */}
        <path
          d="M 54 48 L 146 152"
          stroke="#FAF7F2"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 54 48 L 146 152"
          stroke="url(#wifiOrangeGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Small Disconnected Alert Badge on top right of the slash */}
        <g transform="translate(136, 42)">
          <circle cx="12" cy="12" r="13" fill="#FAF7F2" />
          <circle cx="12" cy="12" r="11" fill="url(#wifiOrangeGrad)" filter="url(#softShadow)" />
          <path d="M 12 7 L 12 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.3" fill="white" />
        </g>
      </svg>
    </div>
  );
}


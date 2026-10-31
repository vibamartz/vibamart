import React from 'react';

// Decorative background shapes helper for cream background with soft orange & green decorative shapes
export function DecorativeBackgroundElements() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Top right orange soft blob */}
      <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-gradient-to-br from-orange-200/40 to-amber-100/30 blur-3xl" />
      {/* Top left green soft blob */}
      <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-emerald-200/35 to-green-100/25 blur-3xl" />
      {/* Bottom right green soft blob */}
      <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-gradient-to-tl from-emerald-200/35 to-teal-100/25 blur-3xl" />
      {/* Bottom left orange soft blob */}
      <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-200/40 to-orange-100/30 blur-3xl" />
      
      {/* Subtle organic geometric shapes */}
      <svg className="absolute top-12 left-10 w-16 h-16 text-emerald-500/15" viewBox="0 0 100 100" fill="currentColor">
        <circle cx="50" cy="50" r="40" />
      </svg>
      <svg className="absolute top-24 right-12 w-20 h-20 text-orange-400/15" viewBox="0 0 100 100" fill="currentColor">
        <path d="M50 0 L100 50 L50 100 L0 50 Z" />
      </svg>
      <svg className="absolute bottom-28 left-14 w-14 h-14 text-orange-400/20" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="16 12">
        <circle cx="50" cy="50" r="40" />
      </svg>
      <svg className="absolute bottom-20 right-16 w-16 h-16 text-emerald-500/15" viewBox="0 0 100 100" fill="currentColor">
        <circle cx="50" cy="50" r="30" />
      </svg>
    </div>
  );
}

// 1. Centered Wi-Fi disconnected illustration
export function WifiDisconnectedIllustration({ className = 'w-48 h-48 sm:w-56 sm:h-56' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        <defs>
          <linearGradient id="wifiGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="wifiOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <radialGradient id="wifiCenterGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dcfce7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
          </radialGradient>
          <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#15803d" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Soft radial glow */}
        <circle cx="120" cy="120" r="95" fill="url(#wifiCenterGlow)" />

        {/* Outer Circular Ring with subtle dashed accents */}
        <circle
          cx="120"
          cy="120"
          r="84"
          stroke="#e2e8f0"
          strokeWidth="3"
          strokeDasharray="6 8"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Outer Wi-Fi Arc (Green) */}
        <path
          d="M 50 85 A 90 90 0 0 1 190 85"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Middle Wi-Fi Arc (Orange) */}
        <path
          d="M 75 115 A 60 60 0 0 1 165 115"
          stroke="url(#wifiOrangeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Inner Wi-Fi Arc (Green) */}
        <path
          d="M 98 145 A 30 30 0 0 1 142 145"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.45"
        />

        {/* Wi-Fi Base Dot */}
        <circle cx="120" cy="176" r="9" fill="url(#wifiOrangeGrad)" />

        {/* Circular Disconnected Slash Badge */}
        <g filter="url(#shadowGlow)">
          <circle cx="155" cy="85" r="32" fill="#ffffff" stroke="#fee2e2" strokeWidth="3" />
          {/* Red/Orange Disconnected Wi-Fi slash */}
          <path
            d="M 139 69 L 171 101"
            stroke="#ef4444"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Signal wave crossed inside badge */}
          <path
            d="M 143 89 A 14 14 0 0 1 167 89"
            stroke="#94a3b8"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="155" cy="94" r="2.5" fill="#ef4444" />
        </g>

        {/* Floating playful decorative elements */}
        <circle cx="45" cy="140" r="5" fill="#15803d" opacity="0.6" />
        <circle cx="195" cy="150" r="6" fill="#f97316" opacity="0.7" />
        <circle cx="65" cy="55" r="4" fill="#f59e0b" opacity="0.5" />
      </svg>
    </div>
  );
}

// 2. Friendly shopping storefront illustration
export function StorefrontIllustration({ className = 'w-56 h-56 sm:w-64 sm:h-64' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 280 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
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
          <linearGradient id="storeCream" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>
          <linearGradient id="windowGlass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>
        </defs>

        {/* Store base shadow */}
        <ellipse cx="140" cy="242" rx="100" ry="12" fill="#0f172a" opacity="0.08" />

        {/* Building wall */}
        <rect x="52" y="90" width="176" height="145" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2.5" />

        {/* Store Top Signboard */}
        <rect x="42" y="42" width="196" height="42" rx="10" fill="url(#storeGreen)" />
        <rect x="46" y="46" width="188" height="34" rx="8" fill="#15803d" stroke="#86efac" strokeWidth="1" strokeOpacity="0.4" />
        
        {/* ViBa Mart storefront text on sign */}
        <text x="140" y="68" textAnchor="middle" fill="#ffffff" fontWeight="900" fontSize="16" letterSpacing="2" fontFamily="sans-serif">
          ViBa MART
        </text>

        {/* Striped Green & Orange Awning */}
        <g>
          {/* Awning stripes */}
          <path d="M 40 84 L 52 120 L 74 120 L 65 84 Z" fill="url(#storeOrange)" />
          <path d="M 65 84 L 74 120 L 98 120 L 90 84 Z" fill="url(#storeGreen)" />
          <path d="M 90 84 L 98 120 L 122 120 L 115 84 Z" fill="url(#storeOrange)" />
          <path d="M 115 84 L 122 120 L 146 120 L 140 84 Z" fill="url(#storeGreen)" />
          <path d="M 140 84 L 146 120 L 170 120 L 165 84 Z" fill="url(#storeOrange)" />
          <path d="M 165 84 L 170 120 L 194 120 L 190 84 Z" fill="url(#storeGreen)" />
          <path d="M 190 84 L 194 120 L 216 120 L 215 84 Z" fill="url(#storeOrange)" />
          <path d="M 215 84 L 216 120 L 238 120 L 238 84 Z" fill="url(#storeGreen)" />

          {/* Scalloped Awning trim */}
          <path
            d="M 40 120 Q 51 130 62 120 Q 73 130 84 120 Q 95 130 106 120 Q 117 130 128 120 Q 139 130 150 120 Q 161 130 172 120 Q 183 130 194 120 Q 205 130 216 120 Q 227 130 238 120"
            fill="none"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Shop Showcase Window */}
        <rect x="66" y="136" width="70" height="78" rx="8" fill="url(#windowGlass)" stroke="#cbd5e1" strokeWidth="2" />
        {/* Window reflection lines */}
        <line x1="72" y1="142" x2="110" y2="180" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
        <line x1="88" y1="142" x2="124" y2="178" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        {/* Window display shelf with goodies */}
        <rect x="72" y="196" width="58" height="6" rx="3" fill="#cbd5e1" />
        <rect x="76" y="180" width="16" height="16" rx="3" fill="#f97316" />
        <rect x="96" y="176" width="14" height="20" rx="3" fill="#15803d" />
        <circle cx="118" cy="188" r="7" fill="#eab308" />

        {/* Front Glass Door */}
        <rect x="150" y="136" width="62" height="99" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
        <rect x="156" y="142" width="50" height="42" rx="4" fill="url(#windowGlass)" />
        {/* Door handle */}
        <circle cx="198" cy="188" r="4" fill="#f97316" />

        {/* Welcome mat */}
        <path d="M 144 235 L 218 235 L 224 242 L 138 242 Z" fill="#15803d" rx="2" />

        {/* Warm storefront lantern */}
        <g>
          <path d="M 36 136 L 46 136 L 46 142 L 36 142 Z" fill="#64748b" />
          <path d="M 41 142 L 41 148" stroke="#64748b" strokeWidth="2" />
          <circle cx="41" cy="154" r="8" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <circle cx="41" cy="154" r="14" fill="#fef08a" opacity="0.3" />
        </g>

        {/* Potted plant beside door */}
        <g>
          <path d="M 226 215 L 244 215 L 241 236 L 229 236 Z" fill="#ea580c" />
          <ellipse cx="235" cy="204" rx="10" ry="12" fill="#16a34a" />
          <ellipse cx="230" cy="208" rx="8" ry="9" fill="#22c55e" />
          <ellipse cx="240" cy="208" rx="8" ry="9" fill="#15803d" />
        </g>

        {/* Offline indicator badge floating over store */}
        <g>
          <circle cx="236" cy="48" r="22" fill="#ffffff" stroke="#fed7aa" strokeWidth="3" />
          {/* Slashed Wi-Fi symbol */}
          <path d="M 224 48 A 12 12 0 0 1 248 48" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 228 53 A 6 6 0 0 1 244 53" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
          <circle cx="236" cy="58" r="1.5" fill="#f97316" />
          <line x1="222" y1="36" x2="250" y2="60" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

// 3. Shopping cart illustration with a disconnected Wi-Fi icon
export function ShoppingCartOfflineIllustration({ className = 'w-44 h-44 sm:w-52 sm:h-52' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 240 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="cartGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="cartOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="cartBadgeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.1" />
          </filter>
        </defs>

        {/* Soft ground shadow */}
        <ellipse cx="115" cy="198" rx="80" ry="10" fill="#0f172a" opacity="0.08" />

        {/* Saved Cart items inside the cart basket */}
        {/* Box 1 (Orange) */}
        <rect x="75" y="85" width="34" height="42" rx="5" fill="url(#cartOrange)" transform="rotate(-6 75 85)" />
        <line x1="78" y1="102" x2="105" y2="100" stroke="#ffedd5" strokeWidth="2" strokeDasharray="3 2" />
        
        {/* Box 2 (Green) */}
        <rect x="106" y="78" width="40" height="48" rx="6" fill="url(#cartGreen)" />
        <rect x="114" y="94" width="24" height="12" rx="3" fill="#ffffff" opacity="0.25" />

        {/* Gift or product round shape */}
        <circle cx="152" cy="104" r="16" fill="#fde047" stroke="#ca8a04" strokeWidth="2" />
        <path d="M 144 104 L 160 104 M 152 96 L 152 112" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />

        {/* Shopping Cart Wireframe Basket */}
        <path
          d="M 38 60 H 54 L 74 145 H 168 L 186 78 H 62"
          stroke="#15803d"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cart Grid Wire Lines */}
        <path
          d="M 76 96 H 180 M 80 120 H 172"
          stroke="#15803d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M 102 80 L 98 142 M 132 80 L 130 142 M 160 80 L 156 142"
          stroke="#15803d"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Cart Chassis Lower Bar */}
        <path
          d="M 78 158 H 158 L 168 174"
          stroke="#334155"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Wheels */}
        <circle cx="90" cy="182" r="12" fill="#ffffff" stroke="#15803d" strokeWidth="5" />
        <circle cx="90" cy="182" r="4" fill="#ea580c" />

        <circle cx="156" cy="182" r="12" fill="#ffffff" stroke="#15803d" strokeWidth="5" />
        <circle cx="156" cy="182" r="4" fill="#ea580c" />

        {/* Cart Handle */}
        <path
          d="M 36 60 L 46 60"
          stroke="#ea580c"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Disconnected Wi-Fi badge badge */}
        <g filter="url(#cartBadgeShadow)">
          <circle cx="188" cy="52" r="28" fill="#ffffff" stroke="#fdba74" strokeWidth="3" />
          
          {/* Signal wave arcs */}
          <path
            d="M 172 48 A 16 16 0 0 1 204 48"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 178 55 A 10 10 0 0 1 198 55"
            stroke="#15803d"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="188" cy="62" r="2.5" fill="#ea580c" />

          {/* Red Disconnection Slash */}
          <line
            x1="172"
            y1="36"
            x2="204"
            y2="68"
            stroke="#ef4444"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

// 4. Friendly shopping bag illustration with a disconnected Wi-Fi symbol
export function ShoppingBagOfflineIllustration({ className = 'w-48 h-48 sm:w-56 sm:h-56' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          <linearGradient id="bagGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="bagOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="bagBadgeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Soft base shadow */}
        <ellipse cx="120" cy="218" rx="72" ry="10" fill="#0f172a" opacity="0.08" />

        {/* Bag Handles */}
        <path
          d="M 88 95 C 88 45, 152 45, 152 95"
          fill="none"
          stroke="#ea580c"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M 94 95 C 94 55, 146 55, 146 95"
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Shopping Bag Body */}
        <path
          d="M 64 92 L 52 205 C 51 211 56 216 62 216 H 178 C 184 216 189 211 188 205 L 176 92 Z"
          fill="url(#bagGreenGrad)"
          stroke="#14532d"
          strokeWidth="2"
        />

        {/* Bag side fold effect */}
        <path
          d="M 64 92 L 78 216 M 176 92 L 162 216"
          stroke="#ffffff"
          strokeWidth="2"
          opacity="0.15"
        />

        {/* Friendly Face / Cheerful ViBa Smile on Bag */}
        {/* Cheerful eyes */}
        <circle cx="102" cy="138" r="4.5" fill="#ffffff" />
        <circle cx="138" cy="138" r="4.5" fill="#ffffff" />
        {/* Warm friendly smile */}
        <path
          d="M 108 152 Q 120 166 132 152"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Cute blush cheeks */}
        <circle cx="94" cy="148" r="5" fill="#fca5a5" opacity="0.7" />
        <circle cx="146" cy="148" r="5" fill="#fca5a5" opacity="0.7" />

        {/* ViBa Mart small emblem tag on bottom of bag */}
        <rect x="100" y="180" width="40" height="18" rx="5" fill="#ea580c" />
        <text x="120" y="193" textAnchor="middle" fill="#ffffff" fontWeight="800" fontSize="10" letterSpacing="1">
          ViBa
        </text>

        {/* Disconnected Wi-Fi badge in top corner */}
        <g filter="url(#bagBadgeGlow)">
          <circle cx="178" cy="80" r="28" fill="#ffffff" stroke="#fed7aa" strokeWidth="3" />
          
          {/* Signal wave arcs */}
          <path
            d="M 162 76 A 16 16 0 0 1 194 76"
            stroke="#15803d"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 168 83 A 10 10 0 0 1 188 83"
            stroke="#ea580c"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="178" cy="90" r="2.5" fill="#ea580c" />

          {/* Slashed Disconnection Indicator */}
          <line
            x1="162"
            y1="64"
            x2="194"
            y2="96"
            stroke="#ef4444"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}


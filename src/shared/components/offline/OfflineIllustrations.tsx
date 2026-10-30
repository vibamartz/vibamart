import React from 'react';

/**
 * 1. Centered Wi-Fi Disconnected Illustration
 * Used in: No Internet Connection Screen
 */
export function WifiDisconnectedIllustration({ className = 'w-48 h-48' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="wifiGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="wifiOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <linearGradient id="softRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#bbf7d0" stopOpacity="0.3" />
          </linearGradient>

          <radialGradient id="wifiGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#dcfce7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </radialGradient>

          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#ea580c" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Ambient glow and backdrop circles */}
        <circle cx="120" cy="120" r="105" fill="url(#wifiGlow)" />
        <circle cx="120" cy="120" r="88" fill="url(#softRingGrad)" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.6" />

        {/* Outer White Card / Island */}
        <circle cx="120" cy="120" r="76" fill="#FFFFFF" filter="url(#softShadow)" />

        {/* Decorative ambient dots */}
        <circle cx="48" cy="80" r="5" fill="#f97316" opacity="0.75" />
        <circle cx="192" cy="72" r="4" fill="#16a34a" opacity="0.8" />
        <circle cx="188" cy="165" r="6" fill="#f97316" opacity="0.6" />
        <circle cx="56" cy="160" r="4.5" fill="#15803d" opacity="0.6" />

        {/* Decorative mini stars/plus shapes */}
        <path d="M40 120 L44 120 M42 118 L42 122" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
        <path d="M200 120 L204 120 M202 118 L202 122" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />

        {/* Outer Arc (broken) */}
        <path
          d="M75 92 C88 78 103 71 120 71 C137 71 152 78 165 92"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="11"
          strokeLinecap="round"
        />

        {/* Middle Arc */}
        <path
          d="M92 110 C100 101 109 97 120 97 C131 97 140 101 148 110"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Inner Arc */}
        <path
          d="M107 128 C111 124 115 122 120 122 C125 122 129 124 133 128"
          stroke="url(#wifiGreenGrad)"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Bottom Dot */}
        <circle cx="120" cy="148" r="6.5" fill="url(#wifiGreenGrad)" />

        {/* Disconnect Slash / Badge - Premium Orange Accent */}
        <line
          x1="68"
          y1="172"
          x2="172"
          y2="68"
          stroke="#ffffff"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <line
          x1="68"
          y1="172"
          x2="172"
          y2="68"
          stroke="url(#wifiOrangeGrad)"
          strokeWidth="9"
          strokeLinecap="round"
        />

        {/* Disconnect indicator badge in the corner */}
        <g transform="translate(142, 136)">
          <circle cx="16" cy="16" r="16" fill="#ea580c" />
          <circle cx="16" cy="16" r="14" fill="#ffffff" />
          <circle cx="16" cy="16" r="11" fill="url(#wifiOrangeGrad)" />
          {/* Exclamation mark */}
          <rect x="14.5" y="9" width="3" height="7.5" rx="1.5" fill="#ffffff" />
          <circle cx="16" cy="19.5" r="1.5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 2. Friendly Shopping Storefront Illustration
 * Used in: Home Screen (Offline)
 */
export function StorefrontIllustration({ className = 'w-56 h-48' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      <svg
        viewBox="0 0 260 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-lg"
      >
        <defs>
          <linearGradient id="storeGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="storeOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <linearGradient id="awningStripeA" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="awningStripeB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="100%" stopColor="#fed7aa" />
          </linearGradient>

          <radialGradient id="storeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#ecfdf5" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          <filter id="softGlowShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#15803d" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ambient background soft glow */}
        <ellipse cx="130" cy="120" rx="110" ry="85" fill="url(#storeGlow)" />

        {/* Floating soft clouds & sparkles */}
        <path d="M35 55 Q45 45 55 55 Q65 48 75 56 Q85 64 70 70 Q30 70 35 55 Z" fill="#ffffff" opacity="0.85" />
        <path d="M195 45 Q205 38 215 45 Q225 40 232 47 Q240 55 228 60 Q190 60 195 45 Z" fill="#ffffff" opacity="0.85" />
        <circle cx="218" cy="85" r="4" fill="#f97316" opacity="0.75" />
        <circle cx="42" cy="140" r="5" fill="#22c55e" opacity="0.65" />

        {/* Store Ground Base / Pavement */}
        <rect x="25" y="185" width="210" height="10" rx="5" fill="#e2e8f0" />
        <rect x="35" y="182" width="190" height="4" rx="2" fill="#cbd5e1" opacity="0.6" />

        {/* Main Store Building Body */}
        <g filter="url(#softGlowShadow)">
          <rect x="48" y="75" width="164" height="108" rx="16" fill="#FFFFFF" stroke="#f1f5f9" strokeWidth="2" />
        </g>

        {/* Store Signboard: ViBa Mart */}
        <rect x="74" y="52" width="112" height="24" rx="7" fill="url(#storeGreen)" />
        <text
          x="130"
          y="68"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="12"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.8"
        >
          ViBa Mart
        </text>

        {/* Awning (Striped green & cream canopy) */}
        <g>
          {/* Awning segments */}
          <path d="M40 76 L62 76 L60 98 Q50 106 40 98 Z" fill="url(#awningStripeA)" />
          <path d="M62 76 L84 76 L82 98 Q72 106 62 98 Z" fill="url(#awningStripeB)" />
          <path d="M84 76 L106 76 L104 98 Q94 106 84 98 Z" fill="url(#awningStripeA)" />
          <path d="M106 76 L128 76 L126 98 Q116 106 106 98 Z" fill="url(#awningStripeB)" />
          <path d="M128 76 L150 76 L148 98 Q138 106 128 98 Z" fill="url(#awningStripeA)" />
          <path d="M150 76 L172 76 L170 98 Q160 106 150 98 Z" fill="url(#awningStripeB)" />
          <path d="M172 76 L194 76 L192 98 Q182 106 172 98 Z" fill="url(#awningStripeA)" />
          <path d="M194 76 L216 76 L214 98 Q204 106 194 98 Z" fill="url(#awningStripeB)" />
          <path d="M216 76 L220 76 L218 98 Q217 102 214 98 Z" fill="url(#awningStripeA)" />
        </g>

        {/* Display Window on Left */}
        <rect x="62" y="112" width="56" height="58" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
        <rect x="66" y="146" width="48" height="3" rx="1.5" fill="#bbf7d0" />
        {/* Products on display shelf */}
        <circle cx="75" cy="140" r="5" fill="#f97316" />
        <rect x="85" y="132" width="8" height="14" rx="2" fill="#16a34a" />
        <circle cx="102" cy="140" r="4.5" fill="#eab308" />

        {/* Front Door on Right */}
        <rect x="134" y="108" width="54" height="74" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5" />
        <rect x="142" y="116" width="38" height="30" rx="5" fill="#ffedd5" />
        {/* Door handle */}
        <circle cx="178" cy="148" r="3" fill="#ea580c" />

        {/* Little Welcome Door Mat */}
        <rect x="136" y="180" width="50" height="3" rx="1.5" fill="#ea580c" opacity="0.8" />

        {/* Small Potted Plant next to store */}
        <g transform="translate(202, 150)">
          {/* Pot */}
          <path d="M6 18 L18 18 L16 32 L8 32 Z" fill="url(#storeOrange)" />
          {/* Leaves */}
          <circle cx="12" cy="12" r="7" fill="#16a34a" />
          <circle cx="8" cy="14" r="5" fill="#22c55e" />
          <circle cx="16" cy="14" r="5" fill="#22c55e" />
        </g>

        {/* Friendly offline badge tag floating over storefront */}
        <g transform="translate(182, 70)">
          <circle cx="16" cy="16" r="16" fill="#ffffff" filter="url(#softGlowShadow)" />
          <circle cx="16" cy="16" r="13" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1" />
          {/* Mini disconnected Wi-Fi icon */}
          <path d="M10 13 C12 11 15 10 18 10 C20 10 22 11 23 13" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16 C14 14.5 16 14 18 14 C19.5 14 21 14.5 22 16" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="17" cy="20" r="1.5" fill="#ea580c" />
          <line x1="9" y1="23" x2="24" y2="9" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 3. Shopping Cart Illustration with Disconnected Wi-Fi Icon
 * Used in: Cart Screen (Offline)
 */
export function CartDisconnectedIllustration({ className = 'w-48 h-48' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      <svg
        viewBox="0 0 240 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          <linearGradient id="cartGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="cartOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <radialGradient id="cartBackdrop" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ecfdf5" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#fef3c7" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow backdrop */}
        <circle cx="120" cy="110" r="95" fill="url(#cartBackdrop)" />

        {/* Decorative sparkles & dots */}
        <circle cx="36" cy="72" r="4" fill="#16a34a" opacity="0.6" />
        <circle cx="204" cy="65" r="5" fill="#f97316" opacity="0.7" />
        <circle cx="48" cy="155" r="3.5" fill="#f97316" opacity="0.5" />
        <circle cx="198" cy="150" r="4" fill="#22c55e" opacity="0.6" />

        {/* Saved Items Inside Cart (Groceries / Bags) */}
        {/* Baguette/Item */}
        <rect x="74" y="60" width="14" height="42" rx="7" transform="rotate(-15 74 60)" fill="#f59e0b" />
        {/* Grocery Box / Bottle */}
        <rect x="94" y="66" width="22" height="34" rx="4" fill="url(#cartGreen)" />
        <rect x="98" y="58" width="14" height="9" rx="2" fill="#86efac" />
        {/* Fresh Fruit / Apple */}
        <circle cx="126" cy="88" r="14" fill="url(#cartOrange)" />
        <path d="M126 74 C128 71 133 71 135 74" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />

        {/* Cart Basket Structure */}
        <path
          d="M48 64 H64 L82 134 H154 L168 84 H76"
          fill="none"
          stroke="#334155"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cart Wire Grids */}
        <path d="M85 96 H163" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M88 114 H158" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M106 84 L101 134" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M132 84 L127 134" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />

        {/* Cart Handle */}
        <path d="M42 64 H58" stroke="url(#cartOrange)" strokeWidth="8" strokeLinecap="round" />

        {/* Cart Bottom Leg Chassis */}
        <path d="M88 134 L82 152 H148 L152 134" stroke="#334155" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

        {/* Wheels */}
        <circle cx="86" cy="164" r="12" fill="#1e293b" />
        <circle cx="86" cy="164" r="5" fill="#f8fafc" />
        <circle cx="146" cy="164" r="12" fill="#1e293b" />
        <circle cx="146" cy="164" r="5" fill="#f8fafc" />

        {/* Cart Shadow */}
        <ellipse cx="118" cy="184" rx="55" ry="6" fill="#0f172a" opacity="0.1" />

        {/* Disconnected Wi-Fi Badge on Cart */}
        <g transform="translate(136, 92)">
          {/* Badge outer pill */}
          <circle cx="28" cy="28" r="28" fill="#FFFFFF" />
          <circle cx="28" cy="28" r="25" fill="#fff7ed" stroke="#fdba74" strokeWidth="2" />

          {/* Wi-Fi Waves */}
          <path d="M15 22 C19 18 24 16 28 16 C32 16 37 18 41 22" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
          <path d="M19 27 C22 24 25 22.5 28 22.5 C31 22.5 34 24 37 27" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="28" cy="35" r="3" fill="#16a34a" />

          {/* Disconnect Slash Line */}
          <line x1="12" y1="42" x2="44" y2="12" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
          <line x1="12" y1="42" x2="44" y2="12" stroke="url(#cartOrange)" strokeWidth="3.2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/**
 * 4. Friendly Shopping Bag with Disconnected Wi-Fi Symbol
 * Used in: Offline Splash Screen
 */
export function ShoppingBagDisconnectedIllustration({ className = 'w-52 h-52' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className} select-none`}>
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          <linearGradient id="bagGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>

          <linearGradient id="bagOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>

          <linearGradient id="bagCreamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fef3c7" />
          </linearGradient>

          <radialGradient id="splashBagGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#bbf7d0" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
          </radialGradient>

          <filter id="bagShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#15803d" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* Ambient background glow & decorative floating circles */}
        <circle cx="120" cy="125" r="105" fill="url(#splashBagGlow)" />
        <circle cx="45" cy="65" r="6" fill="#f97316" opacity="0.7" />
        <circle cx="195" cy="55" r="5" fill="#16a34a" opacity="0.8" />
        <circle cx="36" cy="165" r="4" fill="#22c55e" opacity="0.6" />
        <circle cx="205" cy="170" r="6" fill="#ea580c" opacity="0.65" />

        {/* Shadow under bag */}
        <ellipse cx="118" cy="198" rx="60" ry="8" fill="#1e293b" opacity="0.12" />

        {/* Bag Handles */}
        <path
          d="M92 98 V62 C92 48 102 38 116 38 C130 38 140 48 140 62 V98"
          stroke="url(#bagOrangeGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />

        {/* Main Shopping Bag Body */}
        <g filter="url(#bagShadow)">
          <path
            d="M66 92 H166 L176 186 C176 192 171 196 165 196 H67 C61 196 56 192 56 186 L66 92 Z"
            fill="url(#bagGreenGrad)"
          />
        </g>

        {/* Fold detail at top rim */}
        <path
          d="M66 92 H166 L164 105 H68 L66 92 Z"
          fill="#14532d"
          opacity="0.3"
        />

        {/* Friendly shopping bag face / ViBa emblem */}
        <g transform="translate(116, 142)">
          {/* Friendly Winking Eyes */}
          <circle cx="-16" cy="-8" r="3.5" fill="#ffffff" />
          <path d="M12 -8 Q18 -12 22 -6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Gentle Smile */}
          <path
            d="M-12 8 Q2 20 16 8"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Rosy blush cheeks */}
          <circle cx="-22" cy="4" r="4" fill="#fb923c" opacity="0.8" />
          <circle cx="22" cy="4" r="4" fill="#fb923c" opacity="0.8" />
        </g>

        {/* Disconnected Wi-Fi Symbol Badge Floating on Bag */}
        <g transform="translate(135, 115)">
          {/* Badge outer circular plate */}
          <circle cx="28" cy="28" r="28" fill="#FFFFFF" />
          <circle cx="28" cy="28" r="25" fill="#fff7ed" stroke="#fed7aa" strokeWidth="2" />

          {/* Wi-Fi Arcs in Orange & Green */}
          <path d="M16 22 C20 18 24 16 28 16 C32 16 36 18 40 22" stroke="#ea580c" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M20 27 C23 24 25.5 22.5 28 22.5 C30.5 22.5 33 24 36 27" stroke="#ea580c" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="28" cy="35" r="3" fill="#ea580c" />

          {/* Disconnect Slash */}
          <line x1="12" y1="42" x2="44" y2="12" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
          <line x1="12" y1="42" x2="44" y2="12" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}


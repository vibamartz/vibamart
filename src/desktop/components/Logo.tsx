import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  variant?: 'light' | 'dark';
  showTextOnMobile?: boolean;
}

export default function Logo({ className = '', iconOnly = false, variant = 'light', showTextOnMobile = false }: LogoProps) {
  const rawId = useId();
  const uniqueId = rawId.replace(/[^a-zA-Z0-9]/g, '_');
  const vGradId = `vGrad_${uniqueId}`;
  const bGradId = `bGrad_${uniqueId}`;

  const textColor = variant === 'light' ? 'text-gray-900' : 'text-white';
  const martColor = variant === 'light' ? 'text-gray-800' : 'text-gray-200';
  const subTextColor = variant === 'light' ? 'text-gray-500' : 'text-gray-400';
  const primaryColor = 'text-emerald-600';
  const secondaryColor = 'text-amber-500';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        {/* custom SVG Logo Mark - Crisp & Vibrant 'VB' style */}
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center group select-none shrink-0">
          <svg
            viewBox="0 0 110 110"
            className="w-full h-full drop-shadow-md"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id={vGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
              <linearGradient id={bGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>

            <g transform="translate(5, 5)">
              {/* Stylized V */}
              <path
                d="M10 25 L38 85 L48 85 L32 25 Z"
                fill={`url(#${vGradId})`}
              />

              {/* Slashes */}
              <path
                d="M45 25 L65 85 H70 L50 25 Z"
                fill={`url(#${vGradId})`}
                opacity="0.95"
              />
              <path
                d="M55 25 L75 85 H80 L60 25 Z"
                fill={`url(#${bGradId})`}
                opacity="0.95"
              />

              {/* Stylized B */}
              <path
                d="M65 25 L88 25 C95 25 100 30 100 38 C100 45 95 50 88 52 C95 54 100 59 100 68 C100 77 95 85 85 85 H70 L90 25 Z"
                fill={`url(#${bGradId})`}
              />

              {/* Inner B holes for punch-out feel */}
              <path d="M82 42 H88 C90 42 92 40 92 38 C92 36 90 34 88 34 H84 L82 42 Z" fill="#ffffff" opacity="0.4" />
              <path d="M78 75 H85 C88 75 90 73 90 68 C90 63 88 61 85 61 H82 L78 75 Z" fill="#ffffff" opacity="0.4" />
            </g>
          </svg>
        </div>
      </div>

      {!iconOnly && (
        <div className={`${showTextOnMobile ? 'flex' : 'hidden sm:flex'} flex-col justify-center leading-none`}>
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl sm:text-3xl font-black tracking-tight flex">
              <span className={`${primaryColor} italic`}>Vi</span>
              <span className={`${secondaryColor} italic`}>Ba</span>
            </span>
            <span className={`${martColor} font-black italic text-lg sm:text-xl tracking-tight ml-0.5`}>Mart</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="h-[1.5px] w-3.5 bg-emerald-600" />
            <span className={`text-[8px] sm:text-[9px] font-extrabold ${subTextColor} uppercase tracking-[0.25em]`}>
              Online Grocery & Shopping
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  variant?: 'light' | 'dark';
}

export default function Logo({ className = '', iconOnly = false, variant = 'light' }: LogoProps) {
  const textColor = variant === 'light' ? 'text-gray-900' : 'text-white';
  const martColor = variant === 'light' ? 'text-gray-800' : 'text-gray-200';
  const subTextColor = variant === 'light' ? 'text-gray-400' : 'text-gray-500';
  const primaryColor = 'text-primary';
  const secondaryColor = 'text-secondary';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* custom SVG Logo Mark - Refined 'VB' minimal style */}
        <div className="relative w-14 h-14 flex items-center justify-center group select-none">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full drop-shadow-md"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#16a34a" />
                <stop offset="100%" stopColor="#15803d" />
              </linearGradient>
              <linearGradient id="bGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>


            {/* Stylized V */}
            <path
              d="M10 25 L38 85 L48 85 L32 25 Z"
              fill="url(#vGrad)"
            />
            
            {/* Slashes (Parallel lines from the image) */}
            <path
              d="M45 25 L65 85 H70 L50 25 Z"
              fill="url(#vGrad)"
              className="opacity-90"
            />
            <path
              d="M55 25 L75 85 H80 L60 25 Z"
              fill="url(#bGrad)"
              className="opacity-90"
            />

            {/* Stylized B */}
            <path
              d="M65 25 L88 25 C95 25 100 30 100 38 C100 45 95 50 88 52 C95 54 100 59 100 68 C100 77 95 85 85 85 H70 L90 25 Z"
              fill="url(#bGrad)"
            />
            
            {/* Inner B holes for punch-out feel (Optional, or just solid shapes) */}
            <path d="M82 42 H88 C90 42 92 40 92 38 C92 36 90 34 88 34 H84 L82 42 Z" fill="white" className="opacity-10" />
            <path d="M78 75 H85 C88 75 90 73 90 68 C90 63 88 61 85 61 H82 L78 75 Z" fill="white" className="opacity-10" />
          </svg>
        </div>
      </div>
      
      {!iconOnly && (
        <div className="hidden sm:flex flex-col justify-center leading-none">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-black tracking-tight flex">
              <span className={`${primaryColor} italic`}>Vi</span>
<span className={`${secondaryColor} italic`}>Ba</span>
            </span>
            <span className={`${martColor} font-black italic text-lg tracking-tight ml-0.5`}>Mart</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`h-[1px] w-3 bg-primary/40`} />
            <span className={`text-[8px] font-extrabold ${subTextColor} uppercase tracking-[0.3em]`}>
               Premium Lifestyle
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

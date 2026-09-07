import React from 'react';
import { Layers, Sparkles, Smartphone, Shirt, Laptop, Home as HomeIcon, Tv, Tag } from 'lucide-react';

interface CategoryLogoProps {
  name: string;
  image?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  className?: string;
  showLabel?: boolean;
  labelClassName?: string;
}

export function renderCategoryFallbackIcon(name: string = '', iconName: string = '', sizeClass: string = 'w-5 h-5') {
  const lower = name.toLowerCase();
  
  if (lower.includes('mobile') || lower.includes('phone') || iconName === 'smartphone') {
    return <Smartphone className={`${sizeClass} text-emerald-600`} />;
  }
  if (lower.includes('fashion') || lower.includes('cloth') || lower.includes('shirt') || lower.includes('men') || lower.includes('women') || iconName === 'shirt') {
    return <Shirt className={`${sizeClass} text-emerald-600`} />;
  }
  if (lower.includes('electron') || lower.includes('laptop') || lower.includes('computer') || iconName === 'laptop') {
    return <Laptop className={`${sizeClass} text-emerald-600`} />;
  }
  if (lower.includes('home') || lower.includes('decor') || lower.includes('furnit') || iconName === 'home') {
    return <HomeIcon className={`${sizeClass} text-emerald-600`} />;
  }
  if (lower.includes('appliance') || lower.includes('tv') || iconName === 'tv') {
    return <Tv className={`${sizeClass} text-emerald-600`} />;
  }
  if (lower.includes('beauty') || lower.includes('skin') || lower.includes('makeup') || iconName === 'sparkles') {
    return <Sparkles className={`${sizeClass} text-amber-500`} />;
  }
  if (lower.includes('deal') || lower.includes('offer')) {
    return <Tag className={`${sizeClass} text-rose-500`} />;
  }
  if (lower.includes('toy') || lower.includes('kid')) {
    return <Sparkles className={`${sizeClass} text-yellow-500`} />;
  }
  
  return <Layers className={`${sizeClass} text-emerald-600`} />;
}

export default function CategoryLogo({
  name,
  image,
  icon,
  size = 'md',
  active = false,
  className = '',
  showLabel = false,
  labelClassName = '',
}: CategoryLogoProps) {
  // Dimension mappings matching Mobile Category UI specifications
  const sizeMap = {
    sm: {
      box: 'w-8 h-8 rounded-xl',
      icon: 'w-4 h-4',
      text: 'text-[9px]',
    },
    md: {
      box: 'w-11 h-11 rounded-2xl',
      icon: 'w-5 h-5',
      text: 'text-[10px]',
    },
    lg: {
      box: 'w-14 h-14 rounded-2xl',
      icon: 'w-7 h-7',
      text: 'text-xs',
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const baseStyle = `flex items-center justify-center overflow-hidden transition-all duration-200 ${currentSize.box}`;
  
  const activeStyle = active
    ? 'bg-emerald-600 text-white shadow-md scale-105 ring-2 ring-emerald-500/20'
    : 'bg-white border border-yellow-200/90 shadow-xs hover:border-emerald-300 hover:shadow-sm';

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`${baseStyle} ${activeStyle} ${className}`}>
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
              const parent = (e.target as HTMLElement).parentElement;
              if (parent) {
                const fallbackContainer = parent.querySelector('.category-fallback-icon') as HTMLElement;
                if (fallbackContainer) fallbackContainer.style.display = 'flex';
              }
            }}
          />
        ) : null}

        <div
          className="category-fallback-icon flex items-center justify-center w-full h-full bg-emerald-50/60"
          style={{ display: image ? 'none' : 'flex' }}
        >
          {renderCategoryFallbackIcon(name, icon, currentSize.icon)}
        </div>
      </div>

      {showLabel && (
        <span
          className={`font-extrabold line-clamp-1 mt-1.5 px-0.5 leading-tight ${currentSize.text} ${
            active ? 'text-emerald-800' : 'text-gray-700'
          } ${labelClassName}`}
        >
          {name}
        </span>
      )}
    </div>
  );
}

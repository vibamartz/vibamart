import React from 'react';
import {
  Layers, Sparkles, Smartphone, Shirt, Laptop, Home as HomeIcon, Tv, Tag, Flame,
  Headphones, Camera, Gamepad, Gamepad2, BookOpen, Dumbbell, Car, Watch, ShoppingBag, Apple,
  Gift, Percent, Package
} from 'lucide-react';

export const Lipstick = ({ className = "w-5 h-5", size = 24, color = "currentColor", strokeWidth = 2, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M6 12h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-9z" />
    <path d="M8 8h8v4H8z" />
    <path d="M9 8V4.5L15 2v6" />
  </svg>
);

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

export function renderCategoryFallbackIcon(
  name: string = '',
  iconName: string = '',
  sizeClass: string = 'w-5 h-5',
  active: boolean = false,
  customColor?: string
) {
  const lowerName = name.toLowerCase();
  const lowerIcon = iconName.toLowerCase();
  const colorClass = active ? 'text-white' : (customColor || 'text-emerald-600');

  if (lowerName.includes('toy') || lowerName.includes('kid') || lowerName.includes('baby') || lowerIcon === 'gamepad') {
    return <Gamepad className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('food') || lowerName.includes('health') || lowerName.includes('grocer') || lowerName.includes('fruit') || lowerIcon === 'apple') {
    return <Apple className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('for you') || lowerName.includes('recommend') || lowerIcon === 'sparkles') {
    return <Sparkles className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('deal') || lowerName.includes('offer') || lowerName.includes('discount') || lowerIcon === 'flame' || lowerIcon === 'fire') {
    return <Flame className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('beauty') || lowerName.includes('skin') || lowerName.includes('makeup') || lowerName.includes('cosmetic') || lowerIcon === 'lipstick') {
    return <Lipstick className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('mobile') || lowerName.includes('phone') || lowerIcon === 'smartphone') {
    return <Smartphone className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('fashion') || lowerName.includes('cloth') || lowerName.includes('shirt') || lowerName.includes('men') || lowerName.includes('women') || lowerName.includes('apparel') || lowerName.includes('footwear') || lowerName.includes('shoe') || lowerIcon === 'shirt') {
    return <Shirt className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('electron') || lowerName.includes('laptop') || lowerName.includes('computer') || lowerIcon === 'laptop') {
    return <Laptop className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('home') || lowerName.includes('decor') || lowerName.includes('furnit') || lowerIcon === 'home') {
    return <HomeIcon className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('appliance') || lowerName.includes('tv') || lowerName.includes('televis') || lowerName.includes('refrig') || lowerIcon === 'tv') {
    return <Tv className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('toy') || lowerName.includes('kid') || lowerName.includes('baby') || lowerIcon === 'gamepad') {
    return <Gamepad className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('food') || lowerName.includes('health') || lowerName.includes('grocer') || lowerName.includes('fruit') || lowerIcon === 'apple') {
    return <Apple className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('audio') || lowerName.includes('headphone') || lowerName.includes('sound')) {
    return <Headphones className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('camera') || lowerName.includes('photo')) {
    return <Camera className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('game') || lowerName.includes('gaming')) {
    return <Gamepad className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('book') || lowerName.includes('stationery')) {
    return <BookOpen className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('sport') || lowerName.includes('fitness')) {
    return <Dumbbell className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('auto') || lowerName.includes('car') || lowerName.includes('bike')) {
    return <Car className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('watch') || lowerName.includes('jewel')) {
    return <Watch className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('bag') || lowerName.includes('luggage')) {
    return <ShoppingBag className={`${sizeClass} ${colorClass}`} />;
  }
  if (lowerName.includes('reward') || lowerName.includes('gift')) {
    return <Gift className={`${sizeClass} ${colorClass}`} />;
  }

  return <Layers className={`${sizeClass} ${colorClass}`} />;
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
  // Dimension mappings matching Category UI specifications
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
    : 'bg-emerald-50/60 border border-yellow-200/90 shadow-xs hover:border-emerald-300 hover:shadow-sm';

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className={`${baseStyle} ${activeStyle} ${className}`}>
        <div className="flex items-center justify-center w-full h-full">
          {image && (image.startsWith('http') || image.startsWith('data:') || image.startsWith('/')) ? (
            <img src={image} alt={name} className="w-full h-full object-cover" />
          ) : (
            renderCategoryFallbackIcon(name, icon, currentSize.icon, active)
          )}
        </div>
      </div>

      {showLabel && (
        <span
          className={`font-extrabold line-clamp-1 mt-1.5 px-0.5 leading-tight ${currentSize.text} ${active ? 'text-emerald-800' : 'text-gray-700'
            } ${labelClassName}`}
        >
          {name}
        </span>
      )}
    </div>
  );
}


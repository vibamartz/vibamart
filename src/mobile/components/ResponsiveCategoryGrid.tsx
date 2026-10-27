import React from 'react';
import { renderCategoryFallbackIcon } from '../../shared/components/CategoryLogo';

export interface CategoryGridItem {
  id: string;
  name: string;
  image?: string;
  icon?: string;
  slug?: string;
  [key: string]: any;
}

interface ResponsiveCategoryGridProps<T extends CategoryGridItem = CategoryGridItem> {
  items: T[];
  onItemClick: (item: T) => void;
  isSelected?: (item: T) => boolean;
  compact?: boolean;
  boxSizeClass?: string;
  iconSizeClass?: string;
  textSizeClass?: string;
  gapXClass?: string;
  gapYClass?: string;
  className?: string;
}

export default function ResponsiveCategoryGrid<T extends CategoryGridItem = CategoryGridItem>({
  items,
  onItemClick,
  isSelected,
  compact = false,
  boxSizeClass,
  iconSizeClass,
  textSizeClass,
  gapXClass,
  gapYClass,
  className = ''
}: ResponsiveCategoryGridProps<T>) {
  if (!items || items.length === 0) return null;

  // Determine styling based on compactness
  const actualBoxSize = boxSizeClass || (compact ? 'w-10 h-10' : 'w-11 h-11 sm:w-12 sm:h-12');
  const actualIconSize = iconSizeClass || (compact ? 'w-5 h-5' : 'w-5 h-5 sm:w-6 sm:h-6');
  const actualTextSize = textSizeClass || (compact ? 'text-[9px]' : 'text-[10px]');
  const actualGapX = gapXClass || (compact ? 'gap-x-1' : 'gap-x-1.5');
  const actualGapY = gapYClass || (compact ? 'gap-y-1.5' : 'gap-y-2');
  const gapPx = compact ? 4 : 6;

  const renderItemNode = (item: T, idx: number | string) => {
    const selected = isSelected ? Boolean(isSelected(item)) : false;
    const hasImage = Boolean(item.image && (item.image.startsWith('http') || item.image.startsWith('data:') || item.image.startsWith('/')));

    return (
      <button
        key={item.id || item.slug || idx}
        onClick={() => onItemClick(item)}
        className="flex flex-col items-center justify-start gap-1 shrink-0 w-full min-w-0 cursor-pointer active:scale-95 transition-all text-center select-none group"
      >
        <div
          className={`${actualBoxSize} rounded-xl overflow-hidden flex items-center justify-center shrink-0 transition-all ${
            selected
              ? 'ring-2 ring-emerald-600 bg-white shadow-xs scale-105'
              : 'bg-emerald-50/60 border border-emerald-100/70 shadow-2xs group-hover:border-emerald-300'
          }`}
        >
          {hasImage ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${selected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              {renderCategoryFallbackIcon(item.name, item.icon, actualIconSize, selected)}
            </div>
          )}
        </div>
        <span
          className={`font-bold leading-tight line-clamp-1 truncate w-full px-0.5 tracking-tight ${actualTextSize} ${
            selected ? 'text-emerald-900 font-black' : 'text-gray-700'
          }`}
        >
          {item.name}
        </span>
      </button>
    );
  };

  // Case 1: 10 items or fewer
  // In a 5-column CSS grid:
  // - 10 items: 5 on Row 1, 5 on Row 2 (5 + 5)
  // - 9 items: 5 on Row 1, 4 on Row 2 (5 + 4)
  // - 8 items: 5 on Row 1, 3 on Row 2 (5 + 3)
  // - 7 items: 5 on Row 1, 2 on Row 2 (5 + 2)
  // - 6 items: 5 on Row 1, 1 on Row 2 (5 + 1)
  // - 5 items: 5 on Row 1 (5 in 1 row)
  // - <= 4 items: row 1 only
  if (items.length <= 10) {
    return (
      <div className={`grid grid-cols-5 ${actualGapX} ${actualGapY} w-full ${className}`}>
        {items.map((item, idx) => renderItemNode(item, idx))}
      </div>
    );
  }

  // Case 2: More than 10 items
  // Strictly maintain 2 rows, horizontally scrollable with at least 5 items per row in view
  const cols = Math.ceil(items.length / 2);
  const row1 = items.slice(0, cols);
  const row2 = items.slice(cols);

  return (
    <div
      className={`overflow-x-auto hide-scrollbar no-scrollbar py-0.5 w-full ${className}`}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div
        className={`grid ${actualGapX} ${actualGapY}`}
        style={{
          gridTemplateRows: 'repeat(2, auto)',
          gridAutoFlow: 'column',
          gridAutoColumns: `calc((100% - ${4 * gapPx}px) / 5)`,
        }}
      >
        {Array.from({ length: cols }).flatMap((_, c) => {
          const nodes = [];
          if (c < row1.length) nodes.push(renderItemNode(row1[c], `r1-${c}`));
          if (c < row2.length) nodes.push(renderItemNode(row2[c], `r2-${c}`));
          return nodes;
        })}
      </div>
    </div>
  );
}

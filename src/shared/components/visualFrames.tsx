import React from 'react';

export interface FrameShapeConfig {
  id: string;
  name: string;
  category: 'Standard Shapes' | 'Architectural & Scalloped Frames' | 'Traditional & Heritage';
  aspectClass: string; // Tailwind aspect ratio class
  aspectRatio: string; // CSS aspect ratio fallback
  borderRadius?: string; // CSS border radius class if purely CSS
  clipPathId?: string; // SVG defs clipPath ID if SVG based
  description: string;
  iconSvg?: string; // Small preview SVG path
}

export const FRAME_SHAPES: FrameShapeConfig[] = [
  {
    id: 'portrait-3-4',
    name: 'Portrait 3:4',
    category: 'Standard Shapes',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    borderRadius: 'rounded-2xl',
    description: 'Clean standard 3:4 portrait card'
  },
  {
    id: 'portrait-4-5',
    name: 'Portrait 4:5',
    category: 'Standard Shapes',
    aspectClass: 'aspect-[4/5]',
    aspectRatio: '4/5',
    borderRadius: 'rounded-2xl',
    description: 'Modern 4:5 vertical portrait'
  },
  {
    id: 'square',
    name: 'Square (1:1)',
    category: 'Standard Shapes',
    aspectClass: 'aspect-square',
    aspectRatio: '1/1',
    borderRadius: 'rounded-2xl',
    description: 'Balanced 1:1 square card'
  },
  {
    id: 'circle',
    name: 'Circle',
    category: 'Standard Shapes',
    aspectClass: 'aspect-square',
    aspectRatio: '1/1',
    borderRadius: 'rounded-full',
    description: 'Full circular round shape'
  },
  {
    id: 'capsule',
    name: 'Capsule / Pill',
    category: 'Standard Shapes',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    borderRadius: 'rounded-full',
    description: 'Smooth capsule stadium shape'
  },
  {
    id: 'scalloped-arch',
    name: 'Scalloped Arch Frame',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-scalloped-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Elegantly arched top with scalloped contour'
  },
  {
    id: 'scalloped-window',
    name: 'Scalloped Window Frame',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-[4/5]',
    aspectRatio: '4/5',
    clipPathId: 'vns-clip-scalloped-window',
    description: 'Ornate Moorish multi-lobed window frame'
  },
  {
    id: 'decorative-scalloped',
    name: 'Decorative Scalloped Frame',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-[4/5]',
    aspectRatio: '4/5',
    clipPathId: 'vns-clip-decorative-scalloped',
    description: 'Continuous scalloped wave border'
  },
  {
    id: 'ornamental-arch',
    name: 'Ornamental Arch Frame',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-ornamental-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Baroque crown arch with ornamental flourishes'
  },
  {
    id: 'mughal-arch',
    name: 'Mughal / Indian Arch Frame',
    category: 'Traditional & Heritage',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-mughal-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Authentic cusped Mughal jharokha arch'
  },
  {
    id: 'floral-scallop',
    name: 'Floral Scallop Frame',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-square',
    aspectRatio: '1/1',
    clipPathId: 'vns-clip-floral-scallop',
    description: 'Lotus / flower petal rosette frame'
  },
  {
    id: 'temple-arch',
    name: 'Temple Arch Frame',
    category: 'Traditional & Heritage',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-temple-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Indian mandir / temple pinnacle arch'
  },
  {
    id: 'classic-arch',
    name: 'Classic Cathedral Arch',
    category: 'Architectural & Scalloped Frames',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-classic-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Smooth Roman dome cathedral arch'
  },
  {
    id: 'moroccan-arch',
    name: 'Moroccan Ogee Arch',
    category: 'Traditional & Heritage',
    aspectClass: 'aspect-[3/4]',
    aspectRatio: '3/4',
    clipPathId: 'vns-clip-moroccan-arch',
    borderRadius: 'rounded-b-2xl',
    description: 'Pointed ogee dome arch'
  }
];

export function getFrameConfig(frameShape?: string): FrameShapeConfig {
  if (!frameShape) {
    return FRAME_SHAPES[0]; // Default: Portrait 3:4
  }
  const found = FRAME_SHAPES.find(f => f.id === frameShape || f.id.toLowerCase() === frameShape.toLowerCase());
  return found || FRAME_SHAPES[0];
}

/**
 * Global SVG Definitions for all frame clip paths.
 * Uses clipPathUnits="objectBoundingBox" (normalized 0 to 1) for 100% responsiveness & crisp vector clipping.
 */
export const VisualFrameDefs: React.FC = () => {
  return (
    <svg
      width="0"
      height="0"
      className="absolute w-0 h-0 pointer-events-none opacity-0 overflow-hidden"
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0 }}
    >
      <defs>
        {/* 1. Classic Cathedral Arch */}
        <clipPath id="vns-clip-classic-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0,0.35 C 0,0.1 0.2,0 0.5,0 C 0.8,0 1,0.1 1,0.35 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 Z" />
        </clipPath>

        {/* 2. Scalloped Arch Frame */}
        <clipPath id="vns-clip-scalloped-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0,0.42 C 0,0.34 0.04,0.27 0.10,0.23 C 0.15,0.13 0.26,0.08 0.35,0.06 C 0.41,0 0.59,0 0.65,0.06 C 0.74,0.08 0.85,0.13 0.90,0.23 C 0.96,0.27 1,0.34 1,0.42 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 Z" />
        </clipPath>

        {/* 3. Scalloped Window Frame */}
        <clipPath id="vns-clip-scalloped-window" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.01 C 0.62,0.01 0.70,0.06 0.74,0.12 C 0.82,0.10 0.90,0.18 0.88,0.26 C 0.95,0.30 0.99,0.38 0.99,0.5 C 0.99,0.62 0.95,0.70 0.88,0.74 C 0.90,0.82 0.82,0.90 0.74,0.88 C 0.70,0.94 0.62,0.99 0.5,0.99 C 0.38,0.99 0.30,0.94 0.26,0.88 C 0.18,0.90 0.10,0.82 0.12,0.74 C 0.05,0.70 0.01,0.62 0.01,0.5 C 0.01,0.38 0.05,0.30 0.12,0.26 C 0.10,0.18 0.18,0.10 0.26,0.12 C 0.30,0.06 0.38,0.01 0.5,0.01 Z" />
        </clipPath>

        {/* 4. Decorative Scalloped Frame (Postage Stamp / Plaque Ripple) */}
        <clipPath id="vns-clip-decorative-scalloped" clipPathUnits="objectBoundingBox">
          <path d="M 0.08,0.02 C 0.12,0 0.16,0 0.2,0.02 C 0.24,0 0.28,0 0.32,0.02 C 0.36,0 0.40,0 0.44,0.02 C 0.48,0 0.52,0 0.56,0.02 C 0.60,0 0.64,0 0.68,0.02 C 0.72,0 0.76,0 0.80,0.02 C 0.84,0 0.88,0 0.92,0.02 C 0.96,0.04 1,0.08 0.98,0.14 C 1,0.18 1,0.22 0.98,0.26 C 1,0.30 1,0.34 0.98,0.38 C 1,0.42 1,0.46 0.98,0.50 C 1,0.54 1,0.58 0.98,0.62 C 1,0.66 1,0.70 0.98,0.74 C 1,0.78 1,0.82 0.98,0.86 C 1,0.92 0.96,0.96 0.92,0.98 C 0.88,1 0.84,1 0.80,0.98 C 0.76,1 0.72,1 0.68,0.98 C 0.64,1 0.60,1 0.56,0.98 C 0.52,1 0.48,1 0.44,0.98 C 0.40,1 0.36,1 0.32,0.98 C 0.28,1 0.24,1 0.20,0.98 C 0.16,1 0.12,1 0.08,0.98 C 0.04,0.96 0,0.92 0.02,0.86 C 0,0.82 0,0.78 0.02,0.74 C 0,0.70 0,0.66 0.02,0.62 C 0,0.58 0,0.54 0.02,0.50 C 0,0.46 0,0.42 0.02,0.38 C 0,0.34 0,0.30 0.02,0.26 C 0,0.22 0,0.18 0.02,0.14 C 0,0.08 0.04,0.04 0.08,0.02 Z" />
        </clipPath>

        {/* 5. Ornamental Arch Frame */}
        <clipPath id="vns-clip-ornamental-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.01 C 0.55,0.08 0.62,0.05 0.66,0.12 C 0.73,0.10 0.80,0.18 0.82,0.26 C 0.92,0.30 1,0.40 1,0.52 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 L 0,0.52 C 0,0.40 0.08,0.30 0.18,0.26 C 0.20,0.18 0.27,0.10 0.34,0.12 C 0.38,0.05 0.45,0.08 0.5,0.01 Z" />
        </clipPath>

        {/* 6. Mughal / Indian Arch Frame */}
        <clipPath id="vns-clip-mughal-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.02 C 0.54,0.05 0.60,0.06 0.64,0.05 C 0.68,0.09 0.74,0.11 0.76,0.16 C 0.81,0.19 0.88,0.24 0.89,0.31 C 0.96,0.35 1,0.42 1,0.50 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 L 0,0.50 C 0,0.42 0.04,0.35 0.11,0.31 C 0.12,0.24 0.19,0.19 0.24,0.16 C 0.26,0.11 0.32,0.09 0.36,0.05 C 0.40,0.06 0.46,0.05 0.5,0.02 Z" />
        </clipPath>

        {/* 7. Floral Scallop Frame (Lotus / Petal Rosette) */}
        <clipPath id="vns-clip-floral-scallop" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.02 C 0.58,0.02 0.66,0.06 0.72,0.12 C 0.78,0.06 0.88,0.08 0.92,0.16 C 0.98,0.22 0.98,0.32 0.94,0.40 C 1,0.46 1,0.56 0.94,0.62 C 0.98,0.70 0.96,0.80 0.90,0.86 C 0.84,0.92 0.74,0.94 0.66,0.90 C 0.60,0.96 0.50,0.98 0.42,0.94 C 0.34,0.98 0.24,0.94 0.18,0.88 C 0.12,0.82 0.10,0.72 0.14,0.64 C 0.08,0.58 0.08,0.48 0.14,0.42 C 0.10,0.34 0.12,0.24 0.18,0.18 C 0.24,0.12 0.34,0.10 0.42,0.14 C 0.46,0.06 0.52,0.02 0.5,0.02 Z" />
        </clipPath>

        {/* 8. Temple Arch Frame */}
        <clipPath id="vns-clip-temple-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.01 L 0.54,0.05 L 0.52,0.07 L 0.62,0.12 L 0.59,0.15 L 0.73,0.22 L 0.70,0.26 L 0.88,0.37 L 0.86,0.41 L 1,0.50 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 L 0,0.50 L 0.14,0.41 L 0.12,0.37 L 0.30,0.26 L 0.27,0.22 L 0.41,0.15 L 0.38,0.12 L 0.48,0.07 L 0.46,0.05 Z" />
        </clipPath>

        {/* 9. Moroccan Ogee Arch */}
        <clipPath id="vns-clip-moroccan-arch" clipPathUnits="objectBoundingBox">
          <path d="M 0.5,0.01 C 0.53,0.06 0.58,0.12 0.65,0.16 C 0.76,0.22 0.86,0.22 0.94,0.32 C 1,0.40 1,0.50 1,0.60 L 1,0.92 C 1,0.97 0.96,1 0.9,1 L 0.1,1 C 0.04,1 0,0.97 0,0.92 L 0,0.60 C 0,0.50 0,0.40 0.06,0.32 C 0.14,0.22 0.24,0.22 0.35,0.16 C 0.42,0.12 0.47,0.06 0.5,0.01 Z" />
        </clipPath>
      </defs>
    </svg>
  );
};

import { create } from 'zustand';
import { Product, BrandCoupon } from '../../shared/types';

export interface DesktopShareOptions {
  specificUrl?: string;
  specificImage?: string;
  variantName?: string;
}

interface DesktopShareStore {
  isOpen: boolean;
  product: Product | null;
  reward: BrandCoupon | null;
  options?: DesktopShareOptions;
  openShare: (product: Product, options?: DesktopShareOptions) => void;
  openRewardShare: (reward: BrandCoupon) => void;
  closeShare: () => void;
}

export const useDesktopShareStore = create<DesktopShareStore>((set) => ({
  isOpen: false,
  product: null,
  reward: null,
  options: undefined,
  openShare: (product, options) => {
    set({
      isOpen: true,
      product,
      reward: null,
      options,
    });
  },
  openRewardShare: (reward) => {
    set({
      isOpen: true,
      product: null,
      reward,
      options: undefined,
    });
  },
  closeShare: () => set({ isOpen: false, product: null, reward: null, options: undefined }),
}));

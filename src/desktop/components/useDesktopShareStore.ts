import { create } from 'zustand';
import { Product } from '../../shared/types';

export interface DesktopShareOptions {
  specificUrl?: string;
  specificImage?: string;
  variantName?: string;
}

interface DesktopShareStore {
  isOpen: boolean;
  product: Product | null;
  options?: DesktopShareOptions;
  openShare: (product: Product, options?: DesktopShareOptions) => void;
  closeShare: () => void;
}

export const useDesktopShareStore = create<DesktopShareStore>((set) => ({
  isOpen: false,
  product: null,
  options: undefined,
  openShare: (product, options) => {
    set({
      isOpen: true,
      product,
      options,
    });
  },
  closeShare: () => set({ isOpen: false, product: null, options: undefined }),
}));

import { create } from 'zustand';

export interface ShareModalData {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  price?: number;
  discountPrice?: number;
  category?: string;
  customToastMessage?: string;
}

interface ShareModalState {
  isOpen: boolean;
  data: ShareModalData | null;
  openModal: (data: ShareModalData) => void;
  closeModal: () => void;
}

export const useShareModalStore = create<ShareModalState>((set) => ({
  isOpen: false,
  data: null,
  openModal: (data) => set({ isOpen: true, data }),
  closeModal: () => set({ isOpen: false, data: null }),
}));

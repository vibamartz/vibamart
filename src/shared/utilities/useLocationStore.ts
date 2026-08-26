import { create } from 'zustand';
import { Address } from '../types';
import { useAuthStore } from '../../backend/store';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import toast from 'react-hot-toast';

interface LocationState {
  selectedAddress: Address | null;
  savedAddresses: Address[];
  loading: boolean;

  initLocation: () => void;
  selectAddress: (address: Address) => Promise<void>;
  addSavedAddress: (address: Address) => Promise<void>;
  updateSavedAddress: (idOrIndex: string | number, updated: Address) => Promise<void>;
  deleteSavedAddress: (idOrIndex: string | number) => Promise<void>;
  setDefaultAddress: (idOrIndex: string | number) => Promise<void>;
}

const STORAGE_KEY = 'viba_selected_address';

export const useLocationStore = create<LocationState>((set, get) => ({
  selectedAddress: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })(),
  savedAddresses: [],
  loading: false,

  initLocation: () => {
    const user = useAuthStore.getState().user;
    if (user?.addresses && user.addresses.length > 0) {
      set({ savedAddresses: user.addresses });

      // If no address selected yet, default to user's primary/default address
      if (!get().selectedAddress) {
        const defaultAddr = user.addresses.find(a => a.isDefault) || user.address || user.addresses[0];
        set({ selectedAddress: defaultAddr });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAddr));
      }
    } else if (user?.address) {
      set({ savedAddresses: [user.address] });
      if (!get().selectedAddress) {
        set({ selectedAddress: user.address });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user.address));
      }
    }
  },

  selectAddress: async (address: Address) => {
    set({ selectedAddress: address });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(address));

    const user = useAuthStore.getState().user;
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { address }, { merge: true });
        useAuthStore.setState({ user: { ...user, address } });
      } catch (err) {
        console.error('Failed to sync selected address to user profile:', err);
      }
    }
  },

  addSavedAddress: async (address: Address) => {
    const user = useAuthStore.getState().user;
    const currentList = get().savedAddresses;
    const newAddress: Address = {
      ...address,
      id: address.id || Date.now().toString(),
      isDefault: address.isDefault ?? currentList.length === 0
    };

    let updatedList = [...currentList];
    if (newAddress.isDefault) {
      updatedList = updatedList.map(a => ({ ...a, isDefault: false }));
    }
    updatedList.push(newAddress);

    set({ savedAddresses: updatedList });
    set({ selectedAddress: newAddress });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAddress));

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          addresses: updatedList,
          address: newAddress
        }, { merge: true });
        useAuthStore.setState({ 
          user: { 
            ...user, 
            addresses: updatedList, 
            address: newAddress 
          } 
        });
        toast.success('Address saved!');
      } catch (err) {
        console.error('Failed to save address to Firebase:', err);
        toast.error('Failed to save address to cloud profile');
      }
    } else {
      toast.success('Address set for current session');
    }
  },

  updateSavedAddress: async (idOrIndex: string | number, updated: Address) => {
    const user = useAuthStore.getState().user;
    const currentList = get().savedAddresses;
    
    let updatedList = currentList.map((addr, idx) => {
      const match = typeof idOrIndex === 'number' ? idx === idOrIndex : addr.id === idOrIndex;
      return match ? { ...addr, ...updated } : addr;
    });

    if (updated.isDefault) {
      updatedList = updatedList.map((a, idx) => {
        const match = typeof idOrIndex === 'number' ? idx === idOrIndex : a.id === idOrIndex;
        return match ? { ...a, isDefault: true } : { ...a, isDefault: false };
      });
    }

    set({ savedAddresses: updatedList });

    const currentSelected = get().selectedAddress;
    const isEditingSelected = typeof idOrIndex === 'number' 
      ? (currentSelected && currentList[idOrIndex]?.id === currentSelected.id)
      : (currentSelected?.id === idOrIndex);

    if (isEditingSelected || updated.isDefault) {
      set({ selectedAddress: updated });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    if (user) {
      try {
        const activePrimary = updatedList.find(a => a.isDefault) || updatedList[0] || null;
        await setDoc(doc(db, 'users', user.uid), { 
          addresses: updatedList,
          ...(activePrimary ? { address: activePrimary } : {})
        }, { merge: true });
        useAuthStore.setState({ 
          user: { 
            ...user, 
            addresses: updatedList,
            ...(activePrimary ? { address: activePrimary } : {})
          } 
        });
        toast.success('Address updated!');
      } catch (err) {
        console.error('Failed to update address:', err);
        toast.error('Failed to update address');
      }
    }
  },

  deleteSavedAddress: async (idOrIndex: string | number) => {
    const user = useAuthStore.getState().user;
    const currentList = get().savedAddresses;

    const updatedList = currentList.filter((addr, idx) => {
      return typeof idOrIndex === 'number' ? idx !== idOrIndex : addr.id !== idOrIndex;
    });

    set({ savedAddresses: updatedList });

    const currentSelected = get().selectedAddress;
    const wasSelectedDeleted = typeof idOrIndex === 'number' 
      ? (currentSelected && currentList[idOrIndex]?.id === currentSelected.id)
      : (currentSelected?.id === idOrIndex);

    const nextSelected = wasSelectedDeleted ? (updatedList[0] || null) : currentSelected;
    set({ selectedAddress: nextSelected });

    if (nextSelected) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSelected));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          addresses: updatedList,
          address: nextSelected
        }, { merge: true });
        useAuthStore.setState({ 
          user: { 
            ...user, 
            addresses: updatedList,
            address: nextSelected
          } 
        });
        toast.success('Address removed');
      } catch (err) {
        console.error('Failed to delete address:', err);
      }
    }
  },

  setDefaultAddress: async (idOrIndex: string | number) => {
    const user = useAuthStore.getState().user;
    const currentList = get().savedAddresses;

    const updatedList = currentList.map((addr, idx) => {
      const match = typeof idOrIndex === 'number' ? idx === idOrIndex : addr.id === idOrIndex;
      return { ...addr, isDefault: match };
    });

    const primary = updatedList.find(a => a.isDefault) || null;
    set({ savedAddresses: updatedList, selectedAddress: primary });
    if (primary) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(primary));
    }

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { 
          addresses: updatedList,
          address: primary
        }, { merge: true });
        useAuthStore.setState({ 
          user: { 
            ...user, 
            addresses: updatedList,
            address: primary
          } 
        });
        toast.success('Default delivery address updated!');
      } catch (err) {
        console.error('Failed to set default address:', err);
      }
    }
  }
}));

// Sync location store when auth user changes
useAuthStore.subscribe((state) => {
  if (state.user) {
    const addresses = state.user.addresses || (state.user.address ? [state.user.address] : []);
    useLocationStore.setState({ savedAddresses: addresses });
    if (!useLocationStore.getState().selectedAddress && state.user.address) {
      useLocationStore.setState({ selectedAddress: state.user.address });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.user.address));
    }
  }
});

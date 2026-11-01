import { toast, showToast, toastManager } from './toastManager';
import { GlobalToastContainer } from './GlobalToastContainer';
import { GlobalToast } from './GlobalToast';

export {
  toast,
  showToast,
  toastManager,
  GlobalToastContainer,
  GlobalToastContainer as Toaster,
  GlobalToast,
};

export type { ToastType, ToastOptions, ToastItem } from './types';

export default toast;


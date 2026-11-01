import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';
import { ToastItem, ToastType } from './types';

interface GlobalToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
  isExiting?: boolean;
}

interface ToastStyleConfig {
  background: string;
  borderColor: string;
  titleColor: string;
  dividerColor: string;
  iconColor: string;
  closeColor: string;
  defaultTitle: string;
  IconComponent: React.ElementType;
}

const TOAST_STYLES: Record<ToastType, ToastStyleConfig> = {
  warning: {
    background: '#FFF8E6',
    borderColor: '#F5B000',
    titleColor: '#B45309',
    dividerColor: '#F5B000',
    iconColor: '#F5B000',
    closeColor: '#78350F',
    defaultTitle: 'Warning',
    IconComponent: AlertTriangle,
  },
  error: {
    background: '#FFF0F0',
    borderColor: '#EF4444',
    titleColor: '#DC2626',
    dividerColor: '#EF4444',
    iconColor: '#EF4444',
    closeColor: '#991B1B',
    defaultTitle: 'Error',
    IconComponent: XCircle,
  },
  success: {
    background: '#EDFFF1',
    borderColor: '#16A34A',
    titleColor: '#16A34A',
    dividerColor: '#16A34A',
    iconColor: '#16A34A',
    closeColor: '#166534',
    defaultTitle: 'Success',
    IconComponent: CheckCircle2,
  },
};

export const GlobalToast: React.FC<GlobalToastProps> = ({ toast, onClose, isExiting }) => {
  const config = TOAST_STYLES[toast.type] || TOAST_STYLES.warning;
  const Icon = config.IconComponent;
  const displayTitle = toast.title || config.defaultTitle;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`pointer-events-auto select-none flex items-start sm:items-center px-4 py-3.5 rounded-[18px] border-[1.5px] transition-all duration-200 ease-out w-full max-w-[calc(100vw-32px)] sm:w-auto sm:min-w-[340px] sm:max-w-[420px] ${
        isExiting
          ? 'opacity-0 -translate-y-2 scale-[0.98]'
          : 'opacity-100 translate-y-0 scale-100 animate-toast-slide-in'
      }`}
      style={{
        backgroundColor: config.background,
        borderColor: config.borderColor,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Icon Area */}
      <div className="flex-shrink-0 flex items-center justify-center pt-0.5 sm:pt-0">
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: config.iconColor }} strokeWidth={2.2} />
      </div>

      {/* Vertical Divider */}
      <div
        className="w-[1.5px] self-stretch min-h-[28px] mx-3 sm:mx-3.5 my-0.5 flex-shrink-0 rounded-full opacity-60"
        style={{ backgroundColor: config.dividerColor }}
      />

      {/* Text Hierarchy: Title + Message */}
      <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center">
        <h4
          className="text-[13px] sm:text-[14px] font-bold tracking-tight leading-tight"
          style={{ color: config.titleColor }}
        >
          {displayTitle}
        </h4>
        {toast.message && (
          <p className="text-[12px] sm:text-[13px] font-medium leading-relaxed text-[#1F2937] break-words whitespace-pre-line mt-0.5">
            {toast.message}
          </p>
        )}
      </div>

      {/* Manual Dismiss Close Button */}
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Close notification"
        className="flex-shrink-0 ml-2 p-1 rounded-lg hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer text-gray-500"
        style={{ color: config.closeColor }}
      >
        <X className="w-4 h-4" strokeWidth={2.5} />
      </button>
    </div>
  );
};


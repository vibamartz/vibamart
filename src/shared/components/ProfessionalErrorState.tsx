import React from 'react';
import { AlertTriangle, Lock, RefreshCw, ShieldAlert } from 'lucide-react';

interface ProfessionalErrorStateProps {
  type?: 'error' | 'permission';
  title?: string;
  description?: string;
  onAction?: () => void;
  actionText?: string;
  secondaryAction?: () => void;
  secondaryActionText?: string;
  instructions?: string;
  className?: string;
  compact?: boolean;
}

export default function ProfessionalErrorState({
  type = 'error',
  title,
  description,
  onAction,
  actionText,
  secondaryAction,
  secondaryActionText,
  instructions,
  className = '',
  compact = false
}: ProfessionalErrorStateProps) {
  const isPermission = type === 'permission';

  const defaultTitle = isPermission ? 'Access Required' : 'Something went wrong';
  const defaultDescription = isPermission
    ? 'This feature needs permission to continue.'
    : "We couldn't complete this request right now. Please try again.";
  const defaultActionText = isPermission ? 'Allow Access' : 'Try Again';

  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;
  const displayActionText = actionText || defaultActionText;

  if (compact) {
    return (
      <div className={`p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center text-center ${className}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${isPermission ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
          {isPermission ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <h4 className="text-base font-bold text-gray-900 mb-1">{displayTitle}</h4>
        <p className="text-xs text-gray-500 max-w-sm mb-4 leading-relaxed">{displayDescription}</p>
        
        {instructions && (
          <p className="text-[11px] text-gray-400 mb-3 bg-white p-2.5 rounded-xl border border-gray-100 w-full text-left">
            {instructions}
          </p>
        )}

        <div className="flex gap-2 w-full max-w-xs">
          {secondaryAction && secondaryActionText && (
            <button
              onClick={secondaryAction}
              className="flex-1 py-2.5 px-4 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              {secondaryActionText}
            </button>
          )}
          {onAction && (
            <button
              onClick={onAction}
              className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary-hover transition-colors shadow-sm flex items-center justify-center gap-1.5"
            >
              {!isPermission && <RefreshCw className="w-3.5 h-3.5" />}
              {displayActionText}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-[300px] w-full flex items-center justify-center p-6 ${className}`}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-gray-100 shadow-xl text-center flex flex-col items-center animate-in fade-in zoom-in-95">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${isPermission ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
          {isPermission ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
        </div>

        <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">
          {displayTitle}
        </h3>

        <p className="text-sm font-medium text-gray-500 mb-6 leading-relaxed">
          {displayDescription}
        </p>

        {instructions && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 text-left w-full">
            <p className="text-xs font-semibold text-gray-700 mb-1">How to enable access:</p>
            <p className="text-xs text-gray-500 leading-relaxed">{instructions}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {secondaryAction && secondaryActionText && (
            <button
              onClick={secondaryAction}
              className="flex-1 py-3.5 px-4 font-bold text-gray-700 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-colors text-sm"
            >
              {secondaryActionText}
            </button>
          )}
          {onAction && (
            <button
              onClick={onAction}
              className="flex-1 py-3.5 px-4 font-black text-white bg-primary rounded-2xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-sm"
            >
              {!isPermission && <RefreshCw className="w-4 h-4" />}
              {displayActionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

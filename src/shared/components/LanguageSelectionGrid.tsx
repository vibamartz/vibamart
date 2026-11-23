import React from 'react';
import { Check } from 'lucide-react';
import { SupportedLanguage, SUPPORTED_LANGUAGES } from '../translations/authTranslations';

interface LanguageSelectionGridProps {
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  className?: string;
}

export default function LanguageSelectionGrid({
  selectedLanguage,
  onSelectLanguage,
  className = '',
}: LanguageSelectionGridProps) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 ${className}`}>
      {SUPPORTED_LANGUAGES.map((item) => {
        const isSelected = selectedLanguage === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => onSelectLanguage(item.code)}
            className={`relative flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer ${
              isSelected
                ? 'border-green-600 bg-green-50/80 shadow-sm shadow-green-100 ring-2 ring-green-500/20'
                : 'border-gray-200 bg-white hover:border-green-300 hover:bg-gray-50/60'
            }`}
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span
                className={`text-base sm:text-lg font-black leading-tight tracking-wide ${
                  isSelected ? 'text-green-950 font-black' : 'text-gray-900'
                }`}
              >
                {item.nativeName}
              </span>
              <span
                className={`text-xs font-semibold mt-0.5 truncate ${
                  isSelected ? 'text-green-700 font-bold' : 'text-gray-500'
                }`}
              >
                {item.name}
              </span>
            </div>

            {/* Radio / Selection Indicator */}
            <div className="shrink-0 flex items-center justify-center">
              {isSelected ? (
                <div className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center shadow-xs">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

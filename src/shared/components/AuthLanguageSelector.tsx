import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  AUTH_TRANSLATIONS,
} from '../translations/authTranslations';
import { motion, AnimatePresence } from 'motion/react';

interface AuthLanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onSelectLanguage: (lang: SupportedLanguage) => void;
  className?: string;
}

export default function AuthLanguageSelector({
  currentLanguage,
  onSelectLanguage,
  className = '',
}: AuthLanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLangOption =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const t = AUTH_TRANSLATIONS[currentLanguage] || AUTH_TRANSLATIONS.en;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: SupportedLanguage) => {
    onSelectLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Selector trigger bar / button */}
      <div className="flex items-center justify-between gap-2 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200/80 rounded-2xl p-1.5 px-3 transition-all">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer focus:outline-none"
          aria-label={t.selectLanguage}
          aria-expanded={isOpen}
        >
          <div className="w-7 h-7 rounded-xl bg-white shadow-xs border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-bold text-emerald-800/80 tracking-wider">
              {t.languageLabel}
            </span>
            <span className="text-xs font-black text-gray-900 truncate">
              {activeLangOption.nativeName}
              {activeLangOption.code !== 'en' && (
                <span className="text-gray-500 font-semibold text-[11px] ml-1">
                  ({activeLangOption.name})
                </span>
              )}
            </span>
          </div>
        </button>

        {/* Quick-switch badge for common Indian languages */}
        <div className="flex items-center gap-1 shrink-0">
          {currentLanguage !== 'en' && (
            <button
              type="button"
              onClick={() => handleSelect('en')}
              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/90 hover:bg-white text-emerald-900 border border-emerald-200 shadow-2xs transition-all cursor-pointer"
              title="Switch to English"
            >
              EN
            </button>
          )}
          {currentLanguage !== 'hi' && (
            <button
              type="button"
              onClick={() => handleSelect('hi')}
              className="px-2 py-1 rounded-lg text-[10px] font-black tracking-wider bg-white/90 hover:bg-white text-emerald-900 border border-emerald-200 shadow-2xs transition-all cursor-pointer"
              title="हिन्दी में बदलें"
            >
              हिन्दी
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-white/60 transition-colors cursor-pointer"
            aria-label="Toggle language menu"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-emerald-900' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-2"
          >
            <div className="px-3 py-2 border-b border-gray-100 mb-1 flex items-center justify-between">
              <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                {t.selectLanguage}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {SUPPORTED_LANGUAGES.length} {t.languageLabel}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 pr-0.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang.code === currentLanguage;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-bold'
                        : 'hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900">{lang.nativeName}</span>
                      <span className="text-[11px] text-gray-500">{lang.name}</span>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


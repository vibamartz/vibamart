import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, X, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../translations/LanguageContext';
import { SupportedLanguage } from '../translations/authTranslations';
import LanguageSelectionGrid from './LanguageSelectionGrid';
import toast from 'react-hot-toast';

export default function LanguageSelectionModal() {
  const { language, setLanguage, isLanguageModalOpen, closeLanguageModal, strings } = useLanguage();
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(language);

  useEffect(() => {
    if (isLanguageModalOpen) {
      setSelectedLang(language);
    }
  }, [isLanguageModalOpen, language]);

  if (!isLanguageModalOpen) return null;

  const handleApply = () => {
    setLanguage(selectedLang);
    closeLanguageModal();
    const updatedLangObj = strings;
    toast.success(
      selectedLang === 'en'
        ? 'Language updated to English'
        : `भाषा सफलतापूर्वक अपडेट की गई (${selectedLang})`
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50/50 via-emerald-50/30 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center shadow-xs">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 leading-tight">
                  {strings.chooseYourLanguage || 'Choose Your Language'}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {strings.chooseYourLanguageSubtitle || 'Select your preferred language for ViBa Mart'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeLanguageModal}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grid Content */}
          <div className="p-5 sm:p-6 overflow-y-auto flex-1">
            <LanguageSelectionGrid
              selectedLanguage={selectedLang}
              onSelectLanguage={(lang) => setSelectedLang(lang)}
            />
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeLanguageModal}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition-colors cursor-pointer"
            >
              {strings.cancel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-black shadow-md shadow-green-200 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {strings.continueBtn || 'Continue'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

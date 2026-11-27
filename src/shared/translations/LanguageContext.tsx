import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  LanguageOption,
  AUTH_TRANSLATIONS,
} from './authTranslations';
import {
  SITE_TRANSLATIONS,
  SITE_PHRASE_DICTIONARY,
  SiteTranslationStrings,
} from './siteTranslations';
import { useAuthStore } from '../../backend/store';
import { db } from '../../backend/firebase/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  languages: LanguageOption[];
  t: (key: string, fallback?: string) => string;
  strings: SiteTranslationStrings;
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'viba_preferred_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage;
      if (saved && SITE_TRANSLATIONS[saved]) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'en';
  });

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // Sync from user profile when user logs in if user has a preferredLanguage saved
  useEffect(() => {
    if (user && (user as any).preferredLanguage) {
      const userLang = (user as any).preferredLanguage as SupportedLanguage;
      if (SITE_TRANSLATIONS[userLang] && userLang !== language) {
        setLanguageState(userLang);
        try {
          localStorage.setItem(STORAGE_KEY, userLang);
          document.documentElement.lang = userLang;
        } catch {
          // ignore
        }
      }
    }
  }, [user]);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    if (!SITE_TRANSLATIONS[newLang]) return;
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
      window.dispatchEvent(new CustomEvent('viba_language_change', { detail: newLang }));
    } catch {
      // ignore
    }

    // Persist to user record in Firestore if logged in
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.uid) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        updateDoc(userRef, { preferredLanguage: newLang }).catch(() => {
          // ignore non-critical update error
        });
      } catch {
        // ignore
      }
    }
  }, []);

  const openLanguageModal = useCallback(() => setIsLanguageModalOpen(true), []);
  const closeLanguageModal = useCallback(() => setIsLanguageModalOpen(false), []);

  const strings = useMemo(() => {
    return SITE_TRANSLATIONS[language] || SITE_TRANSLATIONS.en;
  }, [language]);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const s = SITE_TRANSLATIONS[language] || SITE_TRANSLATIONS.en;
      if ((s as any)[key]) return (s as any)[key];

      const a = AUTH_TRANSLATIONS[language] || AUTH_TRANSLATIONS.en;
      if ((a as any)[key]) return (a as any)[key];

      // Check dictionary by exact English phrase
      const dict = SITE_PHRASE_DICTIONARY[language];
      if (dict && dict[key]) return dict[key];

      return fallback || key;
    },
    [language]
  );

  // Sync html lang tag
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  // Client-side non-intrusive DOM text translation for customer-facing sections
  const originalTextMap = useRef<WeakMap<Node, string>>(new WeakMap());
  const isTranslatingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const dict = SITE_PHRASE_DICTIONARY[language] || {};
    const phrases = Object.keys(dict).sort((a, b) => b.length - a.length);

    // Tags to ignore
    const ignoredTags = new Set([
      'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'SVG', 'PATH'
    ]);

    function shouldSkipElement(element: Element | null): boolean {
      if (!element) return false;
      if (ignoredTags.has(element.tagName)) return true;
      if (element.getAttribute('contenteditable') === 'true') return true;
      if (element.classList && (element.classList.contains('notranslate') || element.classList.contains('no-translate'))) return true;
      return false;
    }

    function translateTextNode(node: Text) {
      if (!node.parentElement || shouldSkipElement(node.parentElement)) return;

      const currentVal = node.nodeValue;
      if (!currentVal || !currentVal.trim()) return;

      // Track original English text
      if (!originalTextMap.current.has(node)) {
        originalTextMap.current.set(node, currentVal);
      }

      const originalVal = originalTextMap.current.get(node) || currentVal;

      if (language === 'en') {
        if (node.nodeValue !== originalVal) {
          node.nodeValue = originalVal;
        }
        return;
      }

      const trimmed = originalVal.trim();
      let replaced = originalVal;

      // 1. Direct whole-string match
      if (dict[trimmed]) {
        replaced = originalVal.replace(trimmed, dict[trimmed]);
      } else {
        // 2. Phrase match
        for (const phrase of phrases) {
          if (replaced.includes(phrase)) {
            // Avoid partial word replacements where appropriate
            const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            if (regex.test(replaced)) {
              replaced = replaced.replace(regex, dict[phrase]);
            }
          }
        }
      }

      if (node.nodeValue !== replaced) {
        node.nodeValue = replaced;
      }
    }

    function walkAndTranslate(root: Node) {
      if (!root) return;
      if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root as Text);
        return;
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        if (shouldSkipElement(root as Element)) return;
        const children = root.childNodes;
        for (let i = 0; i < children.length; i++) {
          walkAndTranslate(children[i]);
        }
      }
    }

    const observerConfig: MutationObserverInit = {
      childList: true,
      subtree: true,
      characterData: true,
    };

    let timeoutId: any = null;
    const observer = new MutationObserver(() => {
      if (isTranslatingRef.current) return;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        runTranslation();
      }, 50);
    });

    const runTranslation = () => {
      if (isTranslatingRef.current) return;
      isTranslatingRef.current = true;
      observer.disconnect();
      try {
        walkAndTranslate(document.body);
      } finally {
        isTranslatingRef.current = false;
        observer.observe(document.body, observerConfig);
      }
    };

    // Initial pass
    runTranslation();

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        languages: SUPPORTED_LANGUAGES,
        t,
        strings,
        isLanguageModalOpen,
        openLanguageModal,
        closeLanguageModal,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if called outside provider
    const fallbackLang: SupportedLanguage = (() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage;
        if (saved && SITE_TRANSLATIONS[saved]) return saved;
      } catch {}
      return 'en';
    })();

    return {
      language: fallbackLang,
      setLanguage: () => {},
      languages: SUPPORTED_LANGUAGES,
      t: (key, fallback) => fallback || key,
      strings: SITE_TRANSLATIONS[fallbackLang] || SITE_TRANSLATIONS.en,
      isLanguageModalOpen: false,
      openLanguageModal: () => {},
      closeLanguageModal: () => {},
    };
  }
  return context;
}

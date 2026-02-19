import { useState, useEffect, createContext, useContext, useCallback } from "react";
import en from "./en";
import he from "./he";
import type { TranslationKeys } from "./en";

type Language = "en" | "he";

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: TranslationKeys;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  toggleLanguage: () => {},
  t: en,
  isRTL: false,
});

const translations: Record<Language, TranslationKeys> = { en, he };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("language") as Language) || "en";
    }
    return "en";
  });

  const isRTL = language === "he";

  useEffect(() => {
    const root = document.documentElement;
    root.dir = isRTL ? "rtl" : "ltr";
    root.lang = language;
    localStorage.setItem("language", language);
  }, [language, isRTL]);

  const toggleLanguage = useCallback(() => {
    setLanguage((l) => (l === "en" ? "he" : "en"));
  }, []);

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

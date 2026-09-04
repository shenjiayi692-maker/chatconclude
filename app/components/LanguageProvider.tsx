"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Locale, LOCALE_COOKIE } from "@/lib/locale";

type LanguageContextValue = {
  locale: Locale;
  isEnglish: boolean;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      isEnglish: locale === "en",
      setLocale(nextLocale) {
        setLocaleState(nextLocale);
        document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
        router.refresh();
      },
    }),
    [locale, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}

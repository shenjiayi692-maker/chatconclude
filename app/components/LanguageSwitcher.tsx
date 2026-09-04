"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const nextLocale = locale === "zh" ? "en" : "zh";

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
      className={`rounded-full border border-zinc-300 font-medium text-zinc-600 transition hover:border-zinc-400 hover:bg-white hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 ${
        compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      }`}
    >
      {locale === "zh" ? "EN" : "中文"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/app/components/LanguageProvider";

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname.startsWith(href);
}

export default function AppNavigation({ email }: { email?: string }) {
  const pathname = usePathname();
  const { isEnglish } = useLanguage();
  const primaryLinks = [
    { href: "/app", label: isEnglish ? "This week" : "本周" },
    { href: "/app/history", label: isEnglish ? "History" : "历史" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-5">
          <Link href="/app" className="shrink-0 font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {isEnglish ? "Weekly Review" : "每周知识复习"}
          </Link>
          <nav
            className="hidden items-center gap-1 sm:flex"
            aria-label={isEnglish ? "Main navigation" : "主要导航"}
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm ${
                  isActive(pathname, link.href)
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher compact />
            <Link
              href="/app/capture"
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isEnglish ? "Save" : "保存对话"}
            </Link>
            <Link
              href="/app/settings"
              aria-label={
                email
                  ? isEnglish
                    ? `Settings, signed in as ${email}`
                    : `设置，已登录 ${email}`
                  : isEnglish
                    ? "Settings"
                    : "设置"
              }
              className={`flex size-9 items-center justify-center rounded-full border text-sm font-medium ${
                pathname.startsWith("/app/settings") || pathname.startsWith("/app/setup")
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {email?.trim().charAt(0).toUpperCase() || (isEnglish ? "Me" : "我")}
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label={isEnglish ? "Mobile navigation" : "移动导航"}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-black/95"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {[
            { href: "/app", label: isEnglish ? "Week" : "本周" },
            { href: "/app/capture", label: isEnglish ? "Save" : "保存" },
            { href: "/app/history", label: isEnglish ? "History" : "历史" },
            { href: "/app/settings", label: isEnglish ? "Me" : "我的" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg py-2 text-center text-xs font-medium ${
                isActive(pathname, link.href)
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

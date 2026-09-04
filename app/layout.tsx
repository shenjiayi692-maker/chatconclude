import type { Metadata } from "next";
import LanguageProvider from "./components/LanguageProvider";
import { getLocale } from "@/lib/locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weekly Knowledge Review · 每周知识复习",
  description: "Turn valuable AI conversations into a natural weekly review and active-recall quiz.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className="h-full antialiased">
      <body className="min-h-full">
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}

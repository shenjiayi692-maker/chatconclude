"use client";

import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

export default function ProfileSettings({ initialTimezone }: { initialTimezone: string }) {
  const { isEnglish } = useLanguage();
  const [timezone, setTimezone] = useState(initialTimezone);
  const [status, setStatus] = useState<string | null>(null);
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function save() {
    setStatus(isEnglish ? "Saving…" : "保存中…");
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    const data = await response.json();
    setStatus(response.ok ? (isEnglish ? "Saved" : "已保存") : data?.error || (isEnglish ? "Could not save" : "保存失败"));
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {isEnglish ? "Weekly timezone" : "每周时区"}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {isEnglish
            ? `The weekly boundary is calculated in this timezone. Browser detected: ${detected || "Unknown"}.`
            : `周一边界按这个时区计算。浏览器检测到：${detected || "未知"}。`}
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white p-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-black"
          placeholder="Europe/Berlin"
        />
        <button
          onClick={() => setTimezone(detected)}
          disabled={!detected}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {isEnglish ? "Use browser timezone" : "使用浏览器时区"}
        </button>
        <button
          onClick={save}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isEnglish ? "Save" : "保存"}
        </button>
      </div>
      {status && <p className="text-xs text-zinc-500">{status}</p>}
    </section>
  );
}

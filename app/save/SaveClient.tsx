"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

const MAX_CHARS = 12000;

export default function SaveClient({ email, welcome = false }: { email?: string; welcome?: boolean }) {
  const { isEnglish } = useLanguage();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setOk(null);
    if (!text.trim()) {
      setError(isEnglish ? "Paste the conversation you want to save." : "把要存的对话粘贴进来。");
      return;
    }
    setLoading(true);
    try {
      // 同源请求自动带登录会话 cookie，无需令牌
      const res = await fetch("/api/ingest/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source: "ios" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || (isEnglish ? "Could not save. Please try again." : "存入失败，稍后再试。"));
        return;
      }
      const dup =
        data.duplicates > 0
          ? isEnglish
            ? ` (${data.duplicates} duplicate${data.duplicates === 1 ? "" : "s"} skipped)`
            : `（重复跳过 ${data.duplicates} 条）`
          : "";
      const rejected =
        data.rejected > 0
          ? isEnglish
            ? ` (${data.rejected} not saved because storage is full)`
            : `（容量已满，未存 ${data.rejected} 条）`
          : "";
      setOk(isEnglish ? `${data.saved} saved${dup}${rejected}` : `已存 ${data.saved} 条${dup}${rejected}`);
      setText("");
    } catch {
      setError(isEnglish ? "There seems to be a network issue. Please try again." : "网络好像有点问题，稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">
          {isEnglish ? "Works on mobile and desktop" : "手机和电脑都能用"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Save this conversation" : "保存这段对话"}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500">
          {isEnglish
            ? "Paste an AI conversation. When generating your review, we automatically remove delegated work and casual chat."
            : "粘贴一段 AI 对话。生成回顾时，我们会自动排除让 AI 干活和闲聊的部分。"}
        </p>
        {email && <p className="text-xs text-zinc-400">{isEnglish ? "Saving to" : "保存到"} {email}</p>}
      </header>

      {welcome && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {isEnglish
            ? "You're ready. Paste an AI conversation you want to remember to complete your first save."
            : "已准备好。先粘贴一段你想记住的 AI 对话，完成第一次保存。"}
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isEnglish ? "Paste an AI conversation here…" : "把 AI 对话粘贴到这里……"}
          rows={12}
          maxLength={MAX_CHARS + 1000}
          className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-base text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {text.length} / {MAX_CHARS} {isEnglish ? "characters" : "字"}
          </span>
          <button
            onClick={handleSave}
            disabled={loading}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {loading ? (isEnglish ? "Saving…" : "正在保存…") : isEnglish ? "Save" : "保存"}
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}
      {ok && (
        <div className="flex flex-col gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between dark:bg-emerald-950 dark:text-emerald-200">
          <p>{ok}{isEnglish ? ". It will appear in this week's review." : "，会出现在本周回顾里。"}</p>
          <Link href="/app" className="shrink-0 font-medium underline underline-offset-2">
            {isEnglish ? "Back to this week" : "返回本周"}
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import ReviewDisplay, { ReviewResult } from "../components/ReviewDisplay";
import { useLanguage } from "../components/LanguageProvider";

export interface InitialReview {
  weekStart: string;
  review: string;
  quiz: ReviewResult["quiz"];
  itemCount: number;
  createdAt: string;
}

type Display = ReviewResult & { itemCount: number };

function formatWeek(weekStart: string, isEnglish: boolean) {
  // weekStart 是该周周一（YYYY-MM-DD），展示成「M月D日 那周」
  const [, m, d] = weekStart.split("-");
  return isEnglish
    ? `Week of ${new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : `${Number(m)} 月 ${Number(d)} 日那周`;
}

export default function MyReviewClient({
  initialReview,
}: {
  initialReview: InitialReview | null;
}) {
  const { isEnglish } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 展示态：初始来自已存的最近一份周报；点「刷新」后换成实时生成的结果。
  const [display, setDisplay] = useState<Display | null>(
    initialReview
      ? {
          review: initialReview.review,
          filtered: [],
          quiz: initialReview.quiz,
          itemCount: initialReview.itemCount,
        }
      : null,
  );
  const [weekStart, setWeekStart] = useState<string | null>(initialReview?.weekStart ?? null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      // 同源请求自动带上登录会话 cookie，无需令牌
      const res = await fetch("/api/review/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || (isEnglish ? "Something went wrong. Please try again." : "出了点问题，稍后再试一次。"));
        return;
      }
      setDisplay(data as Display);
      setWeekStart(null);
    } catch {
      setError(isEnglish ? "There seems to be a network issue. Please try again." : "网络好像有点问题，稍后再试一次。");
    } finally {
      setLoading(false);
    }
  }

  const hasContent = display && display.itemCount > 0;
  const weekLabel = display
    ? weekStart
      ? formatWeek(weekStart, isEnglish)
      : isEnglish
        ? "This week"
        : "本周"
    : null;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">
          {isEnglish ? "What did you learn?" : "这一周学了什么"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "This week's review" : "本周回顾"}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-500">
          {isEnglish
            ? "Save AI conversations worth remembering. Delegated work and casual chat are filtered automatically."
            : "保存值得记住的 AI 对话，我们会自动排除让 AI 干活和闲聊的部分。"}
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            {display
              ? isEnglish
                ? "Your review is ready"
                : "本周回顾已准备好"
              : isEnglish
                ? "Ready to generate this week's review"
                : "准备生成本周回顾"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {display
              ? isEnglish
                ? "Update it whenever you save new material."
                : "有新内容时，可以更新这份回顾。"
              : isEnglish
                ? "Save a few knowledge conversations, then turn them into a review and quiz here."
                : "保存一些知识型对话后，在这里整理成回顾与 Quiz。"}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="shrink-0 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading
            ? isEnglish
              ? "Organizing…"
              : "正在整理…"
            : display
              ? isEnglish
                ? "Update review"
                : "更新本周回顾"
              : isEnglish
                ? "Generate review"
                : "生成本周回顾"}
        </button>
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {hasContent && weekLabel && (
        <p className="-mt-4 text-sm text-zinc-400">
          {isEnglish
            ? `${weekLabel} · ${display!.itemCount} saved item${display!.itemCount === 1 ? "" : "s"}`
            : `${weekLabel}保存了 ${display!.itemCount} 条内容`}
        </p>
      )}

      {display ? (
        <ReviewDisplay result={display} />
      ) : (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            {isEnglish ? "No review yet this week" : "这周还没有回顾"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {isEnglish
              ? "Save an AI conversation worth remembering, then come back to generate your review."
              : "先保存一段值得记住的 AI 对话，再回来生成。"}
          </p>
          <a
            href="/app/capture"
            className="mt-5 inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isEnglish ? "Save your first conversation" : "保存第一段对话"}
          </a>
        </section>
      )}
    </div>
  );
}

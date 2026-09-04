"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

export interface FilteredItem {
  question: string;
  category: "task" | "other";
}

export interface QuizItem {
  question: string;
  answer: string;
}

export interface ReviewResult {
  review: string;
  filtered: FilteredItem[];
  quiz: QuizItem[];
}

function QuizCard({ item, index }: { item: QuizItem; index: number }) {
  const { isEnglish } = useLanguage();
  const [revealed, setRevealed] = useState(false);
  const [assessment, setAssessment] = useState<"remembered" | "forgotten" | null>(null);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-500">
        {isEnglish ? `Question ${index + 1}` : `第 ${index + 1} 题`}
      </p>
      <p className="mt-1 text-base text-zinc-900 dark:text-zinc-100">{item.question}</p>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-3 rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isEnglish ? "Reveal answer" : "看答案"}
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="rounded-lg bg-zinc-50 p-3 text-sm whitespace-pre-wrap text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {item.answer}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setAssessment("remembered")}
              className={`rounded-full px-4 py-1.5 text-sm ${
                assessment === "remembered"
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {isEnglish ? "Remembered" : "记住了"}
            </button>
            <button
              onClick={() => setAssessment("forgotten")}
              className={`rounded-full px-4 py-1.5 text-sm ${
                assessment === "forgotten"
                  ? "bg-amber-600 text-white"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {isEnglish ? "Need to review" : "没记住"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewDisplay({ result }: { result: ReviewResult }) {
  const { isEnglish } = useLanguage();

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {isEnglish ? "Weekly review" : "本周回顾"}
        </h2>
        <div className="space-y-3 text-[15px] leading-7 text-zinc-800 dark:text-zinc-200">
          {result.review.split(/\n\s*\n+/).map((para, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {para}
            </p>
          ))}
        </div>
      </div>

      {result.filtered.length > 0 && (
        <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {isEnglish
              ? `${result.filtered.length} work/chat item${result.filtered.length === 1 ? "" : "s"} filtered`
              : `已过滤 ${result.filtered.length} 条干活/闲聊`}
          </summary>
          <ul className="mt-3 space-y-2">
            {result.filtered.map((f, i) => (
              <li key={i} className="text-sm text-zinc-500 dark:text-zinc-500">
                <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-900">
                  {isEnglish
                    ? f.category === "task"
                      ? "Work"
                      : "Other"
                    : f.category === "task"
                      ? "干活"
                      : "其它"}
                </span>
                {f.question.length > 60 ? f.question.slice(0, 60) + "…" : f.question}
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.quiz.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {isEnglish ? "Quiz" : "小测验"}
          </h2>
          <div className="space-y-3">
            {result.quiz.map((q, i) => (
              <QuizCard key={i} item={q} index={i} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

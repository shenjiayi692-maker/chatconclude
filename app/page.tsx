"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ReviewDisplay, { ReviewResult } from "./components/ReviewDisplay";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { useLanguage } from "./components/LanguageProvider";

const MAX_CHARS = 12000;
const HOME_COPY = {
  zh: {
    brand: "每周知识复习",
    account: "已有账号？进入本周回顾",
    eyebrow: "把问过 AI 的好问题，变成真正记住的知识",
    heroLine1: "聊完就忘的知识，",
    heroLine2: "每周帮你重新想起来。",
    heroBody: "保存你和 AI 的对话，自动排除让 AI 干活的内容，生成一份像人写的回顾和主动回忆小测验。",
    start: "免费开始使用",
    try: "先用示例体验",
    freeNote: "无需信用卡 · 可先免登录试用",
    howLabel: "怎么使用",
    howTitle: "不需要整理笔记，只做三件事",
    steps: [
      { number: "01", title: "保存有价值的对话", body: "在电脑浏览器点一下扩展，或在手机网页粘贴对话，不用重新整理。" },
      { number: "02", title: "自动留下知识", body: "识别哪些内容值得复习，排除写邮件、做 PPT 等让 AI 干活的部分。" },
      { number: "03", title: "每周重新想起来", body: "把零散问题写成自然回顾，再用几道 Quiz 检查自己是否真的记住。" },
    ],
    demoLabel: "不是所有对话都值得复习",
    demoTitle: "它知道什么该留下，什么该忘掉",
    demoBody: "知识提问进入本周回顾；写作、执行和闲聊会被过滤，不会把周报变成聊天记录摘要。",
    inputTitle: "本周与 AI 的对话",
    itemCount: "4 条",
    demoItems: [
      { text: "为什么天空通常是蓝色的？", kept: true },
      { text: "帮我写一封道歉邮件并发送", kept: false },
      { text: "机会成本和沉没成本有什么区别？", kept: true },
      { text: "帮我做一份十页的汇报 PPT", kept: false },
    ],
    kept: "保留",
    excluded: "排除",
    processed: "处理后得到",
    outputTitle: "你的本周回顾",
    points: "2 个知识点",
    reviewOne: "这周你重新理解了两个容易被日常直觉带偏的概念。天空呈现蓝色，并不是大气本身有颜色，而是短波长的蓝光更容易发生瑞利散射……",
    reviewTwo: "你还区分了机会成本与沉没成本：前者提醒我们正在放弃什么，后者则不应该继续左右未来决定。",
    quizLabel: "主动回忆 Quiz",
    quizQuestion: "为什么日落通常比白天的天空更偏红？",
    quizHint: "先在心里回答，再点开答案",
    trialLabel: "免登录体验",
    trialTitle: "用一段真实对话试试看",
    trialBody: "不确定贴什么？点击示例，我们放入一段同时包含知识提问和干活请求的对话。",
    fillExample: "填入混合示例",
    placeholder: "把你和 AI 的一段对话粘贴到这里……",
    privacy: "只在内存中处理，不保存、不写日志",
    generating: "正在筛选并生成…",
    generate: "生成我的复习",
    conversionTitle: "以后自动收集这些知识",
    conversionBody: "免费登录后，可以从浏览器或手机持续保存，并在每周回顾里重新想起它们。",
    freeLogin: "免费登录",
    login: "登录",
    privacyPolicy: "隐私政策",
    terms: "使用条款",
    emptyError: "先粘贴一段你和 AI 的对话吧。",
    genericError: "出了点问题，稍后再试一次。",
    networkError: "网络好像有点问题，稍后再试一次。",
    exampleText: `用户：为什么天空通常是蓝色的？请用瑞利散射解释。

AI：太阳光进入大气后，波长较短的蓝光比红光更容易被空气分子散射，所以来自各个方向的散射光以蓝色为主。

用户：帮我写一封道歉邮件并替我发送。

AI：当然，请告诉我收件人和事情经过。

用户：机会成本和沉没成本有什么区别？

AI：机会成本是做出选择时放弃的最佳替代方案的价值；沉没成本则是已经发生且无法追回的投入，不应该影响未来决策。

用户：再帮我做一份十页的汇报 PPT。

AI：可以，请把汇报主题和听众告诉我。`,
  },
  en: {
    brand: "Weekly Knowledge Review",
    account: "Already have an account? Open this week",
    eyebrow: "Turn good questions you asked AI into knowledge you actually remember",
    heroLine1: "Good ideas should not disappear",
    heroLine2: "when the chat ends.",
    heroBody: "Save your AI conversations, automatically remove delegated work, and receive a natural weekly review with active-recall quizzes.",
    start: "Start for free",
    try: "Try an example",
    freeNote: "No credit card · Try it without signing in",
    howLabel: "How it works",
    howTitle: "No note-taking system. Just three steps.",
    steps: [
      { number: "01", title: "Save valuable conversations", body: "Click the browser extension on desktop, or paste a conversation from your phone. No manual cleanup." },
      { number: "02", title: "Keep the knowledge", body: "Knowledge questions stay. Requests to write emails, build slides, or do work for you are removed." },
      { number: "03", title: "Recall it every week", body: "Scattered questions become a natural review, followed by short quizzes that test what you remember." },
    ],
    demoLabel: "Not every conversation is worth reviewing",
    demoTitle: "It knows what to keep—and what to forget",
    demoBody: "Knowledge questions enter your weekly review. Writing, execution, and casual chat are filtered instead of becoming a generic conversation summary.",
    inputTitle: "This week's AI conversations",
    itemCount: "4 items",
    demoItems: [
      { text: "Why is the sky usually blue?", kept: true },
      { text: "Write and send an apology email for me", kept: false },
      { text: "What is the difference between opportunity cost and sunk cost?", kept: true },
      { text: "Create a ten-slide presentation for me", kept: false },
    ],
    kept: "Keep",
    excluded: "Remove",
    processed: "After filtering",
    outputTitle: "Your weekly review",
    points: "2 ideas",
    reviewOne: "This week, you revisited two concepts that everyday intuition often gets wrong. The sky looks blue not because the atmosphere has a color, but because shorter blue wavelengths scatter more easily…",
    reviewTwo: "You also separated opportunity cost from sunk cost: one asks what you are giving up, while the other should not keep shaping future decisions.",
    quizLabel: "ACTIVE RECALL QUIZ",
    quizQuestion: "Why are sunsets usually redder than the daytime sky?",
    quizHint: "Answer in your head before revealing the explanation",
    trialLabel: "Try it without signing in",
    trialTitle: "Use one real conversation",
    trialBody: "Not sure what to paste? Load an example containing both knowledge questions and requests for AI to do work.",
    fillExample: "Load mixed example",
    placeholder: "Paste an AI conversation here…",
    privacy: "Processed in memory only. Not saved or logged.",
    generating: "Filtering and generating…",
    generate: "Generate my review",
    conversionTitle: "Collect valuable knowledge automatically",
    conversionBody: "Sign in for free to keep saving from your browser or phone and revisit it in each weekly review.",
    freeLogin: "Sign in for free",
    login: "Sign in",
    privacyPolicy: "Privacy",
    terms: "Terms",
    emptyError: "Paste an AI conversation first.",
    genericError: "Something went wrong. Please try again shortly.",
    networkError: "There seems to be a network issue. Please try again shortly.",
    exampleText: `User: Why is the sky usually blue? Please explain it using Rayleigh scattering.

AI: When sunlight enters the atmosphere, shorter blue wavelengths scatter more strongly than red wavelengths, so the scattered light arriving from many directions appears mostly blue.

User: Write and send an apology email for me.

AI: Of course. Tell me who it is for and what happened.

User: What is the difference between opportunity cost and sunk cost?

AI: Opportunity cost is the value of the best alternative you give up when making a choice. A sunk cost is an expense that has already happened and cannot be recovered, so it should not influence future decisions.

User: Create a ten-slide presentation for me.

AI: Sure. Tell me the topic and audience.`,
  },
} as const;

export default function Home() {
  const { locale } = useLanguage();
  const copy = HOME_COPY[locale];
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);

  function focusInput() {
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textareaRef.current?.focus();
  }

  function tryExample() {
    setText(copy.exampleText);
    setResult(null);
    setError(null);
    requestAnimationFrame(focusInput);
  }

  async function handleSubmit() {
    setError(null);
    setResult(null);

    if (!text.trim()) {
      setError(copy.emptyError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || copy.genericError);
        return;
      }
      setResult(data as ReviewResult);
    } catch {
      setError(copy.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f7f4] text-zinc-950 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto w-full max-w-6xl px-5 pb-14 pt-6 sm:px-8 sm:pb-20 sm:pt-8">
        <nav className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold tracking-tight">{copy.brand}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/app"
              className="hidden text-sm text-zinc-500 underline-offset-4 transition hover:text-zinc-900 hover:underline sm:block dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {copy.account}
            </Link>
          </div>
        </nav>

        <header className="mx-auto max-w-4xl pb-20 pt-20 text-center sm:pb-28 sm:pt-28">
          <p className="mb-5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {copy.eyebrow}
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-6xl sm:leading-[1.08]">
            {copy.heroLine1}
            <br className="hidden sm:block" />
            {copy.heroLine2}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {copy.heroBody}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 sm:w-auto dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
            >
              {copy.start}
            </Link>
            <button
              type="button"
              onClick={tryExample}
              className="inline-flex w-full items-center justify-center rounded-full border border-zinc-300 bg-white/70 px-6 py-3 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-white sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600"
            >
              {copy.try}
            </button>
          </div>
          <p className="mt-4 text-xs text-zinc-400">{copy.freeNote}</p>
        </header>

        <section aria-labelledby="how-it-works" className="border-t border-zinc-200 py-16 dark:border-zinc-800 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-zinc-500">{copy.howLabel}</p>
            <h2 id="how-it-works" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.howTitle}
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {copy.steps.map((step) => (
              <article
                key={step.number}
                className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                  {step.number}
                </span>
                <h3 className="mt-8 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="filter-demo" className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium text-zinc-500">{copy.demoLabel}</p>
            <h2 id="filter-demo" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {copy.demoTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              {copy.demoBody}
            </p>
          </div>

          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{copy.inputTitle}</h3>
                <span className="text-xs text-zinc-400">{copy.itemCount}</span>
              </div>
              <div className="mt-5 space-y-3">
                {copy.demoItems.map((item) => (
                  <div
                    key={item.text}
                    className={`flex items-start justify-between gap-4 rounded-2xl border p-4 ${
                      item.kept
                        ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/40"
                        : "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-500"
                    }`}
                  >
                    <p className={`text-sm leading-6 ${item.kept ? "text-zinc-800 dark:text-zinc-200" : "line-through decoration-zinc-300 dark:decoration-zinc-700"}`}>
                      {item.text}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        item.kept
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-zinc-200/70 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {item.kept ? copy.kept : copy.excluded}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center text-zinc-300 dark:text-zinc-700">
              <span aria-hidden="true" className="rotate-90 text-3xl lg:rotate-0">→</span>
              <span className="sr-only">{copy.processed}</span>
            </div>

            <div className="flex flex-col rounded-3xl bg-zinc-950 p-6 text-white dark:bg-zinc-100 dark:text-zinc-950">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{copy.outputTitle}</h3>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-300 dark:bg-black/10 dark:text-zinc-600">
                  {copy.points}
                </span>
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-zinc-300 dark:text-zinc-700">
                <p>{copy.reviewOne}</p>
                <p>{copy.reviewTwo}</p>
              </div>
              <div className="mt-auto pt-7">
                <div className="rounded-2xl bg-white/10 p-4 dark:bg-black/5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300 dark:text-emerald-700">
                    {copy.quizLabel}
                  </p>
                  <p className="mt-2 text-sm font-medium">{copy.quizQuestion}</p>
                  <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">{copy.quizHint}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="try" className="mx-auto max-w-3xl border-t border-zinc-200 py-16 dark:border-zinc-800 sm:py-20">
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-500">{copy.trialLabel}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{copy.trialTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {copy.trialBody}
            </p>
            <button
              type="button"
              onClick={tryExample}
              className="mt-5 text-sm font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800 dark:text-emerald-400"
            >
              {copy.fillExample}
            </button>
          </div>

          <div className="mt-8 space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={copy.placeholder}
              rows={11}
              maxLength={MAX_CHARS + 1000}
              className="w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-black dark:text-zinc-100 dark:focus:border-zinc-600"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs text-zinc-400">
                  {text.length} / {MAX_CHARS} {locale === "en" ? "characters" : "字"}
                </span>
                <p className="mt-1 text-xs text-zinc-400">{copy.privacy}</p>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {loading ? copy.generating : copy.generate}
              </button>
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}
          </div>

          {result && (
            <div className="mt-10 space-y-8">
              <ReviewDisplay result={result} />
              <section className="rounded-3xl bg-zinc-950 p-6 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <h2 className="text-lg font-semibold">{copy.conversionTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300 dark:text-zinc-600">
                  {copy.conversionBody}
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 dark:bg-zinc-950 dark:text-white"
                >
                  {copy.freeLogin}
                </Link>
              </section>
            </div>
          )}
        </section>

        <footer className="flex flex-col justify-between gap-4 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-zinc-800 sm:flex-row sm:items-center">
          <p>{copy.brand}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/login" className="font-medium text-zinc-800 hover:underline dark:text-zinc-200">
              {copy.login}
            </Link>
            <Link href="/privacy" className="hover:underline">{copy.privacyPolicy}</Link>
            <Link href="/terms" className="hover:underline">{copy.terms}</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}

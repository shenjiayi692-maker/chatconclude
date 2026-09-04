"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

type CaptureMethod = "desktop" | "mobile" | "both";

export default function OnboardingClient() {
  const { isEnglish } = useLanguage();
  const router = useRouter();
  const [selected, setSelected] = useState<CaptureMethod>("desktop");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options: Array<{
    value: CaptureMethod;
    title: string;
    description: string;
    badge?: string;
  }> = [
    {
      value: "desktop",
      title: isEnglish ? "Mostly in a desktop browser" : "主要在电脑浏览器",
      description: isEnglish
        ? "Save with one click from Claude, ChatGPT, and DeepSeek after connecting the extension."
        : "连接扩展后，在 Claude、ChatGPT 和 DeepSeek 页面一键保存。",
      badge: isEnglish ? "Recommended" : "推荐",
    },
    {
      value: "mobile",
      title: isEnglish ? "Mostly on my phone" : "主要在手机",
      description: isEnglish
        ? "Start by pasting into the mobile web page. You can add a share shortcut later."
        : "先使用移动网页粘贴保存，之后可以再添加分享快捷方式。",
    },
    {
      value: "both",
      title: isEnglish ? "Both desktop and mobile" : "电脑和手机都用",
      description: isEnglish
        ? "Connect the desktop extension first, then use the save page on mobile too."
        : "先连接电脑扩展，手机端随后也能使用保存页面。",
    },
  ];

  async function savePreference(method: CaptureMethod, complete: boolean) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredCaptureMethod: method,
          onboardingComplete: complete || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || (isEnglish ? "Could not save your choice. Please try again." : "暂时没能保存，请重试。"));
        return;
      }
      router.push(complete ? "/app/capture?welcome=1" : "/app/setup/extension");
      router.refresh();
    } catch {
      setError(isEnglish ? "There seems to be a network issue. Please try again." : "网络好像有点问题，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  function continueSetup() {
    void savePreference(selected, selected === "mobile");
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 py-4">
      <header className="space-y-3 text-center">
        <p className="text-sm font-medium text-zinc-500">
          {isEnglish ? "Choose once" : "只需选择一次"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Where do you usually talk with AI?" : "你通常在哪里和 AI 对话？"}
        </h1>
        <p className="text-sm leading-6 text-zinc-500">
          {isEnglish
            ? "We will recommend the easiest way to save. You can change this later in Settings."
            : "我们会推荐最省事的保存方式。以后随时可以在设置里修改。"}
        </p>
      </header>

      <div
        className="space-y-3"
        role="radiogroup"
        aria-label={isEnglish ? "Choose a capture method" : "选择采集方式"}
      >
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(option.value)}
              className={`w-full rounded-2xl border p-5 text-left transition ${
                active
                  ? "border-zinc-900 bg-white shadow-sm ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-950 dark:ring-zinc-100"
                  : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{option.title}</span>
                {option.badge && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {option.badge}
                  </span>
                )}
              </span>
              <span className="mt-2 block text-sm leading-6 text-zinc-500">{option.description}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={continueSetup}
          disabled={loading}
          className="w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading
            ? isEnglish
              ? "Saving…"
              : "正在保存…"
            : selected === "mobile"
              ? isEnglish
                ? "Start saving conversations"
                : "开始保存对话"
              : isEnglish
                ? "Continue to browser extension"
                : "继续连接浏览器扩展"}
        </button>
        {selected !== "mobile" && (
          <button
            type="button"
            onClick={() => void savePreference("mobile", true)}
            disabled={loading}
            className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            {isEnglish ? "Skip the extension and save manually" : "暂时不装扩展，先手动保存"}
          </button>
        )}
      </div>
    </div>
  );
}

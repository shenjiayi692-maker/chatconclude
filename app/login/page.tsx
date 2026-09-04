"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/app/components/LanguageProvider";

function friendlyAuthError(message: string, isEnglish: boolean): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("limit")) {
    return isEnglish
      ? "Too many emails were sent recently. Wait a moment and try again."
      : "邮件发送太频繁了——等一会儿再试。";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return isEnglish
      ? "This email address cannot receive a login link. Try a real inbox."
      : "这个邮箱地址无法接收登录链接，换一个真实可收信的邮箱。";
  }
  if (m.includes("signup") && m.includes("disabled")) {
    return isEnglish
      ? "This email is not registered and new sign-ups are currently disabled."
      : "这个邮箱还没注册，且当前关闭了新用户注册。";
  }
  return isEnglish ? `Could not send the email: ${message}` : `发送失败：${message}`;
}

export default function LoginPage() {
  const { isEnglish } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 回调失败会带 ?error=1 回到这里
    if (new URLSearchParams(window.location.search).has("error")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        isEnglish
          ? "The previous login link could not be verified. Request a new one."
          : "上一次登录链接没能完成验证，重新获取一条再试。",
      );
    }
  }, [isEnglish]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(isEnglish ? "Enter your email address." : "填一下邮箱吧。");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const safeNext =
        requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : "/app";
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeNext);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString() },
      });
      if (error) {
        setError(friendlyAuthError(error.message, isEnglish));
        return;
      }
      setSent(true);
    } catch {
      setError(
        isEnglish
          ? "There seems to be a network issue. Please try again shortly."
          : "网络好像有点问题，稍后再试一次。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-24">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {isEnglish ? "Sign in" : "登录"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isEnglish
              ? "Enter your email and we will send a password-free login link. Once signed in, you can keep saving conversations and revisit them each week."
              : "输入邮箱，我们发一条免密码登录链接。登录后可以持续保存对话，并在每周回顾里重新想起它们。"}
          </p>
        </header>

        {sent ? (
          <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {isEnglish ? "A login link was sent to " : "登录链接已发到 "}
            <span className="font-medium">{email}</span>
            {isEnglish
              ? ". Open it in this browser to finish signing in."
              : "，去邮箱点开就登录了（同一浏览器打开）。"}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading
                ? isEnglish
                  ? "Sending…"
                  : "发送中…"
                : isEnglish
                  ? "Send login link"
                  : "发送登录链接"}
            </button>
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}

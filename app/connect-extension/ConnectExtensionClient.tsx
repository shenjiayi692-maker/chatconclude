"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

const PAYLOAD_ID = "weekly-review-extension-connect-payload";
const READY_EVENT = "weekly-review-extension-ready";
const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/hmpfieahioioldbnicdckaiahmmmammk";

export default function ConnectExtensionClient({ email }: { email?: string }) {
  const { isEnglish } = useLanguage();
  const [status, setStatus] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [extensionDetected, setExtensionDetected] = useState(false);

  useEffect(() => {
    function detectExtension() {
      setExtensionDetected(document.documentElement.dataset.weeklyReviewExtension === "ready");
    }

    detectExtension();
    window.addEventListener(READY_EVENT, detectExtension);
    return () => window.removeEventListener(READY_EVENT, detectExtension);
  }, []);

  async function connect() {
    if (!extensionDetected) {
      setStatus(
        isEnglish
          ? "Extension not detected yet. Finish steps 1 and 2, then refresh this page."
          : "还没有检测到扩展。先完成第 1、2 步，再刷新这个页面。",
      );
      return;
    }

    setConnecting(true);
    setStatus(isEnglish ? "Connecting…" : "正在连接…");
    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: isEnglish ? "Chrome extension connection" : "Chrome 扩展自动连接" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatus(
          isEnglish
            ? "Could not create a connection token. Please try again."
            : data?.error || "令牌生成失败。",
        );
        return;
      }

      const payload = document.createElement("script");
      payload.id = PAYLOAD_ID;
      payload.type = "application/json";
      payload.textContent = JSON.stringify({
        token: data.token,
        apiBase: window.location.origin,
      });
      document.documentElement.appendChild(payload);

      const result = await new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => resolve(false), 3000);
        window.addEventListener(
          "weekly-review-extension-result",
          () => {
            window.clearTimeout(timeout);
            resolve(document.documentElement.dataset.weeklyReviewExtensionResult === "ok");
          },
          { once: true },
        );
        window.dispatchEvent(new CustomEvent("weekly-review-extension-connect"));
      });

      if (result) {
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingComplete: true }),
        });
        setConnected(true);
        setStatus(
          isEnglish
            ? "Connected. Open an AI conversation and click the extension to save it."
            : "连接成功。打开一段 AI 对话，点击扩展就可以保存。",
        );
      } else {
        setStatus(
          isEnglish
            ? "The extension was detected but did not finish connecting. Reload the extension and this page, then try again."
            : "已经检测到扩展，但连接没有完成。刷新扩展和这个页面后再试。",
        );
      }

      if (!result && data.id) {
        await fetch("/api/tokens", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: data.id }),
        });
      }
    } catch {
      setStatus(
        isEnglish
          ? "Connection failed. Refresh this page and try again."
          : "连接失败，请刷新页面重试。",
      );
    } finally {
      document.getElementById(PAYLOAD_ID)?.remove();
      delete document.documentElement.dataset.weeklyReviewExtensionResult;
      setConnecting(false);
    }
  }

  async function skipExtension() {
    setConnecting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredCaptureMethod: "mobile",
          onboardingComplete: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        setStatus(
          isEnglish
            ? "Could not save your choice. Please try again."
            : data?.error || "暂时没能保存，请重试。",
        );
        return;
      }
      window.location.assign("/app/capture?welcome=1");
    } catch {
      setStatus(
        isEnglish
          ? "There seems to be a network issue. Please try again."
          : "网络好像有点问题，请稍后再试。",
      );
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <header className="space-y-3 text-center">
        <p className="text-sm font-medium text-zinc-500">
          {isEnglish ? "Desktop capture" : "电脑端采集"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Install and connect the browser extension" : "安装并连接浏览器扩展"}
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-500">
          {isEnglish
            ? "Install from the Chrome Web Store once, connect your account, and saving a conversation takes one click."
            : "从 Chrome 商店安装一次并连接账号，以后保存对话只要点一下。"}
        </p>
        {email && <p className="text-xs text-zinc-400">{email}</p>}
      </header>

      <ol className="space-y-4">
        <li className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start gap-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950">
              1
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                {isEnglish ? "Install from Chrome Web Store" : "从 Chrome 商店安装"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {isEnglish
                  ? "Open the store listing and click Add to Chrome. No ZIP file or Developer mode is needed."
                  : "打开商店详情页，点击“添加至 Chrome”。无需下载 ZIP，也不用开启开发者模式。"}
              </p>
              <a
                href={CHROME_WEB_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {isEnglish ? "Open Chrome Web Store ↗" : "打开 Chrome 商店 ↗"}
              </a>
              <p className="mt-2 text-xs text-zinc-400">
                {isEnglish ? "Version 0.3.0 · Chrome / Edge" : "版本 0.3.0 · 支持 Chrome / Edge"}
              </p>
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                {isEnglish
                  ? "Chrome Enhanced Safe Browsing may show a ‘not trusted’ notice because this is a newly published extension. This does not mean Chrome found it unsafe; review the requested permissions, then choose Continue to install."
                  : "由于扩展刚刚发布，开启 Chrome“增强型安全浏览”的用户可能看到“尚不受信任”提示。这不代表 Chrome 判定扩展存在风险；确认权限后，可选择“继续安装”。"}
              </p>
            </div>
          </div>
        </li>

        <li
          className={`rounded-2xl border p-5 ${
            extensionDetected
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50"
              : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          }`}
        >
          <div className="flex items-start gap-4">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                extensionDetected
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950"
              }`}
            >
              {extensionDetected ? "✓" : "2"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
                  {isEnglish ? "Connect your account" : "连接你的账号"}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    extensionDetected
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                  }`}
                >
                  {extensionDetected
                    ? isEnglish
                      ? "Extension detected"
                      : "已检测到扩展"
                    : isEnglish
                      ? "Not detected"
                      : "暂未检测到"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {extensionDetected
                  ? isEnglish
                    ? "The extension is ready. Connect it to your signed-in account."
                    : "扩展已经准备好，现在把它连接到当前账号。"
                  : isEnglish
                    ? "After installing from the store, refresh this page. Detection will happen automatically."
                    : "从商店安装后刷新这个页面，系统会自动检测。"}
              </p>
              <button
                type="button"
                onClick={connect}
                disabled={connecting || connected}
                className="mt-4 w-full rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
              >
                {connected
                  ? isEnglish
                    ? "Connected"
                    : "已连接"
                  : connecting
                    ? isEnglish
                      ? "Connecting…"
                      : "连接中…"
                    : extensionDetected
                      ? isEnglish
                        ? "Connect extension"
                        : "连接扩展"
                      : isEnglish
                        ? "I installed it—detect again"
                        : "我已安装，重新检测"}
              </button>
            </div>
          </div>
        </li>
      </ol>

      {status && (
        <p
          className={`rounded-xl p-4 text-sm leading-6 ${
            connected
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          }`}
        >
          {status}
        </p>
      )}

      {connected ? (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 dark:border-emerald-900 dark:bg-zinc-950">
          <div>
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
              {isEnglish ? "Save your first conversation" : "保存第一段对话"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">
              {isEnglish
                ? "Open any supported AI site, refresh the conversation page once, then click the extension icon."
                : "打开任一支持的 AI 网站，刷新一次对话页，然后点击工具栏里的扩展图标。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["ChatGPT", "https://chatgpt.com"],
              ["Claude", "https://claude.ai"],
              ["DeepSeek", "https://chat.deepseek.com"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {label} ↗
              </a>
            ))}
          </div>
          <Link
            href="/app"
            className="inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            {isEnglish ? "Open this week's review" : "进入本周回顾"}
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-3 text-center text-sm">
          <button
            type="button"
            onClick={skipExtension}
            disabled={connecting}
            className="text-zinc-600 hover:underline disabled:opacity-50 dark:text-zinc-300"
          >
            {isEnglish ? "Skip the extension and save manually" : "暂时不装扩展，先手动保存"}
          </button>
          <Link href="/app/settings" className="text-zinc-400 hover:underline">
            {isEnglish ? "Back to Settings" : "返回设置"}
          </Link>
        </div>
      )}
    </div>
  );
}

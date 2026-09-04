"use client";

import { useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

export default function AccountSettings() {
  const { isEnglish } = useLanguage();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deletePhrase = isEnglish ? "DELETE MY ACCOUNT" : "删除我的账号";

  async function signOut() {
    setError(null);
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.error || (isEnglish ? "Could not sign out." : "退出失败。"));
        return;
      }
      window.location.assign("/");
    } catch {
      setError(isEnglish ? "Network error. Please try again." : "网络异常，请稍后重试。");
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: confirmation === deletePhrase ? "删除我的账号" : confirmation,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || (isEnglish ? "Could not delete the account." : "删除失败。"));
        return;
      }
      window.location.assign("/");
    } catch {
      setError(isEnglish ? "Network error. Please try again." : "网络异常，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {isEnglish ? "Account and data" : "账号与数据"}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {isEnglish
            ? "Download a complete copy at any time. Deleting your account permanently removes saved conversations, review history, and all device connections."
            : "可随时下载完整数据副本。删除账号会清除保存的对话、历史回顾和所有设备连接，且无法恢复。"}
        </p>
      </div>
      <a
        href="/api/account/export"
        className="inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isEnglish ? "Export my data" : "导出我的数据"}
      </a>
      <button
        onClick={signOut}
        className="ml-2 rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isEnglish ? "Sign out" : "退出登录"}
      </button>
      <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <label className="block text-xs text-zinc-500">
          {isEnglish ? `Type “${deletePhrase}” to confirm` : "输入“删除我的账号”确认"}
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-black"
          />
        </label>
        <button
          onClick={deleteAccount}
          disabled={deleting || confirmation !== deletePhrase}
          className="rounded-full border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        >
          {deleting
            ? isEnglish
              ? "Deleting…"
              : "删除中…"
            : isEnglish
              ? "Permanently delete account"
              : "永久删除账号"}
        </button>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/app/components/LanguageProvider";
import { isRollingDeviceToken } from "@/lib/token-policy";

export interface TokenRow {
  id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
  expires_at: string;
  last_used_at: string | null;
}

export default function TokenManager({
  initialTokens,
  nowIso,
}: {
  initialTokens: TokenRow[];
  nowIso: string;
}) {
  const { isEnglish } = useLanguage();
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const nowMs = new Date(nowIso).getTime();

  async function handleCreate() {
    setError(null);
    setFreshToken(null);
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || (isEnglish ? "Could not create a token." : "生成失败。"));
        return;
      }
      setFreshToken(data.token);
      setLabel("");
      router.refresh();
    } catch {
      setError(isEnglish ? "There seems to be a network issue. Please try again." : "网络好像有点问题，稍后再试。");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || (isEnglish ? "Could not revoke the token." : "吊销失败。"));
        return;
      }
      router.refresh();
    } catch {
      setError(isEnglish ? "There seems to be a network issue. Please try again." : "网络好像有点问题，稍后再试。");
    }
  }

  async function copyToken() {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {isEnglish ? "Manual tokens (backup)" : "手动令牌（备用）"}
        </h2>
        <p className="text-xs leading-5 text-zinc-500">
          {isEnglish
            ? "A connected device stays signed in. Active device tokens renew automatically; revoke one here if a device is lost or no longer used."
            : "同一设备连接一次后会保持登录。持续使用的设备令牌会自动续期；设备丢失或不再使用时，可在这里吊销。"}
        </p>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isEnglish ? "Label (optional, e.g. My MacBook)" : "备注（可选，如「我的 MacBook」）"}
            className="flex-1 rounded-xl border border-zinc-300 bg-white p-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="shrink-0 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {creating
              ? isEnglish
                ? "Creating…"
                : "生成中…"
              : isEnglish
                ? "Create token"
                : "生成令牌"}
          </button>
        </div>

        {freshToken && (
          <div className="space-y-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {isEnglish
                ? "New token (shown once—copy it now):"
                : "新令牌（只显示这一次，请复制保存）："}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-zinc-800 dark:bg-black dark:text-zinc-200">
                {freshToken}
              </code>
              <button
                onClick={copyToken}
                className="shrink-0 rounded-full border border-emerald-400 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900"
              >
                {copied ? (isEnglish ? "Copied" : "已复制") : isEnglish ? "Copy" : "复制"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {isEnglish ? `Existing tokens (${initialTokens.length})` : `已有令牌（${initialTokens.length}）`}
        </h2>
        {initialTokens.length === 0 ? (
          <p className="text-sm text-zinc-400">
            {isEnglish ? "No tokens yet. Create one above." : "还没有令牌，上面生成一个。"}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {initialTokens.map((t) => {
              const revoked = Boolean(t.revoked_at);
              const rolling = isRollingDeviceToken(t.label);
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-800 dark:text-zinc-200">
                      {t.label || (isEnglish ? "(No label)" : "（无备注）")}
                      {revoked && (
                        <span className="ml-2 text-xs text-zinc-400">
                          {isEnglish ? "Revoked" : "已吊销"}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {isEnglish ? "Created " : "创建于 "}
                      {new Date(t.created_at).toLocaleDateString(isEnglish ? "en-US" : "zh-CN")} ·{" "}
                      {revoked
                        ? isEnglish
                          ? "Revoked"
                          : "已吊销"
                        : new Date(t.expires_at).getTime() <= nowMs
                          ? isEnglish
                            ? "Expired"
                            : "已过期"
                          : rolling
                            ? isEnglish
                              ? `Renews while active · inactive expiry ${new Date(t.expires_at).toLocaleDateString("en-US")}`
                              : `持续使用会自动续期 · 长期未使用将于 ${new Date(t.expires_at).toLocaleDateString("zh-CN")} 失效`
                          : isEnglish
                            ? `Valid until ${new Date(t.expires_at).toLocaleDateString("en-US")}`
                            : `有效至 ${new Date(t.expires_at).toLocaleDateString("zh-CN")}`}
                    </p>
                  </div>
                  {!revoked && new Date(t.expires_at).getTime() > nowMs && (
                    <button
                      onClick={() => handleRevoke(t.id)}
                      className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    >
                      {isEnglish ? "Revoke" : "吊销"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIMEZONE, normalizeTimezone } from "@/lib/timezone";
import AccountSettings from "@/app/settings/AccountSettings";
import ProfileSettings from "@/app/settings/ProfileSettings";
import TokenManager, { TokenRow } from "@/app/settings/token/TokenManager";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const isEnglish = locale === "en";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/settings");

  const { data: tokensData } = await supabase
    .from("api_tokens")
    .select("id, label, created_at, revoked_at, expires_at, last_used_at")
    .order("created_at", { ascending: false });
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const tokens = (tokensData ?? []) as TokenRow[];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">{isEnglish ? "My account" : "我的账号"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Settings" : "设置"}
        </h1>
        {user.email && <p className="text-sm text-zinc-500">{user.email}</p>}
      </header>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            {isEnglish ? "Capture method" : "采集方式"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {isEnglish
              ? "Connect the browser extension to save directly from AI conversation pages."
              : "连接浏览器扩展后，可以在 AI 对话页一键保存。"}
          </p>
        </div>
        <Link
          href="/app/setup/extension"
          className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {isEnglish ? "Connect browser extension" : "连接浏览器扩展"}
        </Link>
        <p className="text-xs text-zinc-400">
          {isEnglish ? "On mobile, you can also use" : "手机上也可以直接使用"}
          <Link href="/app/capture" className="ml-1 underline underline-offset-2">
            {isEnglish ? "Save conversation" : "保存对话"}
          </Link>
          。
        </p>
      </section>

      <ProfileSettings initialTimezone={normalizeTimezone(profile?.timezone ?? DEFAULT_TIMEZONE)} />

      <details className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isEnglish ? "Connection problems? Open manual setup" : "遇到连接问题？打开手动配置"}
        </summary>
        <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          <TokenManager initialTokens={tokens} nowIso={new Date().toISOString()} />
        </div>
      </details>

      <AccountSettings />
    </div>
  );
}

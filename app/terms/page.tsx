import Link from "next/link";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getLocale } from "@/lib/locale-server";

export default async function TermsPage() {
  const isEnglish = (await getLocale()) === "en";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-16 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-zinc-500 hover:underline">
          {isEnglish ? "← Back home" : "← 返回首页"}
        </Link>
        <LanguageSwitcher />
      </div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {isEnglish ? "Terms of use" : "使用条款"}
      </h1>
      <p>{isEnglish ? "Updated July 18, 2026" : "更新日期：2026 年 7 月 18 日"}</p>
      <p>
        {isEnglish
          ? "This product is currently in testing. Do not submit content you do not have the right to process, unlawful material, or unnecessary highly sensitive information."
          : "本产品目前处于测试阶段。请勿提交你无权处理的内容、违法内容或不必要的高度敏感信息。"}
      </p>
      <p>
        {isEnglish
          ? "AI-generated reviews may contain omissions or errors and do not constitute medical, legal, financial, or other professional advice."
          : "AI 生成的复习内容可能存在遗漏或错误，不构成医疗、法律、财务或其他专业建议。"}
      </p>
      <p>
        {isEnglish
          ? "To protect service stability and model costs, the APIs enforce input, frequency, and daily usage limits. Abuse, automated attacks, or attempts to bypass limits may result in suspended access."
          : "为保护服务稳定与模型成本，接口设有输入、频率和每日额度限制。滥用、自动化攻击或绕过限制的行为可能导致访问被暂停。"}
      </p>
      <p>
        {isEnglish
          ? "Users can export or delete account data in Settings. Subscription, refund, and service-availability terms will be added before paid plans launch."
          : "用户可在设置页导出或删除账号数据。正式收费前，本条款会补充订阅、退款和服务可用性约定。"}
      </p>
    </main>
  );
}

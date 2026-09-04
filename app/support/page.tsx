import Link from "next/link";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getLocale } from "@/lib/locale-server";

export default async function SupportPage() {
  const isEnglish = (await getLocale()) === "en";
  const questions = isEnglish
    ? [
        [
          "The extension says it is not connected",
          "Open the extension, choose Connect account, sign in on the website, and complete the connection. Then refresh the Claude, ChatGPT, or DeepSeek conversation page.",
        ],
        [
          "The save button is missing",
          "Confirm that you are on a supported conversation page, reload the extension from chrome://extensions, and refresh the conversation tab.",
        ],
        [
          "A save is waiting to retry",
          "Keep the extension installed and reconnect your account if needed. Temporary network or server failures are retried automatically; queued content expires after seven days.",
        ],
        [
          "I want to remove my data",
          "Use the extension’s Disconnect action to clear local data. Use Settings on the website to revoke device tokens, export data, or permanently delete your account.",
        ],
      ]
    : [
        [
          "扩展提示尚未连接",
          "打开扩展并点击“连接账号”，在网站完成登录和连接，然后刷新 Claude、ChatGPT 或 DeepSeek 对话页。",
        ],
        [
          "页面没有出现保存按钮",
          "确认当前是受支持的对话页，在 chrome://extensions 中重新加载扩展，再刷新对话标签页。",
        ],
        [
          "保存内容正在等待补发",
          "保持扩展安装，并在需要时重新连接账号。临时网络或服务错误会自动重试，队列内容最长保留 7 天。",
        ],
        [
          "我想删除数据",
          "使用扩展里的“断开连接”清除本地数据；在网站设置页可以吊销设备令牌、导出数据或永久删除账号。",
        ],
      ];

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-6 py-16 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-zinc-500 hover:underline">
          {isEnglish ? "← Back home" : "← 返回首页"}
        </Link>
        <LanguageSwitcher />
      </div>
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Help and support" : "帮助与支持"}
        </h1>
        <p>
          {isEnglish
            ? "Quick fixes for the browser extension and capture flow."
            : "浏览器扩展与采集流程的常见问题。"}
        </p>
      </header>
      <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {questions.map(([question, answer]) => (
          <section key={question} className="space-y-2 py-6">
            <h2 className="font-medium text-zinc-950 dark:text-zinc-100">{question}</h2>
            <p>{answer}</p>
          </section>
        ))}
      </div>
      <p className="rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-900">
        {isEnglish
          ? "For issues that are not covered here, use the Support section on the extension’s Chrome Web Store listing. Do not include access tokens or private conversation text in a public report."
          : "如果问题没有在这里解决，请通过扩展 Chrome 商店详情页的“支持”入口反馈。公开反馈中不要粘贴接入令牌或私人对话正文。"}
      </p>
      <div className="flex gap-4 text-zinc-500">
        <Link href="/privacy" className="hover:underline">
          {isEnglish ? "Privacy" : "隐私说明"}
        </Link>
        <Link href="/app/setup/extension" className="hover:underline">
          {isEnglish ? "Extension setup" : "扩展安装"}
        </Link>
      </div>
    </main>
  );
}

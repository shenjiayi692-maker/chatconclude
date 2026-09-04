import Link from "next/link";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { getLocale } from "@/lib/locale-server";

export default async function PrivacyPage() {
  const isEnglish = (await getLocale()) === "en";

  const sections = isEnglish
    ? [
        {
          title: "What the browser extension collects",
          paragraphs: [
            "The extension reads conversation content only after you click “Save to review” or “Save full conversation” and accept the in-product disclosure. It collects the questions and answers you select—or the current conversation when you explicitly choose to save all—plus the AI service name, conversation title or identifier, and capture time.",
            "The extension does not collect conversations in the background, monitor browsing history, read content on unsupported websites, or access passwords, cookies, payment information, or your AI-service account credentials.",
          ],
        },
        {
          title: "How captured content is used",
          paragraphs: [
            "Captured content is encrypted in transit and sent to chat-conclude.vercel.app, then stored in your Supabase-backed account so you can generate personal weekly reviews and quizzes. When you request a review, the relevant content is sent to Anthropic’s API for classification and generation.",
            "We use captured content only to provide and secure the product’s user-facing knowledge capture, review, quiz, export, and deletion features. We do not sell it, use it for advertising, or use it to build advertising profiles.",
          ],
        },
        {
          title: "Account, token, and local data",
          paragraphs: [
            "Supabase Auth processes your email address and sign-in session. The extension stores its access token in Chrome local storage; the server stores only a SHA-256 hash of that token. If an upload fails, the submitted content may remain in a local retry queue for up to seven days.",
            "Selecting “Disconnect and clear local data” removes the local token, consent record, service address, and retry queue from the extension.",
          ],
        },
        {
          title: "Service providers and limited use",
          paragraphs: [
            "Vercel hosts the web application and API, Supabase provides authentication and database storage, and Anthropic processes content when generating reviews and quizzes. Data is shared with these providers only as necessary to provide the features you request.",
            "Use and transfer of extension data is limited to providing or improving the extension’s single purpose, maintaining security, complying with law, or completing a corporate transaction subject to equivalent protections. Humans do not read conversation content except with your specific support consent, when required for security, or when legally required.",
          ],
        },
        {
          title: "Retention and deletion",
          paragraphs: [
            "Saved conversations remain in your account until they are included in a completed weekly archive or you delete your account. After a weekly archive is created, the source conversations for that week are deleted and the generated review and quiz remain. Local failed-upload entries expire after no more than seven days.",
            "In Settings, you can revoke extension tokens, export your account data, or permanently delete your account and associated data. You can also uninstall the extension at any time.",
          ],
        },
        {
          title: "Public paste demo",
          paragraphs: [
            "Conversations pasted into the public homepage demo are processed only for the duration of the request and are not written to the database. The content is sent to Anthropic to classify it and generate the review and quiz.",
          ],
        },
        {
          title: "Security and policy",
          paragraphs: [
            "User data is transmitted over HTTPS and account data is isolated by user identity. Server error logs do not contain conversation text or plaintext access tokens; model-usage records contain model names and token counts rather than conversation content.",
            "The extension’s use of information complies with the Chrome Web Store User Data Policy, including its Limited Use requirements. This notice will be updated before materially different data practices are introduced, and the extension will request consent again when required.",
          ],
        },
      ]
    : [
        {
          title: "浏览器扩展会采集什么",
          paragraphs: [
            "只有在你接受扩展内的数据说明，并点击“存入复习”或“存整段对话”后，扩展才会读取内容。采集范围包括你选中的提问和回答，或你明确选择保存的当前整段会话，以及 AI 服务名称、会话标题或标识和采集时间。",
            "扩展不会在后台采集对话、监控浏览记录、读取不支持网站的内容，也不会访问密码、Cookie、付款信息或你在 AI 服务中的账号凭证。",
          ],
        },
        {
          title: "采集内容如何使用",
          paragraphs: [
            "采集内容会通过加密连接发送到 chat-conclude.vercel.app，并存入由 Supabase 支持的个人账号，用于生成你的知识周报和测验。当你请求生成周报时，相关内容会发送给 Anthropic API 进行分类和生成。",
            "我们只把采集内容用于提供和保护知识采集、周报、测验、导出和删除等用户可见功能。我们不出售这些内容，不将其用于广告，也不据此建立广告画像。",
          ],
        },
        {
          title: "账号、令牌与本地数据",
          paragraphs: [
            "Supabase Auth 会处理你的邮箱地址和登录会话。扩展把接入令牌保存在 Chrome 本地存储中，服务端只保存令牌的 SHA-256 哈希。网络失败时，已经由你提交的内容最多会在本机重试队列中保留 7 天。",
            "点击“断开连接并清空本地数据”会删除扩展本地保存的令牌、同意记录、服务地址和待补发队列。",
          ],
        },
        {
          title: "服务提供商与有限使用",
          paragraphs: [
            "Vercel 托管网站与 API，Supabase 提供登录和数据库服务，Anthropic 在生成周报和测验时处理相关内容。只有为完成你请求的功能所必需时，数据才会传给这些服务商。",
            "扩展数据的使用和传输仅限于实现或改进扩展的单一用途、维护安全、遵守法律，或在同等保护条件下完成公司交易。除非你为具体客服问题明确授权、出于安全需要或法律要求，人工不会阅读你的对话内容。",
          ],
        },
        {
          title: "保存期限与删除",
          paragraphs: [
            "已保存对话会保留到它被纳入一份已完成的跨周归档，或你删除账号。跨周归档创建后，该周原始对话会被删除，仅保留生成的周报与 Quiz。本地失败上传内容最长保留 7 天。",
            "你可以在设置页吊销扩展令牌、导出账号数据，或永久删除账号和关联数据；也可以随时卸载扩展。",
          ],
        },
        {
          title: "公开粘贴 Demo",
          paragraphs: [
            "首页公开 Demo 中粘贴的对话只在请求期间处理，不写入数据库。内容会发送给 Anthropic，用于分类并生成周报和 Quiz。",
          ],
        },
        {
          title: "安全与政策",
          paragraphs: [
            "用户数据通过 HTTPS 传输，并按用户身份隔离。服务端错误日志不包含对话正文或接入令牌明文；模型用量记录只包含模型名称和 token 数，不包含对话内容。",
            "扩展对信息的使用遵守 Chrome Web Store 用户数据政策，包括 Limited Use 要求。如果未来引入实质不同的数据处理方式，我们会先更新本说明，并在需要时重新取得你的同意。",
          ],
        },
      ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-zinc-500 hover:underline">
          {isEnglish ? "← Back home" : "← 返回首页"}
        </Link>
        <LanguageSwitcher />
      </div>

      <header className="mt-10 space-y-3 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
          {isEnglish ? "Weekly Knowledge Review" : "每周知识复习"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Privacy notice" : "隐私说明"}
        </h1>
        <p className="text-zinc-500">
          {isEnglish ? "Effective July 30, 2026" : "生效日期：2026 年 7 月 30 日"}
        </p>
        <p>
          {isEnglish
            ? "You control what is saved. The browser extension never captures conversations until you take an explicit action and accept its disclosure."
            : "你决定保存什么。浏览器扩展只会在你主动操作并同意数据说明后采集对话。"}
        </p>
      </header>

      <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3 py-7">
            <h2 className="text-lg font-medium text-zinc-950 dark:text-zinc-100">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-4 border-t border-zinc-200 pt-7 text-zinc-500 dark:border-zinc-800">
        <Link href="/support" className="hover:underline">
          {isEnglish ? "Support" : "帮助与支持"}
        </Link>
        <Link href="/terms" className="hover:underline">
          {isEnglish ? "Terms of use" : "使用条款"}
        </Link>
      </div>
    </main>
  );
}

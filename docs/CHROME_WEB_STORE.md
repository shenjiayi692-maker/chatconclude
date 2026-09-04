# Chrome Web Store 上架资料包

本文件按 Chrome Web Store Developer Dashboard 的页面顺序填写。发布包与图片均在仓库内生成，不要把测试令牌、邮箱登录链接或 Supabase 密钥写入本文件。

## 0. 提交文件

- 上传包：`extension/dist/weekly-review-capture-0.3.0.zip`
- 商店图标：`extension/store-assets/icon-128.png`
- 中文截图：`extension/store-assets/zh-CN/screenshot-*.png`
- 英文截图：`extension/store-assets/en/screenshot-*.png`
- Small promo tile：`extension/store-assets/promo-small-440x280.png`
- Marquee：`extension/store-assets/promo-marquee-1400x560.png`

上传 ZIP 后先确认：

- `manifest.json` 位于 ZIP 根目录。
- 版本为 `0.3.0`。
- 商店包不包含 `http://localhost:3000/*`。
- 包内没有 `.env*`、测试数据、源码映射或密钥。

## 1. Store listing

### 中文（简体）

**名称**

每周知识复习 · 对话采集

**摘要**

手动保存 Claude、ChatGPT 和 DeepSeek 对话到你的每周知识复习。只有你点击时才会采集。

**详细说明**

把和 AI 聊过的知识，变成真正记得住的每周复习。

在 Claude、ChatGPT 或 DeepSeek 的对话页中，你可以只选择值得回看的提问和回答，也可以明确选择保存当前整段会话。保存后的内容进入你自己的每周知识复习账号，用来生成自然语言周报和主动回忆小测验。

主要功能：

- 手动选择并保存对话消息
- 明确操作后保存当前整段会话
- 支持 Claude、ChatGPT 和 DeepSeek
- 网络临时失败时在本机安全重试
- 自动跳过重复内容
- 随时断开连接、吊销令牌和删除账号数据

隐私设计：

- 安装后先展示清晰的数据说明，由你主动同意
- 只有点击保存后才读取当前对话
- 不后台采集，不监控浏览记录
- 不出售数据，不用于广告
- 内容通过 HTTPS 上传到你的个人账号

首次使用需要登录每周知识复习账号并连接扩展。

**类别**

Productivity / 生产力工具

**语言**

中文（简体）

### English

**Name**

Weekly Knowledge Review Capture

**Summary**

Manually save Claude, ChatGPT, and DeepSeek conversations to your weekly knowledge review. Capture starts only when you click.

**Detailed description**

Turn useful AI conversations into knowledge you can actually remember.

On Claude, ChatGPT, or DeepSeek, select only the questions and answers worth reviewing—or explicitly save the current full conversation. Captured content goes to your own Weekly Knowledge Review account, where it can become a natural-language weekly review and an active-recall quiz.

Key features:

- Manually select and save conversation messages
- Explicitly save the current full conversation
- Works with Claude, ChatGPT, and DeepSeek
- Safely retries user-submitted uploads after temporary failures
- Skips duplicate content
- Disconnect, revoke tokens, export data, or delete your account

Privacy by design:

- Clear in-product disclosure and affirmative consent before capture
- Reads the current conversation only after you click save
- No background capture or browsing-history monitoring
- No data sales or advertising use
- Sends content over HTTPS to your private account

Sign in to a Weekly Knowledge Review account once to connect the extension.

**Category**

Productivity

**Language**

English

### 公共链接

- Homepage URL：`https://chat-conclude.vercel.app`
- Support URL：`https://chat-conclude.vercel.app/support`
- Privacy policy URL：`https://chat-conclude.vercel.app/privacy`

当前使用 `vercel.app` 子域，无法作为自有域名完成 Search Console 的 verified publisher 展示。商业公开推广前建议购买并绑定自有域名，再验证 Publisher URL；这不阻挡首次提交。

## 2. Privacy practices

### Single purpose

**中文**

用户在 Claude、ChatGPT 或 DeepSeek 页面主动选择当前对话内容，并将其保存到自己的每周知识复习账号，以生成个人知识周报和主动回忆测验。

**English**

Let users explicitly select content from the current Claude, ChatGPT, or DeepSeek conversation and save it to their own Weekly Knowledge Review account for personal reviews and active-recall quizzes.

### Permission justifications

**`storage`**

在本机保存用户的连接令牌、明确同意记录、服务地址，以及用户已经点击提交但因临时网络错误尚未送达的重试队列。队列最多保留 7 天，用户断开连接时全部清除。

**`alarms`**

仅用于定时重试用户已经明确点击提交、但因临时网络或服务错误失败的上传。扩展不会用它进行后台抓取。

**Host permissions — Claude / ChatGPT / DeepSeek**

扩展需要在三个明确支持的 AI 会话网站上显示“存入复习”界面，并在用户主动点击后读取当前页面中选择的提问和回答。不访问其他网站，不在后台读取。

**Host permission — `chat-conclude.vercel.app`**

用于打开账号连接页面、接收用户主动签发的扩展令牌，并通过 HTTPS 把用户明确提交的内容上传到其个人账号。

### Remote code

选择：

> No, I am not using remote code.

说明：

所有可执行 JavaScript 均包含在扩展包中。扩展只向产品 HTTPS API 发送数据和接收 JSON，不下载或执行远程代码，也不使用 `eval`。

### Data types

保守且与真实行为一致地勾选：

- Authentication information：扩展接入令牌。
- Website content：当前支持网站上由用户明确保存的会话内容、会话标题或标识。
- Personal communications：用户与 AI 的对话可能包含个人通信。
- User-generated content：用户在 AI 会话中输入的问题。

不要勾选：

- Personally identifiable information：扩展本身不读取或上传用户邮箱；登录发生在产品网站。
- Financial and payment information
- Health information
- Location

如果 Dashboard 将当前页面标题或标识明确归类为 Web history，则也勾选 Web history，并保持隐私说明一致。扩展不读取 Chrome 历史记录，也不构建访问网站列表。

### Limited Use certifications

真实勾选以下声明：

- 不向第三方出售用户数据。
- 不把用户数据用于与单一用途无关的目的。
- 不把用户数据用于信用、贷款或个性化广告。
- 只在提供功能、安全、法律要求或符合政策的公司交易所必需时传输数据。
- 除用户针对具体支持问题明确授权、安全需要或法律要求外，不允许人工阅读内容。

隐私政策已经明确披露 Vercel、Supabase 与 Anthropic 的必要处理。

## 3. Distribution

初次发布建议：

- Visibility：`Unlisted`
- Regions：全部可用地区
- Pricing：Free

先以 Unlisted 邀请 5–20 名种子用户验证安装、连接和持续使用；稳定后再切换 Public。Unlisted 仍需审核，但不会出现在商店搜索中。

## 4. Test instructions

扩展核心功能需要连接账号。提交前在网站设置页创建一个专用审核令牌，不要使用个人主账号令牌。

**Reviewer steps**

1. Install the extension and open it from the Chrome toolbar.
2. Review the disclosure, check the consent box, and select “Agree and continue.”
3. Expand “Manual setup and troubleshooting.”
4. Keep the Service URL as `https://chat-conclude.vercel.app`.
5. Paste the temporary reviewer token supplied in the private credentials field and select “Save and verify.”
6. Open a conversation on `https://chatgpt.com`, `https://claude.ai`, or `https://chat.deepseek.com`.
7. Use the page button to select messages and save them, or use “Save full conversation” in the popup.
8. The extension displays the number of saved and duplicate items returned by the production API, which confirms the capture flow without requiring access to the reviewer account’s email inbox.

**Private reviewer credentials**

- Access token：提交前生成，粘贴到 Dashboard 的私密测试凭证字段。

令牌有效期应覆盖完整审核周期；不要把令牌写进公开商店描述、隐私页或截图。审核结束后在网站设置页立即吊销。

## 5. 提交前人工清单

- [ ] 注册 Chrome Web Store 开发者账号并完成一次性付费。
- [ ] 开启开发者账号两步验证。
- [ ] 填写真实可用的开发者联系邮箱。
- [ ] 上传 `weekly-review-capture-0.3.0.zip`。
- [ ] 上传 128×128 图标、至少一张 1280×800 截图和 440×280 promo tile。
- [ ] 中英文 Store listing 文案均填写。
- [ ] Privacy practices 与本文件逐项一致。
- [ ] Privacy policy URL 和 Support URL 在线可访问。
- [ ] 创建并填写专用 reviewer token。
- [ ] 用全新 Chrome Profile 完成：同意 → 连接 → 选择保存 → 整段保存 → 重试 → 断开。
- [ ] 选择 `Unlisted` 并启用 deferred publishing，审核通过后手动发布。

## 6. 审核依据

- Chrome 扩展上传包必须是 ZIP，且 `manifest.json` 位于根目录。
- Manifest 的 description 不超过 132 个字符。
- 至少上传一张 1280×800（或兼容规格）的实际体验截图；最多五张。
- 数据收集必须在商店页和产品界面中显著披露，并在采集前取得主动同意。
- 权限必须保持实现单一用途所需的最小范围。

官方文档：

- https://developer.chrome.com/docs/webstore/prepare
- https://developer.chrome.com/docs/webstore/best-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/publish

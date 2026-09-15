<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="ChatConclude turns useful AI conversations into a weekly review and active-recall quiz">
</p>

<p align="center">
  <a href="https://chat-conclude.vercel.app"><strong>试试无状态 demo</strong></a>
  · <a href="https://chromewebstore.google.com/detail/hmpfieahioioldbnicdckaiahmmmammk"><strong>安装扩展</strong></a>
  · <a href="./PRODUCT.md">产品说明</a>
  · <a href="./docs/CHROME_WEB_STORE.md">扩展指南</a>
</p>

<p align="center"><a href="./README.md">English</a> · <strong>中文</strong></p>

> 你每周和 AI 聊几十次。一周之后，真正还记得多少？

不用装任何东西——<https://chat-conclude.vercel.app> 粘一段对话就返回一份周报。本地跑：

```bash
git clone https://github.com/shenjiayi692-maker/chatconclude && cd chatconclude && cp .env.example .env.local && npm i && npm run dev
```

它会起来并告诉你要填哪些 key；完整流程需要 Anthropic 和 Supabase。

ChatConclude 帮你记住那些你问过 AI 的有用东西。从 Claude、ChatGPT 或 DeepSeek 里保存选定的对话——或者直接粘进网页 demo——把零散的学习变成一份可读的周报，外加几道用于主动回忆的小题。

## 从对话到记忆

1. **主动保存。** 用浏览器扩展保存一段对话，或者从任何设备粘贴进来。
2. **滤掉噪音。** 知识性提问留下；让 AI 干活和闲聊被排除。
3. **读一份连贯的回顾。** 相关的想法被写成自然的段落，而不是一堆摘要的堆砌。
4. **先回忆，再重读。** 每份周报末尾有 3–5 道题，逼你自己把想法提取出来。

<p align="center">
  <img src="./docs/screenshots/filtering.webp" width="88%" alt="ChatConclude filtering knowledge questions from delegated work before composing a weekly review">
</p>

## 看它跑起来

公开首页是一个无需账号的粘贴 demo。提交一段既包含你学到的东西、又包含你让 AI 代劳的任务的对话，结果会显示：什么进了周报、什么被滤掉了，以及生成的小测验。

<p align="center">
  <img src="./docs/screenshots/paste-demo.webp" width="88%" alt="ChatConclude paste demo for generating a review without signing in">
</p>

## 用行为保护隐私

- 扩展只有在你明确选择保存、并接受告知之后，才会读取内容。
- 公开的粘贴 demo 是请求级作用域：它不把粘贴的对话写进数据库，也不写进应用日志。
- 登录后的数据通过 Supabase 行级安全按用户隔离。
- 源对话在周度归档后被删除；生成的周报和小测验保留。
- 周报由 AI 生成，可能有遗漏或错误。

完整的[隐私政策](https://chat-conclude.vercel.app/privacy)和[上线检查表](./docs/PRODUCTION_CHECKLIST.md)另见。

## 本地开发

```bash
cp .env.example .env.local
npm install
npm run dev
```

按 [`.env.example`](./.env.example) 里列出的项配置 Anthropic 和 Supabase，然后验证改动：

```bash
npm run lint
npm test
npm run build
```

## 架构

| 层 | 实现 |
| --- | --- |
| Web 应用 | Next.js 16 App Router、React 19、TypeScript、Tailwind CSS |
| 周报引擎 | Anthropic SDK，负责分类、撰写周报和生成小测验 |
| 账号与数据 | Supabase Auth、Postgres、SSR 会话、版本化迁移、RLS |
| 采集 | Chrome Manifest V3 扩展，用 DOM 抽取——不调任何平台私有 API |
| 交付 | Vercel，带 lint、测试和构建检查 |

主要路由：`/` 是无状态 demo，`/app/capture` 是已保存的对话，`/app` 是当前周报，`/app/history` 是历史归档，`/app/settings` 是账号与数据控制。

浏览器扩展在 [`extension/`](./extension/README.md)。部署依赖新表结构的代码之前，先按文件名顺序执行 [`supabase/migrations/`](./supabase/migrations/) 里的 SQL。

## 状态

- 网页粘贴 demo：现在可用
- 账号采集、周报历史、导出和删除：已实现
- Chrome 扩展：[已上架 Chrome Web Store](https://chromewebstore.google.com/detail/hmpfieahioioldbnicdckaiahmmmammk)，版本 0.3.0
- 定时邮件推送、分享采集：计划中

扩展的采集层基于 [TheBluCoder/AI-chat-exporter](https://github.com/TheBluCoder/AI-chat-exporter)（MIT），详见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)。

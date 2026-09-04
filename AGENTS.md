# AGENTS.md —— 每周知识复习工具 · Demo

你的任务：按 `PRD-demo.md` 建一个能部署的 demo。真值以 PRD 为准，本文件给你落地约束。

## 一句话
用户粘贴一段自己和 AI 的对话 → 立刻得到一份自然的知识复习周报（自动剔掉「让 AI 干活」的部分、按主题归堆）+ 一个主动回忆小测验。

## 技术栈
- Next.js（App Router）+ TypeScript，部署 Vercel。
- Anthropic 官方 SDK（`@anthropic-ai/sdk`），**只在服务端**调用，key 走环境变量 `ANTHROPIC_API_KEY`，绝不进前端。
- ~~不要数据库、不要 Supabase、不要 auth~~（2026-07-11 更新：采集层任务引入了 Supabase 存 ingest 数据与 api_tokens，见 `TASK-capture-build.md`；粘贴版 demo 的 `/api/review` 仍保持无状态、不落库）。

## 建议目录
- `app/page.tsx` —— 粘贴框 + 「生成复习」按钮 + 结果展示（周报 / 已过滤 / quiz）。
- `app/api/review/route.ts` —— 管线：normalize → classify → group → review + quiz，返回 JSON。
- `lib/prompts.ts` —— 已提供，直接用（`CLASSIFY_SYSTEM` / `REVIEW_SYSTEM` / `QUIZ_SYSTEM` / `MODELS`）。**不要重写这些 prompt。**
- `lib/normalize.ts` —— 粘贴文本 → `NormalizedItem[]`（按空行粗切段，不做精确问答配对）。
- `lib/anthropic.ts` —— SDK client 封装 + 一个稳健解析模型 JSON 输出的 helper（去掉可能的 ``` 围栏后 JSON.parse）。
- `extension/` —— 采集插件（MV3，手动触发），见 `TASK-capture-build.md` 与 `extension/README.md`。
- `app/api/ingest/` —— 插件上送入口（Bearer token 鉴权 + Supabase）。

## 管线（粘贴版 demo）
1. **normalize**：粘贴文本按空行切成段，每段 → `{ id, question: 段落原文, source: 'paste' }`。
2. **classify**（Haiku, `CLASSIFY_SYSTEM`）：一次把所有段丢进去，返回每段 `{id, category, topic}`。只留 `knowledge`。
3. **group**：knowledge 段按 `topic` 归堆。
4. **review**（Sonnet, `REVIEW_SYSTEM`）：把分好组的素材写成自然周报正文。
5. **quiz**（Sonnet, `QUIZ_SYSTEM`）：出 3–5 道闪卡 `{question, answer}[]`。
6. 返回 `{ review: string, filteredCount: number, quiz: {question,answer}[] }`。前端渲染。

## 硬约束（不可妥协）
- **粘贴版 demo 无持久化**：`/api/review` 的对话只在内存里处理，不落库、**不写进日志**。首页明确写出「对话只在内存中处理，不保存」。（插件采集走 `/api/ingest`，那是用户显式点「存」的数据，落 Supabase 且按 user_id 隔离。）
- **成本 / 防滥用**（公开接口在烧真金白银，必须有）：
  - 单 IP 限流（每天 5 次）。demo 用内存计数器即可，注明重新部署会重置。
  - 输入上限：超过 40 段 / 12000 字就拒绝并友好提示。
  - 全局每日调用上限护栏（200 次/天）。
- **输出语气**：周报必须像人写的，禁止满屏加粗小标题 / 项目符号——这条已写进 `REVIEW_SYSTEM`，别在代码或额外指令里把它扭回「结构化」风格。
- **quiz 形式**：闪卡式（先自答→点开看答案→自评记住/没记住），纯前端交互，不落库。

## 明确不做（见 PRD §2）
上传导出文件、登录/账号、Cron、发邮件、存档页、taste 纠正闭环。（浏览器插件采集已在 TASK-capture-build 中落地，不再属于「不做」。）

## 验收（见 PRD §8）
粘贴一段混了知识提问和干活请求的对话：干活的被剔掉、知识的进周报；周报读着像人话；quiz 来自本周内容且能自评；无需登录；刷新不残留；限流/超长/空输入都有清楚提示、不崩。

## 环境变量
- `ANTHROPIC_API_KEY=`（本地放 `.env.local`；Vercel 里配到项目 env）
- `SUPABASE_URL=` / `SUPABASE_SERVICE_ROLE_KEY=`（采集层 ingest 用，只在服务端）

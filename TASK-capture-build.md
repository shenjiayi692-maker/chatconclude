# TASK-capture-build.md —— 采集插件实现任务（给 Claude Code）

## 背景

采集层调研已完成（见 `RESEARCH-capture.md`，其结论经评审采纳）。本任务把它变成能用的东西：一个浏览器插件（手动「存入复习」）+ 我们后端的 ingest API。产品大脑（分类/周报/quiz pipeline）已存在，本任务只负责把对话数据安全地送进库。

**评审后锁定的路线，不再讨论：**
- **全平台只走 DOM 抓取，禁止调用任何平台内部 API**（不做 Rat-S 式的 API 优先；不注入页面脚本拿 token；这是商业产品的 ToS/审核考量，不是技术偏好）
- **v1 只做手动触发**：用户选中消息 → 点「存入复习」。不做 MutationObserver 自动采集
- 代码基础：**只允许复用 TheBluCoder/AI-chat-exporter（MIT）的代码**，保留其版权声明；Rat-S 仓库的代码一行不进本仓库（MPL），但其 selector 事实（已抄录于研究报告 §2）可以用
- v1 平台范围：**claude.ai、chatgpt.com（含 chat.openai.com）、chat.deepseek.com**。豆包不做

## 交付物

1. `extension/` —— MV3 插件（Chrome 优先，结构上不排斥以后出 Firefox 版）
2. `app/api/ingest/route.ts` —— 我们 Next.js 项目里的 ingest 接口 + Supabase 迁移 SQL
3. `extension/README.md` —— 本地加载调试方法 + selector 改版时的修复流程（改哪个 config、跑哪个测试）

## 一、插件规格

### 架构（沿用调研报告 §1 的三层）

```
extension/
├── manifest.json            # MV3
├── src/
│   ├── background.js        # service worker：收 INGEST 消息 → POST（带鉴权）
│   ├── content/
│   │   ├── content-script.js
│   │   └── handler.js       # 消息路由 + 选中模式 UI（改造自 BluCoder）
│   ├── scrapers/
│   │   ├── base/BaseScraper.js       # 从 BluCoder 搬，保留版权头
│   │   ├── platforms/{Claude,ChatGPT,DeepSeek}Scraper.js
│   │   ├── config/{claude,chatgpt,deepseek}.config.js
│   │   └── init.js          # URL → 平台检测
│   ├── popup/               # 极简：登录态 + 「存整段对话」按钮
│   └── lib/normalize.js     # 扁平消息数组 → NormalizedItem[]（报告 §4 的配对规则）
└── tests/                   # fixture + linkedom 单测（学 Rat-S 的工程实践，不搬其代码）
    └── fixtures/            # 各平台真实 DOM 快照
```

### 交互（两条路径，都是手动）

1. **选中保存**（主路径）：页面上浮动按钮「存入复习」→ 进入选中模式（BluCoder 的高亮/点选/横幅交互，文案改中文）→ 用户点选若干条消息 → 确认 → 抽取选中消息 → normalize → 发 INGEST → 轻提示「已存 N 条」。
2. **整段保存**（popup 里）：点「存整段对话」→ 抽取当前会话全部消息（长对话走滚动采集）→ 同上。

### 平台适配要点（来自调研报告，照做）

- ChatGPT：虚拟化滚动采集 + `data-turn-id` 去重（BluCoder 现成，搬）。selector 优先语义化 data 属性。
- Claude：`data-testid="user-message"`；响应类名新旧兼容（`.font-claude-response` 与 `.font-claude-message` 都留）。artifact 内容 v1 不抓（DOM 路线抓不全，接受）。
- DeepSeek：新写 `DeepSeekScraper`。selector 优先 `ds-` 前缀设计系统类（`.ds-markdown`、`.ds-user-message`、`.ds-message-row`），避免依赖 `.fbb737a4` 这类混淆哈希类名；虚拟列表 `data-virtual-list-item-key` 作序号；**必须把 ChatGPT 式滚动采集搬过来**（DeepSeek 长对话同样虚拟化，Rat-S 没处理，我们要处理）。
- 每个平台一份 `tests/fixtures/*.html` 真实 DOM 快照 + parser 单测；selector 全部收进 config 层，页面改版只动 config + fixture。

### NormalizedItem 映射（报告 §4，固化）

```ts
interface NormalizedItem {
  id: string;             // `${conversationId}#${turnIndex}`
  contentHash: string;    // sha256(question + '\n' + (answer ?? '')) 前 16 字节 hex，插件侧算好
  question: string;
  answer?: string;
  source: 'claude' | 'chatgpt' | 'deepseek';
  conversationTitle?: string;
  capturedAt: string;     // 抓取时刻 ISO。明确语义：这不是消息的真实时间
}
```

配对规则：连续 user 消息并入同一 question；连续 assistant 消息拼接为 answer；role 未知或内容为空跳过。conversationId 从 URL 提取（claude.ai `/chat/{uuid}`、chatgpt `/c/{id}`、deepseek `/a/chat/s/{id}`；提不到时用 `document.title` 的 hash 兜底）。

## 二、鉴权（调研报告未覆盖，本任务必须补）

多用户产品，ingest 必须知道「这是谁的数据」。v1 用**个人 API token** 方案（最简可用，不引入 OAuth 复杂度）：

1. 网站侧：用户设置页新增「插件接入」——生成/吊销个人 token（随机 32 字节，服务端只存 hash）。已有 Supabase 表体系里加 `api_tokens (user_id, token_hash, created_at, revoked_at)`。
2. 插件侧：popup 里一个粘贴框「粘贴你的接入令牌」→ 存 `chrome.storage.local`。popup 显示连接状态（打一个轻量 `GET /api/ingest/ping` 验证）。
3. 传输：background SW 的每次 POST 带 `Authorization: Bearer <token>`。
4. 失败态：401 时 popup 与浮动按钮显示「令牌失效，请重新粘贴」，不静默丢数据。

## 三、ingest API 规格

`POST /api/ingest`，Bearer token 鉴权。

请求体：`{ items: NormalizedItem[] }`，单次上限 200 条，超出 413。

服务端行为：
- token → user_id；无效 401。
- **去重双保险**（报告 §4 指出 turn_index 会因编辑消息而平移）：`items` 表唯一约束 `(user_id, source_item_id)`，冲突跳过；再以 `(user_id, content_hash)` 唯一索引兜底，冲突同样跳过。返回 `{ saved: n, duplicates: m }`。
- 表结构在现有 `items` 表上加列：`user_id`、`content_hash`、`captured_at`，给出迁移 SQL。RLS：按 user_id 隔离（现有产品已是多用户，沿用其 RLS 模式）。
- 限流：每 token 每分钟 30 次请求，超出 429。

## 四、约束（硬性）

- 禁止调用平台内部 API、禁止注入页面脚本读取 token/React 内部状态。发现自己在写 `fetch('https://claude.ai/api/...')` 就停下来——这是路线错误。
- POST 只发生在 background service worker（content script 跨域受页面 CORS 限制）；SW 无状态、幂等，失败重试用 `chrome.alarms` 补发，不靠内存排队。
- permissions 最小集：`["activeTab", "storage", "scripting", "alarms"]`；host_permissions 只列三个平台域 + 我们的 API 域。不申请 `downloads`/`clipboardWrite`。
- 绝不后台静默上传：任何上送都由用户显式动作触发（这是商店审核与隐私承诺的底线）。
- BluCoder 代码文件保留 MIT 版权头；仓库根部 THIRD_PARTY_NOTICES.md 记录来源。
- 用户可见文案全中文。

## 五、验收

1. 三个平台上：选中 3 条消息 → 存入 → Supabase 里出现正确配对的 NormalizedItem，重复保存同样内容返回 duplicates 而非新行。
2. ChatGPT 和 DeepSeek 的 50+ 轮长对话「存整段」不丢头部消息。
3. 无 token / token 失效时有明确 UI 提示，无静默失败。
4. `npm test` 跑通全部 fixture 单测；故意改坏一个 selector，对应单测确实变红。
5. 插件包体审查：全部代码本地打包，无远程加载；权限声明与上述最小集一致。
6. 在用户编辑过消息的会话里重复保存，不产生重复行（content_hash 兜底生效）。

## 六、明确不做

自动采集（MutationObserver）、平台内部 API、豆包适配、Firefox 上架、OAuth、selector 云端热更、artifact 内容抓取。

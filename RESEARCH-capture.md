# RESEARCH-capture.md —— 采集层改造清单

> 调研对象：
> - [TheBluCoder/AI-chat-exporter](https://github.com/TheBluCoder/AI-chat-exporter)（下称 **BluCoder**），调研时 HEAD `3253d76`，v2.0.2
> - [Rat-S/ai-chat-exporter](https://github.com/Rat-S/ai-chat-exporter)（下称 **Rat-S**），调研时 HEAD `41606fe`，v1.2.0
>
> 结论先行：**骨架抄 BluCoder（MIT，可直接搬代码），事实学 Rat-S（MPL-2.0，只借鉴思路和 selector 事实）**。出口改造面很小：两个项目的「生成文件」都集中在一两个函数里，替换成 POST 的改动是外科手术级的。v1 建议手动触发（选中消息→存这条），BluCoder 的选中交互可整套复用。

---

## 0. 许可证核实（决定能拿多少）

| 仓库 | LICENSE | 结论 |
|---|---|---|
| BluCoder | **MIT**（LICENSE 文件，"Copyright (c) 2024 AI Chat Exporter Contributors"） | ✅ 可直接复用代码进闭源产品，保留版权声明即可 |
| Rat-S | **MPL-2.0**（LICENSE 文件为 Mozilla Public License 2.0 全文；package.json 无 license 字段） | ⚠️ 文件级 copyleft：把它的源文件搬进产品，该文件必须保持 MPL 并对外提供源码。**策略定为「仅借鉴」**——思路、架构、selector 字符串（selector 是客观事实，不受版权保护）可以学，代码不搬 |
| Rat-S 内嵌的 `content/lib/turndown.js` | 第三方库 Turndown，上游是 MIT | 如需 HTML→Markdown 转换，直接从 npm 装 `turndown`，不从 Rat-S 拿 |

MPL-2.0 严格说不是 GPL 那种传染整个产品的强 copyleft，理论上可以「整文件原样使用 + 该文件开源」地合规引入。但为省去合规维护成本，本项目按任务要求从严处理：**Rat-S 一行代码都不进我们的仓库**。

---

## 1. BluCoder 架构图（三层分工 + 数据流）

```
┌─ popup（扩展弹窗，用户点击入口）─────────────────────────────┐
│ popup.js：向当前 tab 发消息 SCRAPE_PAGE / EXPORT_SELECTED，    │
│ 拿到 result JSON 存为 lastResult，再按格式下载/复制            │
└──────────────┬───────────────────────────────────────────────┘
               │ browserAPI.tabs.sendMessage
┌─ content script（注入到 AI 聊天页面）─────────────────────────┐
│ content-script.js（引导）：动态 import 下面两个模块            │
│  ├ scrapers/init.js：按 URL 正则识别平台 → new 对应 Scraper    │
│  │   → 挂到 window.runScrape                                  │
│  └ content/handler.js：消息路由（SCRAPE_PAGE→runScrape、       │
│      EXPORT_SELECTED→选中模式、PING）+ 选中模式的页面 UI       │
├─ scrapers 三层 ──────────────────────────────────────────────┤
│ ① base/BaseScraper.js（713 行，模板方法模式）                  │
│    scrape() = waitForContainer → scrollToLoadHistory（滚到顶   │
│    加载历史）→ waitForStableContent（等 DOM 稳定）→            │
│    extractAllMessages（抽象，子类必须实现）→ 统计 → 格式化      │
│    还提供：代码块保真、动态反引号围栏、语言别名、克隆剥离等公共 helper │
│ ② platforms/XxxScraper.js（每平台一个，override 钩子）          │
│    ChatGPT：滚动渐进采集虚拟化 turn；Claude：处理 artifacts     │
│    预览面板的开合抓取                                          │
│ ③ config/xxx.config.js（纯数据：selectors + scrollConfig +     │
│    codeLanguageAliases）——改版时理论上只动这一层               │
└──────────────────────────────────────────────────────────────┘
```

**消息抽取入口**：`src/content/handler.js:337` 收到 `SCRAPE_PAGE` → `window.runScrape()`（`src/scrapers/init.js:84` 挂载）→ `BaseScraper.scrape()`（`src/scrapers/base/BaseScraper.js:56`）。

**数据流**：页面 DOM → 各平台 `extractAllMessages()` 产出统一消息格式：

```js
{ role: 'user'|'model', content: string /* markdown */, media, uploaded_files,
  embedded_documents, timestamp /* 抓取时刻，非真实消息时间 */, turn_index, turn_id? }
```

→ `formatResult()` 包上 `{ success, messages, count, statistics, url, platform }` → sendResponse 回 popup → popup 按 JSON/MD/PDF 下载。

Rat-S 架构类似但更薄：`content/main.js` 里一个 parser 注册表（11 个平台），`ChatParser` 基类只有 `isAvailable(url)` 和 `parse()` 两个方法，产出 `{ title, messages: [{role, content}], metadata }`。它的独特之处是 **API 优先**：Claude 和 ChatGPT 的 parser 先走平台内部 API（见 §2），DOM 只是兜底。

---

## 2. 可复用资产清单（逐项）

### 直接拿（BluCoder，MIT）

| 资产 | 位置 | 说明 |
|---|---|---|
| BaseScraper 模板方法骨架 | `src/scrapers/base/BaseScraper.js` | scrape 流水线 + waitForElement/sleep/滚动/稳定性检测，整个文件可搬 |
| 三层架构（base/platforms/config） | `src/scrapers/` | 组织方式直接沿用，selector 改版只动 config |
| **选中部分消息交互** | `src/content/handler.js:62-330` | 选中模式全套：注入高亮样式（`ensureSelectionStyle`）、浮动横幅、click 捕获选中/反选（`handleSelectionClick`）、按 `turnIndex:role` 键过滤结果（`applySelectedFilter`）。这就是我们「点存这条」的现成骨架 |
| 代码块保真 helper | `BaseScraper.js:600-683` | `createMarkdownCodeBlock`（动态反引号宽度防嵌套冲突）、`extractCodeTextPreserveLines`（处理 `<br>` 和 CodeMirror `.cm-line`）、`normalizeCodeLanguage` + config 层语言别名 |
| 用户消息富文本→markdown | `ClaudeScraper.js:47-109` | 代码块/有序无序列表/行内 code 转 markdown 的 DOM 遍历写法 |
| ChatGPT 虚拟化滚动采集 | `ChatGPTScraper.js:32-175` | 渐进滚动 + `data-turn-id` 去重 + turn 指纹稳定性检测（`BaseScraper.js:333-357`），长对话必需 |
| manifest MV3 模板 | `manifest.json` | content_scripts 静态注入 + web_accessible_resources 动态 import 的组合 |
| 平台 selector 配置 | `src/scrapers/config/*.config.js` | ChatGPT/Claude/Gemini 三份，直接拿 |

### 要改再用（BluCoder）

| 资产 | 改动 |
|---|---|
| `content/handler.js` 消息路由 | 砍掉 EXPORT 系列 action，换成 `SAVE_SELECTED` / `SAVE_ALL`，结果不回 popup 下载而是走 POST（见 §3） |
| popup | 大幅简化：我们不需要格式选择/预览/PDF，可能只留「存整段对话」按钮 + 登录态显示 |
| `formatResult()` 输出 | 在 content script 侧直接映射成 `NormalizedItem[]`（见 §4），不再带 statistics/media 等我们用不上的字段 |
| `calculateStatistics`、media/PDF/markdown 导出链路 | 不需要，删（`utils.js` 里 downloadFile/exportToPDF/convertToMarkdown 全砍） |

### 只看不拿（Rat-S，MPL-2.0，借鉴事实与思路）

| 事实/思路 | 位置（供对照，不搬代码） | 价值 |
|---|---|---|
| **DeepSeek selector 事实** | `content/parsers/deepseek.js` | 用户消息 `.fbb737a4`（**混淆哈希类名，最脆弱**）；AI 回答 `.ds-markdown` / `.ds-assistant-message-main-content`；兜底 `.ds-message-row` + `.ds-user-message`。`ds-` 前缀是语义化设计系统类名，比哈希类稳定，优先用 |
| DeepSeek 页面结构事实 | `tests/fixtures/deepseek-chat.html` | 消息挂在虚拟列表 `ds-virtual-list-visible-items` 下，item 有 `data-virtual-list-item-key`（可作稳定序号）；代码块 `.md-code-block`，语言标签在 banner 的 span 里。**虚拟列表意味着长对话会卸载早期消息，DeepSeek 也需要 ChatGPT 式滚动采集** |
| **Claude API 优先策略** | `content/parsers/claude.js:4-45` | 不刮 DOM，直接 `fetch('https://claude.ai/api/organizations')` 拿 orgId，再拉 `/chat_conversations/{id}?tree=True&rendering_mode=messages`（cookie 同源自动带上）。拿到真实消息 uuid、真实时间戳、attachments、thinking、分支树（用 `current_leaf_message_uuid` 回溯当前分支）。保真度完胜 DOM，但是非公开 API（风险见 §6） |
| ChatGPT API 优先 + postMessage 桥 | `content/parsers/chatgpt.js` | accessToken 从页面 `#client-bootstrap` JSON 里取，经注入页面脚本 + postMessage 桥回传（绕过 content script 的隔离世界限制） |
| React fiber 兜底读取 | `content/claude_react_reader.js` | DOM 刮不到 artifact 内容时注入脚本读 React 内部状态——知道有这条路即可，v1 不做 |
| 用 fixture + linkedom 做 parser 单测 | `tests/` | 把各平台真实 DOM 存成 fixture，selector 回归测试不用开浏览器。**这个工程实践强烈建议照做** |
| 20 秒 API 响应缓存 | `claude.js:163-178` | 避免 popup 反复触发重复拉取 |

---

## 3. 出口改造点（下载 → POST）

两个项目「生成文件」的位置都很集中：

**BluCoder**（下载发生在 popup 侧）：
- `src/utils/utils.js:141-183` `downloadFile()`——Blob → `browserAPI.downloads.download`（或 `<a>.click()` 兜底）。**唯一的文件出口**。
- 调用它的三处：`src/popup/popup.js:593`（JSON）、`:623`（Markdown）、`:646` 附近（PDF 走 `exportToPDF`）。

**Rat-S**（下载直接发生在 content script 里）：
- `content/main.js:134-153`（`EXPORT_CHAT` handler 内）——formatter.format → Blob → `URL.createObjectURL` → 注入 `<a>` 点击。

**最小改动面**：数据在 sendResponse/download 之前已经是干净的结构化 JSON（BluCoder 的 `result.messages`、Rat-S 的 `conversation.messages`）。所以改造 = 在拿到结构化结果的地方截断，接一段「映射 + POST」：

```js
// content script 侧（替代 downloadFile 的全部调用）
const items = toNormalizedItems(result);          // §4 的映射，~40 行
await chrome.runtime.sendMessage({ type: 'INGEST', items });

// background service worker 侧（做实际网络请求）
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'INGEST') return;
  fetch('https://our-domain/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: msg.items }),
  }).then(r => sendResponse({ ok: r.ok }), e => sendResponse({ ok: false, error: String(e) }));
  return true;
});
```

**为什么 POST 放 background 而不是 content script**：MV3 下 content script 的 fetch 受宿主页面同源策略约束，跨域打我们的 ingest API 要么给 API 配 CORS 白名单（白名单里得写 `https://claude.ai` 等来源，很怪），要么走 background service worker + 把我们的 API 域加进 `host_permissions`（SW 的 fetch 不受页面 CORS 限制）。**推荐后者**，顺带把重试/退避也收在 SW 一处。

需要同步删掉的：`downloads`、`clipboardWrite` 权限；popup 里的格式选择/预览 UI；`utils.js` 的 markdown/PDF 转换链路。

---

## 4. NormalizedItem 映射

两个项目的产出都是**扁平的消息数组**（role 交替），我们的目标是**问答对**。映射规则：

```
遍历 messages：
  遇到 role='user'    → 开一个新 item，question = content
                        （连续多条 user 消息：并入同一 question，换行拼接）
  遇到 role='model'/'assistant'/'Claude' → 填入当前 item 的 answer
                        （连续多条 assistant：拼接；Rat-S 的 'Claude Artifact'
                         角色消息并入 answer 或直接丢弃——对「知识复习」场景 artifact 多为交付物，建议丢）
  role 未知/内容空    → 跳过
```

各字段来源：

| NormalizedItem 字段 | DOM 抓取路径（BluCoder 风格） | API 路径（Rat-S 风格，仅 Claude/ChatGPT） |
|---|---|---|
| `id` | `${conversationId}#${turn_index}`。conversationId 从 URL 提：claude.ai `/chat/{uuid}`、chatgpt.com `/c/{id}`、DeepSeek `/a/chat/s/{id}`；turn_index 是 BaseScraper 现成的 | 直接用平台的消息 uuid（全局唯一，最稳的去重键） |
| `question` / `answer` | 上面的配对规则，content 已是 markdown | 同左，content 来自 API 的 text/content blocks |
| `source` | 平台检测现成：`init.js detectPlatform()` / `handler.js getCurrentPlatform()`，小写化 `'claude'|'chatgpt'|'deepseek'` | 同左 |
| `conversationTitle` | `document.title`（各平台会把会话名放 title） | Claude API 的 `data.name`，更干净 |
| `createdAt` | **DOM 拿不到真实时间**——BaseScraper 的 timestamp 是抓取时刻。要么省略，要么如实填抓取时刻并在服务端知道它不是消息时间 | API 返回真实 `created_at` ✅ |

注意：`id` 用 `convId#turn_index` 有一个已知弱点——用户在会话中间**编辑/重发**消息会让后续 turn_index 平移，产生重复上报。服务端去重除了按 id，最好再加一层 `hash(question)` 兜底。

---

## 5. 触发模式建议

**a) 手动（推荐 v1 就做这个）**——改动小，且和产品逻辑天然咬合。

- BluCoder 的选中模式（`handler.js:194-233`）已经把最难的部分做完了：高亮可选消息、点选/反选、浮动横幅提示、按选中键过滤结果。把「Export Selected」按钮换成页面内浮动按钮「存入复习」，出口从下载换成 §3 的 POST，就是完整的 v1。
- 实现成本估计：**2–3 天**（含浮动按钮 UI 和保存成功的轻提示）。
- 更重要的产品理由：**用户点「存」这个动作本身就是最高质量的 taste 信号**——它直接告诉我们「这条值得复习」，比分类器猜可靠。自动采集反而把这个信号稀释了。

**b) 自动（v2 再说）**——两个仓库都没做，需要新写。两条技术路线：

| 路线 | 做法 | 脆弱度 |
|---|---|---|
| MutationObserver | 监听消息容器的子树变化，防抖到「回答流式输出结束」再抽取新 turn，按 turn key 去重上送 | 中。依赖和刮 DOM 相同的 selector；流式渲染期间会疯狂触发，防抖阈值难调；SPA 切换会话要重新挂观察器 |
| 拦截接口 | 注入页面脚本 patch fetch/XHR（MV3 的 webRequest 读不到响应体，只能页面注入），直接拿平台 API 的干净 JSON | 高。等于逆向各平台私有接口，改版即断且不易察觉；扩展商店审核观感差；Rat-S 的 postMessage 桥说明工程上可行，但每个平台都要单独逆向 |

**推荐：v1 只做手动**。若 v2 要自动，选 MutationObserver（至少和 DOM 抓取共享同一套 selector 维护成本），并保留手动作为信号通道。

---

## 6. 风险清单

1. **selector 脆弱度分层**（从稳到脆）：
   - 较稳：ChatGPT 的 `data-turn` / `data-message-author-role` / `data-testid="conversation-turn-N"`（语义化 data 属性，产品自己的测试也依赖它们）；DeepSeek 的 `ds-` 前缀设计系统类。
   - 中等：Claude 的 `data-testid="user-message"`、`.font-claude-response`。**实际改版记录**：Claude 曾把 `.font-claude-message` 改名 `.font-claude-response`，Rat-S 的 parser 至今两个都留着兼容（`claude.js:314-321`）。
   - 最脆：混淆哈希类名——DeepSeek 用户消息的 `.fbb737a4`、BluCoder Claude config 里的 Tailwind 长链（`div.overflow-y-scroll.overflow-x-hidden.pt-6.flex-1`，`claude.config.js:7`）。这类前端一重新构建就换名。
   - 两仓库的 commit 史都是佐证：Rat-S 有整串 fix parser 提交；BluCoder 2.0.1 整个版本在修 ChatGPT 虚拟化丢 turn。**结论：selector 必须进 config 层 + fixture 单测（学 Rat-S），改版时的修复成本才可控。**
2. **虚拟滚动列表**：ChatGPT 和 DeepSeek 都虚拟化渲染，长对话中早期消息不在 DOM 里。ChatGPT 两仓库都已处理（渐进滚动采集）；**DeepSeek 的 Rat-S parser 没处理，长对话会丢头部消息**——我们适配 DeepSeek 时要把 ChatGPT 的滚动采集方案搬过去。
3. **内部 API 依赖**（若学 Rat-S 的 API 优先路线）：保真度和时间戳的收益很大，但都是非公开接口，随时变、变了不报错只报 4xx/5xx；且属于平台 ToS 灰色地带。建议：Claude 可以 API 优先 + DOM 兜底（Rat-S 已验证该结构可行），其余平台 v1 只走 DOM。「待确认」：各平台 ToS 对第三方扩展调用内部 API 的具体条款。
4. **Manifest V3 限制**：
   - 禁远程代码：selector 更新必须随扩展版本发布，不能云端热更 selector 配置（商店审核会查）。改版→修复→审核上架有 1–3 天延迟窗口，期间该平台采集是坏的，产品上要有「采集失败请粘贴」的兜底提示。
   - Service worker 会休眠：POST 逻辑要无状态、幂等，失败重试用 `chrome.alarms` 或下次触发时补发，不能靠 SW 内存排队。
   - content script 跨域 fetch 受页面 CORS 限制：POST 走 background SW（见 §3）。
5. **permissions 最小集**（比两个原项目都小）：
   ```
   permissions:      ["activeTab", "storage", "scripting"]
   host_permissions: ["https://claude.ai/*", "https://chatgpt.com/*",
                      "https://chat.openai.com/*", "https://chat.deepseek.com/*",
                      "https://our-ingest-domain/*"]
   ```
   不需要 `downloads` / `clipboardWrite`。host_permissions 每加一个域，商店审核和用户安装提示都更吓人，只列真正支持的平台。
6. **中文平台差异**：DeepSeek 已见的差异——混淆类名为主、虚拟列表、`ds-` 设计系统前缀；此外登录态更严格（未登录基本无内容可刮）。**豆包（doubao.com）不在两仓库覆盖内，需自行适配，做法参考 DeepSeek**：先存页面 fixture → 找语义化类名/data 属性 → 写 parser + 单测。本任务不做。
7. **隐私与商店审核**：一个「读取 AI 对话并发送到第三方服务器」的扩展，Chrome Web Store 会重点审。需要：清晰的隐私政策页、POST 前的用户可见提示（手动模式天然满足）、绝不后台静默上传（又一个 v1 选手动的理由）。

---

## 附：PoC（第 4 步）

`capture-poc/` 目录：最小 MV3 骨架，只在 claude.ai 上抽取当前对话并 `console.log` 出 `NormalizedItem[]`。不接真实 API、无 UI。加载方式见目录内 README。

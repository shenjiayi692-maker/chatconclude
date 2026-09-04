# TASK-capture-research.md —— 采集层调研任务（给 Claude Code）

## 背景（一段话读懂产品）

我在做一个「每周知识复习」产品：捕获用户和 AI 的对话 → 筛出「值得复习的知识类提问」（剔掉让 AI 干活的）→ 每周生成一份自然语言周报 + 主动回忆 quiz。核心大脑（分类 + 周报 + quiz 的 pipeline）已经跑通。现在要做**采集层**：一个浏览器插件，在用户使用 claude.ai / chat.openai.com / chat.deepseek.com 等页面时抓取对话，**POST 到我们的 ingest API**（而不是下载成文件）。

已有两个开源项目把「从 AI 聊天页面抽取对话」的脏活干过了，本任务是研究它们、产出改造方案。

## 你的任务：先调研，产出文档，**本任务不写产品代码**

### 第 1 步：clone 两个仓库并通读

- `https://github.com/TheBluCoder/AI-chat-exporter` —— 多平台导出插件。重点看它的架构：BaseScraper 抽象基类 + 每平台的 Scraper 实现（ChatGPT/Gemini/Claude）+ 每平台的 selector 配置文件（*.config.js），以及「选中部分消息导出」的实现。
- `https://github.com/Rat-S/ai-chat-exporter` —— Firefox 插件，支持 ChatGPT / Gemini / Claude / **DeepSeek** / Perplexity / Qwen。重点看它的 DeepSeek 适配（selector、消息结构解析）。

### 第 2 步：核实许可证（决定我们能拿多少）

- 分别确认两个仓库的 LICENSE 文件。宽松协议（MIT/Apache-2.0）→ 可以直接复用代码；copyleft（GPL/AGPL）→ 只能借鉴思路和 selector 事实，不能搬代码进我们的闭源产品。**把结论和依据写进报告**，拿不准就标注为「仅借鉴」。

### 第 3 步：产出《改造清单》（RESEARCH-capture.md），必须回答：

1. **架构图**：TheBluCoder 的 BaseScraper/平台Scraper/config 三层是怎么分工的？消息抽取的入口在哪、数据在模块间怎么流动？
2. **可复用资产清单**：逐项列出（文件/模块级）哪些能直接拿、哪些要改、哪些只看不拿。特别标注：
   - 各平台的 DOM selector 与消息结构解析（尤其 DeepSeek 的，来自 Rat-S）
   - 代码块/表格/公式的保真处理
   - 「选中部分消息」的交互实现
3. **出口改造点**：这两个项目都是「抽取 → 下载文件」。我们要改成「抽取 → 规整为 NormalizedItem[] → POST 到 ingest API」。指出：现有代码里「生成文件」发生在哪几处？替换成 fetch POST 的最小改动面是什么？
4. **NormalizedItem 映射**：它们抽出的消息结构，怎么映射到我们的格式：
   ```ts
   interface NormalizedItem {
     id: string;            // 稳定 id（会话id+消息序号），用于服务端去重
     question: string;      // 用户发的消息
     answer?: string;       // AI 的回答
     source?: string;       // 'claude' | 'chatgpt' | 'deepseek' ...
     conversationTitle?: string;
     createdAt?: string;    // ISO
   }
   ```
5. **触发模式建议**：基于现有代码结构，评估两种模式的实现成本：
   a) 手动——页面上浮动按钮/选中消息后点「存这条」（对应现有「导出按钮」交互，改动小）
   b) 自动——后台监听新消息自动上送（现有代码没有，需要评估用 MutationObserver 还是拦截接口，以及脆弱度）
   给出你的推荐和理由。**v1 倾向手动优先**（跟产品的 taste 逻辑一致：用户点存本身就是筛选信号）。
6. **风险清单**：selector 脆弱度（各平台改版历史）、Manifest V3 限制、需要的 permissions 最小集、以及 DeepSeek/豆包页面结构与英文平台的差异点。

### 第 4 步（可选，若第 3 步顺利）：最小 PoC

仅当改造清单完成后：起一个最小插件骨架（Manifest V3），只做一件事——在 claude.ai 页面上抽取当前对话、console.log 出 NormalizedItem[]。**不接真实 API、不上架、不做 UI**。目的是验证 selector 思路可行。

## 约束

- 本任务的交付物是 `RESEARCH-capture.md`（+ 可选的 PoC 目录），**不是完整插件**。
- 不确定的许可证/技术判断，明确标注「待确认」，不要含糊带过。
- 豆包（doubao.com）不在这两个仓库覆盖内：只需在风险清单里记一笔「豆包需自行适配，参考 DeepSeek 的做法」，本任务不做。

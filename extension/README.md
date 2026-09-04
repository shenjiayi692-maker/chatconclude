# 每周知识复习 · 采集插件（MV3）

在 claude.ai / chatgpt.com（含 chat.openai.com）/ chat.deepseek.com 页面手动选中对话消息，「存入复习」到我们的 ingest API。**只走 DOM 抓取，不调用任何平台内部 API；所有上送都由用户显式动作触发，绝不后台采集。**

## 安装与连接

1. 解压发布包，在 Chrome 打开 `chrome://extensions`，开启「开发者模式」，选择「加载已解压的扩展程序」。
2. 第一次打开扩展时阅读数据采集说明，勾选确认并点击「同意并继续」。同意前扩展不会读取或上传对话。
3. 点击扩展弹窗里的「连接账号」，登录网页后点击「连接扩展」。
4. 回到 Claude / ChatGPT / DeepSeek 页面并刷新一次，即可保存对话。

连接成功后，同一设备会保持登录；持续使用时令牌自动续期。主动断开、网站设置页吊销令牌，或长期一年未使用后才需要重新连接。令牌复制粘贴只作为开发和故障排查的备用路径。

## 本地加载调试

1. 服务端准备：
   - 项目根目录 `.env.local` 配好 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`，在 Supabase SQL Editor 执行 `supabase/migrations/20260711000000_capture_ingest.sql`。
   - 管理员应优先使用网页设置页签发令牌。仅在应急时设置 `ALLOW_ADMIN_TOKEN_MINT=1`，再运行 `npm run mint-token -- --user <真实用户 UUID> --label 备注`。
   - `npm run dev` 起本地服务（默认 http://localhost:3000）。
2. Chrome 打开 `chrome://extensions` → 开「开发者模式」→「加载已解压的扩展程序」→ 选本目录（`extension/`）。
3. 点工具栏扩展图标，使用「一键连接账号」；也可展开手动设置输入令牌。
4. 打开任一支持平台的会话页：
   - **选中保存**（主路径）：点右下角浮动按钮「存入复习」→ 页面消息出现虚线高亮 → 点选若干条（选中变绿）→ 点「存入所选 (N)」→ 轻提示「已存 N 条」。
   - **整段保存**：扩展弹窗里点「存整段对话」（长对话自动滚动加载，需几秒）。
5. 验证入库：Supabase 的 `items` 表应出现配对好的行；重复保存同样内容返回「重复跳过」，不产生新行。

改代码后在 `chrome://extensions` 点扩展卡片上的刷新按钮，并刷新目标页面。

## 页面改版时的修复流程（selector 断了怎么办）

selector 全部收在 config 层，正常情况下**只需要动两个文件**：

1. 打开对应平台的会话页，用 DevTools 找到新的消息节点结构。
2. 改对应平台的 config：
   - Claude → `src/scrapers/config/claude.config.js`
   - ChatGPT → `src/scrapers/config/chatgpt.config.js`
   - DeepSeek → `src/scrapers/config/deepseek.config.js`
3. 用 DevTools 把真实会话的**最小结构**（两三轮对话即可，删掉无关节点、脱敏内容）复制进对应 fixture：
   - `tests/fixtures/claude-chat.html` / `chatgpt-chat.html` / `deepseek-chat.html`
4. 本目录跑 `npm install && npm test`——对应平台的单测应先红（复现断裂）后绿（确认修复）。
5. 若结构变化大到 config 不够（比如角色判定方式变了），才动 `src/scrapers/platforms/*Scraper.js`。

selector 选取原则（踩过的坑）：优先语义化 data 属性（`data-testid` / `data-turn`）和设计系统前缀类（DeepSeek 的 `ds-`），**永远不要**依赖构建产物哈希类名（如 `.fbb737a4`）或 Tailwind 长链。

## 结构

```
manifest.json            MV3；permissions 最小集，无 downloads/clipboardWrite
src/background.js        唯一网络出口：INGEST → Bearer POST；失败入队 chrome.alarms 补发
src/content/
  content-script.js      引导（动态 import）
  handler.js             浮动按钮 + 选中模式 + 保存链路 + popup 消息路由
src/scrapers/
  base/BaseScraper.js    模板方法基类（MIT，来自 TheBluCoder/AI-chat-exporter）
  platforms/*.js         Claude（纯遍历）/ ChatGPT、DeepSeek（虚拟化滚动采集）
  config/*.config.js     每平台 selector（改版只动这里）
  init.js                URL → 平台检测 + 会话 id 提取
src/lib/normalize.js     消息配对 → NormalizedItem[]（含 contentHash）
src/popup/               令牌配置 + 连接状态 + 存整段对话
tests/                   fixture + linkedom 单测（npm test）
```

## 上架前的注意事项

- 商店发布包应移除 `http://localhost:3000/*` 权限；本地调试版可以保留。
- 首次同意版本为 `2026-07-30`。若未来实质改变采集内容或用途，应更新版本并重新取得同意。
- selector 改版 → 修复 → 商店审核有 1–3 天窗口，期间该平台采集是坏的；产品侧要有「采集失败请用网页粘贴」的兜底提示。
- 隐私政策与 Dashboard 的数据类别、处理方和 Limited Use 声明必须保持一致。

## 打包

先生成 PNG 图标，再执行 `npm run package`。产物位于
`dist/weekly-review-capture-<version>.zip`，商店文案和审核清单见
`docs/CHROME_WEB_STORE.md`。

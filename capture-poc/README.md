# Capture PoC

最小 Manifest V3 骨架，只做一件事：在 claude.ai 页面抽取当前对话，`console.log` 出 `NormalizedItem[]`。不发任何网络请求、无 UI、不上架。

## 加载

1. Chrome 打开 `chrome://extensions`，开右上角「开发者模式」。
2. 「加载已解压的扩展程序」→ 选本目录（`capture-poc/`）。
3. 打开任意 claude.ai 会话页，F12 看控制台：加载 3 秒后自动打印抽取结果；也可手动执行 `__capturePoc()` 重跑。

## 验证点

- 每条用户提问 → 一个 `NormalizedItem`（`id` = `会话uuid#序号`，`source='claude'`）。
- 紧随其后的 Claude 回复进 `answer`。
- 长对话未上滚加载的部分抓不到——符合预期，滚动采集不在 PoC 范围（见 RESEARCH-capture.md §2）。

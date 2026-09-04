# Third-Party Notices

## TheBluCoder/AI-chat-exporter (MIT)

`extension/` 中以下文件搬运或改编自
[TheBluCoder/AI-chat-exporter](https://github.com/TheBluCoder/AI-chat-exporter)
（调研时 HEAD `3253d76`，v2.0.2），以 MIT 协议使用：

- `extension/src/scrapers/base/BaseScraper.js`（搬运 + 裁剪：去媒体采集、加 skipScroll、上移 sweep 通用逻辑）
- `extension/src/scrapers/base/constants.js`（搬运 + 裁剪）
- `extension/src/scrapers/platforms/ClaudeScraper.js`（改编：去 artifact/媒体链路）
- `extension/src/scrapers/platforms/ChatGPTScraper.js`（改编：去媒体链路）
- `extension/src/scrapers/config/claude.config.js`、`chatgpt.config.js`（改编）
- `extension/src/scrapers/init.js`（改编）
- `extension/src/content/handler.js` 中的选中模式交互（高亮/点选/横幅）（改编：中文化、出口改 POST）
- `extension/src/content/content-script.js` 的动态 import 引导模式（改编）

原始版权声明：

```
MIT License

Copyright (c) 2024 AI Chat Exporter Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 未使用的代码来源说明

[Rat-S/ai-chat-exporter](https://github.com/Rat-S/ai-chat-exporter)（MPL-2.0）
在调研阶段（`RESEARCH-capture.md`）被通读，本仓库**未包含其任何代码**；
仅参考了其中的客观事实（DeepSeek 页面的 DOM 结构与 selector 字符串）与工程实践思路
（fixture 单测）。DeepSeek 适配（`DeepSeekScraper.js`、`deepseek.config.js`、
`tests/fixtures/deepseek-chat.html`）为本仓库新写。

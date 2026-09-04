/**
 * DeepSeek 平台配置。selector 全部收在这里，chat.deepseek.com 改版只动本文件 + tests/fixtures/deepseek-chat.html。
 *
 * selector 事实来源：调研报告 RESEARCH-capture.md §2（不含任何 Rat-S 代码）。
 * 原则：优先 `ds-` 前缀的设计系统类（语义化、相对稳定），
 * 避免依赖 `.fbb737a4` 这类构建产物混淆哈希类名（前端一重新构建就换）。
 */

export const DEEPSEEK_CONFIG = {
  platform: 'DeepSeek',
  source: 'deepseek',

  selectors: {
    // 会话滚动区（ds-scroll-area 是设计系统类）；兜底 main
    CONTAINER: '.ds-scroll-area, main',
    CHAT_CONTAINER: '.ds-scroll-area, main',

    // 虚拟列表 item（每 item 含一条用户消息及其回复块），key 可作稳定序号
    ARTICLE_TURN: '[data-virtual-list-item-key]',

    // 用户消息包裹（.ds-message 是设计系统类；内层文本是哈希类名，不依赖）
    USER_MESSAGE: '.ds-user-message, .ds-message',

    // 模型回复正文
    MODEL_RESPONSE: '.ds-markdown',
    MODEL_RESPONSE_MAIN: '.ds-assistant-message-main-content',

    // 代码块：容器 + 语言标签所在的 banner
    CODE_BLOCK: '.md-code-block',
    CODE_BLOCK_BANNER: '.md-code-block-banner',
  },

  scrollConfig: {
    maxAttempts: 50,
    delay: 800,
    stabilityDelay: 500,
    stabilityTimeout: 10000,
    scrollIncrement: 0.8,
  },
};

export default DEEPSEEK_CONFIG;

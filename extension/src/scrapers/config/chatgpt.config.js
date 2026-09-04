/**
 * ChatGPT 平台配置。selector 全部收在这里，chatgpt.com 改版只动本文件 + tests/fixtures/chatgpt-chat.html。
 *
 * Adapted from TheBluCoder/AI-chat-exporter — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 */

export const CHATGPT_CONFIG = {
  platform: 'ChatGPT',
  source: 'chatgpt',

  selectors: {
    CONTAINER: 'main',
    CHAT_CONTAINER: 'main',

    // Turns：语义化 data 属性，ChatGPT 自己的测试也依赖它们，相对最稳
    USER_TURN: '[data-turn="user"]',
    MODEL_TURN: '[data-turn="assistant"]',
    ARTICLE_TURN: '[data-turn]',

    // 内容容器
    USER_CONTENT: '[data-message-author-role="user"]',
    MODEL_CONTENT: '[data-message-author-role="assistant"]',

    // 文本
    USER_TEXT: '.whitespace-pre-wrap',
    MODEL_TEXT: '.markdown',
  },

  scrollConfig: {
    maxAttempts: 50,
    delay: 800,
    stabilityDelay: 500,
    stabilityTimeout: 10000,
    scrollIncrement: 0.8, // 每步滚动 80% 视口高度
  },
};

export default CHATGPT_CONFIG;

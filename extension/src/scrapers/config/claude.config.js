/**
 * Claude 平台配置。selector 全部收在这里，claude.ai 改版只动本文件 + tests/fixtures/claude-chat.html。
 *
 * Adapted from TheBluCoder/AI-chat-exporter — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 */

export const CLAUDE_CONFIG = {
  platform: 'Claude',
  source: 'claude',

  selectors: {
    // 会话容器：优先语义化程度更高的 main，Tailwind 长链类名太脆弱不再依赖
    CONTAINER: 'main',
    CHAT_CONTAINER: 'main',

    // 每轮对话的包裹节点
    MESSAGE_TURN: 'div[data-test-render-count]',

    // 用户消息（data-testid 相对稳定）
    USER_QUERY: 'div[data-testid="user-message"]',

    // 模型回复：新旧类名兼容（.font-claude-message 是旧版类名，Claude 曾改名，两个都留）
    MODEL_RESPONSE: 'div.font-claude-response, div.font-claude-message',

    // 代码块（用户消息里的粘贴代码）
    CODE_BLOCK: '.code-block__code',
    LINE_NUMBERS: '.react-syntax-highlighter-line-number',
  },

  scrollConfig: {
    maxAttempts: 50,
    delay: 1500,
    stabilityDelay: 500,
    stabilityTimeout: 8000,
  },
};

export default CLAUDE_CONFIG;

/**
 * Scraper 初始化：按 URL 识别平台 → 实例化对应 scraper。
 *
 * Adapted from TheBluCoder/AI-chat-exporter — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 */

import { ChatGPTScraper } from './platforms/ChatGPTScraper.js';
import { ClaudeScraper } from './platforms/ClaudeScraper.js';
import { DeepSeekScraper } from './platforms/DeepSeekScraper.js';
import { PLATFORM_URL_PATTERNS } from './base/constants.js';

const PLATFORMS = [
  {
    pattern: PLATFORM_URL_PATTERNS.CHATGPT,
    name: 'ChatGPT',
    source: 'chatgpt',
    ScraperClass: ChatGPTScraper,
    // 会话 id 提取：chatgpt.com/c/{id}
    conversationIdPattern: /\/c\/([^/?#]+)/,
  },
  {
    pattern: PLATFORM_URL_PATTERNS.CLAUDE,
    name: 'Claude',
    source: 'claude',
    ScraperClass: ClaudeScraper,
    // claude.ai/chat/{uuid}
    conversationIdPattern: /\/chat\/([^/?#]+)/,
  },
  {
    pattern: PLATFORM_URL_PATTERNS.DEEPSEEK,
    name: 'DeepSeek',
    source: 'deepseek',
    ScraperClass: DeepSeekScraper,
    // chat.deepseek.com/a/chat/s/{id}
    conversationIdPattern: /\/a\/chat\/s\/([^/?#]+)/,
  },
];

/** 按当前 URL 检测平台，返回平台描述或 null。 */
export function detectPlatform(url = window.location.href) {
  return PLATFORMS.find((p) => p.pattern.test(url)) || null;
}

/**
 * 提取会话 id；提不到时用 document.title 的 FNV-1a 哈希兜底
 * （保证同一会话内多次保存的 id 前缀一致）。
 */
export function getConversationId(platform, url = window.location.href) {
  const match = url.match(platform.conversationIdPattern);
  if (match) return match[1];

  const title = document.title || 'untitled';
  let hash = 0x811c9dc5;
  for (let i = 0; i < title.length; i++) {
    hash ^= title.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `t-${hash.toString(16)}`;
}

/** 创建当前页面的 scraper 实例，无支持平台返回 null。 */
export function createScraper() {
  const platform = detectPlatform();
  if (!platform) return null;
  return {
    platform,
    scraper: new platform.ScraperClass(),
  };
}

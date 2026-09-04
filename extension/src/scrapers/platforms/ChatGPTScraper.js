/**
 * ChatGPT Scraper —— chatgpt.com / chat.openai.com 的 DOM 抽取。
 * ChatGPT 虚拟化渲染消息（不在视口的 turn 会被卸载），必须边滚边采。
 *
 * Adapted from TheBluCoder/AI-chat-exporter — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 *
 * 相对上游的改造：不抓图片/媒体，只留文本 + 代码块保真；
 * sweepDownAndCapture 通用逻辑上移到 BaseScraper（DeepSeek 复用）。
 */

import { BaseScraper } from '../base/BaseScraper.js';
import { CHATGPT_CONFIG } from '../config/chatgpt.config.js';
import { LOG_TEXT_PREVIEW_LENGTH } from '../base/constants.js';

const DEFAULT_SCROLL_INCREMENT = 0.8;
const DEFAULT_TURN_INDEX = 0;
const CONTENT_LOAD_DELAY_MS = 240;
const RECOVERY_SCROLL_INCREMENT = 0.4;
const RECOVERY_LOAD_DELAY_MS = 350;

export class ChatGPTScraper extends BaseScraper {
  constructor() {
    super(CHATGPT_CONFIG);
  }

  /**
   * 渐进滚动 + 收割。skipScroll 时只收当前挂载的 turn。
   */
  async extractAllMessages(container, options = {}) {
    const allMessages = new Map();
    const seenShellTurns = new Set();

    if (options.skipScroll) {
      await this.captureVisibleTurns(container, allMessages, seenShellTurns);
      return this.sortedMessages(allMessages);
    }

    const scrollContainer = this.findScrollContainer(container);

    // 先滚到顶（挂载最早的 turn），再从上往下扫
    scrollContainer.scrollTop = 0;
    await this.waitForTurnSettle(scrollContainer, RECOVERY_LOAD_DELAY_MS);

    await this.sweepDownAndCapture(
      scrollContainer,
      allMessages,
      seenShellTurns,
      this.scrollConfig.scrollIncrement || DEFAULT_SCROLL_INCREMENT,
      CONTENT_LOAD_DELAY_MS
    );

    // 见过 shell 但没水合成功的 turn，回到顶部细粒度补扫一遍
    const unresolved = this.getUnresolvedTurnKeys(allMessages, seenShellTurns);
    if (unresolved.size > 0) {
      scrollContainer.scrollTop = 0;
      await this.waitForTurnSettle(scrollContainer, RECOVERY_LOAD_DELAY_MS);

      await this.sweepDownAndCapture(
        scrollContainer,
        allMessages,
        seenShellTurns,
        RECOVERY_SCROLL_INCREMENT,
        RECOVERY_LOAD_DELAY_MS,
        unresolved
      );
    }

    return this.sortedMessages(allMessages);
  }

  sortedMessages(allMessages) {
    return Array.from(allMessages.values()).sort((a, b) => a.turn_index - b.turn_index);
  }

  /** 优先 ChatGPT 显式声明的滚动根。 */
  findScrollContainer(startElement) {
    const explicitRoot = document.querySelector('[data-scroll-root]');
    if (explicitRoot) return explicitRoot;
    return super.findScrollContainer(startElement);
  }

  /** 收割当前挂载的 turn（shell turn 单独记账，等水合后再入 Map）。 */
  async captureVisibleTurns(scrollContainer, allMessages, seenShellTurns, targetTurnKeys = null) {
    const visibleTurns = Array.from(scrollContainer.querySelectorAll(this.selectors.ARTICLE_TURN));

    for (const turn of visibleTurns) {
      const role = turn.getAttribute('data-turn');
      const turnIndex = this.parseTurnIndex(turn);
      const turnId = turn.getAttribute('data-turn-id');
      const turnKey = this.createTurnKey(turn, role, turnIndex);

      if (targetTurnKeys && !targetTurnKeys.has(turnKey)) continue;
      if (allMessages.has(turnKey)) continue;

      seenShellTurns.add(turnKey);

      try {
        if (role === 'user') {
          const userText = this.extractUserText(turn);
          if (!this.hasHydratedContent(userText)) continue;

          allMessages.set(turnKey, this.createMessage({
            role: 'user',
            content: userText,
            turn_index: turnIndex,
            turn_id: turnId || turnKey,
          }));
        } else if (role === 'assistant') {
          const modelText = this.extractModelText(turn);
          if (!this.hasHydratedContent(modelText)) continue;

          allMessages.set(turnKey, this.createMessage({
            role: 'model',
            content: modelText,
            turn_index: turnIndex,
            turn_id: turnId || turnKey,
          }));
        }
      } catch (err) {
        console.warn(`[${this.platform}-Scraper] Error extracting turn ${turnKey}:`, err);
      }
    }
  }

  /** 从 data-testid="conversation-turn-N" 解析序号。 */
  parseTurnIndex(turnElement) {
    const testId = turnElement?.getAttribute('data-testid') || '';
    const parsed = Number.parseInt(testId.split('-').pop(), 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_TURN_INDEX;
  }

  /** 稳定去重键：data-turn-id > data-testid > role+index+文本前缀。 */
  createTurnKey(turnElement, role, turnIndex) {
    const turnId = turnElement?.getAttribute('data-turn-id');
    if (turnId) return turnId;

    const testId = turnElement?.getAttribute('data-testid');
    if (testId) return testId;

    const textPreview = (role === 'assistant'
      ? this.extractModelText(turnElement)
      : this.extractUserText(turnElement)
    ).slice(0, LOG_TEXT_PREVIEW_LENGTH);

    return `${role || 'unknown'}-${turnIndex}-${textPreview}`;
  }

  extractUserText(userTurnElement) {
    if (!userTurnElement) return '';

    const contentContainer = userTurnElement.querySelector(this.selectors.USER_CONTENT);
    if (!contentContainer) return '';

    const targetElement = contentContainer.querySelector(this.selectors.USER_TEXT) || contentContainer;
    const clone = this.cloneAndStripSelectors(targetElement, ['button', 'img']);

    return this.blockAwareText(clone);
  }

  /** 模型回复：处理 ChatGPT 的代码块（pre + 头部语言标签）。 */
  extractModelText(modelTurnElement) {
    if (!modelTurnElement) return '';

    const contentContainer = modelTurnElement.querySelector(this.selectors.MODEL_CONTENT);
    if (!contentContainer) return '';

    const targetElement = contentContainer.querySelector(this.selectors.MODEL_TEXT) || contentContainer;
    const clone = this.cloneAndStripSelectors(targetElement, ['button', 'img']);

    clone.querySelectorAll('pre').forEach((pre) => {
      const codeEl = pre.querySelector('code');
      if (!codeEl) return;
      const codeContent = this.extractCodeTextPreserveLines(codeEl);

      // 语言优先取 ChatGPT UI 的头部标签
      const headerLabel = pre.querySelector('.text-token-text-primary')?.innerText?.trim() || '';

      const preClone = pre.cloneNode(true);
      if (preClone.querySelector('code')) preClone.querySelector('code').remove();
      preClone.querySelectorAll('button').forEach((b) => b.remove());
      const fallbackLabel = preClone.innerText.trim().split('\n')[0] || '';

      const language = this.normalizeCodeLanguage(headerLabel || fallbackLabel);
      pre.replaceWith(document.createTextNode(this.createMarkdownCodeBlock(codeContent, language)));
    });

    // blockAwareText 已在块级边界补换行并收敛多余空白行
    return this.blockAwareText(clone);
  }
}

export default ChatGPTScraper;

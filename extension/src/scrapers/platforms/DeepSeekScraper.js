/**
 * DeepSeek Scraper —— chat.deepseek.com 的 DOM 抽取。本文件为新写（非搬运）。
 * selector 事实来源：RESEARCH-capture.md §2。
 *
 * DeepSeek 用虚拟列表渲染消息（[data-virtual-list-item-key]），长对话中
 * 不在视口的消息会被卸载——必须像 ChatGPT 一样边滚边采（Rat-S 没处理这点，我们处理）。
 *
 * 结构事实（来自调研）：每个虚拟列表 item 里，
 *   - 用户消息：`.ds-message` 包裹（内层文本节点是混淆哈希类名，不依赖）
 *   - 模型回复：`.ds-markdown`（更具体的是 `.ds-assistant-message-main-content`）
 *   - 代码块：`.md-code-block`，语言标签在 `.md-code-block-banner` 的 span 里
 */

import { BaseScraper } from '../base/BaseScraper.js';
import { DEEPSEEK_CONFIG } from '../config/deepseek.config.js';

const CONTENT_LOAD_DELAY_MS = 240;
const RECOVERY_SCROLL_INCREMENT = 0.4;
const RECOVERY_LOAD_DELAY_MS = 350;
const DEFAULT_SCROLL_INCREMENT = 0.8;

export class DeepSeekScraper extends BaseScraper {
  constructor() {
    super(DEEPSEEK_CONFIG);
  }

  async extractAllMessages(container, options = {}) {
    const allMessages = new Map();
    const seenShellTurns = new Set();

    if (options.skipScroll) {
      await this.captureVisibleTurns(container.ownerDocument?.body || container, allMessages, seenShellTurns);
      return this.sortedMessages(allMessages);
    }

    const scrollContainer = this.findScrollContainer(container);

    scrollContainer.scrollTop = 0;
    await this.waitForTurnSettle(scrollContainer, RECOVERY_LOAD_DELAY_MS);

    await this.sweepDownAndCapture(
      scrollContainer,
      allMessages,
      seenShellTurns,
      this.scrollConfig.scrollIncrement || DEFAULT_SCROLL_INCREMENT,
      CONTENT_LOAD_DELAY_MS
    );

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

  /**
   * 收割当前挂载的虚拟列表 item。
   * 一个 item 里可能同时有用户消息和模型回复，各自入 Map（key 加 role 后缀）。
   */
  async captureVisibleTurns(scrollContainer, allMessages, seenShellTurns, targetTurnKeys = null) {
    const root = scrollContainer.ownerDocument || document;
    let items = Array.from(root.querySelectorAll(this.selectors.ARTICLE_TURN));

    // 兜底：页面没有虚拟列表结构时（如短对话或改版），按文档序直接扫消息节点
    if (items.length === 0) {
      this.captureWithoutVirtualList(root, allMessages, seenShellTurns);
      return;
    }

    for (const item of items) {
      const key = item.getAttribute('data-virtual-list-item-key') || '';
      const turnIndex = Number.parseInt(key, 10);
      const baseIndex = Number.isFinite(turnIndex) ? turnIndex : 0;

      const userKey = `${key}:user`;
      const modelKey = `${key}:model`;

      try {
        if (!targetTurnKeys || targetTurnKeys.has(userKey)) {
          if (!allMessages.has(userKey)) {
            seenShellTurns.add(userKey);
            const userEl = this.findUserElement(item);
            const userText = this.extractDeepSeekUserText(userEl);
            if (this.hasHydratedContent(userText)) {
              allMessages.set(userKey, this.createMessage({
                role: 'user',
                content: userText,
                turn_index: baseIndex * 2,
                turn_id: userKey,
              }));
            }
          }
        }

        if (!targetTurnKeys || targetTurnKeys.has(modelKey)) {
          if (!allMessages.has(modelKey)) {
            seenShellTurns.add(modelKey);
            const modelEl =
              item.querySelector(this.selectors.MODEL_RESPONSE_MAIN) ||
              item.querySelector(this.selectors.MODEL_RESPONSE);
            const modelText = this.extractDeepSeekModelText(modelEl);
            if (this.hasHydratedContent(modelText)) {
              allMessages.set(modelKey, this.createMessage({
                role: 'model',
                content: modelText,
                turn_index: baseIndex * 2 + 1,
                turn_id: modelKey,
              }));
            }
          }
        }
      } catch (err) {
        console.warn(`[${this.platform}-Scraper] Error extracting item ${key}:`, err);
      }
    }
  }

  /** 无虚拟列表时的兜底：按文档序扫 .ds-message / .ds-markdown。 */
  captureWithoutVirtualList(root, allMessages, seenShellTurns) {
    const candidates = Array.from(
      root.querySelectorAll(`${this.selectors.USER_MESSAGE}, ${this.selectors.MODEL_RESPONSE}`)
    );

    let index = 0;
    for (const el of candidates) {
      const isModel = el.matches(this.selectors.MODEL_RESPONSE);
      // .ds-message 可能同时包住模型回复的外层，含 .ds-markdown 的按模型处理、跳过外层
      if (!isModel && el.querySelector(this.selectors.MODEL_RESPONSE)) continue;

      const role = isModel ? 'model' : 'user';
      const text = isModel
        ? this.extractDeepSeekModelText(el)
        : this.extractDeepSeekUserText(el);

      if (!this.hasHydratedContent(text)) continue;

      const turnKey = `flat-${index}:${role}`;
      seenShellTurns.add(turnKey);
      allMessages.set(turnKey, this.createMessage({
        role,
        content: text,
        turn_index: index,
        turn_id: turnKey,
      }));
      index++;
    }
  }

  /** 在虚拟列表 item 里找用户消息节点（排除包住模型回复的包裹层）。 */
  findUserElement(item) {
    const candidates = item.querySelectorAll(this.selectors.USER_MESSAGE);
    for (const el of candidates) {
      if (!el.querySelector(this.selectors.MODEL_RESPONSE)) return el;
    }
    return null;
  }

  extractDeepSeekUserText(element) {
    if (!element) return '';
    const clone = this.cloneAndStripSelectors(element, ['button', 'img', '.ds-icon', '.ds-icon-button']);
    return this.blockAwareText(clone);
  }

  /** 模型回复：把 .md-code-block 转成 markdown 围栏（语言取 banner 首个词）。 */
  extractDeepSeekModelText(element) {
    if (!element) return '';

    const clone = this.cloneAndStripSelectors(element, ['button', 'img', '.ds-icon', '.ds-icon-button']);
    if (!clone) return '';

    clone.querySelectorAll(this.selectors.CODE_BLOCK).forEach((block) => {
      const pre = block.querySelector('pre');
      const codeSource = pre || block.querySelector('code');
      if (!codeSource) return;

      const banner = block.querySelector(this.selectors.CODE_BLOCK_BANNER);
      const language = this.normalizeCodeLanguage(
        (banner?.textContent || '').trim().split(/\s+/)[0] || ''
      );

      // 从克隆里摘掉 banner，避免语言标签混进代码正文
      banner?.remove();
      const codeContent = this.extractCodeTextPreserveLines(codeSource);
      block.replaceWith(document.createTextNode(this.createMarkdownCodeBlock(codeContent, language)));
    });

    return this.blockAwareText(clone);
  }
}

export default DeepSeekScraper;

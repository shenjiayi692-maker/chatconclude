/**
 * Claude Scraper —— claude.ai 的 DOM 抽取。
 *
 * Adapted from TheBluCoder/AI-chat-exporter — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 *
 * 相对上游的改造：不抓 artifact 预览面板（v1 明确不做）、不抓图片/上传文件，
 * 只留文本问答 + 代码块保真。
 */

import { BaseScraper } from '../base/BaseScraper.js';
import { CLAUDE_CONFIG } from '../config/claude.config.js';

export class ClaudeScraper extends BaseScraper {
  constructor() {
    super(CLAUDE_CONFIG);
  }

  async waitForContainer() {
    return (
      document.querySelector(this.selectors.CHAT_CONTAINER) || document.body
    );
  }

  /**
   * 用户消息富文本 → markdown（代码块/列表/行内 code 保真）。
   */
  extractUserText(userQuery) {
    if (!userQuery) return '';

    const removeSelectors = ['button'];
    if (this.selectors.LINE_NUMBERS) removeSelectors.push(this.selectors.LINE_NUMBERS);
    const clone = this.cloneAndStripSelectors(userQuery, removeSelectors);
    if (!clone) return '';

    // 代码块 → markdown 围栏
    clone.querySelectorAll(this.selectors.CODE_BLOCK).forEach((codeBlock) => {
      const codeEl = codeBlock.querySelector('code');
      if (!codeEl) return;

      const codeClass = codeEl.getAttribute('class') || '';
      const language = this.extractCodeLanguageFromClass(codeClass);
      const codeContent = codeEl.innerText || codeEl.textContent;
      const markdownBlock = this.createMarkdownCodeBlock(codeContent, language);

      codeBlock.replaceWith(document.createTextNode(markdownBlock));
    });

    // 有序/无序列表 → markdown
    clone.querySelectorAll('ol').forEach((ol) => {
      const items = ol.querySelectorAll('li');
      let listText = '\n';
      items.forEach((li, index) => {
        listText += `${index + 1}. ${li.innerText.trim()}\n`;
      });
      ol.replaceWith(document.createTextNode(listText));
    });

    clone.querySelectorAll('ul').forEach((ul) => {
      const items = ul.querySelectorAll('li');
      let listText = '\n';
      items.forEach((li) => {
        listText += `- ${li.innerText.trim()}\n`;
      });
      ul.replaceWith(document.createTextNode(listText));
    });

    // 行内 code
    clone.querySelectorAll('code').forEach((code) => {
      const text = code.innerText || code.textContent;
      code.replaceWith(document.createTextNode(`\`${text}\``));
    });

    return this.blockAwareText(clone);
  }

  /** 模型回复 → 文本（代码块保真）。 */
  extractModelText(modelResponse) {
    if (!modelResponse) return '';

    const clone = this.cloneAndStripSelectors(modelResponse, [
      'button',
      this.selectors.LINE_NUMBERS,
    ]);
    if (!clone) return '';

    clone.querySelectorAll('pre').forEach((pre) => {
      const codeEl = pre.querySelector('code');
      if (!codeEl) return;
      const codeContent = this.extractCodeTextPreserveLines(codeEl);
      const language = this.extractCodeLanguageFromClass(codeEl.getAttribute('class') || '');
      pre.replaceWith(document.createTextNode(this.createMarkdownCodeBlock(codeContent, language)));
    });

    return this.blockAwareText(clone);
  }

  /**
   * Claude 的 DOM 不做虚拟化（历史靠上滚加载，滚完全部在 DOM 里），
   * 所以这里是一次纯 DOM 遍历。
   */
  async extractAllMessages(container) {
    const messages = [];
    let turnIndex = 0;

    const messageNodes = container.querySelectorAll(this.selectors.MESSAGE_TURN);

    for (const node of messageNodes) {
      try {
        const userQuery = node.querySelector(this.selectors.USER_QUERY);
        if (userQuery) {
          const userText = this.extractUserText(userQuery);
          if (this.hasHydratedContent(userText)) {
            messages.push(this.createMessage({
              role: 'user',
              content: userText,
              turn_index: turnIndex,
            }));
          }
        }

        const modelResponse = node.querySelector(this.selectors.MODEL_RESPONSE);
        if (modelResponse) {
          const modelText = this.extractModelText(modelResponse);
          if (this.hasHydratedContent(modelText)) {
            messages.push(this.createMessage({
              role: 'model',
              content: modelText,
              turn_index: turnIndex,
            }));
          }
        }

        turnIndex++;
      } catch (error) {
        console.warn(`[${this.platform}-Scraper] Error parsing message node ${turnIndex}:`, error);
      }
    }

    return messages;
  }
}

export default ClaudeScraper;

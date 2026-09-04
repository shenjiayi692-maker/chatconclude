/**
 * Base Scraper Class
 * Abstract base class for all platform-specific scrapers.
 *
 * Adapted from TheBluCoder/AI-chat-exporter
 * (https://github.com/TheBluCoder/AI-chat-exporter)
 * Copyright (c) 2024 AI Chat Exporter Contributors — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 *
 * 相对上游的改造：
 * - 消息格式裁剪为 { role, content, turn_index, turn_id }（不采集 media/文件/嵌入文档）
 * - scrape() 支持 { skipScroll }：选中保存只抽当前已挂载的 DOM，不做滚动加载
 * - sweepDownAndCapture 提为基类通用方法，供 ChatGPT/DeepSeek 等虚拟化平台复用
 *
 * MESSAGE FORMAT (enforced across all scrapers):
 * { role: "user" | "model", content: string, turn_index: number, turn_id?: string }
 */

import {
  MAX_SCROLL_ATTEMPTS,
  SCROLL_DELAY_MS,
  STABILITY_DELAY_MS,
  STABILITY_TIMEOUT_MS,
  DEFAULT_ELEMENT_WAIT_TIMEOUT_MS,
  ELEMENT_POLL_INTERVAL_MS,
  SCROLL_WIGGLE_DELAY_MS,
  SCROLL_POSITION_TOLERANCE,
  DOM_STABILITY_POLL_MS,
} from './constants.js';

export class BaseScraper {
  /**
   * @param {Object} config - Platform-specific configuration
   * @param {string} config.platform - Platform name
   * @param {Object} config.selectors - DOM selectors
   * @param {Object} config.scrollConfig - Scroll configuration
   */
  constructor(config) {
    if (!config) {
      throw new Error('BaseScraper requires a configuration object');
    }

    this.config = config;
    this.platform = config.platform;
    this.selectors = config.selectors;
    this.scrollConfig = config.scrollConfig || {
      maxAttempts: MAX_SCROLL_ATTEMPTS,
      delay: SCROLL_DELAY_MS,
      stabilityDelay: STABILITY_DELAY_MS,
      stabilityTimeout: STABILITY_TIMEOUT_MS,
    };
  }

  /**
   * Main scraping entry point (template method).
   * @param {Object} [options]
   * @param {boolean} [options.skipScroll] - 只抽当前挂载的 DOM，不滚动加载历史
   * @returns {Promise<Object>} Scraping result
   */
  async scrape(options = {}) {
    try {
      const container = await this.waitForContainer();
      if (!container) {
        throw new Error('Could not find conversation container');
      }

      if (!options.skipScroll) {
        await this.scrollToLoadHistory(container);
        await this.waitForStableContent(container);
      }

      const messages = await this.extractAllMessages(container, options);
      if (!messages.length) {
        throw new Error('页面上没有找到对话消息。');
      }

      return this.formatResult(messages);
    } catch (error) {
      console.error(`[${this.platform}-Scraper] Scrape error:`, error);
      return this.formatError(error);
    }
  }

  /** Wait for the main container element. Override if needed. */
  async waitForContainer() {
    const selector = this.selectors.CONTAINER || this.selectors.CHAT_CONTAINER;
    return await this.waitForElement(selector, DEFAULT_ELEMENT_WAIT_TIMEOUT_MS);
  }

  /** Scroll to load full conversation history. Override for platform-specific behavior. */
  async scrollToLoadHistory(container) {
    await this.autoScrollToTop(container);
  }

  /**
   * Extract all messages from the container. MUST be implemented by subclass.
   * @returns {Promise<Array>}
   */
  async extractAllMessages(_container, _options) {
    throw new Error('extractAllMessages() must be implemented by subclass');
  }

  /** Auto-scroll to top to load history (infinite-scroll style pages). */
  async autoScrollToTop(startElement) {
    const scrollContainer = this.findScrollContainer(startElement);

    let previousHeight = scrollContainer.scrollHeight;
    let noChangeCount = 0;

    for (let i = 0; i < this.scrollConfig.maxAttempts; i++) {
      scrollContainer.scrollTop = 0;
      await this.sleep(this.scrollConfig.delay);

      const currentHeight = scrollContainer.scrollHeight;

      if (currentHeight > previousHeight) {
        previousHeight = currentHeight;
        noChangeCount = 0;
      } else {
        // Double-check with wiggle
        scrollContainer.scrollTop = 10;
        await this.sleep(SCROLL_WIGGLE_DELAY_MS);
        scrollContainer.scrollTop = 0;

        if (scrollContainer.scrollHeight <= previousHeight) {
          noChangeCount++;
          if (noChangeCount >= 2) {
            break;
          }
        }
      }
    }
  }

  /** Find the actual scrollable container. */
  findScrollContainer(startElement) {
    let scrollContainer = startElement;

    if (scrollContainer.scrollHeight <= scrollContainer.clientHeight) {
      let current = scrollContainer;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          current.scrollHeight > current.clientHeight
        ) {
          scrollContainer = current;
          break;
        }
        current = current.parentElement;
      }
    }

    if (!scrollContainer || scrollContainer === document.body) {
      scrollContainer = document.querySelector('main') || document.documentElement;
    }

    return scrollContainer;
  }

  /** Wait for content to stabilize (stop changing). */
  async waitForStableContent(container) {
    const checkInterval = this.scrollConfig.stabilityDelay;
    const timeout = this.scrollConfig.stabilityTimeout;

    let previousContent = container.innerHTML.length;
    let stableCount = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await this.sleep(checkInterval);
      const currentContent = container.innerHTML.length;

      if (currentContent === previousContent) {
        stableCount++;
        if (stableCount >= 3) {
          return;
        }
      } else {
        stableCount = 0;
        previousContent = currentContent;
      }
    }

    console.warn(`[${this.platform}-Scraper] Content did not stabilize within timeout`);
  }

  /**
   * 虚拟化列表通用采集：从当前位置向下分步滚动，边滚边收割已挂载的消息。
   * 子类需实现 captureVisibleTurns(scrollContainer, allMessages, seenShellTurns, targetTurnKeys)。
   * @param {Element} scrollContainer
   * @param {Map} allMessages - turnKey -> message
   * @param {Set} seenShellTurns - 见过但可能未水合的 turnKey
   * @param {number} incrementRatio - 每步滚动占视口高度比例
   * @param {number} waitMs - 每步后等待水合的时间
   * @param {Set<string>|null} targetTurnKeys - 只补采这些 key（恢复扫描用）
   */
  async sweepDownAndCapture(scrollContainer, allMessages, seenShellTurns, incrementRatio, waitMs, targetTurnKeys = null) {
    const increment = Math.max(1, Math.floor(scrollContainer.clientHeight * incrementRatio));
    let currentScroll = scrollContainer.scrollTop;

    while (currentScroll < scrollContainer.scrollHeight) {
      await this.captureVisibleTurns(scrollContainer, allMessages, seenShellTurns, targetTurnKeys);

      const nextScroll = Math.min(currentScroll + increment, scrollContainer.scrollHeight);
      scrollContainer.scrollTop = nextScroll;
      await this.waitForTurnSettle(scrollContainer, waitMs);

      if (scrollContainer.scrollTop < nextScroll - SCROLL_POSITION_TOLERANCE) {
        break;
      }

      if (targetTurnKeys && this.getUnresolvedTurnKeys(allMessages, seenShellTurns, targetTurnKeys).size === 0) {
        break;
      }

      currentScroll = scrollContainer.scrollTop;
    }

    await this.captureVisibleTurns(scrollContainer, allMessages, seenShellTurns, targetTurnKeys);
  }

  /** 虚拟化平台子类实现：收割当前挂载的消息。 */
  async captureVisibleTurns(_scrollContainer, _allMessages, _seenShellTurns, _targetTurnKeys = null) {
    throw new Error('captureVisibleTurns() must be implemented by virtualization-aware subclass');
  }

  /** Wait for an element to appear in the DOM. */
  async waitForElement(selector, timeout = DEFAULT_ELEMENT_WAIT_TIMEOUT_MS) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
      await this.sleep(ELEMENT_POLL_INTERVAL_MS);
    }

    console.warn(`[${this.platform}-Scraper] Element not found: ${selector}`);
    return null;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** True when turn has hydrated content we can capture. */
  hasHydratedContent(text) {
    return Boolean(text && text.trim());
  }

  /** Build a lightweight fingerprint of currently mounted turns (virtualization-aware settling). */
  getTurnRenderFingerprint(container) {
    if (!container || !this.selectors?.ARTICLE_TURN) return '';
    const nodes = container.querySelectorAll(this.selectors.ARTICLE_TURN);
    return Array.from(nodes)
      .map((node) => node.getAttribute('data-turn-id') || node.getAttribute('data-testid') || node.getAttribute('data-virtual-list-item-key') || '')
      .filter(Boolean)
      .join('|');
  }

  /** Wait until rendered turn fingerprint changes, or until max wait elapses. */
  async waitForTurnSettle(container, maxWaitMs) {
    const baseline = this.getTurnRenderFingerprint(container);
    const boundedWaitMs = Math.max(maxWaitMs, DOM_STABILITY_POLL_MS);
    const start = Date.now();

    while (Date.now() - start < boundedWaitMs) {
      await this.sleep(DOM_STABILITY_POLL_MS);
      if (this.getTurnRenderFingerprint(container) !== baseline) return;
    }
  }

  /** Compute unresolved keys that were seen but not yet captured. */
  getUnresolvedTurnKeys(capturedMap, seenSet, subset = null) {
    const unresolved = new Set();
    for (const key of seenSet) {
      if (subset && !subset.has(key)) continue;
      if (!capturedMap.has(key)) unresolved.add(key);
    }
    return unresolved;
  }

  /**
   * Generic text extraction helper.
   * @param {Element} element
   * @param {Object} options
   */
  extractTextFromElement(element, options = {}) {
    if (!element) return '';

    const {
      contentSelector = null,
      textSelector = null,
      removeSelectors = ['button', 'img'],
    } = options;

    let targetElement = element;
    if (contentSelector) {
      const container = element.querySelector(contentSelector);
      if (container) {
        targetElement = container;
      }
    }

    if (textSelector) {
      const textEl = targetElement.querySelector(textSelector);
      if (textEl) {
        return textEl.innerText.trim();
      }
    }

    const clone = targetElement.cloneNode(true);
    removeSelectors.forEach((selector) => {
      clone.querySelectorAll(selector).forEach((el) => el.remove());
    });

    return clone.innerText.trim();
  }

  /** Extract text from user message. Override for platform-specific extraction. */
  extractUserText(element) {
    return this.extractTextFromElement(element, {
      contentSelector: this.selectors.USER_CONTENT,
      textSelector: this.selectors.USER_TEXT,
      removeSelectors: ['button', 'img'],
    });
  }

  /** Extract text from model message. Override for platform-specific extraction. */
  extractModelText(element) {
    return this.extractTextFromElement(element, {
      contentSelector: this.selectors.MODEL_CONTENT,
      textSelector: this.selectors.MODEL_TEXT,
      removeSelectors: ['button', '.action-button'],
    });
  }

  /** Create a standardized message object. */
  createMessage({ role, content = '', turn_index = 0, turn_id = null }) {
    const message = { role, content, turn_index };
    if (turn_id) {
      message.turn_id = turn_id;
    }
    return message;
  }

  /** Normalize code language labels to markdown-friendly identifiers. */
  normalizeCodeLanguage(label) {
    const raw = (label || '').trim().toLowerCase();
    if (!raw) return '';

    const defaultAliases = {
      'c++': 'cpp',
      'cpp': 'cpp',
      'c#': 'csharp',
      'csharp': 'csharp',
      'javascript': 'js',
      'typescript': 'ts',
    };

    const configuredAliases = this.config?.codeLanguageAliases || {};
    const aliases = { ...defaultAliases, ...configuredAliases };
    const normalized = aliases[raw] || raw.replace(/\s+/g, '');

    if (!/^[a-z0-9#+._-]{1,20}$/i.test(normalized)) return '';
    return normalized;
  }

  /** Determine safe code-fence width when content may already contain backticks. */
  getBacktickWrapper(content) {
    const minBackticks = 3;
    if (!content) return '`'.repeat(minBackticks);

    const backtickMatches = content.match(/`+/g);
    let maxBackticks = 0;
    if (backtickMatches) {
      maxBackticks = Math.max(...backtickMatches.map((m) => m.length));
    }
    return '`'.repeat(Math.max(minBackticks, maxBackticks + 1));
  }

  /** Extract a normalized language identifier from a class attribute string. */
  extractCodeLanguageFromClass(classNames) {
    const match = String(classNames || '').match(/language-([\w+-]+)/i);
    return this.normalizeCodeLanguage(match ? match[1] : '');
  }

  /** Create a fenced markdown code block with safe backtick width. */
  createMarkdownCodeBlock(codeContent, language = '', prefix = '\n', suffix = '\n') {
    const content = (codeContent || '').trimEnd();
    const ticks = this.getBacktickWrapper(content);
    const lang = this.normalizeCodeLanguage(language);
    return `${prefix}${ticks}${lang}\n${content}\n${ticks}${suffix}`;
  }

  /** Extract code text while preserving logical line breaks across different renderers. */
  extractCodeTextPreserveLines(codeElement) {
    if (!codeElement) return '';

    const direct = (codeElement.innerText || '').replace(/\r\n/g, '\n');
    if (direct.includes('\n')) return direct;

    const cmLines = codeElement.querySelectorAll('.cm-line');
    if (cmLines.length > 0) {
      const joined = Array.from(cmLines).map((line) => (line.innerText || '').replace(/\r\n/g, '\n')).join('\n');
      if (joined.trim()) return joined;
    }

    const clone = codeElement.cloneNode(true);
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return (clone.textContent || '').replace(/\r\n/g, '\n');
  }

  /**
   * 不依赖布局地把元素文本取出，并在块级元素边界补换行。
   *
   * 为什么不用 innerText：我们抽取时先 cloneNode 再读文本，克隆出来的是游离节点，
   * 真实浏览器里游离节点没有布局，innerText 会退化成 textContent —— 块级元素之间的
   * 换行全部丢失（列表、标题、段落糊成一行）。textContent 又永远不加换行。
   * 这里手动遍历：遇到块级元素在其内容前后补 \n，<br> 补一个 \n，文本节点取 textContent。
   * 这样在 Chrome（游离克隆）和 linkedom（测试）里行为一致。
   */
  blockAwareText(root) {
    if (!root) return '';
    const BLOCK = new Set([
      'P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HR', 'TABLE', 'TR',
    ]);
    const parts = [];
    const walk = (node) => {
      if (node.nodeType === 3) {
        parts.push(node.textContent);
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (tag === 'BR') {
        parts.push('\n');
        return;
      }
      const isBlock = BLOCK.has(tag);
      if (isBlock) parts.push('\n');
      for (const child of node.childNodes) walk(child);
      if (isBlock) parts.push('\n');
    };
    walk(root);
    return parts
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Clone an element and remove a list of selectors from the clone. */
  cloneAndStripSelectors(element, selectors = []) {
    if (!element) return null;
    const clone = element.cloneNode(true);
    selectors.forEach((selector) => {
      if (!selector) return;
      clone.querySelectorAll(selector).forEach((node) => node.remove());
    });
    return clone;
  }

  /** Extract trimmed innerText from an element, optionally stripping selectors first. */
  extractCleanInnerText(element, selectors = []) {
    const clone = this.cloneAndStripSelectors(element, selectors);
    return clone ? clone.innerText.trim() : '';
  }

  /** Format successful result. */
  formatResult(messages) {
    return {
      success: true,
      messages,
      count: messages.length,
      url: location.href,
      platform: this.platform,
    };
  }

  /** Format error result. */
  formatError(error) {
    return {
      success: false,
      error: error.message,
      url: location.href,
      platform: this.platform,
    };
  }
}

export default BaseScraper;

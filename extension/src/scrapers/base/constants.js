/**
 * Adapted from TheBluCoder/AI-chat-exporter
 * (https://github.com/TheBluCoder/AI-chat-exporter)
 * Copyright (c) 2024 AI Chat Exporter Contributors — MIT License.
 * See THIRD_PARTY_NOTICES.md at the repository root.
 */

// Scroll configuration
export const MAX_SCROLL_ATTEMPTS = 50;
export const SCROLL_DELAY_MS = 1500;
export const STABILITY_DELAY_MS = 500;
export const STABILITY_TIMEOUT_MS = 5000;

// Element wait configuration
export const DEFAULT_ELEMENT_WAIT_TIMEOUT_MS = 10000;
export const ELEMENT_POLL_INTERVAL_MS = 100;

// Scroll verification
export const SCROLL_WIGGLE_DELAY_MS = 150;
export const SCROLL_POSITION_TOLERANCE = 10;

// DOM stability probing (used by virtualization-aware scrapers)
export const DOM_STABILITY_POLL_MS = 75;

export const LOG_TEXT_PREVIEW_LENGTH = 50;

// Platform URL patterns（v1 范围：claude / chatgpt / deepseek）
export const PLATFORM_URL_PATTERNS = {
  CHATGPT: /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//,
  CLAUDE: /^https:\/\/claude\.ai\//,
  DEEPSEEK: /^https:\/\/chat\.deepseek\.com\//,
};

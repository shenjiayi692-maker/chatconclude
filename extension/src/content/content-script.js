/**
 * Content Script Bootstrap —— 入口保持极小，动态 import 业务模块。
 * （MV3 的 content_scripts 不支持 ES module，需经 web_accessible_resources 动态加载。
 *  该模式 adapted from TheBluCoder/AI-chat-exporter — MIT License。）
 */

async function bootstrap() {
  try {
    const handlerUrl = chrome.runtime.getURL('src/content/handler.js');
    const { initialize } = await import(handlerUrl);
    initialize();
  } catch (error) {
    console.error('[weekly-review-capture] Failed to bootstrap content script:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

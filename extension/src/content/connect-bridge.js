/**
 * 仅运行在官方连接页：把网页一次性生成的令牌写入 chrome.storage。
 * 网页与 content script 通过临时 DOM 节点通信；节点读取后立即删除。
 */

const PAYLOAD_ID = 'weekly-review-extension-connect-payload';
const CONNECT_EVENT = 'weekly-review-extension-connect';
const READY_EVENT = 'weekly-review-extension-ready';

document.documentElement.dataset.weeklyReviewExtension = 'ready';
window.dispatchEvent(new CustomEvent(READY_EVENT));

window.addEventListener(CONNECT_EVENT, async () => {
  const payloadNode = document.getElementById(PAYLOAD_ID);
  if (!payloadNode) return;

  let payload;
  try {
    payload = JSON.parse(payloadNode.textContent || '{}');
  } catch {
    payloadNode.remove();
    return;
  }
  payloadNode.remove();

  if (
    typeof payload.token !== 'string' ||
    !payload.token.startsWith('wr_') ||
    typeof payload.apiBase !== 'string' ||
    !payload.apiBase.startsWith('https://chat-conclude.vercel.app')
  ) {
    document.documentElement.dataset.weeklyReviewExtensionResult = 'error';
    window.dispatchEvent(new CustomEvent('weekly-review-extension-result'));
    return;
  }

  const result = await chrome.runtime.sendMessage({
    type: 'CONNECT_TOKEN',
    token: payload.token,
    apiBase: payload.apiBase,
  });
  document.documentElement.dataset.weeklyReviewExtensionResult = result?.ok ? 'ok' : 'error';
  window.dispatchEvent(new CustomEvent('weekly-review-extension-result'));
});

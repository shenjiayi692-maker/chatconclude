const CONSENT_VERSION = '2026-07-30';
const isEnglish = !navigator.language.toLowerCase().startsWith('zh');

const copy = isEnglish
  ? {
      title: 'Weekly Knowledge Review',
      subtitle: 'Conversation capture',
      consentLabel: 'Before you begin',
      consentTitle: 'You choose what gets saved',
      consentDisclosure:
        'Only after you click save, the extension reads the questions and answers you select from the current AI conversation and uploads them over an encrypted connection to your Weekly Knowledge Review account to create reviews and quizzes.',
      consentPointOne: 'No background capture or browsing-history monitoring',
      consentPointTwo: 'No data sales or advertising use',
      consentPointThree: 'Disconnect and clear local data at any time',
      consentCheckboxLabel: 'I understand and agree to this collection and use',
      acceptConsent: 'Agree and continue',
      privacyLink: 'Read the full privacy notice',
      statusChecking: 'Checking connection…',
      connect: 'Connect account',
      connectHint: 'Sign in on the website and connect automatically—no token copying.',
      captureLabel: 'Current conversation',
      saveAll: 'Save full conversation',
      saveAllHint: 'Or close this popup and use the button on the page to save only selected messages.',
      manualSummary: 'Manual setup and troubleshooting',
      apiBaseLabel: 'Service URL',
      tokenLabel: 'Access token',
      tokenPlaceholder: 'Paste your access token',
      tokenHint: 'The token is stored only in this browser.',
      save: 'Save and verify',
      disconnect: 'Disconnect and clear local data',
      footerPrivacyLink: 'Privacy',
      connected: 'Connected',
      noToken: 'Account not connected yet.',
      unauthorized: 'Connection expired. Please reconnect.',
      unavailable: 'Service unavailable',
      savedVerifying: 'Saved. Verifying…',
      queued: (count) => ` · ${count} pending ${count === 1 ? 'upload' : 'uploads'}`,
      grabbing: 'Reading this conversation…',
      noTab: 'Could not find the active tab.',
      unsupported: 'Open a Claude, ChatGPT, or DeepSeek conversation first.',
      saved: (saved, duplicates, rejected) =>
        `Saved ${saved}${duplicates ? ` · ${duplicates} duplicates skipped` : ''}${rejected ? ` · ${rejected} not saved because storage is full` : ''}`,
      failed: 'Could not save this conversation.',
    }
  : {
      title: '每周知识复习',
      subtitle: '对话采集',
      consentLabel: '开始前请确认',
      consentTitle: '你决定保存什么',
      consentDisclosure:
        '只有当你点击保存时，扩展才会读取当前 AI 会话中你选择的提问和回答，并通过加密连接上传到你的每周知识复习账号，用于生成周报和测验。',
      consentPointOne: '不会后台采集或监控浏览记录',
      consentPointTwo: '不会出售数据或用于广告',
      consentPointThree: '可随时断开并清空本地数据',
      consentCheckboxLabel: '我了解并同意以上采集和使用方式',
      acceptConsent: '同意并继续',
      privacyLink: '查看完整隐私说明',
      statusChecking: '检查连接中…',
      connect: '连接账号',
      connectHint: '打开网站登录后自动连接，无需复制令牌。',
      captureLabel: '当前会话',
      saveAll: '存整段对话',
      saveAllHint: '也可以关闭弹窗，使用页面右下角按钮只保存选中的消息。',
      manualSummary: '手动配置与故障排查',
      apiBaseLabel: '服务地址',
      tokenLabel: '接入令牌',
      tokenPlaceholder: '粘贴你的接入令牌',
      tokenHint: '令牌只保存在本机浏览器中。',
      save: '保存并验证',
      disconnect: '断开连接并清空本地数据',
      footerPrivacyLink: '隐私说明',
      connected: '已连接',
      noToken: '还没有连接账号。',
      unauthorized: '连接已失效，请重新连接。',
      unavailable: '无法连接服务',
      savedVerifying: '已保存，正在验证…',
      queued: (count) => ` · ${count} 批待补发`,
      grabbing: '正在读取当前会话…',
      noTab: '找不到当前标签页。',
      unsupported: '请先打开 Claude、ChatGPT 或 DeepSeek 的对话页。',
      saved: (saved, duplicates, rejected) =>
        `已存 ${saved} 条${duplicates ? ` · 重复跳过 ${duplicates} 条` : ''}${rejected ? ` · 容量已满，未存 ${rejected} 条` : ''}`,
      failed: '保存失败，请稍后重试。',
    };

const apiBaseInput = document.getElementById('apiBase');
const tokenInput = document.getElementById('token');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const connectionDot = document.getElementById('connectionDot');
const saveAllBtn = document.getElementById('saveAll');
const resultEl = document.getElementById('result');
const connectBtn = document.getElementById('connect');
const disconnectBtn = document.getElementById('disconnect');
const consentCard = document.getElementById('consentCard');
const appContent = document.getElementById('appContent');
const consentCheckbox = document.getElementById('consentCheckbox');
const acceptConsentBtn = document.getElementById('acceptConsent');

function applyCopy() {
  document.documentElement.lang = isEnglish ? 'en' : 'zh-CN';
  const ids = [
    'title',
    'subtitle',
    'consentLabel',
    'consentTitle',
    'consentDisclosure',
    'consentPointOne',
    'consentPointTwo',
    'consentPointThree',
    'consentCheckboxLabel',
    'acceptConsent',
    'privacyLink',
    'connect',
    'connectHint',
    'captureLabel',
    'saveAll',
    'saveAllHint',
    'manualSummary',
    'apiBaseLabel',
    'tokenLabel',
    'tokenHint',
    'save',
    'disconnect',
    'footerPrivacyLink',
  ];
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = copy[id];
  });
  tokenInput.placeholder = copy.tokenPlaceholder;
  statusEl.textContent = copy.statusChecking;
}

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
  connectionDot.className = `connection-dot ${cls}`;
}

function setResult(text, cls = '') {
  resultEl.textContent = text;
  resultEl.className = `status ${cls}`;
}

async function hasCurrentConsent() {
  const { dataConsentVersion } = await chrome.storage.local.get('dataConsentVersion');
  return dataConsentVersion === CONSENT_VERSION;
}

async function renderConsentState() {
  const accepted = await hasCurrentConsent();
  consentCard.hidden = accepted;
  appContent.hidden = !accepted;
  return accepted;
}

async function refreshStatus() {
  const ping = await chrome.runtime.sendMessage({ type: 'PING_API' });
  const queue = await chrome.runtime.sendMessage({ type: 'QUEUE_STATUS' });
  const queueText = queue?.pending > 0 ? copy.queued(queue.pending) : '';

  if (ping?.ok) {
    setStatus(`${copy.connected}${queueText}`, 'ok');
  } else if (ping?.error === 'no_token') {
    setStatus(copy.noToken, 'error');
  } else if (ping?.error === 'unauthorized') {
    setStatus(copy.unauthorized, 'error');
  } else {
    setStatus(`${copy.unavailable}${queueText}`, 'error');
  }
}

async function init() {
  applyCopy();
  if (!(await renderConsentState())) return;
  const { apiBase, token } = await chrome.storage.local.get(['apiBase', 'token']);
  if (apiBase) apiBaseInput.value = apiBase;
  if (token) tokenInput.value = token;
  await refreshStatus();
}

consentCheckbox.addEventListener('change', () => {
  acceptConsentBtn.disabled = !consentCheckbox.checked;
});

acceptConsentBtn.addEventListener('click', async () => {
  if (!consentCheckbox.checked) return;
  await chrome.runtime.sendMessage({
    type: 'GRANT_DATA_CONSENT',
    version: CONSENT_VERSION,
  });
  await renderConsentState();
  await refreshStatus();
});

saveBtn.addEventListener('click', async () => {
  const apiBase = apiBaseInput.value.trim().replace(/\/+$/, '') || 'https://chat-conclude.vercel.app';
  const token = tokenInput.value.trim();
  await chrome.storage.local.set({ apiBase, token });
  setStatus(copy.savedVerifying);
  await refreshStatus();
});

connectBtn.addEventListener('click', async () => {
  await chrome.tabs.create({ url: 'https://chat-conclude.vercel.app/app/setup/extension' });
  window.close();
});

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_LOCAL_DATA' });
  apiBaseInput.value = '';
  tokenInput.value = '';
  consentCheckbox.checked = false;
  acceptConsentBtn.disabled = true;
  setResult('');
  await renderConsentState();
});

saveAllBtn.addEventListener('click', async () => {
  if (!(await hasCurrentConsent())) {
    await renderConsentState();
    return;
  }

  saveAllBtn.disabled = true;
  setResult(copy.grabbing);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setResult(copy.noTab, 'error');
      return;
    }

    const resp = await chrome.tabs.sendMessage(tab.id, { action: 'SAVE_ALL' }).catch(() => null);
    if (!resp) {
      setResult(copy.unsupported, 'error');
      return;
    }

    if (resp.ok) {
      setResult(copy.saved(resp.saved, resp.duplicates, resp.rejected), resp.rejected > 0 ? 'error' : 'ok');
    } else {
      setResult(resp.error || copy.failed, 'error');
    }
  } finally {
    saveAllBtn.disabled = false;
    refreshStatus();
  }
});

init();

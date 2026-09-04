/**
 * 页面交互层：浮动按钮「存入复习」+ 选中模式 + 保存链路 + popup 消息路由。
 *
 * 选中模式的高亮/点选/横幅交互 adapted from TheBluCoder/AI-chat-exporter
 * (content/handler.js) — MIT License. See THIRD_PARTY_NOTICES.md.
 * 相对上游的改造：文案中文化；出口从「导出文件」改为 normalize + INGEST 上送；
 * 增加 DeepSeek 平台候选；增加页面浮动按钮与轻提示。
 */

import { createScraper, getConversationId } from '../scrapers/init.js';
import { toNormalizedItems } from '../lib/normalize.js';

const SELECTABLE_ATTR = 'data-wr-selectable';
const SELECTED_ATTR = 'data-wr-selected';
const TURN_INDEX_ATTR = 'data-wr-turn-index';
const ROLE_ATTR = 'data-wr-role';
const STYLE_ID = 'wr-capture-style';
const BANNER_ID = 'wr-capture-banner';
const FAB_ID = 'wr-capture-fab';
const TOAST_ID = 'wr-capture-toast';
const CONSENT_ID = 'wr-capture-consent';
const CONSENT_VERSION = '2026-07-30';
const isEnglish = !navigator.language.toLowerCase().startsWith('zh');
const ui = isEnglish
  ? {
      bannerEmpty: 'Selection mode: click highlighted messages to select them. Click again to deselect, then use “Save selected”.',
      bannerCount: (count) => `${count} selected. Use “Save selected” or keep selecting messages.`,
      saving: 'Saving…',
      saveToReview: 'Save to review',
      saveSelected: (count) => `Save selected (${count})`,
      nothingSelected: 'Select at least one highlighted message first.',
      cancel: 'Cancel',
      noCandidates: 'No messages found. Open a conversation with some content first.',
      noResponse: 'Save failed: the extension background did not respond.',
      noConsent: 'Review and accept the data disclosure first.',
      noToken: 'Connect your account from the extension popup first.',
      unauthorized: 'The connection expired. Reconnect from the extension popup.',
      payloadTooLarge: 'Too much content was selected. Save fewer messages and try again.',
      rateLimited: 'Too many saves in a short time. Please wait and try again.',
      queued: 'The network is unavailable. This save is queued and will retry automatically.',
      unknownFailure: (error) => `Save failed: ${error || 'unknown error'}`,
      selectedMismatch: 'The selected messages could not be matched. Please select them again.',
      noItems: 'No saveable question-and-answer pair was found. Select at least one question.',
      saved: (saved, duplicates, rejected) =>
        `Saved ${saved}${duplicates ? ` · ${duplicates} duplicates skipped` : ''}${rejected ? ` · ${rejected} not saved because storage is full` : ''}`,
      exception: (message) => `Save failed: ${message}`,
      busy: 'A save is already in progress. Please wait.',
    }
  : {
      bannerEmpty: '选中模式：点击页面里的消息进行选择，再点一次取消选择。选好后点右下角「存入所选」。',
      bannerCount: (count) => `已选 ${count} 条。点右下角「存入所选」保存，或继续点选消息。`,
      saving: '保存中…',
      saveToReview: '存入复习',
      saveSelected: (count) => `存入所选 (${count})`,
      nothingSelected: '还没选中任何消息——点击页面里高亮的消息即可选中。',
      cancel: '取消',
      noCandidates: '页面上没有找到可选的消息——先打开一个有内容的会话。',
      noResponse: '保存失败：插件后台无响应。',
      noConsent: '请先确认数据采集说明。',
      noToken: '请先在扩展弹窗中连接账号。',
      unauthorized: '连接已失效，请在扩展弹窗中重新连接。',
      payloadTooLarge: '选择的内容过多，请减少消息后重试。',
      rateLimited: '保存过于频繁，请稍后重试。',
      queued: '网络暂时不可用，已加入重试队列，恢复后自动补发。',
      unknownFailure: (error) => `保存失败：${error || '未知错误'}`,
      selectedMismatch: '选中的消息没能匹配到内容，请重新选择。',
      noItems: '没有配对出可保存的问答——至少要选中一条提问。',
      saved: (saved, duplicates, rejected) =>
        `已存 ${saved} 条${duplicates ? ` · 重复跳过 ${duplicates} 条` : ''}${rejected ? ` · 容量已满，未存 ${rejected} 条` : ''}`,
      exception: (message) => `保存失败：${message}`,
      busy: '正在保存中，稍等片刻。',
    };

let ctx = null; // { platform, scraper }
let selectionModeActive = false;
let selectedKeys = [];
let selectableNodes = [];
let saving = false;

/* ---------- 样式与基础 UI ---------- */

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [${SELECTABLE_ATTR}="1"] { outline: 2px dashed #38bdf8 !important; outline-offset: 2px; cursor: pointer !important; }
    [${SELECTED_ATTR}="1"] { outline: 3px solid #22c55e !important; box-shadow: 0 0 0 2px rgba(34,197,94,0.2) !important; }
    #${BANNER_ID} { position: fixed; top: 16px; right: 16px; z-index: 2147483647; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.5; max-width: 320px; }
    #${FAB_ID} { position: fixed; bottom: 24px; right: 24px; z-index: 2147483646; display: flex; gap: 8px; align-items: center; }
    #${FAB_ID} button { border: none; border-radius: 9999px; padding: 10px 16px; font-size: 13px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
    #${FAB_ID} .wr-primary { background: #0f172a; color: #fff; }
    #${FAB_ID} .wr-secondary { background: #e2e8f0; color: #0f172a; }
    #${TOAST_ID} { position: fixed; bottom: 80px; right: 24px; z-index: 2147483647; background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 13px; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }
    #${CONSENT_ID} { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; padding: 20px; background: rgba(9,9,11,0.6); backdrop-filter: blur(4px); }
    #${CONSENT_ID} .wr-consent-card { width: min(420px, 100%); border: 1px solid #e4e4e7; border-radius: 18px; padding: 22px; color: #18181b; background: #fff; box-shadow: 0 24px 60px rgba(0,0,0,0.25); font: 13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; }
    #${CONSENT_ID} h2 { margin: 0 0 8px; color: #18181b; font-size: 20px; line-height: 1.35; }
    #${CONSENT_ID} p { margin: 0; color: #52525b; }
    #${CONSENT_ID} ul { display: grid; gap: 6px; margin: 14px 0; padding: 0; color: #3f3f46; list-style: none; }
    #${CONSENT_ID} li::before { margin-right: 7px; color: #059669; content: "✓"; font-weight: 700; }
    #${CONSENT_ID} label { display: flex; align-items: flex-start; gap: 8px; margin: 14px 0; color: #27272a; cursor: pointer; }
    #${CONSENT_ID} input { margin-top: 4px; accent-color: #18181b; }
    #${CONSENT_ID} .wr-consent-actions { display: flex; gap: 8px; }
    #${CONSENT_ID} button { flex: 1; border: 0; border-radius: 9px; padding: 10px 12px; font: inherit; font-weight: 600; cursor: pointer; }
    #${CONSENT_ID} button:disabled { opacity: .45; cursor: not-allowed; }
    #${CONSENT_ID} .wr-consent-accept { color: #fff; background: #18181b; }
    #${CONSENT_ID} .wr-consent-cancel { color: #27272a; background: #e4e4e7; }
    #${CONSENT_ID} a { display: inline-block; margin-top: 12px; color: #52525b; font-size: 11px; text-underline-offset: 2px; }
  `;
  document.documentElement.appendChild(style);
}

async function ensureDataConsent() {
  const state = await chrome.runtime.sendMessage({ type: 'CHECK_DATA_CONSENT' });
  if (state?.accepted) return true;

  ensureStyle();
  return new Promise((resolve) => {
    document.getElementById(CONSENT_ID)?.remove();
    const overlay = document.createElement('div');
    overlay.id = CONSENT_ID;

    const card = document.createElement('section');
    card.className = 'wr-consent-card';

    const title = document.createElement('h2');
    title.textContent = isEnglish ? 'You choose what gets saved' : '你决定保存什么';

    const disclosure = document.createElement('p');
    disclosure.textContent = isEnglish
      ? 'Only after you click save, the extension reads the questions and answers you select from this AI conversation and uploads them over an encrypted connection to your Weekly Knowledge Review account to create reviews and quizzes.'
      : '只有当你点击保存时，扩展才会读取当前 AI 会话中你选择的提问和回答，并通过加密连接上传到你的每周知识复习账号，用于生成周报和测验。';

    const points = document.createElement('ul');
    const pointCopy = isEnglish
      ? ['No background capture or browsing-history monitoring', 'No data sales or advertising use', 'Disconnect and delete your data at any time']
      : ['不会后台采集或监控浏览记录', '不会出售数据或用于广告', '可随时断开并删除数据'];
    pointCopy.forEach((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      points.appendChild(item);
    });

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const labelText = document.createElement('span');
    labelText.textContent = isEnglish
      ? 'I understand and agree to this collection and use'
      : '我了解并同意以上采集和使用方式';
    label.append(checkbox, labelText);

    const actions = document.createElement('div');
    actions.className = 'wr-consent-actions';
    const cancel = document.createElement('button');
    cancel.className = 'wr-consent-cancel';
    cancel.textContent = isEnglish ? 'Not now' : '暂不使用';
    const accept = document.createElement('button');
    accept.className = 'wr-consent-accept';
    accept.textContent = isEnglish ? 'Agree and continue' : '同意并继续';
    accept.disabled = true;
    actions.append(cancel, accept);

    const privacy = document.createElement('a');
    privacy.href = 'https://chat-conclude.vercel.app/privacy';
    privacy.target = '_blank';
    privacy.rel = 'noreferrer';
    privacy.textContent = isEnglish ? 'Read the full privacy notice' : '查看完整隐私说明';

    checkbox.addEventListener('change', () => {
      accept.disabled = !checkbox.checked;
    });
    cancel.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    accept.addEventListener('click', async () => {
      if (!checkbox.checked) return;
      const result = await chrome.runtime.sendMessage({
        type: 'GRANT_DATA_CONSENT',
        version: CONSENT_VERSION,
      });
      overlay.remove();
      resolve(Boolean(result?.ok));
    });

    card.append(title, disclosure, points, label, actions, privacy);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function showToast(text, ms = 4000) {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.remove(), ms);
}

function updateBanner() {
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    document.body.appendChild(banner);
  }
  const count = selectedKeys.length;
  banner.textContent = count === 0
    ? ui.bannerEmpty
    : ui.bannerCount(count);
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

/* ---------- 浮动按钮 ---------- */

function renderFab() {
  ensureStyle();
  let fab = document.getElementById(FAB_ID);
  if (!fab) {
    fab = document.createElement('div');
    fab.id = FAB_ID;
    document.body.appendChild(fab);
  }
  fab.replaceChildren();

  const primary = document.createElement('button');
  primary.className = 'wr-primary';

  if (saving) {
    primary.textContent = ui.saving;
    primary.disabled = true;
    fab.appendChild(primary);
    return;
  }

  if (!selectionModeActive) {
    primary.textContent = ui.saveToReview;
    primary.addEventListener('click', async () => {
      if (!(await ensureDataConsent())) return;
      const started = enterSelectionMode();
      if (!started.success) showToast(started.error);
      renderFab();
    });
    fab.appendChild(primary);
  } else {
    primary.textContent = ui.saveSelected(selectedKeys.length);
    primary.addEventListener('click', () => {
      if (!selectedKeys.length) {
        showToast(ui.nothingSelected);
        return;
      }
      saveSelected();
    });

    const cancel = document.createElement('button');
    cancel.className = 'wr-secondary';
    cancel.textContent = ui.cancel;
    cancel.addEventListener('click', () => {
      exitSelectionMode();
      renderFab();
    });

    fab.appendChild(primary);
    fab.appendChild(cancel);
  }
}

/* ---------- 选中模式 ---------- */

function candidateKey(turnIndex, role) {
  return `${turnIndex}:${role}`;
}

/** 按平台列出可选消息节点。role/turnIndex 与各 scraper 的产出保持一致，供后续过滤。 */
function getSelectionCandidates() {
  const { platform, scraper } = ctx;
  const s = scraper.selectors;

  if (platform.source === 'chatgpt') {
    const turns = Array.from(document.querySelectorAll(s.ARTICLE_TURN));
    return turns.map((turn) => {
      const rawRole = turn.getAttribute('data-turn');
      const role = rawRole === 'assistant' ? 'model' : rawRole || 'unknown';
      return { node: turn, role, turnIndex: scraper.parseTurnIndex(turn) };
    });
  }

  if (platform.source === 'claude') {
    const rows = [];
    const groups = Array.from(document.querySelectorAll(s.MESSAGE_TURN));
    groups.forEach((group, idx) => {
      const user = group.querySelector(s.USER_QUERY);
      const model = group.querySelector(s.MODEL_RESPONSE);
      if (user) rows.push({ node: user, role: 'user', turnIndex: idx });
      if (model) rows.push({ node: model, role: 'model', turnIndex: idx });
    });
    return rows;
  }

  if (platform.source === 'deepseek') {
    const rows = [];
    const items = Array.from(document.querySelectorAll(s.ARTICLE_TURN));
    items.forEach((item) => {
      const key = Number.parseInt(item.getAttribute('data-virtual-list-item-key') || '', 10);
      const base = Number.isFinite(key) ? key : 0;
      const user = scraper.findUserElement(item);
      const model = item.querySelector(s.MODEL_RESPONSE_MAIN) || item.querySelector(s.MODEL_RESPONSE);
      if (user) rows.push({ node: user, role: 'user', turnIndex: base * 2 });
      if (model) rows.push({ node: model, role: 'model', turnIndex: base * 2 + 1 });
    });
    return rows;
  }

  return [];
}

function handleSelectionClick(event) {
  const target = event.target?.closest?.(`[${SELECTABLE_ATTR}="1"]`);
  if (!target) return;

  event.preventDefault();
  event.stopPropagation();

  const key = candidateKey(target.getAttribute(TURN_INDEX_ATTR), target.getAttribute(ROLE_ATTR));
  const existingIdx = selectedKeys.indexOf(key);
  if (existingIdx >= 0) {
    selectedKeys.splice(existingIdx, 1);
    target.setAttribute(SELECTED_ATTR, '0');
  } else {
    selectedKeys.push(key);
    target.setAttribute(SELECTED_ATTR, '1');
  }
  updateBanner();
  renderFab();
}

function enterSelectionMode() {
  ensureStyle();
  const candidates = getSelectionCandidates();
  if (!candidates.length) {
    return { success: false, error: ui.noCandidates };
  }

  selectionModeActive = true;
  selectedKeys = [];
  selectableNodes = [];

  candidates.forEach(({ node, role, turnIndex }) => {
    if (!node?.setAttribute) return;
    node.setAttribute(SELECTABLE_ATTR, '1');
    node.setAttribute(SELECTED_ATTR, '0');
    node.setAttribute(TURN_INDEX_ATTR, String(turnIndex));
    node.setAttribute(ROLE_ATTR, role);
    selectableNodes.push(node);
  });

  document.addEventListener('click', handleSelectionClick, true);
  updateBanner();
  return { success: true };
}

function exitSelectionMode() {
  selectionModeActive = false;
  selectedKeys = [];
  selectableNodes.forEach((node) => {
    try {
      node.removeAttribute(SELECTABLE_ATTR);
      node.removeAttribute(SELECTED_ATTR);
      node.removeAttribute(TURN_INDEX_ATTR);
      node.removeAttribute(ROLE_ATTR);
    } catch (_err) { /* node 可能已被虚拟列表卸载 */ }
  });
  selectableNodes = [];
  document.removeEventListener('click', handleSelectionClick, true);
  removeBanner();
}

/* ---------- 保存链路 ---------- */

function ingestErrorText(resp) {
  if (!resp) return ui.noResponse;
  if (resp.error === 'no_consent') return ui.noConsent;
  if (resp.error === 'no_token') return ui.noToken;
  if (resp.error === 'unauthorized') return ui.unauthorized;
  if (resp.error === 'payload_too_large') return ui.payloadTooLarge;
  if (resp.error === 'rate_limited') return ui.rateLimited;
  if (resp.queued) return ui.queued;
  return ui.unknownFailure(resp.error);
}

async function scrapeAndIngest({ selectedOnly }) {
  const { platform, scraper } = ctx;

  const result = await scraper.scrape({ skipScroll: selectedOnly });
  if (!result.success) {
    return { ok: false, error: result.error };
  }

  let messages = result.messages;
  if (selectedOnly) {
    const keySet = new Set(selectedKeys);
    messages = messages.filter((m) => keySet.has(candidateKey(m.turn_index, m.role)));
    if (!messages.length) {
      return { ok: false, error: ui.selectedMismatch };
    }
  }

  const items = await toNormalizedItems(messages, {
    source: platform.source,
    conversationId: getConversationId(platform),
    conversationTitle: document.title || undefined,
  });

  if (!items.length) {
    return { ok: false, error: ui.noItems };
  }

  const resp = await chrome.runtime.sendMessage({ type: 'INGEST', items });
  if (resp?.ok) {
    return {
      ok: true,
      saved: resp.saved,
      duplicates: resp.duplicates,
      rejected: resp.rejected ?? 0,
      total: items.length,
    };
  }
  return { ok: false, error: ingestErrorText(resp), raw: resp };
}

async function saveSelected() {
  if (saving) return;
  saving = true;
  renderFab();

  try {
    const outcome = await scrapeAndIngest({ selectedOnly: true });
    if (outcome.ok) {
      showToast(ui.saved(outcome.saved, outcome.duplicates, outcome.rejected));
      exitSelectionMode();
    } else {
      showToast(outcome.error);
    }
  } catch (err) {
    showToast(ui.exception(err.message));
  } finally {
    saving = false;
    renderFab();
  }
}

/* ---------- popup 消息路由 ---------- */

export function initialize() {
  ctx = createScraper();
  if (!ctx) return; // 不支持的页面（manifest matches 应该已挡住）

  renderFab();

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'SAVE_ALL') {
      (async () => {
        if (!(await ensureDataConsent())) {
          sendResponse({
            ok: false,
            error: isEnglish
              ? 'Please review and accept the data disclosure first.'
              : '请先查看并同意数据采集说明。',
          });
          return;
        }
        if (saving) {
          sendResponse({ ok: false, error: ui.busy });
          return;
        }
        saving = true;
        renderFab();
        try {
          const outcome = await scrapeAndIngest({ selectedOnly: false });
          if (outcome.ok) {
            showToast(ui.saved(outcome.saved, outcome.duplicates, outcome.rejected));
          } else {
            showToast(outcome.error);
          }
          sendResponse(outcome);
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        } finally {
          saving = false;
          renderFab();
        }
      })();
      return true;
    }

    if (request.action === 'PING') {
      sendResponse({ status: 'ready', platform: ctx.platform.source });
      return true;
    }

    return false;
  });
}

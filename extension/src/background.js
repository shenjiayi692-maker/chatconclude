/**
 * Background service worker：唯一的网络出口。
 * - 收 content script 的 INGEST → 带 Bearer token POST 到 ingest API
 * - 网络失败/5xx 入 storage 队列，chrome.alarms 定时补发（SW 无状态，不靠内存排队）
 * - 4xx（令牌无效、请求过大等）不入队，直接把错误返回给页面提示用户
 * - 收 popup 的 PING_API → GET /api/ingest/ping 验证令牌
 */

const DEFAULT_API_BASE = 'https://chat-conclude.vercel.app';
const QUEUE_KEY = 'ingestQueue';
const RETRY_ALARM = 'wr-ingest-retry';
const RETRY_PERIOD_MINUTES = 1;
const MAX_QUEUE_LENGTH = 20;
const MAX_ATTEMPTS = 8;
const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PAYLOAD_CHARS = 250_000;
const CONSENT_VERSION = '2026-07-30';

async function hasDataConsent() {
  const { dataConsentVersion } = await chrome.storage.local.get('dataConsentVersion');
  return dataConsentVersion === CONSENT_VERSION;
}

async function getSettings() {
  const { apiBase, token } = await chrome.storage.local.get(['apiBase', 'token']);
  return { apiBase: (apiBase || DEFAULT_API_BASE).replace(/\/+$/, ''), token: token || '' };
}

async function postItems(items) {
  if (!(await hasDataConsent())) return { ok: false, error: 'no_consent' };

  const { apiBase, token } = await getSettings();
  if (!token) return { ok: false, error: 'no_token' };

  const payload = JSON.stringify({ items });
  if (!Array.isArray(items) || items.length === 0 || items.length > 200 || payload.length > MAX_PAYLOAD_CHARS) {
    return { ok: false, error: 'payload_too_large' };
  }

  let res;
  try {
    res = await fetch(`${apiBase}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: payload,
    });
  } catch (err) {
    return { ok: false, error: 'network', retriable: true, detail: String(err) };
  }

  if (res.status === 401) return { ok: false, error: 'unauthorized' };
  if (res.status === 429) return { ok: false, error: 'rate_limited', retriable: true };
  if (res.status >= 500) return { ok: false, error: `server_${res.status}`, retriable: true };
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error || '';
    } catch (_e) { /* 非 JSON 响应 */ }
    return { ok: false, error: detail || `http_${res.status}` };
  }

  const data = await res.json();
  return {
    ok: true,
    saved: data.saved ?? 0,
    duplicates: data.duplicates ?? 0,
    rejected: data.rejected ?? 0,
  };
}

/* ---------- 重试队列（storage 持久化，与 SW 生命周期解耦） ---------- */

async function getQueue() {
  const { [QUEUE_KEY]: queue } = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(queue) ? queue : [];
}

async function setQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  if (queue.length > 0) {
    chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_PERIOD_MINUTES });
  } else {
    chrome.alarms.clear(RETRY_ALARM);
  }
}

async function enqueue(items) {
  const queue = await getQueue();
  if (queue.length >= MAX_QUEUE_LENGTH) return false;
  queue.push({ items, attempts: 0, enqueuedAt: Date.now() });
  try {
    await setQueue(queue);
    return true;
  } catch {
    return false;
  }
}

async function drainQueue() {
  const queue = await getQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const entry of queue) {
    if (
      typeof entry.enqueuedAt !== 'number' ||
      Date.now() - entry.enqueuedAt > MAX_QUEUE_AGE_MS
    ) {
      continue;
    }
    const result = await postItems(entry.items);
    if (result.ok) continue; // 服务端幂等去重，重复补发无害
    if (result.retriable) {
      entry.attempts += 1;
      if (entry.attempts < MAX_ATTEMPTS) {
        remaining.push(entry);
      }
      // 超过次数上限丢弃；popup 会显示队列数量变化，属可见失败
    }
    // 不可重试的错误（如令牌失效）：保留在队列里等用户修好令牌后继续补发
    if (
      result.error === 'unauthorized' ||
      result.error === 'no_token' ||
      result.error === 'no_consent'
    ) {
      remaining.push(entry);
    }
  }
  await setQueue(remaining);
}

/* ---------- 消息路由 ---------- */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_DATA_CONSENT') {
    (async () => {
      sendResponse({ ok: true, accepted: await hasDataConsent(), version: CONSENT_VERSION });
    })();
    return true;
  }

  if (message.type === 'GRANT_DATA_CONSENT') {
    (async () => {
      if (message.version !== CONSENT_VERSION) {
        sendResponse({ ok: false });
        return;
      }
      await chrome.storage.local.set({
        dataConsentVersion: CONSENT_VERSION,
        dataConsentAcceptedAt: new Date().toISOString(),
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'CONNECT_TOKEN') {
    (async () => {
      if (
        typeof message.token !== 'string' ||
        !message.token.startsWith('wr_') ||
        typeof message.apiBase !== 'string' ||
        !message.apiBase.startsWith(DEFAULT_API_BASE)
      ) {
        sendResponse({ ok: false });
        return;
      }
      await chrome.storage.local.set({
        token: message.token,
        apiBase: DEFAULT_API_BASE,
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'INGEST') {
    (async () => {
      const result = await postItems(message.items);
      if (result.ok) {
        sendResponse(result);
        return;
      }
      if (result.retriable) {
        const queued = await enqueue(message.items);
        sendResponse({ ...result, queued });
        return;
      }
      sendResponse(result);
    })();
    return true;
  }

  if (message.type === 'PING_API') {
    (async () => {
      const { apiBase, token } = await getSettings();
      if (!token) {
        sendResponse({ ok: false, error: 'no_token' });
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/ingest/ping`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) sendResponse({ ok: true });
        else if (res.status === 401) sendResponse({ ok: false, error: 'unauthorized' });
        else sendResponse({ ok: false, error: `http_${res.status}` });
      } catch (err) {
        sendResponse({ ok: false, error: 'network', detail: String(err) });
      }
    })();
    return true;
  }

  if (message.type === 'QUEUE_STATUS') {
    (async () => {
      const queue = await getQueue();
      sendResponse({ pending: queue.length });
    })();
    return true;
  }

  if (message.type === 'CLEAR_LOCAL_DATA') {
    (async () => {
      await chrome.storage.local.remove([
        'token',
        'apiBase',
        QUEUE_KEY,
        'dataConsentVersion',
        'dataConsentAcceptedAt',
      ]);
      await chrome.alarms.clear(RETRY_ALARM);
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) {
    drainQueue();
  }
});

// SW 冷启动时若有积压，恢复重试闹钟
chrome.runtime.onStartup?.addListener(async () => {
  const queue = await getQueue();
  if (queue.length > 0) {
    chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_PERIOD_MINUTES });
  }
});

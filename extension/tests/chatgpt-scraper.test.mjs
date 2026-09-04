import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from './helpers.mjs';

test('ChatGPTScraper：skipScroll 模式抽出已挂载的 turn', async () => {
  const { document } = loadFixture('chatgpt-chat.html');
  const { ChatGPTScraper } = await import('../src/scrapers/platforms/ChatGPTScraper.js');

  const scraper = new ChatGPTScraper();
  const messages = await scraper.extractAllMessages(document.querySelector('main'), { skipScroll: true });

  assert.equal(messages.length, 4);

  assert.equal(messages[0].role, 'user');
  assert.match(messages[0].content, /三次握手/);
  assert.equal(messages[0].turn_index, 1); // 来自 data-testid="conversation-turn-1"
  assert.equal(messages[0].turn_id, 'turn-u-1');

  assert.equal(messages[1].role, 'model');
  assert.match(messages[1].content, /SYN_RECV/);
  // 代码块：语言取自 UI 头部标签，Copy 按钮被剥掉
  assert.match(messages[1].content, /```bash/);
  assert.match(messages[1].content, /tcp_synack_retries/);
  assert.doesNotMatch(messages[1].content, /Copy/);

  assert.equal(messages[2].role, 'user');
  assert.equal(messages[3].role, 'model');
});

test('ChatGPTScraper：data-turn-id 去重（重复收割不产生重复消息）', async () => {
  const { document } = loadFixture('chatgpt-chat.html');
  const { ChatGPTScraper } = await import('../src/scrapers/platforms/ChatGPTScraper.js');

  const scraper = new ChatGPTScraper();
  const main = document.querySelector('main');

  const allMessages = new Map();
  const seen = new Set();
  await scraper.captureVisibleTurns(main, allMessages, seen);
  await scraper.captureVisibleTurns(main, allMessages, seen); // 模拟滚动中重复收割

  assert.equal(allMessages.size, 4);
});

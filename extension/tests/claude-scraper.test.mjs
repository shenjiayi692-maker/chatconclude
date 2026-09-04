import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from './helpers.mjs';

test('ClaudeScraper：从 fixture 抽出配对的用户/模型消息', async () => {
  const { document } = loadFixture('claude-chat.html');
  const { ClaudeScraper } = await import('../src/scrapers/platforms/ClaudeScraper.js');

  const scraper = new ClaudeScraper();
  const messages = await scraper.extractAllMessages(document.querySelector('main'));

  assert.equal(messages.length, 4);

  assert.equal(messages[0].role, 'user');
  assert.match(messages[0].content, /向量数据库/);

  assert.equal(messages[1].role, 'model');
  assert.match(messages[1].content, /语义相似度/);
  // 代码块保真：转成了 markdown 围栏并带语言标签
  assert.match(messages[1].content, /```python/);
  assert.match(messages[1].content, /hybrid_search/);
  // 按钮等噪声被剥掉
  assert.doesNotMatch(messages[1].content, /复制/);

  assert.equal(messages[2].role, 'user');
  assert.match(messages[2].content, /自我介绍/);

  // 旧类名 .font-claude-message 兼容
  assert.equal(messages[3].role, 'model');
  assert.match(messages[3].content, /润色后的版本/);
});

test('ClaudeScraper：turn_index 单调且同轮共享', async () => {
  const { document } = loadFixture('claude-chat.html');
  const { ClaudeScraper } = await import('../src/scrapers/platforms/ClaudeScraper.js');

  const scraper = new ClaudeScraper();
  const messages = await scraper.extractAllMessages(document.querySelector('main'));

  const indices = messages.map((m) => m.turn_index);
  assert.deepEqual([...indices].sort((a, b) => a - b), indices);
});

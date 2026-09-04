import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from './helpers.mjs';

// 真实 chatgpt.com DOM 的抓取保真度回归。用于确认：
// - 空的 turn（conversation-turn-1）被跳过
// - 用户消息原文（含用户自己粘贴丢空格的内容）如实抽出，不再额外损坏
// - 助手回答的有序/无序列表结构不塌成一行
// - 操作按钮（Copy/Good/Bad）被剥掉
test('ChatGPTScraper：真实 genome 会话抽取保真', async () => {
  const { document } = loadFixture('chatgpt-real-genome.html');
  const { ChatGPTScraper } = await import('../src/scrapers/platforms/ChatGPTScraper.js');

  const scraper = new ChatGPTScraper();
  const messages = await scraper.extractAllMessages(document.querySelector('main'), { skipScroll: true });

  // conversation-turn-1 是空 user turn → 跳过；剩 3 条（assistant/user/assistant）
  assert.equal(messages.length, 3);

  assert.equal(messages[0].role, 'model');
  assert.equal(messages[0].turn_index, 2);
  assert.match(messages[0].content, /The information provided seems to be in a textual format/);
  // 有序列表项没塌成一行
  assert.match(messages[0].content, /6\.37\/6\.27 \(female\/male\) Gigabase pairs/);

  assert.equal(messages[1].role, 'user');
  assert.equal(messages[1].turn_index, 3);
  // 用户粘贴时就没空格——如实保留，不是抓取额外损坏
  assert.match(messages[1].content, /Give the textual format/);
  assert.match(messages[1].content, /AcompletesetofanorganismsDNAiscalleditsgenome/);
  // 换行/项目符号保留
  assert.match(messages[1].content, /• Humandiploidgenomeis/);

  assert.equal(messages[2].role, 'model');
  assert.equal(messages[2].turn_index, 4);
  assert.match(messages[2].content, /Certainly! Here's the information in a textual format/);
  // 无序列表 4 项都在
  assert.match(messages[2].content, /A complete set of an organism's DNA is called its genome\./);
  assert.match(messages[2].content, /present in the majority of cells in the body\./);

  // 操作按钮文案不混入正文
  for (const m of messages) {
    assert.doesNotMatch(m.content, /Copy response|Good response|Bad response|Copy message|Edit message/);
  }
});

// 走完整管线：真实消息 → normalize 配对
test('ChatGPT 真实会话 → normalize：配对与孤儿答案处理', async () => {
  const { document } = loadFixture('chatgpt-real-genome.html');
  const { ChatGPTScraper } = await import('../src/scrapers/platforms/ChatGPTScraper.js');
  const { toNormalizedItems } = await import('../src/lib/normalize.js');

  const scraper = new ChatGPTScraper();
  const messages = await scraper.extractAllMessages(document.querySelector('main'), { skipScroll: true });

  const items = await toNormalizedItems(messages, {
    source: 'chatgpt',
    conversationId: 'genome-conv',
    conversationTitle: 'Human Genome Details',
  });

  // turn-2 的助手回答没有前置提问（turn-1 空）→ 作为孤儿答案被丢弃。
  // 只剩 turn-3 提问 + turn-4 回答配成一条。
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'genome-conv#3');
  assert.match(items[0].question, /Give the textual format/);
  assert.match(items[0].answer, /Certainly! Here's the information/);
  assert.equal(items[0].source, 'chatgpt');
});

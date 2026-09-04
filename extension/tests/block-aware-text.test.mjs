import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture } from './helpers.mjs';

// 回归：真实 Chrome 里对「游离克隆」读 innerText 会退化成 textContent，块级换行全丢
// （DeepSeek 长答案的标题/列表糊成一行就是这个 bug）。blockAwareText 手动遍历补换行，
// 不依赖布局，textContent 做不到的断行它能做到。
test('blockAwareText：块级元素之间断行，textContent 做不到', async () => {
  const { document } = loadFixture('deepseek-blocks.html');
  const md = document.querySelector('.ds-markdown');

  // textContent 基线：标题「…预测」和列表首项「短期…」被糊在一起，没有分隔
  assert.match(md.textContent, /原油价格预测短期/);

  const { DeepSeekScraper } = await import('../src/scrapers/platforms/DeepSeekScraper.js');
  const scraper = new DeepSeekScraper();
  const text = scraper.blockAwareText(md.cloneNode(true));

  // 修复后：不再糊在一起，块之间有换行
  assert.doesNotMatch(text, /原油价格预测短期/);
  assert.match(text, /原油价格预测\n/);
  assert.match(text, /\n短期：布伦特原油/);
  // 三个列表项各自成段
  assert.match(text, /\n中期：/);
  assert.match(text, /\n长期：/);
  // 第二个标题也断开
  assert.match(text, /\n二、核心影响因素\n/);
});

test('DeepSeekScraper：块级答案经完整抽取后保留段落结构', async () => {
  const { document } = loadFixture('deepseek-blocks.html');
  const { DeepSeekScraper } = await import('../src/scrapers/platforms/DeepSeekScraper.js');
  const scraper = new DeepSeekScraper();

  const messages = await scraper.extractAllMessages(
    document.querySelector('.ds-scroll-area'),
    { skipScroll: true }
  );

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'user');
  assert.equal(messages[0].content, '原油价格预测');

  assert.equal(messages[1].role, 'model');
  // 关键：标题与列表项不粘连
  assert.doesNotMatch(messages[1].content, /预测短期/);
  assert.doesNotMatch(messages[1].content, /桶。中期/);
});

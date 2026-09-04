import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { loadFixture } from './helpers.mjs';

test('DeepSeekScraper：从虚拟列表 fixture 抽出配对消息', async () => {
  const { document } = loadFixture('deepseek-chat.html');
  const { DeepSeekScraper } = await import('../src/scrapers/platforms/DeepSeekScraper.js');

  const scraper = new DeepSeekScraper();
  const messages = await scraper.extractAllMessages(
    document.querySelector('.ds-scroll-area'),
    { skipScroll: true }
  );

  assert.equal(messages.length, 4);

  assert.equal(messages[0].role, 'user');
  assert.match(messages[0].content, /HTTPS 握手/);
  assert.equal(messages[0].turn_index, 0); // key 0 → 0*2

  assert.equal(messages[1].role, 'model');
  assert.match(messages[1].content, /TLS 握手/);
  // 代码块：语言取自 banner，banner 文本不混入正文
  assert.match(messages[1].content, /```elixir/);
  assert.match(messages[1].content, /tls handshake/);
  assert.doesNotMatch(messages[1].content, /复制/);
  assert.equal(messages[1].turn_index, 1); // key 0 → 0*2+1

  assert.equal(messages[2].role, 'user');
  assert.match(messages[2].content, /翻译成英文/);
  assert.equal(messages[2].turn_index, 2); // key 1 → 1*2

  assert.equal(messages[3].role, 'model');
  assert.match(messages[3].content, /TLS handshake phase/);
});

test('DeepSeekScraper：无虚拟列表时按文档序兜底', async () => {
  const dom = parseHTML(`<html><body>
    <main>
      <div class="ds-message"><div class="x">第一个问题</div></div>
      <div class="ds-markdown"><p>第一个回答</p></div>
    </main>
  </body></html>`);
  globalThis.window = dom.window;
  globalThis.document = dom.document;
  globalThis.location = { href: 'https://fixture.test/' };

  const { DeepSeekScraper } = await import('../src/scrapers/platforms/DeepSeekScraper.js');
  const scraper = new DeepSeekScraper();
  const messages = await scraper.extractAllMessages(dom.document.querySelector('main'), { skipScroll: true });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, 'user');
  assert.match(messages[0].content, /第一个问题/);
  assert.equal(messages[1].role, 'model');
  assert.match(messages[1].content, /第一个回答/);
});

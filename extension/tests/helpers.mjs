import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 加载 fixture 并把浏览器全局挂到 Node globalThis（scraper 代码引用全局 document/window）。
 */
export function loadFixture(name) {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
  const dom = parseHTML(html);

  globalThis.window = dom.window;
  globalThis.document = dom.document;
  globalThis.HTMLElement = dom.HTMLElement;
  globalThis.Node = dom.Node;
  // scraper 里 formatResult 用到 location
  globalThis.location = { href: 'https://fixture.test/' };

  return dom;
}

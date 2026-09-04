import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toNormalizedItems, contentHash } from '../src/lib/normalize.js';

const META = { source: 'claude', conversationId: 'conv-1', conversationTitle: '测试会话' };

test('normalize：基本问答配对', async () => {
  const items = await toNormalizedItems([
    { role: 'user', content: '问题一', turn_index: 0 },
    { role: 'model', content: '回答一', turn_index: 1 },
    { role: 'user', content: '问题二', turn_index: 2 },
    { role: 'model', content: '回答二', turn_index: 3 },
  ], META);

  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'conv-1#0');
  assert.equal(items[0].question, '问题一');
  assert.equal(items[0].answer, '回答一');
  assert.equal(items[0].source, 'claude');
  assert.equal(items[0].conversationTitle, '测试会话');
  assert.ok(!Number.isNaN(Date.parse(items[0].capturedAt)));
  assert.equal(items[1].id, 'conv-1#2');
});

test('normalize：连续 user 并入同一 question，连续 model 拼接为 answer', async () => {
  const items = await toNormalizedItems([
    { role: 'user', content: '上半句', turn_index: 0 },
    { role: 'user', content: '下半句', turn_index: 1 },
    { role: 'model', content: '回答 A', turn_index: 2 },
    { role: 'model', content: '回答 B', turn_index: 3 },
  ], META);

  assert.equal(items.length, 1);
  assert.equal(items[0].question, '上半句\n\n下半句');
  assert.equal(items[0].answer, '回答 A\n\n回答 B');
  assert.equal(items[0].id, 'conv-1#0'); // id 取 question 起始消息的 turn_index
});

test('normalize：没有提问的回答被跳过；空内容与未知 role 跳过', async () => {
  const items = await toNormalizedItems([
    { role: 'model', content: '孤儿回答', turn_index: 0 },
    { role: 'user', content: '   ', turn_index: 1 },
    { role: 'system', content: '系统消息', turn_index: 2 },
    { role: 'user', content: '真正的问题', turn_index: 3 },
  ], META);

  assert.equal(items.length, 1);
  assert.equal(items[0].question, '真正的问题');
  assert.equal(items[0].answer, undefined);
});

test('contentHash：32 个 hex 字符、内容稳定、随内容变化', async () => {
  const a = await contentHash('q', 'a');
  const b = await contentHash('q', 'a');
  const c = await contentHash('q', 'b');
  const d = await contentHash('q', undefined);

  assert.match(a, /^[0-9a-f]{32}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

test('normalize：contentHash 已算好且与 question/answer 对应', async () => {
  const items = await toNormalizedItems([
    { role: 'user', content: 'Q', turn_index: 0 },
    { role: 'model', content: 'A', turn_index: 1 },
  ], META);

  assert.equal(items[0].contentHash, await contentHash('Q', 'A'));
});

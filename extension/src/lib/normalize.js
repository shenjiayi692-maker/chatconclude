/**
 * normalize.js —— 扁平消息数组 → NormalizedItem[]。
 * 配对规则（TASK-capture-build.md §一，固化）：
 *   - 连续 user 消息并入同一 question（换行拼接）
 *   - 连续 model 消息拼接为当前 item 的 answer
 *   - model 消息出现时没有已开启的 item（比如用户只选了回答没选提问）→ 跳过
 *   - role 未知或内容为空 → 跳过
 *
 * id = `${conversationId}#${question 起始消息的 turn_index}`
 * contentHash = sha256(question + '\n' + (answer ?? '')) 前 16 字节 hex（32 个 hex 字符）
 */

/** sha256 前 16 字节 hex。content script（https 页面）与 Node 18+ 都有 crypto.subtle。 */
export async function contentHash(question, answer) {
  const input = `${question}\n${answer ?? ''}`;
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(digest).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {Array<{role: string, content: string, turn_index: number}>} messages
 * @param {Object} meta
 * @param {string} meta.source - 'claude' | 'chatgpt' | 'deepseek'
 * @param {string} meta.conversationId
 * @param {string} [meta.conversationTitle]
 * @param {string} [meta.capturedAt] - ISO；缺省取当前时刻
 * @returns {Promise<Array>} NormalizedItem[]
 */
export async function toNormalizedItems(messages, meta) {
  const { source, conversationId, conversationTitle } = meta;
  const capturedAt = meta.capturedAt || new Date().toISOString();

  const pairs = [];
  let current = null;

  for (const msg of messages || []) {
    const content = (msg?.content || '').trim();
    if (!content) continue;

    if (msg.role === 'user') {
      if (current && current.answerParts.length > 0) {
        // 上一个 item 已有回答，新的 user 消息开启新 item
        pairs.push(current);
        current = null;
      }
      if (current) {
        current.questionParts.push(content);
      } else {
        current = {
          turnIndex: msg.turn_index ?? pairs.length,
          questionParts: [content],
          answerParts: [],
        };
      }
    } else if (msg.role === 'model' || msg.role === 'assistant') {
      if (!current) continue; // 没有提问的回答，跳过
      current.answerParts.push(content);
    }
    // 其它 role 跳过
  }
  if (current) pairs.push(current);

  const items = [];
  for (const pair of pairs) {
    const question = pair.questionParts.join('\n\n');
    const answer = pair.answerParts.length > 0 ? pair.answerParts.join('\n\n') : undefined;

    items.push({
      id: `${conversationId}#${pair.turnIndex}`,
      contentHash: await contentHash(question, answer),
      question,
      ...(answer ? { answer } : {}),
      source,
      ...(conversationTitle ? { conversationTitle } : {}),
      capturedAt,
    });
  }

  return items;
}

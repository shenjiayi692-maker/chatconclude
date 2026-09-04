/**
 * Capture PoC —— claude.ai 专用。
 * 目标只有一个：验证「DOM selector → NormalizedItem[]」这条路走得通。
 * 在控制台跑 __capturePoc() 或等 3 秒自动跑一次，结果 console.log 出来。
 *
 * selector 事实来源：TheBluCoder/AI-chat-exporter（MIT）的 claude.config.js，
 * 外加 .font-claude-message 旧类名兜底。
 */

const SELECTORS = {
  // 每轮对话的包裹节点
  TURN: "div[data-test-render-count]",
  // 轮内的用户消息 / 模型回复
  USER: 'div[data-testid="user-message"]',
  MODEL: "div.font-claude-response, div.font-claude-message",
};

function getConversationId() {
  const m = location.pathname.match(/\/chat\/([^/?#]+)/);
  return m ? m[1] : "unknown";
}

/** 克隆节点、剥掉按钮等噪声后取 innerText。 */
function cleanText(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll("button, .sr-only").forEach((n) => n.remove());
  return clone.innerText.trim().replace(/\n{3,}/g, "\n\n");
}

/** 页面 DOM → NormalizedItem[]（question=用户消息，answer=紧随的模型回复）。 */
function extractNormalizedItems() {
  const convId = getConversationId();
  const title = document.title;
  const items = [];

  const turns = document.querySelectorAll(SELECTORS.TURN);
  let index = 0;

  for (const turn of turns) {
    const question = cleanText(turn.querySelector(SELECTORS.USER));
    const answer = cleanText(turn.querySelector(SELECTORS.MODEL));

    // Claude 的 DOM 里 user 和 model 常在相邻的两个 turn 节点：
    // 有 question 就开新 item；只有 answer 则补进上一个 item。
    if (question) {
      items.push({
        id: `${convId}#${index++}`,
        question,
        ...(answer ? { answer } : {}),
        source: "claude",
        conversationTitle: title,
      });
    } else if (answer && items.length > 0 && !items[items.length - 1].answer) {
      items[items.length - 1].answer = answer;
    }
  }

  return items;
}

function run() {
  const items = extractNormalizedItems();
  console.log(`[capture-poc] 抽取到 ${items.length} 条 NormalizedItem：`);
  console.log(JSON.stringify(items, null, 2));
  return items;
}

// 暴露到页面控制台方便手动重跑；页面加载后 3 秒自动跑一次
window.__capturePoc = run;
setTimeout(run, 3000);

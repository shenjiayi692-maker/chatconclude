import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const outputRoot = path.join(root, "extension/store-assets");
const iconPath = path.join(root, "extension/icons/icon-128.png");
const iconData = (await readFile(iconPath)).toString("base64");

const palettes = {
  ink: "#18181b",
  muted: "#71717a",
  line: "#e4e4e7",
  paper: "#ffffff",
  canvas: "#f4f4f5",
  mint: "#34d399",
  mintSoft: "#d1fae5",
  blue: "#60a5fa",
};

function escape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(x, y, value, size, weight = 400, fill = palettes.ink, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, PingFang SC, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escape(value)}</text>`;
}

function roundedRect(x, y, width, height, radius, fill, stroke = "none", strokeWidth = 1) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function icon(x, y, size) {
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/png;base64,${iconData}"/>`;
}

function shell(content, background = palettes.canvas) {
  return `<svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="800" fill="${background}"/>
    ${content}
  </svg>`;
}

function browserFrame(x, y, width, height, content) {
  return `
    <g filter="url(#shadow)">
      ${roundedRect(x, y, width, height, 18, palettes.paper, "#d4d4d8")}
      <path d="M ${x} ${y + 52} H ${x + width}" stroke="#e4e4e7"/>
      <circle cx="${x + 24}" cy="${y + 26}" r="5" fill="#f87171"/>
      <circle cx="${x + 42}" cy="${y + 26}" r="5" fill="#fbbf24"/>
      <circle cx="${x + 60}" cy="${y + 26}" r="5" fill="#34d399"/>
      ${roundedRect(x + 90, y + 14, width - 180, 24, 12, "#f4f4f5")}
      ${content}
    </g>`;
}

function defs() {
  return `<defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#18181b" flood-opacity="0.14"/>
    </filter>
    <linearGradient id="mintGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d1fae5"/>
      <stop offset="1" stop-color="#ecfeff"/>
    </linearGradient>
  </defs>`;
}

const locales = {
  "zh-CN": {
    oneTitle: "保存前，先由你确认",
    oneSubtitle: "清楚说明采集什么、如何使用；只有主动同意后才开始。",
    oneCardLabel: "开始前请确认",
    oneCardTitle: "你决定保存什么",
    oneDisclosure: ["只有点击保存后，才读取你选择的", "AI 对话并加密上传到个人账号。"],
    onePoints: ["不后台采集", "不监控浏览记录", "不出售或用于广告"],
    oneAgree: "我了解并同意以上方式",
    oneButton: "同意并继续",
    twoTitle: "只保存真正值得回看的内容",
    twoSubtitle: "在对话页点选提问和回答，确认后才会上传。",
    userOne: "为什么睡眠能帮助巩固记忆？",
    answerOne: "睡眠期间，大脑会重新激活新形成的记忆痕迹……",
    userTwo: "帮我把这段内容做成一个 PPT",
    answerTwo: "可以，我会先整理结构……",
    selected: "已选 2 条",
    saveSelected: "存入所选 (2)",
    filtered: "任务请求会在生成周报时自动剔除",
    threeTitle: "把聊天变成能复习的知识",
    threeSubtitle: "保存后，在个人账号里生成自然周报和主动回忆测验。",
    reviewLabel: "本周知识复习",
    reviewTitle: "记忆不是存档，而是一次次重建",
    reviewBody: ["你这周反复追问的是“为什么会忘”。有意思的是，", "睡眠并不是被动休息，而是在重新组织白天留下的痕迹。"],
    quizLabel: "主动回忆",
    quizQuestion: "为什么睡眠有助于长期记忆形成？",
    quizButton: "想好后查看答案",
    promoTitle: "把 AI 对话，变成每周复习",
    promoSubtitle: "只在你点击时保存",
  },
  en: {
    oneTitle: "Approve before capture starts",
    oneSubtitle: "See exactly what is read and why. Capture begins only after consent.",
    oneCardLabel: "BEFORE YOU BEGIN",
    oneCardTitle: "You choose what gets saved",
    oneDisclosure: ["Only after you click save, selected AI", "conversation content is encrypted and uploaded."],
    onePoints: ["No background capture", "No browsing-history monitoring", "No data sales or advertising use"],
    oneAgree: "I understand and agree",
    oneButton: "Agree and continue",
    twoTitle: "Save only what is worth revisiting",
    twoSubtitle: "Select questions and answers on the conversation page, then confirm the save.",
    userOne: "Why does sleep help consolidate memory?",
    answerOne: "During sleep, the brain reactivates newly formed memory traces…",
    userTwo: "Turn this material into a slide deck",
    answerTwo: "Sure. I’ll start by outlining the structure…",
    selected: "2 messages selected",
    saveSelected: "Save selected (2)",
    filtered: "Task requests are filtered out when your review is generated",
    threeTitle: "Turn conversations into knowledge you revisit",
    threeSubtitle: "Generate a natural weekly review and an active-recall quiz in your account.",
    reviewLabel: "WEEKLY KNOWLEDGE REVIEW",
    reviewTitle: "Memory is rebuilt, not merely stored",
    reviewBody: ["This week you kept returning to why we forget. Sleep is not", "passive downtime—it helps reorganize traces left during the day."],
    quizLabel: "ACTIVE RECALL",
    quizQuestion: "Why does sleep support long-term memory formation?",
    quizButton: "Reveal answer when ready",
    promoTitle: "Turn AI chats into weekly review",
    promoSubtitle: "Saved only when you click",
  },
};

function consentScreenshot(copy) {
  const card = `
    ${roundedRect(790, 120, 370, 560, 24, palettes.paper, palettes.line)}
    ${icon(820, 150, 54)}
    ${text(890, 174, "Weekly Knowledge Review", 18, 700)}
    ${text(890, 196, copy.oneCardLabel, 10, 700, "#047857")}
    ${text(820, 250, copy.oneCardTitle, 26, 700)}
    ${text(820, 292, copy.oneDisclosure[0], 14, 400, "#52525b")}
    ${text(820, 316, copy.oneDisclosure[1], 14, 400, "#52525b")}
    ${copy.onePoints.map((point, index) => `${text(824, 370 + index * 38, "✓", 16, 700, "#059669")}${text(852, 370 + index * 38, point, 14, 500, "#3f3f46")}`).join("")}
    ${roundedRect(820, 488, 18, 18, 4, palettes.paper, "#a1a1aa")}
    ${text(850, 502, copy.oneAgree, 13, 500)}
    ${roundedRect(820, 540, 310, 52, 12, palettes.ink)}
    ${text(975, 573, copy.oneButton, 14, 700, palettes.paper, "middle")}
    ${text(975, 626, "Privacy · 隐私说明", 11, 500, palettes.muted, "middle")}
  `;
  return shell(`
    ${defs()}
    <circle cx="140" cy="80" r="240" fill="url(#mintGlow)" opacity="0.9"/>
    ${icon(100, 120, 72)}
    ${text(100, 270, copy.oneTitle, 42, 750)}
    ${text(100, 318, copy.oneSubtitle, 18, 400, "#52525b")}
    ${browserFrame(740, 70, 470, 660, card)}
  `);
}

function captureScreenshot(copy) {
  const conversation = `
    ${roundedRect(90, 112, 210, 620, 0, "#fafafa")}
    ${text(122, 160, "Weekly Review", 17, 700)}
    ${text(122, 205, "ChatGPT", 13, 600, "#52525b")}
    ${text(122, 238, "Claude", 13, 500, "#71717a")}
    ${text(122, 271, "DeepSeek", 13, 500, "#71717a")}
    ${roundedRect(370, 130, 350, 54, 18, "#f4f4f5", "#34d399", 3)}
    ${text(392, 162, copy.userOne, 14, 500)}
    ${roundedRect(340, 210, 600, 96, 18, "#ffffff", "#34d399", 3)}
    ${text(368, 247, copy.answerOne, 14, 400, "#3f3f46")}
    ${text(368, 276, "Memory consolidation · hippocampus → cortex", 13, 500, "#047857")}
    ${roundedRect(520, 350, 420, 54, 18, "#f4f4f5")}
    ${text(542, 382, copy.userTwo, 14, 500)}
    ${roundedRect(340, 430, 600, 82, 18, "#ffffff", "#d4d4d8")}
    ${text(368, 466, copy.answerTwo, 14, 400, "#71717a")}
    ${roundedRect(790, 630, 142, 34, 17, palettes.mintSoft)}
    ${text(861, 652, copy.selected, 12, 700, "#047857", "middle")}
    ${roundedRect(950, 618, 180, 52, 26, palettes.ink)}
    ${text(1040, 650, copy.saveSelected, 13, 700, palettes.paper, "middle")}
  `;
  return shell(`
    ${defs()}
    ${text(80, 66, copy.twoTitle, 34, 750)}
    ${browserFrame(50, 78, 1180, 680, conversation)}
    ${roundedRect(728, 548, 410, 42, 21, "#fef3c7")}
    ${text(933, 574, copy.filtered, 12, 650, "#92400e", "middle")}
  `);
}

function reviewScreenshot(copy) {
  const review = `
    ${roundedRect(110, 110, 690, 590, 20, palettes.paper, palettes.line)}
    ${text(150, 158, copy.reviewLabel, 11, 700, "#047857")}
    ${text(150, 210, copy.reviewTitle, 30, 750)}
    ${text(150, 266, copy.reviewBody[0], 16, 400, "#3f3f46")}
    ${text(150, 296, copy.reviewBody[1], 16, 400, "#3f3f46")}
    ${roundedRect(150, 350, 600, 1, 0, palettes.line)}
    ${text(150, 398, copy.quizLabel, 11, 700, "#2563eb")}
    ${text(150, 448, copy.quizQuestion, 20, 650)}
    ${roundedRect(150, 500, 250, 48, 24, palettes.ink)}
    ${text(275, 530, copy.quizButton, 13, 700, palettes.paper, "middle")}
    ${roundedRect(850, 160, 300, 430, 24, "#18181b")}
    ${icon(890, 202, 64)}
    ${text(890, 310, "7", 76, 750, palettes.paper)}
    ${text(890, 346, "knowledge items", 14, 500, "#a1a1aa")}
    ${text(890, 406, "3", 54, 750, palettes.mint)}
    ${text(890, 438, "recall cards", 14, 500, "#a1a1aa")}
    ${roundedRect(890, 490, 220, 46, 23, palettes.mint)}
    ${text(1000, 519, "Review ready ✓", 13, 700, "#064e3b", "middle")}
  `;
  return shell(`
    ${defs()}
    ${text(80, 66, copy.threeTitle, 34, 750)}
    ${browserFrame(50, 78, 1180, 680, review)}
  `);
}

function promoSmall(copy) {
  return `<svg width="440" height="280" viewBox="0 0 440 280" xmlns="http://www.w3.org/2000/svg">
    <rect width="440" height="280" fill="#18181b"/>
    <circle cx="390" cy="-10" r="160" fill="#34d399" opacity="0.18"/>
    ${icon(34, 34, 62)}
    ${text(34, 144, copy.promoTitle, 27, 750, palettes.paper)}
    ${text(34, 181, copy.promoSubtitle, 15, 500, "#a1a1aa")}
    ${roundedRect(34, 216, 152, 34, 17, palettes.mint)}
    ${text(110, 238, "Claude · ChatGPT · DeepSeek", 9, 700, "#064e3b", "middle")}
  </svg>`;
}

function promoMarquee(copy) {
  return `<svg width="1400" height="560" viewBox="0 0 1400 560" xmlns="http://www.w3.org/2000/svg">
    <rect width="1400" height="560" fill="#18181b"/>
    <circle cx="1280" cy="40" r="430" fill="#34d399" opacity="0.14"/>
    <circle cx="1080" cy="560" r="260" fill="#60a5fa" opacity="0.1"/>
    ${icon(110, 100, 96)}
    ${text(110, 288, copy.promoTitle, 54, 750, palettes.paper)}
    ${text(110, 348, copy.promoSubtitle, 22, 500, "#a1a1aa")}
    ${roundedRect(900, 110, 360, 340, 28, "#ffffff")}
    ${text(950, 174, "Weekly Knowledge Review", 19, 700)}
    ${roundedRect(950, 216, 260, 64, 16, "#f4f4f5")}
    ${text(980, 254, "AI conversation", 15, 600, "#52525b")}
    <path d="M1080 300 V340" stroke="#34d399" stroke-width="4" stroke-linecap="round"/>
    <path d="M1068 330 L1080 342 L1092 330" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${roundedRect(950, 362, 260, 50, 25, palettes.mint)}
    ${text(1080, 393, "Saved when you click ✓", 13, 700, "#064e3b", "middle")}
  </svg>`;
}

await mkdir(outputRoot, { recursive: true });
await copyFile(iconPath, path.join(outputRoot, "icon-128.png"));

for (const [locale, copy] of Object.entries(locales)) {
  const localeDir = path.join(outputRoot, locale);
  await mkdir(localeDir, { recursive: true });
  const screenshots = [
    ["screenshot-1-consent.png", consentScreenshot(copy)],
    ["screenshot-2-capture.png", captureScreenshot(copy)],
    ["screenshot-3-review.png", reviewScreenshot(copy)],
  ];
  for (const [filename, svg] of screenshots) {
    await sharp(Buffer.from(svg)).png().toFile(path.join(localeDir, filename));
  }
}

await sharp(Buffer.from(promoSmall(locales["zh-CN"])))
  .png()
  .toFile(path.join(outputRoot, "promo-small-440x280.png"));
await sharp(Buffer.from(promoMarquee(locales["zh-CN"])))
  .png()
  .toFile(path.join(outputRoot, "promo-marquee-1400x560.png"));

console.log(`Generated Chrome Web Store assets in ${outputRoot}`);

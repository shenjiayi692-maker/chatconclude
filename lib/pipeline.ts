import { anthropic, getText, parseModelJson } from "@/lib/anthropic";
import { CLASSIFY_SYSTEM, MODELS, QUIZ_SYSTEM, REVIEW_SYSTEM } from "@/lib/prompts";
import { sanitizeClassifications, sanitizeQuiz } from "@/lib/model-output";
import { recordUsage, UsageContext } from "@/lib/usage";

const MAX_QUESTION_CHARS = 4_000;
const MAX_ANSWER_CHARS = 8_000;
const MAX_MATERIAL_CHARS = 60_000;

export interface PipelineItem {
  id: string;
  question: string;
  answer?: string;
}

export interface QuizItem {
  question: string;
  answer: string;
}

export interface FilteredItem {
  question: string;
  category: "task" | "other";
}

export interface PipelineResult {
  review: string;
  filtered: FilteredItem[];
  quiz: QuizItem[];
}

export interface ClassifiedItem {
  id: string;
  category: "knowledge" | "task" | "other";
  topic: string;
}

export class PipelineError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function logModelFailure(stage: string, error: unknown) {
  const metadata =
    error && typeof error === "object"
      ? {
          name: "name" in error ? String(error.name) : "Error",
          status: "status" in error ? String(error.status) : undefined,
        }
      : { name: typeof error };
  console.error(`[pipeline] ${stage} failed:`, metadata);
}

/**
 * 共用管线：classify（只留 knowledge）→ 按 topic 归堆 → review + quiz。
 * 粘贴版（只有 question）和采集版（有 question + answer）都走这里。
 * 有 answer 时把答案一并作为素材，周报/quiz 更实。
 */
export async function runReviewPipeline(
  items: PipelineItem[],
  usageContext?: UsageContext,
): Promise<PipelineResult> {
  const classified = await classifyItems(items, usageContext);
  return composeReview(items, classified, usageContext);
}

/**
 * 只做分类那一步（Haiku）。抽出来给采集版复用：DB 路径只把「没分过类的新条目」丢进来，
 * 已分类的直接读缓存，省 token。
 */
export async function classifyItems(
  items: PipelineItem[],
  usageContext?: UsageContext,
): Promise<ClassifiedItem[]> {
  if (items.length === 0) return [];
  try {
    const classifyMsg = await anthropic.messages.create({
      model: MODELS.classify,
      max_tokens: 4096,
      system: CLASSIFY_SYSTEM,
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            items.map(({ id, question }) => ({
              id,
              text: question.slice(0, MAX_QUESTION_CHARS),
            })),
          ),
        },
      ],
    });
    await recordUsage(usageContext, MODELS.classify, classifyMsg.usage);
    const parsed = parseModelJson<unknown>(getText(classifyMsg));
    return sanitizeClassifications(parsed, new Set(items.map((item) => item.id)));
  } catch (err) {
    logModelFailure("classify", err);
    throw new PipelineError("分类这一步出错了，稍后再试一次。", 502);
  }
}

/**
 * 拿到分类结果后：按 topic 归堆 → review + quiz。分类可以来自本次调用或数据库缓存。
 */
export async function composeReview(
  items: PipelineItem[],
  classified: ClassifiedItem[],
  usageContext?: UsageContext,
): Promise<PipelineResult> {
  const catById = new Map(classified.map((c) => [c.id, c]));
  const itemById = new Map(items.map((it) => [it.id, it]));

  const knowledgeGroups = new Map<string, PipelineItem[]>();
  const filtered: FilteredItem[] = [];

  for (const item of items) {
    const c = catById.get(item.id);
    if (c?.category === "knowledge") {
      const topic = c.topic?.trim() || "其它";
      if (!knowledgeGroups.has(topic)) knowledgeGroups.set(topic, []);
      knowledgeGroups.get(topic)!.push(item);
    } else {
      filtered.push({
        question: item.question,
        category: c?.category === "task" ? "task" : "other",
      });
    }
  }

  if (knowledgeGroups.size === 0) {
    return {
      review:
        "这次的内容里没找到值得复习的知识类提问，看起来都是让 AI 干活或闲聊的部分，换一批试试？",
      filtered,
      quiz: [],
    };
  }

  const groupedText = Array.from(knowledgeGroups.entries())
    .map(([topic, groupItems]) => {
      const body = groupItems
        .map((it) => {
          const full = itemById.get(it.id);
          const question = (full?.question ?? it.question).slice(0, MAX_QUESTION_CHARS);
          if (full?.answer) return `问：${question}\n答：${full.answer.slice(0, MAX_ANSWER_CHARS)}`;
          return question;
        })
        .join("\n\n");
      return `## ${topic}\n${body}`;
    })
    .join("\n\n")
    .slice(0, MAX_MATERIAL_CHARS);

  return generateReviewArtifacts(groupedText, filtered, usageContext);
}

/** 用已整理好的素材生成最终周报与 quiz；周归档分批时用于合并批次摘要。 */
export async function generateReviewArtifacts(
  material: string,
  filtered: FilteredItem[] = [],
  usageContext?: UsageContext,
): Promise<PipelineResult> {
  const safeMaterial = material.slice(0, MAX_MATERIAL_CHARS);

  // review 是主产物、quiz 是附加。并行但独立容错：review 失败才算整体失败；
  // quiz 的调用或 JSON 解析偶发失败时降级为空数组，不拖垮已生成好的周报。
  const [reviewRes, quizRes] = await Promise.allSettled([
    anthropic.messages.create({
      model: MODELS.write,
      max_tokens: 2048,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: safeMaterial }],
    }),
    anthropic.messages.create({
      model: MODELS.quiz,
      max_tokens: 2048,
      system: QUIZ_SYSTEM,
      messages: [{ role: "user", content: safeMaterial }],
    }),
  ]);

  if (reviewRes.status === "rejected") {
    logModelFailure("review", reviewRes.reason);
    throw new PipelineError("生成周报这一步出错了，稍后再试一次。", 502);
  }
  await recordUsage(usageContext, MODELS.write, reviewRes.value.usage);
  const review = getText(reviewRes.value);

  let quiz: QuizItem[] = [];
  if (quizRes.status === "fulfilled") {
    await recordUsage(usageContext, MODELS.quiz, quizRes.value.usage);
    try {
      quiz = sanitizeQuiz(parseModelJson<unknown>(getText(quizRes.value)));
    } catch {
      console.error("[pipeline] quiz output invalid; degrading to empty quiz");
    }
  } else {
    logModelFailure("quiz", quizRes.reason);
  }

  return { review, filtered, quiz };
}

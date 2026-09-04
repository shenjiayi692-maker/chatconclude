import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ClassifiedItem,
  FilteredItem,
  PipelineError,
  PipelineItem,
  PipelineResult,
  classifyItems,
  composeReview,
  generateReviewArtifacts,
} from "@/lib/pipeline";
import {
  DEFAULT_TIMEZONE,
  groupByLocalWeek,
  normalizeTimezone,
  weekStart,
} from "@/lib/timezone";
import { UsageContext } from "@/lib/usage";

const QUERY_PAGE_SIZE = 500;
const CLASSIFY_BATCH_SIZE = 40;
const REVIEW_BATCH_SIZE = 40;
const REVIEW_BATCH_CHARS = 50_000;

interface WeekItemRow {
  id: string;
  question: string;
  answer: string | null;
  category: string | null;
  topic: string | null;
  captured_at: string | null;
  created_at: string;
}

function currentWeekFilter(iso: string) {
  return `captured_at.gte.${iso},and(captured_at.is.null,created_at.gte.${iso})`;
}

function pastFilter(iso: string) {
  return `captured_at.lt.${iso},and(captured_at.is.null,created_at.lt.${iso})`;
}

function rowTimestamp(row: WeekItemRow): number {
  return new Date(row.captured_at ?? row.created_at).getTime();
}

function rowMaterialSize(row: WeekItemRow): number {
  return row.question.length + (row.answer?.length ?? 0) + 32;
}

function chunkRows(rows: WeekItemRow[]): WeekItemRow[][] {
  const chunks: WeekItemRow[][] = [];
  let current: WeekItemRow[] = [];
  let chars = 0;

  for (const row of rows) {
    const size = rowMaterialSize(row);
    if (
      current.length > 0 &&
      (current.length >= REVIEW_BATCH_SIZE || chars + size > REVIEW_BATCH_CHARS)
    ) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(row);
    chars += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

async function getUserTimezone(userId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) return DEFAULT_TIMEZONE;
  const { data } = await admin
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return normalizeTimezone(data?.timezone);
}

async function fetchRows(userId: string, filter: string): Promise<WeekItemRow[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new PipelineError("服务端尚未配置数据库。", 503);

  const rows: WeekItemRow[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await admin
      .from("items")
      .select("id, question, answer, category, topic, captured_at, created_at")
      .eq("user_id", userId)
      .or(filter)
      .order("created_at", { ascending: true })
      .range(from, from + QUERY_PAGE_SIZE - 1);

    if (error) {
      console.error("[weekly] items query failed:", error.code, error.message);
      throw new PipelineError("读取采集数据失败，稍后再试。", 502);
    }

    const page = (data ?? []) as WeekItemRow[];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function classifyRows(
  rows: WeekItemRow[],
  userId: string,
  persist: boolean,
  usageContext: UsageContext,
): Promise<ClassifiedItem[]> {
  const known: ClassifiedItem[] = [];
  const unknown: PipelineItem[] = [];

  for (const row of rows) {
    if (row.category === "knowledge" || row.category === "task" || row.category === "other") {
      known.push({
        id: row.id,
        category: row.category,
        topic: row.topic ?? "其它",
      });
    } else {
      unknown.push({ id: row.id, question: row.question });
    }
  }

  const fresh: ClassifiedItem[] = [];
  for (let index = 0; index < unknown.length; index += CLASSIFY_BATCH_SIZE) {
    fresh.push(
      ...(await classifyItems(
        unknown.slice(index, index + CLASSIFY_BATCH_SIZE),
        usageContext,
      )),
    );
  }

  if (persist && fresh.length) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { error } = await admin.rpc("cache_item_classifications", {
        p_user_id: userId,
        p_items: fresh,
      });
      if (error) {
        console.error("[weekly] cache classifications failed:", error.code, error.message);
      }
    }
  }

  return [...known, ...fresh];
}

/**
 * 任意数量的周条目分批生成。每批受字符和条数上限保护，多批时再用同一周报 prompt 合并摘要。
 * 这样不会因 60 条上限删除未进入周报的数据，也不会把超大输入一次塞给模型。
 */
async function reviewFromRows(
  rows: WeekItemRow[],
  userId: string,
  persist: boolean,
  scope: UsageContext["scope"],
): Promise<PipelineResult> {
  const usageContext: UsageContext = { scope, userId };
  const classified = await classifyRows(rows, userId, persist, usageContext);
  const classifiedById = new Map(classified.map((item) => [item.id, item]));
  const chunks = chunkRows(rows);
  const results: PipelineResult[] = [];

  for (const chunk of chunks) {
    const items: PipelineItem[] = chunk.map((row) => ({
      id: row.id,
      question: row.question,
      answer: row.answer ?? undefined,
    }));
    const chunkClassified = chunk
      .map((row) => classifiedById.get(row.id))
      .filter((item): item is ClassifiedItem => Boolean(item));
    results.push(await composeReview(items, chunkClassified, usageContext));
  }

  if (results.length === 1) return results[0];

  const filtered: FilteredItem[] = results.flatMap((result) => result.filtered);
  if (filtered.length === rows.length) {
    return {
      review:
        "这次的内容里没找到值得复习的知识类提问，看起来都是让 AI 干活或闲聊的部分，换一批试试？",
      filtered,
      quiz: [],
    };
  }
  const summaries = results
    .map((result, index) => ({ result, index }))
    .filter(({ result, index }) => result.filtered.length < chunks[index].length)
    .map(({ result, index }) => `第 ${index + 1} 批素材摘要：\n${result.review}`)
    .join("\n\n");
  return generateReviewArtifacts(summaries, filtered, usageContext);
}

export type WeeklyResult =
  | (PipelineResult & { itemCount: number; weekStart: string; empty?: false })
  | { empty: true };

/** 生成/刷新本周周报；跨周残留会先逐周归档并精确删除已归档行。 */
export async function generateCurrentWeek(userId: string): Promise<WeeklyResult> {
  const timeZone = await getUserTimezone(userId);
  await reconcileUser(userId, timeZone);

  const admin = getSupabaseAdmin();
  if (!admin) throw new PipelineError("服务端尚未配置数据库。", 503);

  const current = weekStart(Date.now(), timeZone);
  const rows = await fetchRows(userId, currentWeekFilter(new Date(current.startMs).toISOString()));
  if (rows.length === 0) return { empty: true };

  const result = await reviewFromRows(rows, userId, true, "weekly_review");
  const { error } = await admin.from("reviews").upsert(
    {
      user_id: userId,
      week_start: current.dateStr,
      review: result.review,
      quiz: result.quiz,
      item_count: rows.length,
      created_at: new Date().toISOString(),
      archived_at: null,
    },
    { onConflict: "user_id,week_start" },
  );
  if (error) {
    console.error("[weekly] save review failed:", error.message);
    throw new PipelineError("保存周报失败，稍后再试。", 502);
  }

  return { ...result, itemCount: rows.length, weekStart: current.dateStr };
}

/**
 * 跨周对账：
 * - 按用户时区把历史原始条目分到各自然周；
 * - 每周保存成功后只删除该周实际参与归档的 ID；
 * - 某周失败则保留原文，下次重试，不影响其他周。
 */
export async function reconcileUser(
  userId: string,
  knownTimezone?: string,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const timeZone = normalizeTimezone(knownTimezone ?? (await getUserTimezone(userId)));
  const current = weekStart(Date.now(), timeZone);
  let rows: WeekItemRow[];
  try {
    rows = await fetchRows(userId, pastFilter(new Date(current.startMs).toISOString()));
  } catch (error) {
    console.error("[weekly] reconcile query failed:", error);
    return;
  }
  if (rows.length === 0) return;

  const groups = groupByLocalWeek(rows, rowTimestamp, timeZone);

  for (const [weekDate, weekRows] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const { data: existing, error: existingError } = await admin
      .from("reviews")
      .select("review, quiz, item_count, archived_at")
      .eq("user_id", userId)
      .eq("week_start", weekDate)
      .maybeSingle();

    if (existingError) {
      console.error("[weekly] archive lookup failed, keeping source rows:", existingError.message);
      continue;
    }

    try {
      const isArchived = Boolean(existing?.archived_at);
      const completeDraft =
        Boolean(existing) && !isArchived && existing!.item_count === weekRows.length;
      let review: string;
      let quiz: PipelineResult["quiz"];
      let itemCount: number;

      if (completeDraft) {
        review = existing!.review;
        quiz = (existing!.quiz ?? []) as PipelineResult["quiz"];
        itemCount = weekRows.length;
      } else {
        const fresh = await reviewFromRows(
          weekRows,
          userId,
          true,
          "weekly_archive",
        );
        const result = isArchived
          ? await generateReviewArtifacts(
              `已有周报：\n${existing!.review}\n\n本次补录内容：\n${fresh.review}`,
              fresh.filtered,
              { scope: "weekly_archive", userId },
            )
          : fresh;
        review = result.review;
        quiz = result.quiz;
        itemCount = (isArchived ? existing!.item_count : 0) + weekRows.length;
      }

      const ids = weekRows.map((row) => row.id);
      const { error } = await admin.rpc("archive_week", {
        p_user_id: userId,
        p_week_start: weekDate,
        p_review: review,
        p_quiz: quiz,
        p_item_count: itemCount,
        p_item_ids: ids,
      });
      if (error) {
        console.error("[weekly] atomic archive failed, keeping source rows:", error.message);
        continue;
      }
    } catch (error) {
        console.error("[weekly] archive generation failed, keeping source rows:", error);
        continue;
    }

  }
}

export interface StoredReview {
  weekStart: string;
  review: string;
  quiz: PipelineResult["quiz"];
  itemCount: number;
  createdAt: string;
}

export async function getReviewHistory(
  userId: string,
  limit = 12,
): Promise<StoredReview[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("reviews")
    .select("week_start, review, quiz, item_count, created_at")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 52));

  if (error) {
    console.error("[weekly] review history query failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    weekStart: row.week_start,
    review: row.review,
    quiz: (row.quiz ?? []) as PipelineResult["quiz"],
    itemCount: row.item_count ?? 0,
    createdAt: row.created_at,
  }));
}

export async function getLatestReview(userId: string): Promise<StoredReview | null> {
  return (await getReviewHistory(userId, 1))[0] ?? null;
}

import { NextRequest, NextResponse } from "next/server";
import { authenticateToken } from "@/lib/ingest-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkPerKeyPerMinute } from "@/lib/ratelimit";

const MAX_ITEMS_PER_REQUEST = 200;
const MAX_QUESTION_CHARS = 8_000;
const MAX_ANSWER_CHARS = 20_000;
const MAX_BATCH_CHARS = 200_000;

// 插件的 background service worker 跨域调用本接口：令牌走 Authorization 头、
// 不依赖 cookie，放开 CORS 是安全的。
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface IncomingItem {
  id: string;
  contentHash: string;
  question: string;
  answer?: string;
  source: string;
  conversationTitle?: string;
}

const ALLOWED_SOURCES = new Set(["claude", "chatgpt", "deepseek"]);

function validateItem(raw: unknown): IncomingItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const it = raw as Record<string, unknown>;

  if (typeof it.id !== "string" || !it.id.trim()) return null;
  if (typeof it.contentHash !== "string" || !/^[0-9a-f]{32}$/.test(it.contentHash)) return null;
  if (typeof it.question !== "string" || !it.question.trim()) return null;
  if (it.question.length > MAX_QUESTION_CHARS) return null;
  if (typeof it.source !== "string" || !ALLOWED_SOURCES.has(it.source)) return null;
  if (it.answer !== undefined && typeof it.answer !== "string") return null;
  if (typeof it.answer === "string" && it.answer.length > MAX_ANSWER_CHARS) return null;
  if (it.conversationTitle !== undefined && typeof it.conversationTitle !== "string") return null;

  return {
    id: it.id.slice(0, 512),
    contentHash: it.contentHash,
    question: it.question,
    answer: it.answer as string | undefined,
    source: it.source,
    conversationTitle: (it.conversationTitle as string | undefined)?.slice(0, 512),
  };
}

export async function POST(req: NextRequest) {
  const auth = await authenticateToken(req.headers.get("authorization"));
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (!(await checkPerKeyPerMinute(`tok:${auth.tokenHash}`))) {
    return json({ error: "请求太频繁，稍后再试（每分钟 30 次）。" }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求体不是合法 JSON。" }, 400);
  }

  const rawItems = (body as { items?: unknown })?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return json({ error: "items 为空。" }, 400);
  }
  if (rawItems.length > MAX_ITEMS_PER_REQUEST) {
    return json({ error: `单次最多 ${MAX_ITEMS_PER_REQUEST} 条，分批发送。` }, 413);
  }

  const items: IncomingItem[] = [];
  let batchChars = 0;
  for (const raw of rawItems) {
    const item = validateItem(raw);
    if (!item) {
      return json({ error: "存在格式不合法的条目。" }, 400);
    }
    batchChars += item.question.length + (item.answer?.length ?? 0);
    if (batchChars > MAX_BATCH_CHARS) {
      return json({ error: "本批内容过长，请分批发送。" }, 413);
    }
    items.push(item);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json({ error: "服务端尚未配置数据库。" }, 503);
  }

  const capturedAt = new Date().toISOString();
  const { data, error } = await supabase.rpc("ingest_items", {
    p_user_id: auth.userId,
    p_items: items.map((item) => ({ ...item, capturedAt })),
  });

  if (error) {
    console.error("[ingest] rpc failed:", error.code, error.message);
    return json({ error: "入库失败，稍后再试。" }, 502);
  }

  const result = data as { saved?: number; duplicates?: number; rejected?: number } | null;
  return json(
    {
      saved: result?.saved ?? 0,
      duplicates: result?.duplicates ?? 0,
      rejected: result?.rejected ?? 0,
    },
    200,
  );
}

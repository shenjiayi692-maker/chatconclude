import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { resolveAuth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { checkPerKeyPerMinute } from "@/lib/ratelimit";
import { MAX_CHARS, MAX_SEGMENTS, normalize } from "@/lib/normalize";

// 手机端（快捷指令 / 网页粘贴页）用的文本入库口：收原始文本，服务端切段+算 hash+去重入库。
// 桌面插件走 /api/ingest（结构化问答）；这里走粗文本，无问答配对，交给复习管线的分类去筛。

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const ALLOWED_SOURCES = new Set(["ios", "claude", "chatgpt", "deepseek"]);

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** sha256(question + '\n') 前 16 字节 hex，与 lib normalize 的 contentHash 公式一致（无 answer）。 */
function contentHash(question: string): string {
  return createHash("sha256").update(`${question}\n`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }
  if (!(await checkPerKeyPerMinute(auth.rateKey))) {
    return json({ error: "请求太频繁，稍后再试。" }, 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求体不是合法 JSON。" }, 400);
  }

  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";
  const rawSource = (body as { source?: unknown })?.source;
  const source = typeof rawSource === "string" && ALLOWED_SOURCES.has(rawSource) ? rawSource : "ios";

  if (!text.trim()) {
    return json({ error: "没有内容可存。" }, 400);
  }
  if (text.length > MAX_CHARS) {
    return json({ error: `内容太长（超过 ${MAX_CHARS} 字），分几次存。` }, 413);
  }

  const segments = normalize(text);
  if (segments.length === 0) {
    return json({ error: "没识别出可存的段落。" }, 400);
  }
  if (segments.length > MAX_SEGMENTS) {
    return json({ error: `段落太多（超过 ${MAX_SEGMENTS} 段），分几次存。` }, 413);
  }

  const capturedAt = new Date().toISOString();
  const items = segments.map(({ question }) => {
    const hash = contentHash(question);
    return {
      id: `ios#${hash}`, // 无会话 id/序号，用内容 hash 做稳定去重键
      contentHash: hash,
      question,
      answer: null,
      source,
      conversationTitle: null,
      capturedAt,
    };
  });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json({ error: "服务端尚未配置数据库。" }, 503);
  }

  const { data, error } = await supabase.rpc("ingest_items", {
    p_user_id: auth.userId,
    p_items: items,
  });

  if (error) {
    console.error("[ingest/text] rpc failed:", error.code, error.message);
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

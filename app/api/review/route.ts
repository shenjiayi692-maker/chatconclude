import { NextRequest, NextResponse } from "next/server";
import { MAX_CHARS, MAX_SEGMENTS, normalize } from "@/lib/normalize";
import { PipelineError, runReviewPipeline } from "@/lib/pipeline";
import { checkReviewLimit } from "@/lib/ratelimit";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("请求格式不对，刷新页面再试一次。", 400);
  }

  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : "";

  if (!text.trim()) {
    return errorResponse("还没贴内容呢，把一段对话粘贴进来再点生成。", 400);
  }
  if (text.length > MAX_CHARS) {
    return errorResponse(`内容有点长（超过 ${MAX_CHARS} 字），先截取本周最想复习的部分再贴进来。`, 400);
  }

  const items = normalize(text);
  if (items.length === 0) {
    return errorResponse("没识别出可用的段落，检查一下格式再试试。", 400);
  }
  if (items.length > MAX_SEGMENTS) {
    return errorResponse(`段落有点多（超过 ${MAX_SEGMENTS} 段），先精简一下再贴进来。`, 400);
  }

  const ip =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const rl = await checkReviewLimit(ip);
  if (!rl.allowed) {
    return errorResponse(
      rl.reason === "ip"
        ? "今天已经用满了额度（每人每天 5 次），明天再来吧。"
        : "今天用的人有点多，系统当日额度已用完，明天再试试。",
      429,
    );
  }

  try {
    const result = await runReviewPipeline(
      items.map(({ id, question }) => ({ id, question })),
      { scope: "public_review" },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PipelineError) {
      return errorResponse(err.message, err.status);
    }
    return errorResponse("出了点问题，稍后再试一次。", 500);
  }
}

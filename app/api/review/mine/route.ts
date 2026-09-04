import { NextRequest, NextResponse } from "next/server";
import { resolveAuth } from "@/lib/auth";
import { PipelineError } from "@/lib/pipeline";
import { generateCurrentWeek } from "@/lib/weekly";
import {
  checkGlobalDailyGuard,
  checkPerKeyPerMinute,
  checkUserDailyReview,
} from "@/lib/ratelimit";

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

// 生成/刷新「本周」周报：换周会自动归档上周、清空上周原始内容（见 lib/weekly）。
export async function POST(req: NextRequest) {
  const auth = await resolveAuth(req);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (!(await checkPerKeyPerMinute(auth.rateKey, undefined, true))) {
    return json({ error: "请求太频繁，稍后再试。" }, 429);
  }
  if (!(await checkGlobalDailyGuard())) {
    return json({ error: "今天系统额度已用完，明天再试。" }, 429);
  }
  if (!(await checkUserDailyReview(auth.userId))) {
    return json({ error: "今天已生成 5 次周报，明天再刷新。" }, 429);
  }

  try {
    const result = await generateCurrentWeek(auth.userId);
    if ("empty" in result && result.empty) {
      return json(
        {
          review:
            "本周还没有采集到内容。在 Claude / ChatGPT / DeepSeek 里用插件「存入复习」，或在手机上「存入复习」几条知识提问，再回来生成。",
          filtered: [],
          quiz: [],
          itemCount: 0,
        },
        200,
      );
    }
    return json(result, 200);
  } catch (err) {
    if (err instanceof PipelineError) {
      return json({ error: err.message }, err.status);
    }
    console.error("[review/mine] unexpected:", err);
    return json({ error: "出了点问题，稍后再试一次。" }, 500);
  }
}

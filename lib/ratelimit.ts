import { getSupabaseAdmin } from "./supabase/admin";

// 限流走 Supabase 共享存储（rate_limit_hit RPC），跨 serverless 实例真生效。
// 烧模型成本的入口失败时 fail-closed；纯采集入口可 fail-open，避免限流故障导致用户内容丢失。

export const REVIEW_IP_DAILY = 5; // 公开粘贴版每 IP 每天
export const REVIEW_GLOBAL_DAILY = 200; // 全局每日 Anthropic 预算护栏（review + review/mine 共用）
export const PER_KEY_PER_MINUTE = 30; // 每令牌/每用户每分钟
export const FREE_USER_DAILY_REVIEWS = 5;

async function rateLimitHit(
  key: string,
  limit: number,
  windowSeconds: number,
  failClosed: boolean,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return !failClosed;
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[ratelimit] rpc failed:", error.message);
    return !failClosed;
  }
  return data === true;
}

export type ReviewLimit = { allowed: true } | { allowed: false; reason: "ip" | "global" };

/** 公开粘贴版 /api/review：先按 IP 拦滥用者，再消耗全局预算。 */
export async function checkReviewLimit(ip: string): Promise<ReviewLimit> {
  if (!(await rateLimitHit(`rl:review:ip:${ip}`, REVIEW_IP_DAILY, 86400, true))) {
    return { allowed: false, reason: "ip" };
  }
  if (!(await rateLimitHit("rl:review:global", REVIEW_GLOBAL_DAILY, 86400, true))) {
    return { allowed: false, reason: "global" };
  }
  return { allowed: true };
}

/** 全局每日预算护栏（给已鉴权、但同样烧 Anthropic 的 /api/review/mine）。 */
export async function checkGlobalDailyGuard(): Promise<boolean> {
  return rateLimitHit("rl:review:global", REVIEW_GLOBAL_DAILY, 86400, true);
}

/** 每令牌/每用户每分钟节流（ingest、review/mine）。 */
export async function checkPerKeyPerMinute(
  rateKey: string,
  limit = PER_KEY_PER_MINUTE,
  failClosed = false,
): Promise<boolean> {
  return rateLimitHit(`rl:min:${rateKey}`, limit, 60, failClosed);
}

/** 免费用户每天最多主动生成/刷新 5 次周报。 */
export async function checkUserDailyReview(userId: string): Promise<boolean> {
  return rateLimitHit(`rl:review:user:${userId}`, FREE_USER_DAILY_REVIEWS, 86400, true);
}

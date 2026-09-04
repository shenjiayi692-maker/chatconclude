import { authenticateToken } from "./ingest-auth";
import { createClient } from "./supabase/server";

// 统一鉴权：机器客户端（扩展 / iOS 快捷指令）走 Bearer 令牌；网页走登录会话 cookie。
// rateKey 用于限流分桶：令牌用 hash、会话用 userId。

export type ResolvedAuth =
  | { ok: true; userId: string; rateKey: string; via: "token" | "session" }
  | { ok: false; status: 401 | 503; error: string };

export async function resolveAuth(req: Request): Promise<ResolvedAuth> {
  const authHeader = req.headers.get("authorization");

  // 有 Authorization 头 → 只走令牌路径（无效就直接失败，不静默回落会话）
  if (authHeader) {
    const r = await authenticateToken(authHeader);
    if (r.ok) {
      return { ok: true, userId: r.userId, rateKey: `tok:${r.tokenHash}`, via: "token" };
    }
    return { ok: false, status: r.status, error: r.error };
  }

  // 否则读登录会话（同源网页请求会自动带 cookie）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { ok: true, userId: user.id, rateKey: `usr:${user.id}`, via: "session" };
  }

  return { ok: false, status: 401, error: "未登录，且没有接入令牌。" };
}

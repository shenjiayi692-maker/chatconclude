import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "./supabase/admin";
import {
  deviceTokenExpiresAt,
  isRollingDeviceToken,
  shouldRecordTokenUse,
} from "./token-policy";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AuthResult =
  | { ok: true; userId: string; tokenHash: string }
  | { ok: false; status: 401 | 503; error: string };

/** Authorization: Bearer <token> → user_id。服务端只比对 token 的 sha256。 */
export async function authenticateToken(authorization: string | null): Promise<AuthResult> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { ok: false, status: 401, error: "缺少接入令牌。" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, status: 503, error: "服务端尚未配置数据库。" };
  }

  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, user_id, label, revoked_at, expires_at, last_used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 503, error: "令牌校验暂时不可用。" };
  }
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 401, error: "令牌无效、已过期或已吊销。" };
  }

  const nowMs = Date.now();
  if (shouldRecordTokenUse(data.last_used_at, nowMs)) {
    const updates: { last_used_at: string; expires_at?: string } = {
      last_used_at: new Date(nowMs).toISOString(),
    };
    if (isRollingDeviceToken(data.label)) {
      updates.expires_at = deviceTokenExpiresAt(nowMs);
    }
    const { error: updateError } = await supabase
      .from("api_tokens")
      .update(updates)
      .eq("id", data.id);
    if (updateError) {
      console.error("[auth] token last-used update failed:", updateError.code);
    }
  }

  return { ok: true, userId: data.user_id, tokenHash };
}

// 限流已移到 lib/ratelimit.ts（Supabase 共享存储版）。

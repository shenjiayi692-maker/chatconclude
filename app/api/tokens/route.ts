import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/ingest-auth";
import { hasValidOrigin } from "@/lib/request-security";
import { deviceTokenExpiresAt } from "@/lib/token-policy";

/** 读当前登录用户；未登录返回 null。 */
async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** 生成新令牌：明文只在这一次响应里返回，服务端只存 hash。 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }
  if (!hasValidOrigin(req)) {
    return NextResponse.json({ error: "请求来源不合法。" }, { status: 403 });
  }

  let label: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.label === "string" && body.label.trim()) {
      label = body.label.trim().slice(0, 60);
    }
  } catch {
    // 无 body 也行
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "服务端尚未配置数据库。" }, { status: 503 });
  }

  const { count } = await admin
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= 10) {
    return NextResponse.json(
      { error: "有效令牌已达到 10 个，请先吊销不用的设备。" },
      { status: 429 },
    );
  }

  const token = `wr_${randomBytes(32).toString("hex")}`;
  const expiresAt = deviceTokenExpiresAt();
  const { data, error } = await admin
    .from("api_tokens")
    .insert({
      user_id: user.id,
      token_hash: hashToken(token),
      label,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[tokens] insert failed:", error.code, error.message);
    return NextResponse.json({ error: "生成失败，稍后再试。" }, { status: 502 });
  }

  return NextResponse.json({ id: data.id, token, expiresAt }, { status: 201 });
}

/** 吊销令牌（软删：写 revoked_at）。只能吊销自己的。 */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }
  if (!hasValidOrigin(req)) {
    return NextResponse.json({ error: "请求来源不合法。" }, { status: 403 });
  }

  let id: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.id === "string") id = body.id;
  } catch {
    // 下面统一处理缺参
  }
  if (!id) {
    return NextResponse.json({ error: "缺少令牌 id。" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "服务端尚未配置数据库。" }, { status: 503 });
  }

  const { error } = await admin
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id); // 强制只能改自己的

  if (error) {
    console.error("[tokens] revoke failed:", error.code, error.message);
    return NextResponse.json({ error: "吊销失败，稍后再试。" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

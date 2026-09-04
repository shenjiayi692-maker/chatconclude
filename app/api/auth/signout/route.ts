import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasValidOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "请求来源不合法。" }, { status: 403 });
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[auth] signout failed:", error.name);
    return NextResponse.json({ error: "退出失败，请稍后重试。" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

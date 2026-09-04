import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasValidOrigin } from "@/lib/request-security";

export async function DELETE(request: Request) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "请求来源不合法。" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  let confirmation = "";
  try {
    const body = await request.json();
    confirmation = typeof body?.confirmation === "string" ? body.confirmation : "";
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }
  if (confirmation !== "删除我的账号") {
    return NextResponse.json({ error: "请输入完整确认文字。" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "数据库未配置。" }, { status: 503 });
  }

  const { error: dataError } = await admin.rpc("delete_user_data", {
    p_user_id: user.id,
  });
  if (dataError) {
    console.error("[account-delete] data removal failed:", dataError.code, dataError.message);
    return NextResponse.json({ error: "删除数据失败，请稍后重试。" }, { status: 502 });
  }

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("[account-delete] auth removal failed:", authError.message);
    return NextResponse.json(
      { error: "数据已清空，但账号注销未完成。请重试或联系支持。" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

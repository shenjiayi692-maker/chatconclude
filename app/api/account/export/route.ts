import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录。" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "数据库未配置。" }, { status: 503 });
  }

  const [profile, items, reviews, tokens] = await Promise.all([
    admin
      .from("user_profiles")
      .select(
        "timezone, plan, preferred_capture_method, onboarding_completed_at, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("items")
      .select(
        "source_item_id, question, answer, source, conversation_title, captured_at, created_at, category, topic",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    admin
      .from("reviews")
      .select("week_start, review, quiz, item_count, created_at, archived_at")
      .eq("user_id", user.id)
      .order("week_start", { ascending: true }),
    admin
      .from("api_tokens")
      .select("label, created_at, revoked_at, expires_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const failed = [profile, items, reviews, tokens].find((result) => result.error);
  if (failed?.error) {
    console.error("[account-export] read failed:", failed.error.code, failed.error.message);
    return NextResponse.json({ error: "导出失败，稍后再试。" }, { status: 502 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
    },
    profile: profile.data,
    items: items.data ?? [],
    reviews: reviews.data ?? [],
    tokens: tokens.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="weekly-review-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

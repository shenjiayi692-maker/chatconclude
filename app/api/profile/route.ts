import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hasValidOrigin } from "@/lib/request-security";
import { normalizeTimezone, validTimezone } from "@/lib/timezone";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录。" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "数据库未配置。" }, { status: 503 });

  const { data, error } = await admin
    .from("user_profiles")
    .select("timezone, plan, preferred_capture_method, onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "读取设置失败。" }, { status: 502 });

  return NextResponse.json({
    timezone: normalizeTimezone(data?.timezone),
    plan: data?.plan ?? "free",
    configured: Boolean(data),
    preferredCaptureMethod: data?.preferred_capture_method ?? null,
    onboardingCompleted: Boolean(data?.onboarding_completed_at),
  });
}

export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录。" }, { status: 401 });

  if (!hasValidOrigin(req)) {
    return NextResponse.json({ error: "请求来源不合法。" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }
  const input = body as {
    timezone?: unknown;
    preferredCaptureMethod?: unknown;
    onboardingComplete?: unknown;
  };
  const hasTimezone = input.timezone !== undefined;
  const hasCaptureMethod = input.preferredCaptureMethod !== undefined;
  const completesOnboarding = input.onboardingComplete === true;

  if (hasTimezone && !validTimezone(input.timezone)) {
    return NextResponse.json({ error: "时区格式不正确。" }, { status: 400 });
  }
  const allowedCaptureMethods = new Set(["desktop", "mobile", "both"]);
  if (
    hasCaptureMethod &&
    (typeof input.preferredCaptureMethod !== "string" ||
      !allowedCaptureMethods.has(input.preferredCaptureMethod))
  ) {
    return NextResponse.json({ error: "采集方式不正确。" }, { status: 400 });
  }
  if (!hasTimezone && !hasCaptureMethod && !completesOnboarding) {
    return NextResponse.json({ error: "没有可保存的设置。" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "数据库未配置。" }, { status: 503 });
  const update: Record<string, string> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };
  if (hasTimezone) update.timezone = input.timezone as string;
  if (hasCaptureMethod) {
    update.preferred_capture_method = input.preferredCaptureMethod as string;
  }
  if (completesOnboarding) {
    update.onboarding_completed_at = new Date().toISOString();
  }
  const { error } = await admin.from("user_profiles").upsert(
    update,
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[profile] update failed:", error.code, error.message);
    return NextResponse.json({ error: "保存设置失败。" }, { status: 502 });
  }
  return NextResponse.json({
    timezone: hasTimezone ? input.timezone : undefined,
    preferredCaptureMethod: hasCaptureMethod ? input.preferredCaptureMethod : undefined,
    onboardingCompleted: completesOnboarding || undefined,
  });
}

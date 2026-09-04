import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * 邮件登录回调，兼容两种邮件模板：
 * - PKCE 流：?code=...        → exchangeCodeForSession
 * - OTP 流：?token_hash=&type= → verifyOtp
 * 成功后回到用户原本要去的页面；没有指定时进入本周回顾。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const requestedNext = searchParams.get("next");
  const next =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/app";

  const supabase = await createClient();

  async function successRedirect() {
    if (next === "/app") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("onboarding_completed_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!profile?.onboarding_completed_at) {
          return NextResponse.redirect(`${origin}/app/setup`);
        }
      }
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return successRedirect();
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return successRedirect();
    console.error("[auth/callback] verifyOtp failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=1`);
}

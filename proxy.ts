import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 的 proxy 约定（原 middleware）。刷新 Supabase 会话 cookie。
export default async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // 只在需要会话的页面路径跑；采集用的 API 走 Bearer、不依赖 cookie，无需经过这里
  matcher: [
    "/settings/:path*",
    "/app/:path*",
    "/login",
    "/auth/:path*",
    "/my",
    "/save",
    "/history",
    "/connect-extension",
  ],
};

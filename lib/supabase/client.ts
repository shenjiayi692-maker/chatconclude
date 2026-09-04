import { createBrowserClient } from "@supabase/ssr";

/** 浏览器端 Supabase client（anon key），用于登录/会话。 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

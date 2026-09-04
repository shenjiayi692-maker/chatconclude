import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 服务端 Supabase client（anon key + cookie 会话），用于 server component / route handler 读登录态。 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // server component 里 set 会抛错，由 middleware 负责刷新，忽略即可
          }
        },
      },
    },
  );
}

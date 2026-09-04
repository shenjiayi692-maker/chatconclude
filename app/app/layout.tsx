import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TimezoneBootstrap from "@/app/components/TimezoneBootstrap";
import AppNavigation from "./AppNavigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Weekly Review · 每周知识复习",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-full bg-zinc-50 pb-20 dark:bg-black sm:pb-0">
      <TimezoneBootstrap />
      <AppNavigation email={user?.email} />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">{children}</main>
    </div>
  );
}

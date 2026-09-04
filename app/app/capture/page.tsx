import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SaveClient from "@/app/save/SaveClient";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/capture");
  const query = await searchParams;

  return <SaveClient email={user.email} welcome={query.welcome === "1"} />;
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLatestReview } from "@/lib/weekly";
import MyReviewClient from "@/app/my/MyReviewClient";

export const dynamic = "force-dynamic";

export default async function ThisWeekPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_completed_at) redirect("/app/setup");
  const latest = await getLatestReview(user.id);

  return <MyReviewClient initialReview={latest} />;
}

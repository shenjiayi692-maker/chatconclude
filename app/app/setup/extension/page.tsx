import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConnectExtensionClient from "@/app/connect-extension/ConnectExtensionClient";

export const dynamic = "force-dynamic";

export default async function ExtensionSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/setup/extension");

  return <ConnectExtensionClient email={user.email} />;
}

import { redirect } from "next/navigation";

export default async function TokenSettingsPage() {
  redirect("/app/settings");
}

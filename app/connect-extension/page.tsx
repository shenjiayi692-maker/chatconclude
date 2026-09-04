import { redirect } from "next/navigation";

export default async function ConnectExtensionPage() {
  redirect("/app/setup/extension");
}

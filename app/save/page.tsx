import { redirect } from "next/navigation";

export default async function SavePage() {
  redirect("/app/capture");
}

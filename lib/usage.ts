import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface UsageContext {
  scope: "public_review" | "weekly_review" | "weekly_archive";
  userId?: string;
}

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
}

/** 只记录模型与 token 数，不记录 prompt、回答或用户文本。失败不影响主流程。 */
export async function recordUsage(
  context: UsageContext | undefined,
  model: string,
  usage: MessageUsage | undefined,
): Promise<void> {
  if (!context || !usage) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error } = await admin.from("usage_events").insert({
    user_id: context.userId ?? null,
    scope: context.scope,
    model,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
  });

  if (error) {
    console.error("[usage] insert failed:", error.code, error.message);
  }
}

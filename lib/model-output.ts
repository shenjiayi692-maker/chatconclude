import type { ClassifiedItem, QuizItem } from "@/lib/pipeline";

export function sanitizeClassifications(
  value: unknown,
  allowedIds: Set<string>,
): ClassifiedItem[] {
  if (!Array.isArray(value)) throw new Error("Classification output is not an array");

  const seen = new Set<string>();
  const result: ClassifiedItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (
      typeof item.id !== "string" ||
      !allowedIds.has(item.id) ||
      seen.has(item.id) ||
      (item.category !== "knowledge" &&
        item.category !== "task" &&
        item.category !== "other")
    ) {
      continue;
    }
    seen.add(item.id);
    result.push({
      id: item.id,
      category: item.category,
      topic:
        typeof item.topic === "string" && item.topic.trim()
          ? item.topic.trim().slice(0, 100)
          : "其它",
    });
  }
  return result;
}

export function sanitizeQuiz(value: unknown): QuizItem[] {
  if (!Array.isArray(value)) throw new Error("Quiz output is not an array");
  return value
    .filter(
      (raw): raw is { question: string; answer: string } =>
        Boolean(
          raw &&
            typeof raw === "object" &&
            typeof (raw as Record<string, unknown>).question === "string" &&
            typeof (raw as Record<string, unknown>).answer === "string" &&
            (raw as { question: string }).question.trim() &&
            (raw as { answer: string }).answer.trim(),
        ),
    )
    .slice(0, 5)
    .map((item) => ({
      question: item.question.trim().slice(0, 1_000),
      answer: item.answer.trim().slice(0, 4_000),
    }));
}

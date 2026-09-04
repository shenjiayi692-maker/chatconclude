export interface NormalizedItem {
  id: string;
  question: string;
  source: "paste";
}

// 单次输入上限：超出则由调用方拒绝并提示裁剪。
export const MAX_SEGMENTS = 40;
export const MAX_CHARS = 12000;

/**
 * 粘贴文本 → NormalizedItem[]。按空行粗切段，不做精确问答配对，
 * 每段是否含知识提问交给分类 prompt 判断。
 */
export function normalize(raw: string): NormalizedItem[] {
  return raw
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((question, i) => ({
      id: `seg-${i}`,
      question,
      source: "paste" as const,
    }));
}

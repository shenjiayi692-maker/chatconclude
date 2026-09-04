import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeClassifications, sanitizeQuiz } from "../lib/model-output.ts";

test("分类输出只接受本次 id、合法类别并去重", () => {
  const result = sanitizeClassifications(
    [
      { id: "a", category: "knowledge", topic: " 生物 " },
      { id: "a", category: "task", topic: "重复" },
      { id: "outside", category: "knowledge", topic: "注入" },
      { id: "b", category: "invalid", topic: "无效" },
      { id: "c", category: "task", topic: "" },
    ],
    new Set(["a", "b", "c"]),
  );
  assert.deepEqual(result, [
    { id: "a", category: "knowledge", topic: "生物" },
    { id: "c", category: "task", topic: "其它" },
  ]);
});

test("Quiz 丢弃畸形项并限制数量和长度", () => {
  const result = sanitizeQuiz([
    { question: " Q1 ", answer: " A1 " },
    null,
    { question: "", answer: "empty" },
    ...Array.from({ length: 10 }, (_, index) => ({
      question: `Q${index + 2}`,
      answer: "x".repeat(5_000),
    })),
  ]);
  assert.equal(result.length, 5);
  assert.deepEqual(result[0], { question: "Q1", answer: "A1" });
  assert.equal(result[1].answer.length, 4_000);
});

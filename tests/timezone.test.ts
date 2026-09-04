import assert from "node:assert/strict";
import test from "node:test";
import { groupByLocalWeek, normalizeTimezone, weekStart } from "../lib/timezone.ts";

test("Asia/Shanghai 周一边界转换为正确 UTC", () => {
  const result = weekStart(Date.parse("2026-07-18T12:00:00Z"), "Asia/Shanghai");
  assert.equal(result.dateStr, "2026-07-13");
  assert.equal(new Date(result.startMs).toISOString(), "2026-07-12T16:00:00.000Z");
});

test("Europe/Berlin 夏令时周一边界正确", () => {
  const result = weekStart(Date.parse("2026-07-18T12:00:00Z"), "Europe/Berlin");
  assert.equal(result.dateStr, "2026-07-13");
  assert.equal(new Date(result.startMs).toISOString(), "2026-07-12T22:00:00.000Z");
});

test("非法时区回退到默认时区", () => {
  assert.equal(normalizeTimezone("not/a-zone"), "Asia/Shanghai");
});

test("超过 60 条仍完整归入同一周，不被截断", () => {
  const items = Array.from({ length: 80 }, (_, index) => ({
    id: index,
    at: Date.parse("2026-07-15T08:00:00Z") + index * 1000,
  }));
  const groups = groupByLocalWeek(items, (item) => item.at, "Asia/Shanghai");
  assert.equal(groups.size, 1);
  assert.equal([...groups.values()][0].length, 80);
});

test("跨周条目分别归档", () => {
  const items = [
    { id: 1, at: Date.parse("2026-07-05T10:00:00Z") },
    { id: 2, at: Date.parse("2026-07-12T10:00:00Z") },
  ];
  const groups = groupByLocalWeek(items, (item) => item.at, "Asia/Shanghai");
  assert.deepEqual([...groups.keys()], ["2026-06-29", "2026-07-06"]);
});

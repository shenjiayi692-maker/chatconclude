export const DEFAULT_TIMEZONE = "Asia/Shanghai";

const weekdayIndex: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoWeekday: number;
}

export function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(value: unknown): string {
  return validTimezone(value) ? value : DEFAULT_TIMEZONE;
}

function zonedParts(timestampMs: number, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    isoWeekday: weekdayIndex[map.weekday] ?? 1,
  };
}

function offsetAt(timestampMs: number, timeZone: string): number {
  const p = zonedParts(timestampMs, timeZone);
  const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return representedAsUtc - Math.floor(timestampMs / 1000) * 1000;
}

/** 把某时区的本地年月日 00:00 转成 UTC 时间戳，迭代可覆盖 DST 切换。 */
function localMidnightUtc(year: number, month: number, day: number, timeZone: string): number {
  const wallClockUtc = Date.UTC(year, month - 1, day);
  let result = wallClockUtc;
  for (let i = 0; i < 3; i += 1) {
    result = wallClockUtc - offsetAt(result, timeZone);
  }
  return result;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** 给定时刻所在自然周的本地周一 00:00，返回真实 UTC 边界和本地 YYYY-MM-DD。 */
export function weekStart(
  timestampMs: number,
  requestedTimezone: string,
): { startMs: number; dateStr: string } {
  const timeZone = normalizeTimezone(requestedTimezone);
  const local = zonedParts(timestampMs, timeZone);
  const mondayDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day) - (local.isoWeekday - 1) * 86_400_000,
  );
  const year = mondayDate.getUTCFullYear();
  const month = mondayDate.getUTCMonth() + 1;
  const day = mondayDate.getUTCDate();

  return {
    startMs: localMidnightUtc(year, month, day, timeZone),
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
  };
}

export function groupByLocalWeek<T>(
  items: T[],
  timestamp: (item: T) => number,
  requestedTimezone: string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = weekStart(timestamp(item), requestedTimezone).dateStr;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

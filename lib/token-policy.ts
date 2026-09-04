export const DEVICE_TOKEN_TTL_DAYS = 365;
export const TOKEN_USAGE_WRITE_INTERVAL_MS = 60 * 60 * 1000;

const FIXED_EXPIRY_LABEL_PREFIXES = ["Chrome Web Store reviewer"];

export function deviceTokenExpiresAt(nowMs = Date.now()): string {
  return new Date(nowMs + DEVICE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isRollingDeviceToken(label: string | null): boolean {
  return !FIXED_EXPIRY_LABEL_PREFIXES.some((prefix) => label?.startsWith(prefix));
}

export function shouldRecordTokenUse(lastUsedAt: string | null, nowMs = Date.now()): boolean {
  return (
    !lastUsedAt ||
    nowMs - new Date(lastUsedAt).getTime() > TOKEN_USAGE_WRITE_INTERVAL_MS
  );
}

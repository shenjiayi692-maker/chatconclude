import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVICE_TOKEN_TTL_DAYS,
  deviceTokenExpiresAt,
  isRollingDeviceToken,
  shouldRecordTokenUse,
} from "../lib/token-policy.ts";

test("普通设备令牌获得 365 天有效期", () => {
  const nowMs = Date.parse("2026-07-30T00:00:00.000Z");
  assert.equal(DEVICE_TOKEN_TTL_DAYS, 365);
  assert.equal(deviceTokenExpiresAt(nowMs), "2027-07-30T00:00:00.000Z");
});

test("普通设备滚动续期，Chrome 审核令牌保持固定到期日", () => {
  assert.equal(isRollingDeviceToken("Chrome 扩展自动连接"), true);
  assert.equal(isRollingDeviceToken("我的 MacBook"), true);
  assert.equal(isRollingDeviceToken("Chrome Web Store reviewer"), false);
  assert.equal(isRollingDeviceToken("Chrome Web Store reviewer 2026-08"), false);
});

test("令牌使用时间最多每小时写入一次", () => {
  const nowMs = Date.parse("2026-07-30T12:00:00.000Z");
  assert.equal(shouldRecordTokenUse(null, nowMs), true);
  assert.equal(shouldRecordTokenUse("2026-07-30T11:30:00.000Z", nowMs), false);
  assert.equal(shouldRecordTokenUse("2026-07-30T10:00:00.000Z", nowMs), true);
});

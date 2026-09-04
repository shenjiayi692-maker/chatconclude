#!/usr/bin/env node
/**
 * 最小令牌签发脚本（v1 不做设置页，验收/自用够了）。
 *
 * 用法：
 *   node scripts/mint-token.mjs [--user <uuid>] [--label <备注>]
 *
 * - 必须传入已存在的 Auth user UUID
 * - 生成 32 字节随机令牌，服务端只存 sha256，明文只打印这一次
 * - 需要 .env.local 里有 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// 轻量读取 .env.local（不引入 dotenv 依赖）
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(import.meta.dirname, "..", ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* .env.local 不存在时靠进程环境变量 */
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user") out.user = args[++i];
    else if (args[i] === "--label") out.label = args[++i];
  }
  return out;
}

loadEnvLocal();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（配在 .env.local）。");
  process.exit(1);
}

const { user, label } = parseArgs();
if (process.env.ALLOW_ADMIN_TOKEN_MINT !== "1") {
  console.error("此脚本仅用于应急管理。确认后设置 ALLOW_ADMIN_TOKEN_MINT=1 再运行。");
  process.exit(1);
}
if (!user) {
  console.error("必须传入 --user <真实 Auth 用户 UUID>，不再自动创建孤立 user_id。");
  process.exit(1);
}

const userId = user;
const token = `wr_${randomBytes(32).toString("hex")}`;
const tokenHash = createHash("sha256").update(token).digest("hex");
const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
if (authError || !authUser.user) {
  console.error("找不到这个 Auth 用户，拒绝签发。");
  process.exit(1);
}

const { error } = await supabase.from("api_tokens").insert({
  user_id: userId,
  token_hash: tokenHash,
  label: label || null,
  expires_at: expiresAt,
});

if (error) {
  console.error("写入失败：", error.message);
  process.exit(1);
}

console.log("令牌已签发（只显示这一次，服务端只存 hash）：\n");
console.log(`  user_id: ${userId}`);
console.log(`  token:   ${token}\n`);
console.log("把 token 粘贴到插件弹窗的「接入令牌」里。");

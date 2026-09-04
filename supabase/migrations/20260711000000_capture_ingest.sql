-- 采集层：api_tokens（插件接入令牌）+ items（采集到的问答）+ 幂等入库 RPC。
-- 注意：本仓库此前是无状态 demo，没有既存表——这里直接 CREATE 而非在「现有 items 表」上 ALTER。

create extension if not exists pgcrypto;

-- 个人接入令牌：服务端只存 hash，明文只在签发时展示一次
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists api_tokens_user_id_idx on public.api_tokens (user_id);

-- 采集到的问答条目
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_item_id text not null,          -- 插件侧的 `${conversationId}#${turnIndex}`
  content_hash text not null,            -- sha256(question + '\n' + answer) 前 16 字节 hex
  question text not null,
  answer text,
  source text not null,                  -- 'claude' | 'chatgpt' | 'deepseek'
  conversation_title text,
  captured_at timestamptz,               -- 抓取时刻（不是消息的真实时间）
  created_at timestamptz not null default now(),
  -- 去重双保险：source_item_id 会因用户编辑消息导致 turn_index 平移，content_hash 兜底
  constraint items_user_source_item_unique unique (user_id, source_item_id),
  constraint items_user_content_hash_unique unique (user_id, content_hash)
);

create index if not exists items_user_id_idx on public.items (user_id);

-- RLS：按 user_id 隔离。服务端走 service role（绕过 RLS）写入；
-- 这些策略保护未来客户端携带用户 JWT 直读的场景。
alter table public.api_tokens enable row level security;
alter table public.items enable row level security;

drop policy if exists items_select_own on public.items;
create policy items_select_own on public.items
  for select using (auth.uid() = user_id);

drop policy if exists api_tokens_select_own on public.api_tokens;
create policy api_tokens_select_own on public.api_tokens
  for select using (auth.uid() = user_id);

-- 幂等入库：ON CONFLICT DO NOTHING 不指定冲突目标，两个唯一约束任一冲突都跳过，
-- 批内互相重复的行同样被吞掉。返回 { saved, duplicates }。
create or replace function public.ingest_items(p_user_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int := coalesce(jsonb_array_length(p_items), 0);
  v_saved int := 0;
begin
  insert into public.items
    (user_id, source_item_id, content_hash, question, answer, source, conversation_title, captured_at)
  select
    p_user_id,
    x."id",
    x."contentHash",
    x."question",
    x."answer",
    x."source",
    x."conversationTitle",
    nullif(x."capturedAt", '')::timestamptz
  from jsonb_to_recordset(p_items) as x(
    "id" text,
    "contentHash" text,
    "question" text,
    "answer" text,
    "source" text,
    "conversationTitle" text,
    "capturedAt" text
  )
  on conflict do nothing;

  get diagnostics v_saved = row_count;

  return jsonb_build_object('saved', v_saved, 'duplicates', v_total - v_saved);
end;
$$;

revoke execute on function public.ingest_items(uuid, jsonb) from public, anon, authenticated;

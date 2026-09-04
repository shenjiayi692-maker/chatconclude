-- 商业化加固：
-- 1) 周报改为按周保留历史；2) 令牌过期/最近使用；3) 用户时区；
-- 4) 原始条目容量护栏；5) 模型用量记录；6) 批量缓存分类结果。

-- 用户配置：网页首次进入时可写入浏览器时区。
create table if not exists public.user_profiles (
  user_id uuid primary key,
  timezone text not null default 'Asia/Shanghai',
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 令牌默认 90 天过期；旧令牌从本次迁移起再给 90 天。
alter table public.api_tokens add column if not exists expires_at timestamptz;
alter table public.api_tokens add column if not exists last_used_at timestamptz;
update public.api_tokens
set expires_at = now() + interval '90 days'
where expires_at is null;
alter table public.api_tokens alter column expires_at set default (now() + interval '90 days');
alter table public.api_tokens alter column expires_at set not null;

-- reviews 从“每用户只留一份”升级为“每用户每周一份”。
alter table public.reviews drop constraint if exists reviews_pkey;
alter table public.reviews
  add constraint reviews_pkey primary key (user_id, week_start);
alter table public.reviews add column if not exists archived_at timestamptz;
create index if not exists reviews_user_created_idx
  on public.reviews (user_id, week_start desc);

-- 记录模型 token 用量，不保存对话正文。
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  scope text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_scope_created_idx
  on public.usage_events (scope, created_at desc);
alter table public.usage_events enable row level security;
-- usage_events 仅 service role 读写，不暴露给客户端。

create or replace view public.daily_usage_summary
with (security_invoker = true)
as
select
  created_at::date as usage_date,
  scope,
  model,
  count(*) as calls,
  sum(input_tokens) as input_tokens,
  sum(output_tokens) as output_tokens
from public.usage_events
group by created_at::date, scope, model;

revoke all on public.daily_usage_summary from public, anon, authenticated;

-- 批量写回分类缓存，替代逐条 UPDATE。
create or replace function public.cache_item_classifications(
  p_user_id uuid,
  p_items jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
  set category = x.category,
      topic = x.topic
  from jsonb_to_recordset(p_items) as x(id uuid, category text, topic text)
  where i.id = x.id
    and i.user_id = p_user_id
    and x.category in ('knowledge', 'task', 'other');
$$;

revoke execute on function public.cache_item_classifications(uuid, jsonb)
  from public, anon, authenticated;

-- 替换入库 RPC：每个用户最多保留 500 条尚未归档的原始条目。
-- advisory lock 避免并发请求同时越过容量检查。
create or replace function public.ingest_items(p_user_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int := coalesce(jsonb_array_length(p_items), 0);
  v_existing int := 0;
  v_capacity int := 0;
  v_saved int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_existing
  from public.items
  where user_id = p_user_id;

  v_capacity := greatest(0, 500 - v_existing);

  insert into public.items
    (user_id, source_item_id, content_hash, question, answer, source, conversation_title, captured_at)
  select
    p_user_id,
    x.item->>'id',
    x.item->>'contentHash',
    x.item->>'question',
    x.item->>'answer',
    x.item->>'source',
    x.item->>'conversationTitle',
    nullif(x.item->>'capturedAt', '')::timestamptz
  from jsonb_array_elements(p_items) with ordinality as x(item, position)
  order by x.position
  limit v_capacity
  on conflict do nothing;

  get diagnostics v_saved = row_count;

  return jsonb_build_object(
    'saved', v_saved,
    'duplicates', greatest(0, least(v_total, v_capacity) - v_saved),
    'rejected', greatest(0, v_total - v_capacity)
  );
end;
$$;

revoke execute on function public.ingest_items(uuid, jsonb)
  from public, anon, authenticated;

-- 周归档的“保存最终周报 + 删除已处理原文”必须同一事务完成，
-- 避免只完成一半后重试时重复合并。
create or replace function public.archive_week(
  p_user_id uuid,
  p_week_start date,
  p_review text,
  p_quiz jsonb,
  p_item_count int,
  p_item_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));

  insert into public.reviews
    (user_id, week_start, review, quiz, item_count, created_at, archived_at)
  values
    (p_user_id, p_week_start, p_review, p_quiz, p_item_count, now(), now())
  on conflict (user_id, week_start) do update
    set review = excluded.review,
        quiz = excluded.quiz,
        item_count = excluded.item_count,
        created_at = excluded.created_at,
        archived_at = excluded.archived_at;

  delete from public.items
  where user_id = p_user_id
    and id = any(p_item_ids);
end;
$$;

revoke execute on function public.archive_week(uuid, date, text, jsonb, int, uuid[])
  from public, anon, authenticated;

-- 账号删除时一次清空应用数据；Auth 用户由服务端 Admin API 随后删除。
create or replace function public.delete_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.items where user_id = p_user_id;
  delete from public.reviews where user_id = p_user_id;
  delete from public.api_tokens where user_id = p_user_id;
  delete from public.usage_events where user_id = p_user_id;
  delete from public.user_profiles where user_id = p_user_id;
end;
$$;

revoke execute on function public.delete_user_data(uuid)
  from public, anon, authenticated;

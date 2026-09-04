-- 每周周期：条目上缓存分类结果（增量分类）+ 每用户一份最近周报（换周归档、原始内容清空）。

-- 1) items 上缓存分类：新采集进来时为 null，生成周报时只对 null 的调用 classify，写回这里复用。
alter table public.items add column if not exists category text;  -- knowledge | task | other | null(未分类)
alter table public.items add column if not exists topic text;

-- 2) 每用户只留最近一份周报（user_id 主键 → upsert 覆盖，天然「只留最近一份」）。
--    原始 items 换周清空后，周报是唯一留存物；不存 filtered（那是要被清掉的原始内容）。
create table if not exists public.reviews (
  user_id uuid primary key,
  week_start date not null,              -- 该周报覆盖的自然周周一（+08:00）
  review text not null,
  quiz jsonb not null default '[]'::jsonb,
  item_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists reviews_select_own on public.reviews;
create policy reviews_select_own on public.reviews
  for select using (auth.uid() = user_id);
-- 写入只走服务端 service role（绕过 RLS）；不给 anon/authenticated 直写。

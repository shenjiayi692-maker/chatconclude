-- 共享存储限流：替代进程内内存计数器（serverless 多实例下内存限流形同虚设）。
-- 一个计数表 + 一个原子 upsert RPC，跨实例真生效。

create table if not exists public.rate_counters (
  key text primary key,
  count int not null default 0,
  expires_at timestamptz not null
);

-- 只让 service role 经 RPC 访问，锁死直接读写
alter table public.rate_counters enable row level security;

-- 原子「命中一次并判断是否超限」：窗口过期则重置，否则 +1；返回是否仍在额度内。
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_counters (key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rate_counters.expires_at < now() then 1
                     else rate_counters.count + 1 end,
        expires_at = case when rate_counters.expires_at < now() then now() + make_interval(secs => p_window_seconds)
                          else rate_counters.expires_at end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- 过期计数行可选清理（行数很小，也可留给定期任务）：
--   delete from public.rate_counters where expires_at < now();

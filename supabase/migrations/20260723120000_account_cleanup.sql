-- 账号删除时同时清除与用户、设备令牌关联的限流键，
-- 避免应用数据删完后 rate_counters 里仍短期残留用户 UUID 或令牌 hash。
create or replace function public.delete_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rate_counters
  where key = 'rl:review:user:' || p_user_id::text
     or key = 'rl:min:usr:' || p_user_id::text
     or key in (
       select 'rl:min:tok:' || token_hash
       from public.api_tokens
       where user_id = p_user_id
     );

  delete from public.items where user_id = p_user_id;
  delete from public.reviews where user_id = p_user_id;
  delete from public.api_tokens where user_id = p_user_id;
  delete from public.usage_events where user_id = p_user_id;
  delete from public.user_profiles where user_id = p_user_id;
end;
$$;

revoke execute on function public.delete_user_data(uuid)
  from public, anon, authenticated;

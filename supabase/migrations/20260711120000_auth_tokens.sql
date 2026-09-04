-- 引入 Supabase Auth（邮箱魔法链接）后，令牌绑到登录用户 auth.uid()。
-- 令牌的生成/吊销走服务端 service role（代码里强制 user_id = 会话用户），
-- 这里补齐 RLS，让登录用户能读到自己的令牌列表、以及（作为第二层防护）改自己的令牌。

-- 已登录用户可读自己的令牌（列表页用）
drop policy if exists api_tokens_select_own on public.api_tokens;
create policy api_tokens_select_own on public.api_tokens
  for select using (auth.uid() = user_id);

-- 已登录用户可吊销自己的令牌（update revoked_at）
drop policy if exists api_tokens_update_own on public.api_tokens;
create policy api_tokens_update_own on public.api_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 已登录用户可为自己创建令牌
drop policy if exists api_tokens_insert_own on public.api_tokens;
create policy api_tokens_insert_own on public.api_tokens
  for insert with check (auth.uid() = user_id);

-- items 的 select policy 已在初始迁移里按 auth.uid() 隔离，无需改动。

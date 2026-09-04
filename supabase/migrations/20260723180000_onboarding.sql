-- 首次使用状态独立于时区和令牌，避免用技术实现细节猜测用户是否完成引导。
alter table public.user_profiles
  add column if not exists preferred_capture_method text,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.user_profiles
  drop constraint if exists user_profiles_preferred_capture_method_check;

alter table public.user_profiles
  add constraint user_profiles_preferred_capture_method_check
  check (
    preferred_capture_method is null
    or preferred_capture_method in ('desktop', 'mobile', 'both')
  );

-- 上线前已存在的账号不重复进入首次设置。
update public.user_profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, created_at, now())
where onboarding_completed_at is null;

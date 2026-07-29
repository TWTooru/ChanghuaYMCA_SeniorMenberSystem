-- legacy production schema 的 migration history 曾修復但未重播角色 migration，
-- 因此明確補回 import_season_data 所依賴的角色 helper，而不改動既有資料表或 policy。
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  -- app_metadata 未設定角色時採最小權限的 viewer，讓寫入 RPC 的角色檢查預設拒絕。
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
    'viewer'
  );
$$;

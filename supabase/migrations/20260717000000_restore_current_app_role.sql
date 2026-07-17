-- The legacy production schema predates the role migration.  Its migration
-- history was repaired without replaying table and policy changes, so restore
-- the helper required by import_season_data explicitly.
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
    'viewer'
  );
$$;

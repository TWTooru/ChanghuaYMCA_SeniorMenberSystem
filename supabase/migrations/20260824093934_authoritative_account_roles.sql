begin;

create schema if not exists private;

create table public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index app_user_roles_single_owner_idx
on public.app_user_roles ((role))
where role = 'owner';

alter table public.app_user_roles enable row level security;
revoke all on table public.app_user_roles from public, anon, authenticated;
grant select on table public.app_user_roles to authenticated;
grant all on table public.app_user_roles to service_role;

create policy "users can read own app role"
on public.app_user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function private.resolve_initial_app_role(
  p_email text,
  p_legacy_role text,
  p_is_backfill boolean
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when lower(p_email) = 'admin@admin.com' then 'owner'
    when p_is_backfill and lower(p_email) = 'stern4310910040@gmail.com' then 'admin'
    when p_is_backfill and p_legacy_role in ('viewer', 'editor', 'admin') then p_legacy_role
    else 'viewer'
  end
$$;

revoke all on function private.resolve_initial_app_role(text, text, boolean)
from public, anon, authenticated;

insert into public.app_user_roles (user_id, role)
select
  u.id,
  private.resolve_initial_app_role(
    u.email,
    u.raw_app_meta_data ->> 'app_role',
    true
  )
from auth.users u
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();

create or replace function private.create_app_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_user_roles (user_id, role)
  values (
    new.id,
    private.resolve_initial_app_role(new.email, null, false)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_app_user_role()
from public, anon, authenticated;

drop trigger if exists create_app_user_role_after_auth_user_insert on auth.users;
create trigger create_app_user_role_after_auth_user_insert
after insert on auth.users
for each row execute function private.create_app_user_role();

create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case r.role
    when 'owner' then 'admin'
    when 'admin' then 'admin'
    when 'editor' then 'editor'
    when 'viewer' then 'viewer'
    else null
  end
  from public.app_user_roles r
  where r.user_id = (select auth.uid())
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

do $migration$
begin
  if pg_catalog.to_regclass('public.students') is not null then
    execute 'drop policy if exists "role users can select students" on public.students';
    execute 'drop policy if exists "role editors can insert students" on public.students';
    execute 'drop policy if exists "role editors can update students" on public.students';
    execute 'drop policy if exists "role admins can delete students" on public.students';

    execute $policy$
      create policy "role users can select students"
      on public.students for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can insert students"
      on public.students for insert
      to authenticated
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can update students"
      on public.students for update
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role admins can delete students"
      on public.students for delete
      to authenticated
      using ((select public.current_app_role()) = 'admin')
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.enrollments') is not null then
    execute 'drop policy if exists "role users can select enrollments" on public.enrollments';
    execute 'drop policy if exists "role editors can insert enrollments" on public.enrollments';
    execute 'drop policy if exists "role editors can update enrollments" on public.enrollments';
    execute 'drop policy if exists "role admins can delete enrollments" on public.enrollments';

    execute $policy$
      create policy "role users can select enrollments"
      on public.enrollments for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can insert enrollments"
      on public.enrollments for insert
      to authenticated
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can update enrollments"
      on public.enrollments for update
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role admins can delete enrollments"
      on public.enrollments for delete
      to authenticated
      using ((select public.current_app_role()) = 'admin')
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.courses') is not null then
    execute 'drop policy if exists "role users can select courses" on public.courses';
    execute 'drop policy if exists "role editors can insert courses" on public.courses';
    execute 'drop policy if exists "role editors can update courses" on public.courses';

    execute $policy$
      create policy "role users can select courses"
      on public.courses for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can insert courses"
      on public.courses for insert
      to authenticated
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can update courses"
      on public.courses for update
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.courses') is not null
     and pg_catalog.to_regclass('public.billing_receipt_courses') is not null then
    execute 'drop policy if exists "role admins can delete courses" on public.courses';
    execute 'drop policy if exists "role editors can delete unbilled courses" on public.courses';
    execute $policy$
      create policy "role editors can delete unbilled courses"
      on public.courses for delete
      to authenticated
      using (
        ((select public.current_app_role()) in ('editor', 'admin'))
        and not exists (
          select 1
          from public.billing_receipt_courses link
          where link.course_id = courses.course_id
        )
      )
    $policy$;
  elsif pg_catalog.to_regclass('public.courses') is not null
        and pg_catalog.to_regclass('public.course_receipts') is not null then
    execute 'drop policy if exists "role admins can delete courses" on public.courses';
    execute 'drop policy if exists "role editors can delete unbilled courses" on public.courses';
    execute $policy$
      create policy "role editors can delete unbilled courses"
      on public.courses for delete
      to authenticated
      using (
        ((select public.current_app_role()) in ('editor', 'admin'))
        and not exists (
          select 1
          from public.course_receipts receipt
          where receipt.course_id = courses.course_id
        )
      )
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.course_catalog') is not null then
    execute 'drop policy if exists "role users can select course catalog" on public.course_catalog';
    execute 'drop policy if exists "role editors can insert course catalog" on public.course_catalog';
    execute 'drop policy if exists "role editors can update course catalog" on public.course_catalog';

    execute $policy$
      create policy "role users can select course catalog"
      on public.course_catalog for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can insert course catalog"
      on public.course_catalog for insert
      to authenticated
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can update course catalog"
      on public.course_catalog for update
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.course_receipts') is not null then
    execute 'drop policy if exists "role users can select course receipts" on public.course_receipts';
    execute 'drop policy if exists "role editors can insert course receipts" on public.course_receipts';
    execute 'drop policy if exists "role editors can update course receipts" on public.course_receipts';
    execute 'drop policy if exists "role editors can delete course receipts" on public.course_receipts';

    execute $policy$
      create policy "role users can select course receipts"
      on public.course_receipts for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can insert course receipts"
      on public.course_receipts for insert
      to authenticated
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can update course receipts"
      on public.course_receipts for update
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
      with check ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
    execute $policy$
      create policy "role editors can delete course receipts"
      on public.course_receipts for delete
      to authenticated
      using ((select public.current_app_role()) in ('editor', 'admin'))
    $policy$;
  end if;
end
$migration$;

do $migration$
begin
  if pg_catalog.to_regclass('public.billing_receipts') is not null then
    execute 'drop policy if exists "role users can select billing receipts" on public.billing_receipts';
    execute $policy$
      create policy "role users can select billing receipts"
      on public.billing_receipts for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
  end if;

  if pg_catalog.to_regclass('public.billing_receipt_courses') is not null then
    execute 'drop policy if exists "role users can select billing receipt courses" on public.billing_receipt_courses';
    execute $policy$
      create policy "role users can select billing receipt courses"
      on public.billing_receipt_courses for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
  end if;

  if pg_catalog.to_regclass('public.enrollment_forms') is not null then
    execute 'drop policy if exists "role users can select enrollment forms" on public.enrollment_forms';
    execute $policy$
      create policy "role users can select enrollment forms"
      on public.enrollment_forms for select
      to authenticated
      using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
    $policy$;
  end if;
end
$migration$;

commit;

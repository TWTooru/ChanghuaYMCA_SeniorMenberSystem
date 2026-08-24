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
declare
  routine_record record;
  after_record record;
  original_definition text;
  safe_definition text;
  safe_source text;
  transformed_guard_count integer;
  untransformable_routines text;
  remaining_routines text;
begin
  with routine_lines as (
    select
      procedure_record.oid,
      namespace_record.nspname,
      procedure_record.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
        as identity_arguments,
      source_line.line,
      source_line.line_number,
      pg_catalog.lead(source_line.line, 1) over (
        partition by procedure_record.oid order by source_line.line_number
      ) as next_line,
      pg_catalog.lead(source_line.line, 2) over (
        partition by procedure_record.oid order by source_line.line_number
      ) as second_next_line
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    cross join lateral pg_catalog.regexp_split_to_table(
      procedure_record.prosrc,
      E'\\r?\\n'
    ) with ordinality as source_line(line, line_number)
    where namespace_record.nspname in ('public', 'private')
      and language_record.lanname = 'plpgsql'
      and procedure_record.prokind in ('f', 'p')
      and procedure_record.prosecdef
  ), discovered_guards as (
    select *,
      (
        line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*[(][[:blank:]',a-z_]+[)][[:blank:]]+then[[:blank:]]*$$safe_guard$
        or line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)[[:blank:]]*'[a-z_]+'[[:blank:]]+then[[:blank:]]*$$safe_guard$
      ) as safely_transformable
    from routine_lines
    where (
        line ~* $unsafe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in$unsafe_guard$
        or line ~* $unsafe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)$unsafe_guard$
      )
      and next_line ~* '^[[:blank:]]*raise[[:blank:]]+exception'
      and second_next_line ~*
        '^[[:blank:]]*end[[:blank:]]+if[[:blank:]]*;[[:blank:]]*$'
  )
  select pg_catalog.string_agg(
    pg_catalog.format(
      '%I.%I(%s) line %s',
      nspname,
      proname,
      identity_arguments,
      line_number
    ),
    ', '
    order by nspname, proname, identity_arguments, line_number
  )
  into untransformable_routines
  from discovered_guards
  where not safely_transformable;

  if untransformable_routines is not null then
    raise exception 'UNTRANSFORMABLE_UNSAFE_ROLE_GUARDS: %',
      untransformable_routines;
  end if;

  for routine_record in
    select
      procedure_record.oid,
      procedure_record.pronamespace,
      procedure_record.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
        as identity_arguments,
      procedure_record.proowner,
      procedure_record.prolang,
      procedure_record.prokind,
      procedure_record.provolatile,
      procedure_record.proisstrict,
      procedure_record.prosecdef,
      procedure_record.proleakproof,
      procedure_record.proparallel,
      procedure_record.procost,
      procedure_record.prorows,
      procedure_record.prosupport,
      procedure_record.proconfig,
      procedure_record.proacl,
      procedure_record.prorettype,
      procedure_record.proretset,
      procedure_record.proargtypes,
      procedure_record.proallargtypes,
      procedure_record.proargmodes,
      procedure_record.proargnames,
      procedure_record.prosrc
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    where namespace_record.nspname in ('public', 'private')
      and language_record.lanname = 'plpgsql'
      and procedure_record.prokind in ('f', 'p')
      and procedure_record.prosecdef
      and exists (
        select 1
        from (
          select
            source_line.line,
            pg_catalog.lead(source_line.line, 1) over (
              order by source_line.line_number
            ) as next_line,
            pg_catalog.lead(source_line.line, 2) over (
              order by source_line.line_number
            ) as second_next_line
          from pg_catalog.regexp_split_to_table(
            procedure_record.prosrc,
            E'\\r?\\n'
          ) with ordinality as source_line(line, line_number)
        ) parsed_source
        where (
            parsed_source.line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*[(][[:blank:]',a-z_]+[)][[:blank:]]+then[[:blank:]]*$$safe_guard$
            or parsed_source.line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)[[:blank:]]*'[a-z_]+'[[:blank:]]+then[[:blank:]]*$$safe_guard$
          )
          and parsed_source.next_line ~*
            '^[[:blank:]]*raise[[:blank:]]+exception'
          and parsed_source.second_next_line ~*
            '^[[:blank:]]*end[[:blank:]]+if[[:blank:]]*;[[:blank:]]*$'
      )
  loop
    original_definition := pg_catalog.pg_get_functiondef(routine_record.oid);
    with source_lines as (
      select
        source_line.line,
        source_line.line_number,
        pg_catalog.lead(source_line.line, 1) over (
          order by source_line.line_number
        ) as next_line,
        pg_catalog.lead(source_line.line, 2) over (
          order by source_line.line_number
        ) as second_next_line
      from pg_catalog.regexp_split_to_table(
        routine_record.prosrc,
        E'\\r?\\n'
      ) with ordinality as source_line(line, line_number)
    ), classified_lines as (
      select *,
        (
          (
            line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*[(][[:blank:]',a-z_]+[)][[:blank:]]+then[[:blank:]]*$$safe_guard$
            or line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)[[:blank:]]*'[a-z_]+'[[:blank:]]+then[[:blank:]]*$$safe_guard$
          )
          and next_line ~* '^[[:blank:]]*raise[[:blank:]]+exception'
          and second_next_line ~*
            '^[[:blank:]]*end[[:blank:]]+if[[:blank:]]*;[[:blank:]]*$'
        ) as is_safe_guard
      from source_lines
    )
    select
      pg_catalog.string_agg(
        case
          when is_safe_guard and line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in$safe_guard$ then
            pg_catalog.regexp_replace(
              line,
              $rewrite$^([[:blank:]]*)if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*([(][[:blank:]',a-z_]+[)])[[:blank:]]+then[[:blank:]]*$rewrite$,
              $replacement$\1if coalesce(public.current_app_role() in \2, false) is not true then$replacement$,
              'i'
            )
          when is_safe_guard then
            pg_catalog.regexp_replace(
              line,
              $rewrite$^([[:blank:]]*)if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)[[:blank:]]*('[a-z_]+')[[:blank:]]+then[[:blank:]]*$rewrite$,
              $replacement$\1if coalesce(public.current_app_role() = \3, false) is not true then$replacement$,
              'i'
            )
          else line
        end,
        E'\n'
        order by line_number
      ),
      count(*) filter (where is_safe_guard)::integer
    into safe_source, transformed_guard_count
    from classified_lines;

    if transformed_guard_count = 0 then
      raise exception 'FAILED_TO_FIND_EXECUTABLE_ROLE_GUARD_FOR_%',
        routine_record.oid;
    end if;

    safe_definition := pg_catalog.replace(
      original_definition,
      routine_record.prosrc,
      safe_source
    );

    if safe_definition = original_definition then
      raise exception 'FAILED_TO_REWRITE_EXECUTABLE_ROLE_GUARD_FOR_%',
        routine_record.oid;
    end if;

    execute safe_definition;

    select
      procedure_record.oid,
      procedure_record.pronamespace,
      procedure_record.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
        as identity_arguments,
      procedure_record.proowner,
      procedure_record.prolang,
      procedure_record.prokind,
      procedure_record.provolatile,
      procedure_record.proisstrict,
      procedure_record.prosecdef,
      procedure_record.proleakproof,
      procedure_record.proparallel,
      procedure_record.procost,
      procedure_record.prorows,
      procedure_record.prosupport,
      procedure_record.proconfig,
      procedure_record.proacl,
      procedure_record.prorettype,
      procedure_record.proretset,
      procedure_record.proargtypes,
      procedure_record.proallargtypes,
      procedure_record.proargmodes,
      procedure_record.proargnames
    into after_record
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid = routine_record.oid;

    if not found
       or after_record.oid is distinct from routine_record.oid
       or after_record.pronamespace is distinct from routine_record.pronamespace
       or after_record.proname is distinct from routine_record.proname
       or after_record.identity_arguments is distinct from routine_record.identity_arguments
       or after_record.proowner is distinct from routine_record.proowner
       or after_record.prolang is distinct from routine_record.prolang
       or after_record.prokind is distinct from routine_record.prokind
       or after_record.provolatile is distinct from routine_record.provolatile
       or after_record.proisstrict is distinct from routine_record.proisstrict
       or after_record.prosecdef is distinct from routine_record.prosecdef
       or after_record.proleakproof is distinct from routine_record.proleakproof
       or after_record.proparallel is distinct from routine_record.proparallel
       or after_record.procost is distinct from routine_record.procost
       or after_record.prorows is distinct from routine_record.prorows
       or after_record.prosupport is distinct from routine_record.prosupport
       or after_record.proconfig is distinct from routine_record.proconfig
       or after_record.proacl is distinct from routine_record.proacl
       or after_record.prorettype is distinct from routine_record.prorettype
       or after_record.proretset is distinct from routine_record.proretset
       or after_record.proargtypes is distinct from routine_record.proargtypes
       or after_record.proallargtypes is distinct from routine_record.proallargtypes
       or after_record.proargmodes is distinct from routine_record.proargmodes
       or after_record.proargnames is distinct from routine_record.proargnames then
      raise exception 'ROUTINE_METADATA_CHANGED_DURING_ROLE_GUARD_REWRITE_FOR_%',
        routine_record.oid;
    end if;
  end loop;

  with routine_lines as (
    select
      procedure_record.oid,
      namespace_record.nspname,
      procedure_record.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
        as identity_arguments,
      source_line.line,
      source_line.line_number,
      pg_catalog.lead(source_line.line, 1) over (
        partition by procedure_record.oid order by source_line.line_number
      ) as next_line,
      pg_catalog.lead(source_line.line, 2) over (
        partition by procedure_record.oid order by source_line.line_number
      ) as second_next_line
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    cross join lateral pg_catalog.regexp_split_to_table(
      procedure_record.prosrc,
      E'\\r?\\n'
    ) with ordinality as source_line(line, line_number)
    where namespace_record.nspname in ('public', 'private')
      and language_record.lanname = 'plpgsql'
      and procedure_record.prokind in ('f', 'p')
      and procedure_record.prosecdef
  )
  select pg_catalog.string_agg(
    pg_catalog.format('%I.%I(%s)', nspname, proname, identity_arguments),
    ', ' order by nspname, proname, identity_arguments
  )
  into remaining_routines
  from routine_lines
  where next_line ~* '^[[:blank:]]*raise[[:blank:]]+exception'
    and second_next_line ~*
      '^[[:blank:]]*end[[:blank:]]+if[[:blank:]]*;[[:blank:]]*$'
    and (
      line ~* $unsafe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in$unsafe_guard$
      or line ~* $unsafe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)$unsafe_guard$
    );

  if remaining_routines is not null then
    raise exception 'UNSAFE_CURRENT_APP_ROLE_GUARDS_REMAIN: %', remaining_routines;
  end if;
end
$migration$;

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

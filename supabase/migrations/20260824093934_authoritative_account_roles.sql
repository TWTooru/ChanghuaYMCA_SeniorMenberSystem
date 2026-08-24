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

create or replace function private.mask_plpgsql_non_code(p_source text)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $function$
declare
  masked_source text := '';
  source_position integer := 1;
  source_length integer := pg_catalog.char_length(p_source);
  parser_state text := 'code';
  block_comment_depth integer := 0;
  dollar_delimiter text;
  dollar_tag text;
  dollar_tag_end_offset integer;
  dollar_tag_position integer;
  dollar_tag_character text;
  dollar_tag_is_valid boolean;
  dollar_quote_boundary boolean;
  current_character text;
  previous_character text;
  next_character text;
  current_pair text;
  escape_single_quote boolean := false;
begin
  while source_position <= source_length loop
    current_character := pg_catalog.substr(p_source, source_position, 1);
    previous_character := pg_catalog.substr(p_source, source_position - 1, 1);
    next_character := pg_catalog.substr(p_source, source_position + 1, 1);
    current_pair := pg_catalog.substr(p_source, source_position, 2);

    if parser_state = 'code' then
      if current_pair = '--' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
        parser_state := 'line_comment';
      elsif current_pair = '/*' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
        parser_state := 'block_comment';
        block_comment_depth := 1;
      elsif current_character = '''' then
        escape_single_quote := (
          source_position > 1
          and pg_catalog.substr(p_source, source_position - 1, 1) ~* 'e'
          and (
            source_position = 2
            or pg_catalog.substr(p_source, source_position - 2, 1)
              !~ '[[:alnum:]_$]'
          )
        ) or (
          source_position > 2
          and pg_catalog.substr(p_source, source_position - 2, 2) ~* 'u&'
          and (
            source_position = 3
            or pg_catalog.substr(p_source, source_position - 3, 1)
              !~ '[[:alnum:]_$]'
          )
        );
        masked_source := masked_source || ' ';
        source_position := source_position + 1;
        parser_state := 'single_quote';
      elsif current_character = '"' then
        masked_source := masked_source || ' ';
        source_position := source_position + 1;
        parser_state := 'double_quote';
      elsif current_character = '$' then
        dollar_delimiter := null;
        dollar_quote_boundary := source_position = 1;
        if not dollar_quote_boundary then
          dollar_quote_boundary := not (
            previous_character ~ '^[A-Za-z0-9_$]$'
            or pg_catalog.ascii(previous_character) >= 128
          );
        end if;

        if dollar_quote_boundary then
          dollar_tag_end_offset := pg_catalog.strpos(
            pg_catalog.substr(p_source, source_position + 1),
            '$'
          );
          if dollar_tag_end_offset > 0 then
            dollar_tag := pg_catalog.substr(
              p_source,
              source_position + 1,
              dollar_tag_end_offset - 1
            );
            dollar_tag_is_valid := dollar_tag = '';
            if dollar_tag <> '' then
              dollar_tag_character := pg_catalog.substr(dollar_tag, 1, 1);
              dollar_tag_is_valid := (
                dollar_tag_character ~ '^[A-Za-z_]$'
                or pg_catalog.ascii(dollar_tag_character) >= 128
              );
              dollar_tag_position := 2;
              while dollar_tag_is_valid
                    and dollar_tag_position <= pg_catalog.char_length(dollar_tag)
              loop
                dollar_tag_character := pg_catalog.substr(
                  dollar_tag,
                  dollar_tag_position,
                  1
                );
                dollar_tag_is_valid := (
                  dollar_tag_character ~ '^[A-Za-z0-9_]$'
                  or pg_catalog.ascii(dollar_tag_character) >= 128
                );
                dollar_tag_position := dollar_tag_position + 1;
              end loop;
            end if;

            if dollar_tag_is_valid then
              dollar_delimiter := '$' || dollar_tag || '$';
            end if;
          end if;
        end if;

        if dollar_delimiter is not null then
          masked_source := masked_source || pg_catalog.repeat(
            ' ',
            pg_catalog.char_length(dollar_delimiter)
          );
          source_position := source_position
            + pg_catalog.char_length(dollar_delimiter);
          parser_state := 'dollar_quote';
        else
          masked_source := masked_source || current_character;
          source_position := source_position + 1;
        end if;
      else
        masked_source := masked_source || current_character;
        source_position := source_position + 1;
      end if;
    elsif parser_state = 'line_comment' then
      if current_character in (E'\r', E'\n') then
        masked_source := masked_source || current_character;
        parser_state := 'code';
      else
        masked_source := masked_source || ' ';
      end if;
      source_position := source_position + 1;
    elsif parser_state = 'block_comment' then
      if current_pair = '/*' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
        block_comment_depth := block_comment_depth + 1;
      elsif current_pair = '*/' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
        block_comment_depth := block_comment_depth - 1;
        if block_comment_depth = 0 then
          parser_state := 'code';
        end if;
      else
        masked_source := masked_source || case
          when current_character in (E'\r', E'\n') then current_character
          else ' '
        end;
        source_position := source_position + 1;
      end if;
    elsif parser_state = 'single_quote' then
      if current_pair = '''''' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
      elsif escape_single_quote and current_character = E'\\'
            and source_position < source_length then
        masked_source := masked_source || case
          when current_character in (E'\r', E'\n') then current_character
          else ' '
        end || case
          when next_character in (E'\r', E'\n') then next_character
          else ' '
        end;
        source_position := source_position + 2;
      elsif current_character = '''' then
        masked_source := masked_source || ' ';
        source_position := source_position + 1;
        parser_state := 'code';
      else
        masked_source := masked_source || case
          when current_character in (E'\r', E'\n') then current_character
          else ' '
        end;
        source_position := source_position + 1;
      end if;
    elsif parser_state = 'double_quote' then
      if current_pair = '""' then
        masked_source := masked_source || '  ';
        source_position := source_position + 2;
      elsif current_character = '"' then
        masked_source := masked_source || ' ';
        source_position := source_position + 1;
        parser_state := 'code';
      else
        masked_source := masked_source || case
          when current_character in (E'\r', E'\n') then current_character
          else ' '
        end;
        source_position := source_position + 1;
      end if;
    elsif parser_state = 'dollar_quote' then
      if pg_catalog.substr(
           p_source,
           source_position,
           pg_catalog.char_length(dollar_delimiter)
         ) = dollar_delimiter then
        masked_source := masked_source || pg_catalog.repeat(
          ' ',
          pg_catalog.char_length(dollar_delimiter)
        );
        source_position := source_position
          + pg_catalog.char_length(dollar_delimiter);
        parser_state := 'code';
        dollar_delimiter := null;
      else
        masked_source := masked_source || case
          when current_character in (E'\r', E'\n') then current_character
          else ' '
        end;
        source_position := source_position + 1;
      end if;
    end if;
  end loop;

  return masked_source;
end
$function$;

revoke all on function private.mask_plpgsql_non_code(text)
from public, anon, authenticated;

create or replace function private.harden_security_definer_role_guards(
  p_source text
)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $function$
  with original_lines as (
    select source_line.line, source_line.line_number
    from pg_catalog.regexp_split_to_table(
      p_source,
      E'\\r?\\n'
    ) with ordinality as source_line(line, line_number)
  ), masked_lines as (
    select source_line.line, source_line.line_number
    from pg_catalog.regexp_split_to_table(
      private.mask_plpgsql_non_code(p_source),
      E'\\r?\\n'
    ) with ordinality as source_line(line, line_number)
  ), source_lines as (
    select
      original_line.line,
      original_line.line_number,
      masked_line.line as masked_line,
      pg_catalog.lead(masked_line.line, 1) over (
        order by original_line.line_number
      ) as next_masked_line,
      pg_catalog.lead(masked_line.line, 2) over (
        order by original_line.line_number
      ) as second_next_masked_line
    from original_lines original_line
    join masked_lines masked_line
      using (line_number)
  ), classified_lines as (
    select *,
      (
        (
          line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*[(][[:blank:]]*'[a-z_]+'([[:blank:]]*,[[:blank:]]*'[a-z_]+')*[[:blank:]]*[)][[:blank:]]+then[[:blank:]]*$$safe_guard$
          or line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]*(<>|!=)[[:blank:]]*'[a-z_]+'[[:blank:]]+then[[:blank:]]*$$safe_guard$
        )
        and (
          masked_line ~* $code_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+(not[[:blank:]]+in|<>|!=)$code_guard$
        )
        and next_masked_line ~* '^[[:blank:]]*raise[[:blank:]]+exception'
        and second_next_masked_line ~*
          '^[[:blank:]]*end[[:blank:]]+if[[:blank:]]*;[[:blank:]]*$'
      ) as is_supported_guard
    from source_lines
  )
  select pg_catalog.string_agg(
    case
      when is_supported_guard
           and line ~* $safe_guard$^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in$safe_guard$ then
        pg_catalog.regexp_replace(
          line,
          $rewrite$^([[:blank:]]*)if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in[[:blank:]]*([(][[:blank:]]*'[a-z_]+'([[:blank:]]*,[[:blank:]]*'[a-z_]+')*[[:blank:]]*[)])[[:blank:]]+then[[:blank:]]*$rewrite$,
          $replacement$\1if coalesce(public.current_app_role() in \2, false) is not true then$replacement$,
          'i'
        )
      when is_supported_guard then
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
  )
  from classified_lines
$function$;

revoke all on function private.harden_security_definer_role_guards(text)
from public, anon, authenticated;

do $migration$
declare
  routine_record record;
  after_record record;
  original_definition text;
  safe_definition text;
  safe_source text;
  remaining_routines text;
begin
  for routine_record in
    select
      procedure_record.oid,
      namespace_record.nspname,
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
      and (
        private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
          'public[.]current_app_role[(][)][[:space:]]+not[[:space:]]+in'
        or private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
          'public[.]current_app_role[(][)][[:space:]]*(<>|!=)'
      )
  loop
    original_definition := pg_catalog.pg_get_functiondef(routine_record.oid);
    safe_source := private.harden_security_definer_role_guards(
      routine_record.prosrc
    );

    if safe_source = routine_record.prosrc then
      raise exception 'UNTRANSFORMABLE_UNSAFE_ROLE_GUARDS: %.%(%)',
        pg_catalog.quote_ident(routine_record.nspname),
        pg_catalog.quote_ident(routine_record.proname),
        routine_record.identity_arguments;
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

  select pg_catalog.string_agg(
    pg_catalog.format(
      '%I.%I(%s)',
      namespace_record.nspname,
      procedure_record.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
    ),
    ', '
    order by namespace_record.nspname,
             procedure_record.proname,
             pg_catalog.pg_get_function_identity_arguments(procedure_record.oid)
  )
  into remaining_routines
  from pg_catalog.pg_proc procedure_record
  join pg_catalog.pg_namespace namespace_record
    on namespace_record.oid = procedure_record.pronamespace
  join pg_catalog.pg_language language_record
    on language_record.oid = procedure_record.prolang
  where namespace_record.nspname in ('public', 'private')
    and language_record.lanname = 'plpgsql'
    and procedure_record.prokind in ('f', 'p')
    and procedure_record.prosecdef
    and (
      private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
        'public[.]current_app_role[(][)][[:space:]]+not[[:space:]]+in'
      or private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
        'public[.]current_app_role[(][)][[:space:]]*(<>|!=)'
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

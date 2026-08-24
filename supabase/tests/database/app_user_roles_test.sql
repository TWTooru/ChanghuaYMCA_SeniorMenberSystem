begin;
select plan(34);

select has_table('public', 'app_user_roles', 'authoritative role table exists');
select has_column('public', 'app_user_roles', 'user_id', 'role row references an auth user');
select has_column('public', 'app_user_roles', 'role', 'role value is stored in the database');
select col_is_pk('public', 'app_user_roles', 'user_id', 'user_id is the primary key');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'admin@admin.com', '{"app_role":"viewer"}', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'stern4310910040@gmail.com', '{"app_role":"admin"}', '{}'),
  ('10000000-0000-4000-8000-000000000003', 'editor.fixture@example.com', '{"app_role":"editor"}', '{}'),
  ('10000000-0000-4000-8000-000000000004', 'deleted.fixture@example.com', '{"app_role":"admin"}', '{}');

delete from auth.users
where id = '10000000-0000-4000-8000-000000000004';
select is(
  (
    select count(*)::integer
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000004'
  ),
  0,
  'deleting an auth user cascades to the stored role'
);

select throws_like(
  $$update public.app_user_roles
    set role = 'superadmin'
    where user_id = '10000000-0000-4000-8000-000000000003'$$,
  '%violates check constraint "app_user_roles_role_check"%',
  'role values outside the supported application roles are rejected'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_index index_record
    join pg_catalog.pg_class index_relation
      on index_relation.oid = index_record.indexrelid
    where index_record.indrelid = 'public.app_user_roles'::pg_catalog.regclass
      and index_relation.relname = 'app_user_roles_single_owner_idx'
      and index_record.indisunique
      and pg_catalog.pg_get_expr(
        index_record.indpred,
        index_record.indrelid
      ) like '%role%owner%'
  ),
  'a partial unique index enforces the single-owner invariant'
);
select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class relation
    where relation.oid = 'public.app_user_roles'::pg_catalog.regclass
  ),
  'row-level security is enabled on the role table'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_class relation,
         lateral pg_catalog.aclexplode(relation.relacl) access_entry
    where relation.oid = 'public.app_user_roles'::pg_catalog.regclass
      and access_entry.grantee = 0
  )
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'select')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'insert')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'update')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'delete')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'truncate')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'references')
  and not pg_catalog.has_table_privilege('anon', 'public.app_user_roles', 'trigger')
  and pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'select')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'insert')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'update')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'delete')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'truncate')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'references')
  and not pg_catalog.has_table_privilege('authenticated', 'public.app_user_roles', 'trigger')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'select')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'insert')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'update')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'delete')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'truncate')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'references')
  and pg_catalog.has_table_privilege('service_role', 'public.app_user_roles', 'trigger'),
  'table grants expose self-read only to authenticated and full access to service_role'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (
    select count(*)::integer
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000003'
  ),
  1,
  'an authenticated user can read their own role row'
);
select is(
  (
    select count(*)::integer
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  0,
  'an authenticated user cannot read another user role row'
);
select throws_ok(
  $$update public.app_user_roles
    set role = 'admin'
    where user_id = '10000000-0000-4000-8000-000000000003'$$,
  '42501',
  'permission denied for table app_user_roles',
  'authenticated users cannot write role rows'
);
reset role;

set local role anon;
select throws_ok(
  $$select * from public.app_user_roles$$,
  '42501',
  'permission denied for table app_user_roles',
  'anonymous users cannot read role rows'
);
reset role;

select has_trigger(
  'auth',
  'users',
  'create_app_user_role_after_auth_user_insert',
  'new auth users receive a stored role through a trigger'
);
select is(
  (
    select role
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  'owner',
  'the fixed owner email is always created as owner'
);
select is(
  (
    select role
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000002'
  ),
  'viewer',
  'new non-owner users ignore metadata and start as viewer'
);
select is(
  (select count(*)::integer from public.app_user_roles where role = 'owner'),
  1,
  'exactly one stored owner exists'
);

select is(
  private.resolve_initial_app_role(
    'stern4310910040@gmail.com',
    'viewer',
    true
  ),
  'admin',
  'the fixed stern account backfills as admin'
);
select is(
  array(
    select private.resolve_initial_app_role(
      'legacy.fixture@example.com',
      input.role,
      true
    )
    from pg_catalog.unnest(array['viewer', 'editor', 'admin'])
      with ordinality as input(role, position)
    order by input.position
  ),
  array['viewer', 'editor', 'admin']::text[],
  'backfill retains valid legacy viewer, editor, and admin roles'
);
select is(
  private.resolve_initial_app_role(
    'legacy-owner.fixture@example.com',
    'owner',
    true
  ),
  'viewer',
  'backfill rejects a legacy owner role for any other email'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
set local role authenticated;
select is(
  public.current_app_role(),
  'viewer',
  'JWT metadata cannot elevate a viewer row'
);
reset role;

update public.app_user_roles
set role = 'editor'
where user_id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(
  public.current_app_role(),
  'editor',
  'role changes take effect without a new JWT'
);
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  public.current_app_role(),
  'admin',
  'owner maps to admin for business-data policies'
);
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000099","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
set local role authenticated;
select is(
  public.current_app_role(),
  null,
  'missing role row fails closed'
);
select throws_ok(
  $$select public.create_billing_receipt(array[]::bigint[], 1000, null)$$,
  '42501',
  'PAYMENT_FORBIDDEN',
  'a valid JWT without a stored role is denied by an active security-definer RPC'
);
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
set local role authenticated;
select is(
  public.current_app_role(),
  null,
  'a deleted user old token fails closed after its role row cascades away'
);
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
set local role authenticated;
insert into public.course_catalog (course_name, active)
values ('Role downgrade fixture', true);
reset role;

update public.app_user_roles
set role = 'viewer'
where user_id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok(
  $$insert into public.course_catalog (course_name, active)
    values ('Denied downgrade fixture', true)$$,
  '42501',
  'new row violates row-level security policy for table "course_catalog"',
  'a stored-role downgrade immediately removes existing data-write access'
);
reset role;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_enrollment_form(-990001)$$,
  'P0001',
  'ENROLLMENT_FORM_NOT_FOUND',
  'owner passes the existing admin-only form-delete check and reaches validation'
);
reset role;

select ok(
  not exists (
    select 1
    from (values
      ('students', 'role users can select students'),
      ('students', 'role editors can insert students'),
      ('students', 'role editors can update students'),
      ('students', 'role admins can delete students'),
      ('enrollments', 'role users can select enrollments'),
      ('enrollments', 'role editors can insert enrollments'),
      ('enrollments', 'role editors can update enrollments'),
      ('enrollments', 'role admins can delete enrollments'),
      ('courses', 'role users can select courses'),
      ('courses', 'role editors can insert courses'),
      ('courses', 'role editors can update courses'),
      ('courses', 'role editors can delete unbilled courses'),
      ('course_catalog', 'role users can select course catalog'),
      ('course_catalog', 'role editors can insert course catalog'),
      ('course_catalog', 'role editors can update course catalog'),
      ('course_receipts', 'role users can select course receipts'),
      ('course_receipts', 'role editors can insert course receipts'),
      ('course_receipts', 'role editors can update course receipts'),
      ('course_receipts', 'role editors can delete course receipts'),
      ('billing_receipts', 'role users can select billing receipts'),
      ('billing_receipt_courses', 'role users can select billing receipt courses'),
      ('enrollment_forms', 'role users can select enrollment forms')
    ) as target(table_name, policy_name)
    left join pg_catalog.pg_policies policy
      on policy.schemaname = 'public'
     and policy.tablename = target.table_name
     and policy.policyname = target.policy_name
    where pg_catalog.to_regclass('public.' || target.table_name) is not null
      and (
        policy.policyname is null
        or concat_ws(' ', policy.qual, policy.with_check)
          !~* 'SELECT[[:space:]]+(public\.)?current_app_role\(\)'
        or (
          target.policy_name = 'role editors can delete unbilled courses'
          and concat_ws(' ', policy.qual, policy.with_check)
            !~* 'billing_receipt_courses'
        )
      )
  ),
  'all active role policies use an init-plan role lookup and preserve unbilled-course protection'
);
select ok(
  pg_catalog.to_regclass('public.course_receipts') is null
  or pg_catalog.has_table_privilege(
    'authenticated',
    'public.course_receipts',
    'delete'
  ),
  'authenticated retains the active course-receipt delete grant'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_namespace namespace_record
      on namespace_record.oid = procedure_record.pronamespace
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    where namespace_record.nspname in ('public', 'private')
      and language_record.lanname = 'plpgsql'
      and procedure_record.prosecdef
      and procedure_record.prosrc ilike '%current_app_role%'
      and (
        private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
          'public[.]current_app_role[(][)][[:space:]]+not[[:space:]]+in'
        or private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
          'app_role[[:space:]]+not[[:space:]]+in'
        or private.mask_plpgsql_non_code(procedure_record.prosrc) ~*
          'public[.]current_app_role[(][)][[:space:]]*(<>|!=)'
      )
  ),
  0,
  'no active security-definer routine retains a fail-open application-role guard'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid =
          'public.create_billing_receipt(bigint[],integer,text)'::pg_catalog.regprocedure
      and procedure_record.proowner = 'postgres'::pg_catalog.regrole
      and procedure_record.prokind = 'f'
      and procedure_record.provolatile = 'v'
      and procedure_record.prosecdef
      and procedure_record.proconfig = array['search_path=""']::text[]
      and pg_catalog.has_function_privilege(
        'authenticated', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'anon', procedure_record.oid, 'execute'
      )
  ),
  'rewritten billing RPC preserves its signature, owner, attributes, config, and grants'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid =
          'public.upsert_course_catalog(text)'::pg_catalog.regprocedure
      and not procedure_record.prosecdef
      and exists (
        select 1
        from pg_catalog.regexp_split_to_table(
          procedure_record.prosrc,
          E'\\r?\\n'
        ) as source_line(line)
        where source_line.line ~*
          '^[[:blank:]]*if[[:blank:]]+public[.]current_app_role[(][)][[:blank:]]+not[[:blank:]]+in'
      )
  ),
  'catalog rewrite leaves security-invoker routines unchanged'
);

create or replace function pg_temp.call_role_guard_hardener(p_source text)
returns text
language plpgsql
as $$
declare
  hardened_source text;
begin
  execute 'select private.harden_security_definer_role_guards($1)'
    into hardened_source
    using p_source;
  return hardened_source;
exception
  when undefined_function then
    return '__MISSING_ROLE_GUARD_HARDENER__';
end
$$;

select is(
  pg_temp.call_role_guard_hardener($fixture$
begin
  /*
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'COMMENT_DECOY';
  end if;
  */
  perform $decoy$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'STRING_DECOY';
  end if;
  $decoy$;
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'EXECUTABLE_GUARD';
  end if;
end;
$fixture$),
  $expected$
begin
  /*
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'COMMENT_DECOY';
  end if;
  */
  perform $decoy$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'STRING_DECOY';
  end if;
  $decoy$;
  if coalesce(public.current_app_role() in ('editor', 'admin'), false) is not true then
    raise exception 'EXECUTABLE_GUARD';
  end if;
end;
$expected$,
  'role-guard hardening preserves block comments and dollar-quoted strings'
);

select * from finish();
rollback;

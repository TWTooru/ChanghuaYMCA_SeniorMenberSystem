begin;
select no_plan();

select has_table('public', 'app_user_roles', 'authoritative role table exists');
select has_column('public', 'app_user_roles', 'user_id', 'role row references an auth user');
select has_column('public', 'app_user_roles', 'role', 'role value is stored in the database');
select col_is_pk('public', 'app_user_roles', 'user_id', 'user_id is the primary key');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001',
  'admin@admin.com',
  '{"app_role":"viewer"}',
  '{}'
);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
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
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace_record
      on namespace_record.oid = relation.relnamespace
    where namespace_record.nspname = 'public'
      and relation.relname = 'app_user_roles_single_owner_idx'
  ),
  0,
  'the single-owner partial unique index is removed'
);

select has_table(
  'private',
  'owner_invariant',
  'the private owner invariant table exists'
);

select is(
  (
    select count(*)::integer
    from private.owner_invariant
    where singleton is true
  ),
  1,
  'the owner invariant has exactly one singleton row'
);

select has_trigger(
  'public',
  'app_user_roles',
  'maintain_owner_invariant_after_change',
  'role changes maintain the owner invariant'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_class relation
    where relation.oid = 'private.owner_invariant'::pg_catalog.regclass
      and relation.relowner = 'postgres'::pg_catalog.regrole
      and relation.relrowsecurity
      and not exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault('r', relation.relowner)
          )
        ) access_entry
        where access_entry.grantee in (
          0,
          'anon'::pg_catalog.regrole,
          'authenticated'::pg_catalog.regrole,
          'service_role'::pg_catalog.regrole
        )
      )
  )
  and not pg_catalog.has_schema_privilege('anon', 'private', 'usage')
  and not pg_catalog.has_schema_privilege('authenticated', 'private', 'usage')
  and not pg_catalog.has_schema_privilege('service_role', 'private', 'usage'),
  'the postgres-owned invariant is RLS-protected and private from application roles'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    where procedure_record.oid =
          'private.maintain_owner_invariant()'::pg_catalog.regprocedure
      and procedure_record.proowner = 'postgres'::pg_catalog.regrole
      and language_record.lanname = 'plpgsql'
      and procedure_record.prosecdef
      and procedure_record.provolatile = 'v'
      and procedure_record.proconfig = array['search_path=""']::text[]
      and not pg_catalog.has_function_privilege(
        'anon', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'service_role', procedure_record.oid, 'execute'
      )
  ),
  'the invariant trigger function is hardened and trigger-only'
);

select has_table(
  'public',
  'app_user_deletion_reservations',
  'durable account-deletion reservations exist'
);
select has_column(
  'public',
  'app_user_deletion_reservations',
  'user_id',
  'each deletion reservation identifies its role row'
);
select has_column(
  'public',
  'app_user_deletion_reservations',
  'token',
  'each deletion reservation has an unguessable ownership token'
);
select has_column(
  'public',
  'app_user_deletion_reservations',
  'expected_role',
  'each deletion reservation snapshots the authorized target role'
);
select has_column(
  'public',
  'app_user_deletion_reservations',
  'expires_at',
  'each deletion reservation expires for worker-crash recovery'
);
select has_column(
  'public',
  'app_user_deletion_reservations',
  'released_at',
  'failed Auth recovery retires but preserves the stale-worker fence'
);
select col_is_pk(
  'public',
  'app_user_deletion_reservations',
  'user_id',
  'a user has at most one deletion reservation'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class relation
    where relation.oid =
          'public.app_user_deletion_reservations'::pg_catalog.regclass
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.app_user_deletion_reservations',
    'select,insert,update,delete'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.app_user_deletion_reservations',
    'select,insert,update,delete'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.app_user_deletion_reservations',
    'select,insert,update,delete'
  ),
  'deletion reservations are RLS-protected and writable only by service_role'
);

select ok(
  (
    select procedure_record.proowner = 'postgres'::pg_catalog.regrole
      and not procedure_record.prosecdef
      and procedure_record.provolatile = 'v'
      and procedure_record.proconfig = array['search_path=""']::text[]
      and not pg_catalog.has_function_privilege(
        'anon', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', procedure_record.oid, 'execute'
      )
      and pg_catalog.has_function_privilege(
        'service_role', procedure_record.oid, 'execute'
      )
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid =
          'public.reserve_app_user_deletion(uuid,text,uuid)'::pg_catalog.regprocedure
  )
  and (
    select procedure_record.proowner = 'postgres'::pg_catalog.regrole
      and not procedure_record.prosecdef
      and procedure_record.provolatile = 'v'
      and procedure_record.proconfig = array['search_path=""']::text[]
      and not pg_catalog.has_function_privilege(
        'anon', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', procedure_record.oid, 'execute'
      )
      and pg_catalog.has_function_privilege(
        'service_role', procedure_record.oid, 'execute'
      )
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid =
          'public.release_app_user_deletion(uuid,uuid)'::pg_catalog.regprocedure
  ),
  'reservation RPCs are hardened invoker functions executable only by service_role'
);

select has_trigger(
  'public',
  'app_user_roles',
  'enforce_app_user_deletion_reservation_before_change',
  'role mutations atomically honor deletion reservations'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure_record
    where procedure_record.oid =
          'private.enforce_app_user_deletion_reservation()'::pg_catalog.regprocedure
      and procedure_record.proowner = 'postgres'::pg_catalog.regrole
      and procedure_record.prosecdef
      and procedure_record.provolatile = 'v'
      and procedure_record.proconfig = array['search_path=""']::text[]
      and not pg_catalog.has_function_privilege(
        'anon', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'authenticated', procedure_record.oid, 'execute'
      )
      and not pg_catalog.has_function_privilege(
        'service_role', procedure_record.oid, 'execute'
      )
  ),
  'the reservation enforcement function is hardened and trigger-only'
);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000005',
  'reservation.fixture@example.com',
  '{}',
  '{}'
);

savepoint mismatched_deletion_reservation;
set local role service_role;
select ok(
  not public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'admin',
    '20000000-0000-4000-8000-000000000000'
  ),
  'service_role cannot reserve a target whose current role changed'
);
reset role;
select is(
  (
    select count(*)::integer
    from public.app_user_deletion_reservations
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  0,
  'a role-snapshot mismatch leaves no deletion reservation'
);
rollback to savepoint mismatched_deletion_reservation;

savepoint durable_deletion_reservation;
set local role service_role;
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'viewer',
    '20000000-0000-4000-8000-000000000001'
  ),
  'a matching target role can be reserved for deletion'
);
reset role;
select is(
  (
    select role
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  'viewer',
  'reserving deletion does not remove the authoritative role row'
);
select throws_ok(
  $$update public.app_user_roles
    set role = 'admin'
    where user_id = '10000000-0000-4000-8000-000000000005'$$,
  'P0001',
  'ACCOUNT_DELETE_IN_PROGRESS',
  'an active deletion lease atomically blocks a concurrent role update'
);
select ok(
  not public.release_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000099'
  ),
  'a worker cannot release a reservation owned by another token'
);
select is(
  (
    select count(*)::integer
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  1,
  'failed reservation recovery cannot remove the authoritative role row'
);
select ok(
  public.release_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000001'
  ),
  'the reservation owner can release its lease after an Auth failure'
);
select ok(
  exists (
    select 1
    from public.app_user_deletion_reservations reservation
    where reservation.user_id = '10000000-0000-4000-8000-000000000005'
      and reservation.released_at is not null
  ),
  'Auth-error recovery keeps a durable fence against a resumed stale worker'
);
select lives_ok(
  $$update public.app_user_roles
    set role = 'editor'
    where user_id = '10000000-0000-4000-8000-000000000005'$$,
  'a released reservation immediately unblocks role management'
);
select throws_ok(
  $$delete from auth.users
    where id = '10000000-0000-4000-8000-000000000005'$$,
  'P0001',
  'ACCOUNT_DELETE_RESERVATION_INVALID',
  'a released reservation rejects a resumed stale Auth deletion'
);
rollback to savepoint durable_deletion_reservation;

savepoint expired_worker_cannot_delete;
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'viewer',
    '20000000-0000-4000-8000-000000000002'
  ),
  'the worker acquires a deletion lease before pausing'
);
update public.app_user_deletion_reservations
set expires_at = pg_catalog.statement_timestamp() - interval '1 second'
where user_id = '10000000-0000-4000-8000-000000000005';
select lives_ok(
  $$update public.app_user_roles
    set role = 'admin'
    where user_id = '10000000-0000-4000-8000-000000000005'$$,
  'role changes recover automatically after an abandoned lease expires'
);
select throws_ok(
  $$delete from auth.users
    where id = '10000000-0000-4000-8000-000000000005'$$,
  'P0001',
  'ACCOUNT_DELETE_RESERVATION_INVALID',
  'a paused worker cannot delete after its role snapshot or lease expires'
);
select is(
  (
    select role
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  'admin',
  'the stale deletion failure preserves the newly authorized role'
);
rollback to savepoint expired_worker_cannot_delete;

savepoint expired_reservation_takeover;
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'viewer',
    '20000000-0000-4000-8000-000000000003'
  ),
  'the first worker acquires a lease'
);
update public.app_user_deletion_reservations
set expires_at = pg_catalog.statement_timestamp() - interval '1 second'
where user_id = '10000000-0000-4000-8000-000000000005';
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'viewer',
    '20000000-0000-4000-8000-000000000004'
  ),
  'a new worker can atomically take over an expired lease'
);
select ok(
  not public.release_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000003'
  ),
  'the old worker cannot release the replacement lease'
);
select ok(
  public.release_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000004'
  ),
  'the replacement worker can release its own lease'
);
rollback to savepoint expired_reservation_takeover;

savepoint valid_reservation_auth_delete;
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000005',
    'viewer',
    '20000000-0000-4000-8000-000000000005'
  ),
  'a viewer deletion obtains an active matching lease'
);
delete from auth.users
where id = '10000000-0000-4000-8000-000000000005';
select is(
  (
    select count(*)::integer
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  0,
  'an active matching lease permits the Auth cascade'
);
select is(
  (
    select count(*)::integer
    from public.app_user_deletion_reservations
    where user_id = '10000000-0000-4000-8000-000000000005'
  ),
  0,
  'the Auth cascade also removes its completed reservation'
);
rollback to savepoint valid_reservation_auth_delete;

savepoint reservation_preserves_last_owner;
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000001',
    'owner',
    '20000000-0000-4000-8000-000000000006'
  ),
  'the final owner can reach the database invariant under an active lease'
);
select throws_ok(
  $$delete from auth.users
    where id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'LAST_OWNER_REQUIRED',
  'the durable lease preserves the database last-owner invariant'
);
rollback to savepoint reservation_preserves_last_owner;
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
  'the first Auth account bootstraps as owner'
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
  'the bootstrap creates exactly one stored owner'
);

update public.app_user_roles
set role = 'owner'
where user_id = '10000000-0000-4000-8000-000000000003';

select is(
  (select count(*)::integer from public.app_user_roles where role = 'owner'),
  2,
  'multiple owners can coexist'
);

select is(
  (select owner_count from private.owner_invariant where singleton is true),
  (select count(*)::integer from public.app_user_roles where role = 'owner'),
  'the invariant counter matches the authoritative role rows after promotion'
);

update public.app_user_roles
set role = 'viewer'
where user_id = '10000000-0000-4000-8000-000000000003';

select is(
  (select owner_count from private.owner_invariant where singleton is true),
  1,
  'a non-last owner can be demoted'
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
    'admin@admin.com',
    'owner',
    false
  ),
  'viewer',
  'the former bootstrap Email has no permanent privilege after owner initialization'
);

savepoint reject_last_owner_update;
select throws_ok(
  $$update public.app_user_roles
    set role = 'admin'
    where user_id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'LAST_OWNER_REQUIRED',
  'the final owner cannot be demoted directly'
);
rollback to savepoint reject_last_owner_update;

savepoint reject_last_owner_role_delete;
select throws_ok(
  $$delete from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'LAST_OWNER_REQUIRED',
  'the final owner role row cannot be deleted directly'
);
rollback to savepoint reject_last_owner_role_delete;

savepoint reject_last_owner_auth_delete;
select throws_ok(
  $$delete from auth.users
    where id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001',
  'LAST_OWNER_REQUIRED',
  'an Auth cascade cannot delete the final owner'
);
rollback to savepoint reject_last_owner_auth_delete;

savepoint allow_non_last_owner_auth_delete;
update public.app_user_roles
set role = 'owner'
where user_id = '10000000-0000-4000-8000-000000000003';
select ok(
  public.reserve_app_user_deletion(
    '10000000-0000-4000-8000-000000000003',
    'owner',
    '20000000-0000-4000-8000-000000000007'
  ),
  'an owner peer can reserve another non-last owner for deletion'
);
delete from auth.users
where id = '10000000-0000-4000-8000-000000000003';
select is(
  (select owner_count from private.owner_invariant where singleton is true),
  1,
  'Auth cascade can delete a non-last owner'
);
rollback to savepoint allow_non_last_owner_auth_delete;

savepoint fixed_email_has_no_permanent_privilege;
update public.app_user_roles
set role = 'owner'
where user_id = '10000000-0000-4000-8000-000000000003';
delete from auth.users
where id = '10000000-0000-4000-8000-000000000001';
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values (
  '10000000-0000-4000-8000-000000000001',
  'admin@admin.com',
  '{"app_role":"owner"}',
  '{}'
);
select is(
  (
    select role
    from public.app_user_roles
    where user_id = '10000000-0000-4000-8000-000000000001'
  ),
  'viewer',
  'a recreated former bootstrap Email is viewer while another owner exists'
);
rollback to savepoint fixed_email_has_no_permanent_privilege;

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

select is(
  pg_catalog.replace(
    private.harden_security_definer_role_guards($fixture$
begin
  -- if public.current_app_role() not in ('editor', 'admin') then
  -- raise exception 'LINE_COMMENT_DECOY';
  -- end if;
  /*
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'BLOCK_COMMENT_DECOY';
  end if;
  */
  perform '
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception ''ORDINARY_STRING_DECOY'';
  end if;
  ';
  perform E'
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception \'E_STRING_DECOY\';
  end if;
  ';
  perform $ascii$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'ASCII_DOLLAR_STRING_DECOY';
  end if;
  $ascii$;
  perform $$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'EMPTY_DOLLAR_STRING_DECOY';
  end if;
  $$;
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'EXECUTABLE_GUARD';
  end if;
end;
$fixture$),
    E'\r\n',
    E'\n'
  ),
  pg_catalog.replace(
    $expected$
begin
  -- if public.current_app_role() not in ('editor', 'admin') then
  -- raise exception 'LINE_COMMENT_DECOY';
  -- end if;
  /*
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'BLOCK_COMMENT_DECOY';
  end if;
  */
  perform '
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception ''ORDINARY_STRING_DECOY'';
  end if;
  ';
  perform E'
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception \'E_STRING_DECOY\';
  end if;
  ';
  perform $ascii$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'ASCII_DOLLAR_STRING_DECOY';
  end if;
  $ascii$;
  perform $$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'EMPTY_DOLLAR_STRING_DECOY';
  end if;
  $$;
  if coalesce(public.current_app_role() in ('editor', 'admin'), false) is not true then
    raise exception 'EXECUTABLE_GUARD';
  end if;
end;
$expected$,
    E'\r\n',
    E'\n'
  ),
  'hardening preserves comments and ordinary, E-prefixed, tagged, and empty dollar strings'
);

select is(
  pg_catalog.replace(
    private.harden_security_definer_role_guards($boundary_fixture$
declare
  foo$decoy$ text := 'identifier value';
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'EXECUTABLE_AFTER_IDENTIFIER';
  end if;
end;
$boundary_fixture$),
    E'\r\n',
    E'\n'
  ),
  pg_catalog.replace(
    $boundary_expected$
declare
  foo$decoy$ text := 'identifier value';
begin
  if coalesce(public.current_app_role() in ('editor', 'admin'), false) is not true then
    raise exception 'EXECUTABLE_AFTER_IDENTIFIER';
  end if;
end;
$boundary_expected$,
    E'\r\n',
    E'\n'
  ),
  'a dollar-shaped identifier suffix cannot hide a later executable guard'
);

select is(
  pg_catalog.replace(
    private.harden_security_definer_role_guards($unicode_fixture$
begin
  perform $標籤$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'UNICODE_DOLLAR_STRING_DECOY';
  end if;
  $標籤$;
end;
$unicode_fixture$),
    E'\r\n',
    E'\n'
  ),
  pg_catalog.replace(
    $unicode_expected$
begin
  perform $標籤$
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'UNICODE_DOLLAR_STRING_DECOY';
  end if;
  $標籤$;
end;
$unicode_expected$,
    E'\r\n',
    E'\n'
  ),
  'hardening preserves non-ASCII dollar-quoted strings'
);

select has_column(
  'public',
  'admin_audit_logs',
  'actor_role',
  'account-management audits store the actor role snapshot'
);
select lives_ok(
  $$insert into public.admin_audit_logs (
      actor_email,
      actor_role,
      action,
      target_email,
      old_role,
      new_role,
      status
    ) values (
      'owner@example.com',
      'owner',
      'update_role',
      'target@example.com',
      'owner',
      'owner',
      'pending'
    )$$,
  'audit actor, old-role, and new-role snapshots accept owner'
);
select throws_like(
  $$insert into public.admin_audit_logs (
      actor_email,
      actor_role,
      action,
      target_email,
      status
    ) values (
      'invalid@example.com',
      'superadmin',
      'invite_user',
      'target@example.com',
      'pending'
    )$$,
  '%violates check constraint "admin_audit_logs_actor_role_check"%',
  'audit actor role rejects unsupported values'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_trigger trigger_record
    where trigger_record.tgrelid = 'auth.users'::pg_catalog.regclass
      and trigger_record.tgname = 'protect_last_auth_admin_before_change'
      and not trigger_record.tgisinternal
  ),
  'the metadata-based last-admin trigger is removed'
);
select ok(
  pg_catalog.to_regprocedure('public.protect_last_auth_admin()') is null,
  'the metadata-based last-admin function is removed'
);

select * from finish();
rollback;

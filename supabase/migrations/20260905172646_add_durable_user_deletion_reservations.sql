begin;

create table public.app_user_deletion_reservations (
  user_id uuid primary key
    constraint app_user_deletion_reservations_user_id_fkey
    references public.app_user_roles(user_id)
    on delete cascade,
  token uuid not null unique,
  expected_role text not null
    constraint app_user_deletion_reservations_expected_role_check
    check (expected_role in ('owner', 'admin', 'editor', 'viewer')),
  expires_at timestamp with time zone not null,
  released_at timestamp with time zone,
  created_at timestamp with time zone not null
    default pg_catalog.statement_timestamp()
);

alter table public.app_user_deletion_reservations owner to postgres;
alter table public.app_user_deletion_reservations enable row level security;

revoke all on table public.app_user_deletion_reservations from public;
revoke all on table public.app_user_deletion_reservations from anon;
revoke all on table public.app_user_deletion_reservations from authenticated;
grant select, insert, update, delete
  on table public.app_user_deletion_reservations
  to service_role;

create function public.reserve_app_user_deletion(
  p_user_id uuid,
  p_expected_role text,
  p_token uuid
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  current_role text;
  reserved_user_id uuid;
begin
  if p_token is null
    or p_expected_role is null
    or p_expected_role not in ('owner', 'admin', 'editor', 'viewer')
  then
    return false;
  end if;

  select role_record.role
  into current_role
  from public.app_user_roles role_record
  where role_record.user_id = p_user_id
  for update;

  if not found or current_role is distinct from p_expected_role then
    return false;
  end if;

  insert into public.app_user_deletion_reservations as reservation (
    user_id,
    token,
    expected_role,
    expires_at,
    created_at
  ) values (
    p_user_id,
    p_token,
    p_expected_role,
    pg_catalog.statement_timestamp() + interval '2 minutes',
    pg_catalog.statement_timestamp()
  )
  on conflict (user_id) do update
  set token = excluded.token,
      expected_role = excluded.expected_role,
      expires_at = excluded.expires_at,
      released_at = null,
      created_at = excluded.created_at
  where reservation.released_at is not null
    or reservation.expires_at <= pg_catalog.statement_timestamp()
  returning user_id into reserved_user_id;

  return reserved_user_id is not null;
end;
$function$;

alter function public.reserve_app_user_deletion(uuid, text, uuid)
  owner to postgres;
revoke all on function public.reserve_app_user_deletion(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_app_user_deletion(uuid, text, uuid)
  to service_role;

create function public.release_app_user_deletion(
  p_user_id uuid,
  p_token uuid
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  released_user_id uuid;
begin
  update public.app_user_deletion_reservations reservation
  set released_at = pg_catalog.statement_timestamp()
  where reservation.user_id = p_user_id
    and reservation.token = p_token
    and reservation.released_at is null
  returning user_id into released_user_id;

  return released_user_id is not null;
end;
$function$;

alter function public.release_app_user_deletion(uuid, uuid)
  owner to postgres;
revoke all on function public.release_app_user_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_app_user_deletion(uuid, uuid)
  to service_role;

create function private.enforce_app_user_deletion_reservation()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  reservation_expected_role text;
  reservation_expires_at timestamp with time zone;
  reservation_released_at timestamp with time zone;
begin
  if tg_op = 'UPDATE' then
    if new.role is not distinct from old.role then
      return new;
    end if;

    if exists (
      select 1
      from public.app_user_deletion_reservations reservation
      where reservation.user_id = old.user_id
        and reservation.released_at is null
        and reservation.expires_at > pg_catalog.statement_timestamp()
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ACCOUNT_DELETE_IN_PROGRESS';
    end if;

    return new;
  end if;

  select
    reservation.expected_role,
    reservation.expires_at,
    reservation.released_at
  into
    reservation_expected_role,
    reservation_expires_at,
    reservation_released_at
  from public.app_user_deletion_reservations reservation
  where reservation.user_id = old.user_id;

  if found and (
    reservation_expected_role is distinct from old.role
    or reservation_released_at is not null
    or reservation_expires_at <= pg_catalog.statement_timestamp()
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACCOUNT_DELETE_RESERVATION_INVALID';
  end if;

  return old;
end;
$function$;

alter function private.enforce_app_user_deletion_reservation()
  owner to postgres;
revoke all on function private.enforce_app_user_deletion_reservation()
  from public, anon, authenticated, service_role;

create trigger enforce_app_user_deletion_reservation_before_change
before update or delete on public.app_user_roles
for each row execute function private.enforce_app_user_deletion_reservation();

comment on table public.app_user_deletion_reservations is
  'Durable leases that bind Auth user deletion to an authorized role snapshot.';
comment on function public.reserve_app_user_deletion(uuid, text, uuid) is
  'Atomically leases deletion only while the target role matches the authorized snapshot.';
comment on function public.release_app_user_deletion(uuid, uuid) is
  'Releases a failed deletion lease only for the worker token that owns it.';
comment on function private.enforce_app_user_deletion_reservation() is
  'Prevents role changes during active deletion and rejects expired or stale Auth cascades.';

commit;

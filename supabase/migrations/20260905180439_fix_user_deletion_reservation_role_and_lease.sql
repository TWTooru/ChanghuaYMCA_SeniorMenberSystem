begin;

create or replace function public.reserve_app_user_deletion(
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
  v_current_role text;
  reserved_user_id uuid;
begin
  if p_token is null
    or p_expected_role is null
    or p_expected_role not in ('owner', 'admin', 'editor', 'viewer')
  then
    return false;
  end if;

  select role_record.role
  into v_current_role
  from public.app_user_roles role_record
  where role_record.user_id = p_user_id
  for update;

  if not found or v_current_role is distinct from p_expected_role then
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
    pg_catalog.statement_timestamp() + interval '10 minutes',
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

comment on table public.app_user_deletion_reservations is
  'Durable role-snapshot leases for Auth user deletion. Expired or released markers reject cascades only until a later authorized request replaces them; Auth Admin is not token-fenced across workers.';
comment on function public.reserve_app_user_deletion(uuid, text, uuid) is
  'Atomically issues a ten-minute deletion lease only while the target role matches the authorized snapshot.';
comment on function public.release_app_user_deletion(uuid, uuid) is
  'Marks a failed deletion lease released only for its worker token; a later authorized request may replace the marker.';
comment on function private.enforce_app_user_deletion_reservation() is
  'Prevents role changes during an active lease and rejects expired, released, or mismatched Auth cascades until a later authorized request replaces the reservation.';

commit;

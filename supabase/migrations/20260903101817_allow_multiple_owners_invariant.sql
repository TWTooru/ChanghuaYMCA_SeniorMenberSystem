begin;

lock table public.app_user_roles in share row exclusive mode;

drop index if exists public.app_user_roles_single_owner_idx;

do $migration$
declare
  v_role_count integer;
  v_owner_count integer;
begin
  select
    count(*)::integer,
    count(*) filter (where role = 'owner')::integer
  into v_role_count, v_owner_count
  from public.app_user_roles;

  if v_role_count > 0 and v_owner_count = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OWNER_BOOTSTRAP_REQUIRED';
  end if;
end
$migration$;

create table private.owner_invariant (
  singleton boolean primary key default true,
  owner_count integer not null,
  constraint owner_invariant_singleton_check check (singleton),
  constraint owner_invariant_owner_count_check check (owner_count >= 0)
);

alter table private.owner_invariant owner to postgres;
alter table private.owner_invariant enable row level security;
revoke all on table private.owner_invariant
from public, anon, authenticated, service_role;

insert into private.owner_invariant (singleton, owner_count)
select
  true,
  count(*) filter (where role = 'owner')::integer
from public.app_user_roles;

create or replace function private.maintain_owner_invariant()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_owner_count integer;
  v_delta integer := 0;
begin
  update private.owner_invariant
  set owner_count = owner_count
  where singleton is true
  returning owner_count into v_owner_count;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'OWNER_INVARIANT_MISSING';
  end if;

  if tg_op = 'INSERT' then
    v_delta := case when new.role = 'owner' then 1 else 0 end;
  elsif tg_op = 'UPDATE' then
    v_delta :=
      case when new.role = 'owner' then 1 else 0 end
      - case when old.role = 'owner' then 1 else 0 end;
  elsif tg_op = 'DELETE' then
    v_delta := case when old.role = 'owner' then -1 else 0 end;
  else
    raise exception using
      errcode = 'P0001',
      message = 'OWNER_INVARIANT_UNSUPPORTED_OPERATION';
  end if;

  if v_owner_count = 0 and v_delta <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OWNER_BOOTSTRAP_REQUIRED';
  end if;

  if v_delta = -1 and v_owner_count <= 1 then
    raise exception using
      errcode = 'P0001',
      message = 'LAST_OWNER_REQUIRED';
  end if;

  if v_delta <> 0 then
    update private.owner_invariant
    set owner_count = owner_count + v_delta
    where singleton is true;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

alter function private.maintain_owner_invariant() owner to postgres;
revoke all on function private.maintain_owner_invariant()
from public, anon, authenticated, service_role;

create trigger maintain_owner_invariant_after_change
after insert or update of role or delete on public.app_user_roles
for each row execute function private.maintain_owner_invariant();

create or replace function private.resolve_initial_app_role(
  p_email text,
  p_legacy_role text,
  p_is_backfill boolean
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $function$
  select case
    when p_is_backfill
      and pg_catalog.lower(p_email) = 'stern4310910040@gmail.com'
      then 'admin'
    when p_is_backfill
      and p_legacy_role in ('viewer', 'editor', 'admin')
      then p_legacy_role
    when not p_is_backfill
      and coalesce(
        (
          select invariant.owner_count = 0
          from private.owner_invariant invariant
          where invariant.singleton is true
        ),
        false
      )
      then 'owner'
    else 'viewer'
  end
$function$;

alter function private.resolve_initial_app_role(text, text, boolean)
owner to postgres;
revoke all on function private.resolve_initial_app_role(text, text, boolean)
from public, anon, authenticated, service_role;

commit;

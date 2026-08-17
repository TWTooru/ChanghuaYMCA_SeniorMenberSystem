begin;

create or replace function private.enforce_enrollment_handler_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  actor_user_id uuid;
  actor_account text;
begin
  if tg_op = 'UPDATE' then
    new.handled_by_user_id := old.handled_by_user_id;
    new.handled_by_account := old.handled_by_account;
    return new;
  end if;

  actor_user_id := (select auth.uid());
  actor_account := pg_catalog.lower(
    nullif(pg_catalog.btrim(auth.jwt() ->> 'email'), '')
  );
  if actor_user_id is null or actor_account is null then
    raise exception 'AUTH_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  new.handled_by_user_id := actor_user_id;
  new.handled_by_account := actor_account;
  return new;
end
$function$;

drop trigger if exists enforce_enrollment_handler_audit on public.enrollments;
create trigger enforce_enrollment_handler_audit
before insert or update on public.enrollments
for each row execute function private.enforce_enrollment_handler_audit();

revoke all on function private.enforce_enrollment_handler_audit()
from public, anon, authenticated;

commit;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text not null,
  action text not null check (action in (
    'invite_user',
    'update_role',
    'resend_invite',
    'send_password_reset',
    'delete_user'
  )),
  target_user_id uuid,
  target_email text not null,
  old_role text check (old_role is null or old_role in ('viewer', 'editor', 'admin')),
  new_role text check (new_role is null or new_role in ('viewer', 'editor', 'admin')),
  status text not null check (status in ('pending', 'success', 'failure')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from anon, authenticated;

comment on table public.admin_audit_logs is
  'Permanent snapshots of privileged Auth account-management actions; accessed only by the service key.';

create or replace function public.protect_last_auth_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if coalesce(old.raw_app_meta_data ->> 'app_role', 'viewer') = 'admin' then
      perform pg_advisory_xact_lock(2026071401);
      if not exists (
        select 1 from auth.users u
        where u.id <> old.id
          and coalesce(u.raw_app_meta_data ->> 'app_role', 'viewer') = 'admin'
      ) then
        raise exception using errcode = '23514', message = 'LAST_ADMIN_PROTECTED';
      end if;
    end if;
    return old;
  end if;

  if coalesce(old.raw_app_meta_data ->> 'app_role', 'viewer') = 'admin'
     and coalesce(new.raw_app_meta_data ->> 'app_role', 'viewer') <> 'admin' then
    perform pg_advisory_xact_lock(2026071401);
    if not exists (
      select 1 from auth.users u
      where u.id <> old.id
        and coalesce(u.raw_app_meta_data ->> 'app_role', 'viewer') = 'admin'
    ) then
      raise exception using errcode = '23514', message = 'LAST_ADMIN_PROTECTED';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_last_auth_admin() from public, anon, authenticated;

create trigger protect_last_auth_admin_before_change
before update of raw_app_meta_data or delete on auth.users
for each row execute function public.protect_last_auth_admin();

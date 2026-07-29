-- 將核心表從「所有 authenticated 使用者可寫」收斂為 viewer／editor／admin 角色權限。
-- current_app_role() 只讀 JWT app_metadata；前端 usePermissions 不參與資料庫授權。

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
    'viewer'
  );
$$;

drop policy if exists "authenticated users can select students" on public.students;
drop policy if exists "authenticated users can insert students" on public.students;
drop policy if exists "authenticated users can update students" on public.students;
drop policy if exists "authenticated users can delete students" on public.students;

drop policy if exists "authenticated users can select enrollments" on public.enrollments;
drop policy if exists "authenticated users can insert enrollments" on public.enrollments;
drop policy if exists "authenticated users can update enrollments" on public.enrollments;
drop policy if exists "authenticated users can delete enrollments" on public.enrollments;

drop policy if exists "authenticated users can select courses" on public.courses;
drop policy if exists "authenticated users can insert courses" on public.courses;
drop policy if exists "authenticated users can update courses" on public.courses;
drop policy if exists "authenticated users can delete courses" on public.courses;

-- viewer 只讀、editor 可新增更新、admin 才可刪除；policy 與 table grant 必須同時允許操作。
create policy "role users can select students"
on public.students for select
to authenticated
using (public.current_app_role() in ('viewer', 'editor', 'admin'));

create policy "role editors can insert students"
on public.students for insert
to authenticated
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role editors can update students"
on public.students for update
to authenticated
using (public.current_app_role() in ('editor', 'admin'))
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role admins can delete students"
on public.students for delete
to authenticated
using (public.current_app_role() = 'admin');

create policy "role users can select enrollments"
on public.enrollments for select
to authenticated
using (public.current_app_role() in ('viewer', 'editor', 'admin'));

create policy "role editors can insert enrollments"
on public.enrollments for insert
to authenticated
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role editors can update enrollments"
on public.enrollments for update
to authenticated
using (public.current_app_role() in ('editor', 'admin'))
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role admins can delete enrollments"
on public.enrollments for delete
to authenticated
using (public.current_app_role() = 'admin');

create policy "role users can select courses"
on public.courses for select
to authenticated
using (public.current_app_role() in ('viewer', 'editor', 'admin'));

create policy "role editors can insert courses"
on public.courses for insert
to authenticated
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role editors can update courses"
on public.courses for update
to authenticated
using (public.current_app_role() in ('editor', 'admin'))
with check (public.current_app_role() in ('editor', 'admin'));

create policy "role admins can delete courses"
on public.courses for delete
to authenticated
using (public.current_app_role() = 'admin');

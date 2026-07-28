drop policy if exists "role editors can delete course receipts"
on public.course_receipts;

create policy "role editors can delete course receipts"
on public.course_receipts
for delete
to authenticated
using (public.current_app_role() in ('editor', 'admin'));

grant delete on table public.course_receipts to authenticated;

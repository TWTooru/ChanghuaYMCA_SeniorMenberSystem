-- 明確重建收據刪除 policy，讓 editor/admin 可於收據編輯流程中撤銷收據。
drop policy if exists "role editors can delete course receipts"
on public.course_receipts;

create policy "role editors can delete course receipts"
on public.course_receipts
for delete
to authenticated
using (public.current_app_role() in ('editor', 'admin'));

-- 授予 authenticated 必要的 DELETE 權限；實際可否刪除仍受上述 RLS policy 限制。
grant delete on table public.course_receipts to authenticated;

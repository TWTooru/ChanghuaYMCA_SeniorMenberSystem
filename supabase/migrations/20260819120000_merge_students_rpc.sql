begin;

create or replace function public.merge_students(
  p_source_id text,
  p_target_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  source_row public.students%rowtype;
  target_row public.students%rowtype;
  moved_enrollments integer := 0;
  deleted_source boolean := false;
begin
  -- 僅 admin 可執行
  if public.current_app_role() not in ('admin') then
    raise exception 'FORBIDDEN: only admin can merge students';
  end if;

  -- 驗證來源與目標學員
  select * into source_row from public.students where student_id = p_source_id;
  if not found then raise exception 'SOURCE_NOT_FOUND: student % does not exist', p_source_id; end if;

  select * into target_row from public.students where student_id = p_target_id;
  if not found then raise exception 'TARGET_NOT_FOUND: student % does not exist', p_target_id; end if;

  if p_source_id = p_target_id then
    raise exception 'SAME_STUDENT: cannot merge a student into themselves';
  end if;

  -- 取得排他鎖防止併發合併
  perform pg_advisory_xact_lock(hashtext('public.student_merge'));

  -- 轉移來源學員的報名紀錄至目標學員
  -- 若目標已有同季度報名，跳過衝突
  with transferred as (
    update public.enrollments
    set student_id = p_target_id
    where student_id = p_source_id
      and season not in (
        select season from public.enrollments where student_id = p_target_id
      )
    returning enrollment_id
  )
  select count(*) into moved_enrollments from transferred;

  -- 刪除來源學員剩餘的重複季度報名（已被目標涵蓋）
  delete from public.enrollments where student_id = p_source_id;

  -- 刪除來源學員
  delete from public.students where student_id = p_source_id;
  deleted_source := true;

  return jsonb_build_object(
    'source_id', p_source_id,
    'target_id', p_target_id,
    'moved_enrollments', moved_enrollments,
    'deleted_source', deleted_source
  );
end;
$function$;

grant execute on function public.merge_students(text, text) to authenticated;

commit;

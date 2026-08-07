-- 擴充 create_enrollment_with_courses RPC 以支援在新增選課時一併寫入繳費金額與發票編號。
-- 新增的參數 p_amount 和 p_invoice_number 皆可為 null（未繳費時不寫入）。
create or replace function public.create_enrollment_with_courses(
  p_student_id text,
  p_season text,
  p_reg_type text,
  p_pre_test text,
  p_post_test text,
  p_refunded integer,
  p_refund_info text,
  p_amount integer default null,
  p_invoice_number text default null,
  p_course_names text[] default '{}'
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment_id bigint;
  v_course_names text[];
begin
  -- 檢查是否已存在同學員同季度的選課
  if exists (
    select 1 from public.enrollments
    where student_id = p_student_id and season = p_season
  ) then
    raise exception '此學員在「%」已存在選課紀錄，請改用編輯既有選課或選擇不同季度', p_season;
  end if;

  -- 寫入 enrollments（含繳費資訊）
  insert into public.enrollments (student_id, season, reg_type, pre_test, post_test, refunded, refund_info, amount, invoice_number)
  values (p_student_id, p_season, p_reg_type, p_pre_test, p_post_test, p_refunded, p_refund_info, p_amount, p_invoice_number)
  returning enrollment_id into v_enrollment_id;

  -- 正規化課程名稱：去除空白、去重
  select array_agg(distinct btrim(name))
  into v_course_names
  from unnest(p_course_names) as name
  where btrim(name) <> '';

  -- 寫入 courses
  if v_course_names is not null then
    insert into public.courses (enrollment_id, course_name)
    select v_enrollment_id, unnest(v_course_names);
  end if;

  return v_enrollment_id;
end;
$$;

-- RPC 執行權限：僅限已認證使用者
revoke all on function public.create_enrollment_with_courses from anon;
grant execute on function public.create_enrollment_with_courses to authenticated;

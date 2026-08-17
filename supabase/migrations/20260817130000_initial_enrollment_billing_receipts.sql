begin;

-- 1. 移除 billing_receipt_courses.course_id 的獨立 UNIQUE 約束，
--    以允許初次報名的課程同時關聯至預繳與正式費用兩張收據。
--    複合主鍵 (receipt_id, course_id) 仍然有效，防止同一張收據重複關聯同一門課。
alter table public.billing_receipt_courses
  drop constraint billing_receipt_courses_course_id_key;

-- 2. 替換 create_student_with_initial_enrollment，在建立課程後原子建立收據。
create or replace function public.create_student_with_initial_enrollment(
  p_student jsonb,
  p_enrollment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid;
  actor_account text;
  supplied_student_id_text text;
  new_student_id bigint;
  new_enrollment_id bigint;
  birth_date_value date;
  start_date_text text;
  end_date_text text;
  handled_on_text text;
  start_date_value date;
  end_date_value date;
  handled_on_value date;
  normalized_period text;
  normalized_courses text[];
  v_prepaid_amount integer;
  v_tuition integer;
  v_materials integer;
  v_membership integer;
  v_formal_amount integer;
  v_prepaid_receipt_number text;
  v_fee_receipt_number text;
  v_receipt_id bigint;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'INITIAL_ENROLLMENT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;

  actor_user_id := (select auth.uid());
  actor_account := pg_catalog.lower(nullif(pg_catalog.btrim(auth.jwt() ->> 'email'), ''));
  if actor_user_id is null or actor_account is null then
    raise exception 'AUTH_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  if p_student is null or pg_catalog.jsonb_typeof(p_student) <> 'object'
     or p_enrollment is null or pg_catalog.jsonb_typeof(p_enrollment) <> 'object' then
    raise exception 'INVALID_INITIAL_ENROLLMENT_PAYLOAD';
  end if;

  normalized_period := pg_catalog.btrim(p_enrollment ->> 'period');
  if normalized_period is null or normalized_period !~ '^第[1-9][0-9]*期$' then
    raise exception 'PERIOD_INVALID';
  end if;

  start_date_text := nullif(pg_catalog.btrim(p_enrollment ->> 'period_start_date'), '');
  end_date_text := nullif(pg_catalog.btrim(p_enrollment ->> 'period_end_date'), '');
  if start_date_text is null or end_date_text is null then
    raise exception 'PERIOD_DATES_REQUIRED';
  end if;
  if start_date_text !~ '^\d{4}-\d{2}-\d{2}$'
     or end_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'PERIOD_DATE_INVALID';
  end if;
  begin
    start_date_value := start_date_text::date;
    end_date_value := end_date_text::date;
  exception when others then
    raise exception 'PERIOD_DATE_INVALID';
  end;
  if pg_catalog.to_char(start_date_value, 'YYYY-MM-DD') <> start_date_text
     or pg_catalog.to_char(end_date_value, 'YYYY-MM-DD') <> end_date_text then
    raise exception 'PERIOD_DATE_INVALID';
  end if;
  if end_date_value < start_date_value then
    raise exception 'PERIOD_DATE_ORDER_INVALID';
  end if;

  if pg_catalog.jsonb_typeof(p_enrollment -> 'courses') is distinct from 'array' then
    raise exception 'COURSE_REQUIRED';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
       or nullif(pg_catalog.btrim(item.value #>> '{}'), '') is null
  ) then
    raise exception 'COURSE_REQUIRED';
  end if;
  select pg_catalog.array_agg(course_name order by course_name)
  into normalized_courses
  from (
    select min(pg_catalog.btrim(item.value #>> '{}')) course_name
    from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    group by pg_catalog.lower(pg_catalog.btrim(item.value #>> '{}'))
  ) normalized;
  if coalesce(pg_catalog.cardinality(normalized_courses), 0) = 0 then
    raise exception 'COURSE_REQUIRED';
  end if;

  handled_on_text := nullif(pg_catalog.btrim(p_enrollment ->> 'handled_on'), '');
  if handled_on_text is not null then
    if handled_on_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'HANDLED_ON_INVALID';
    end if;
    begin
      handled_on_value := handled_on_text::date;
    exception when others then
      raise exception 'HANDLED_ON_INVALID';
    end;
    if pg_catalog.to_char(handled_on_value, 'YYYY-MM-DD') <> handled_on_text then
      raise exception 'HANDLED_ON_INVALID';
    end if;
  end if;

  begin
    birth_date_value := nullif(pg_catalog.btrim(p_student ->> 'birth_date'), '')::date;
  exception when others then
    raise exception 'INVALID_BIRTH_DATE';
  end;

  -- 解析費用欄位
  v_prepaid_amount := private.optional_nonnegative_integer(p_enrollment, 'prepaid_amount');
  v_tuition := private.optional_nonnegative_integer(p_enrollment, 'tuition_fee');
  v_materials := private.optional_nonnegative_integer(p_enrollment, 'materials_fee');
  v_membership := private.optional_nonnegative_integer(p_enrollment, 'membership_fee');
  v_formal_amount := coalesce(v_tuition, 0) + coalesce(v_materials, 0) + coalesce(v_membership, 0);
  v_prepaid_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'prepaid_receipt_number'), '');
  v_fee_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'fee_receipt_number'), '');

  -- 建立學員
  supplied_student_id_text := nullif(pg_catalog.btrim(p_student ->> 'student_id'), '');
  if supplied_student_id_text is null then
    insert into public.students (
      email, name, gender, phone, birth_date, address, organization, education
    ) values (
      nullif(pg_catalog.btrim(p_student ->> 'email'), ''),
      pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'),
      nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value,
      nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''),
      pg_catalog.btrim(p_student ->> 'education')
    ) returning student_id into new_student_id;
  else
    begin
      new_student_id := supplied_student_id_text::bigint;
    exception when others then
      raise exception 'INVALID_STUDENT_ID';
    end;
    if new_student_id <= 0 then
      raise exception 'INVALID_STUDENT_ID';
    end if;
    insert into public.students (
      student_id, email, name, gender, phone, birth_date, address, organization, education
    ) values (
      new_student_id,
      nullif(pg_catalog.btrim(p_student ->> 'email'), ''),
      pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'),
      nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value,
      nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''),
      pg_catalog.btrim(p_student ->> 'education')
    );
  end if;

  -- 建立報名紀錄
  insert into public.enrollments (
    student_id, period, reg_type, refunded, refund_info,
    period_start_date, period_end_date, notes,
    prepaid_amount, prepaid_receipt_number,
    tuition_fee, materials_fee, membership_fee, fee_receipt_number,
    handled_by_name, handled_by_user_id, handled_by_account, handled_on
  ) values (
    new_student_id, normalized_period, '一般', 0, null,
    start_date_value, end_date_value, nullif(pg_catalog.btrim(p_enrollment ->> 'notes'), ''),
    v_prepaid_amount, v_prepaid_receipt_number,
    v_tuition, v_materials, v_membership, v_fee_receipt_number,
    nullif(pg_catalog.btrim(p_enrollment ->> 'handled_by_name'), ''),
    actor_user_id, actor_account, handled_on_value
  ) returning enrollment_id into new_enrollment_id;

  -- 建立課程明細
  insert into public.courses (enrollment_id, course_name)
  select new_enrollment_id, course_name
  from pg_catalog.unnest(normalized_courses) selected(course_name);

  -- 自動建立預繳收據
  if coalesce(v_prepaid_amount, 0) > 0 then
    insert into public.billing_receipts (amount, invoice_number)
    values (v_prepaid_amount, v_prepaid_receipt_number)
    returning receipt_id into v_receipt_id;

    insert into public.billing_receipt_courses (receipt_id, course_id)
    select v_receipt_id, c.course_id
    from public.courses c
    where c.enrollment_id = new_enrollment_id;
  end if;

  -- 自動建立正式費用收據
  if v_formal_amount > 0 then
    insert into public.billing_receipts (amount, invoice_number)
    values (v_formal_amount, v_fee_receipt_number)
    returning receipt_id into v_receipt_id;

    insert into public.billing_receipt_courses (receipt_id, course_id)
    select v_receipt_id, c.course_id
    from public.courses c
    where c.enrollment_id = new_enrollment_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'student_id', new_student_id,
    'enrollment_id', new_enrollment_id
  );
end
$function$;

revoke all on function public.create_student_with_initial_enrollment(jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.create_student_with_initial_enrollment(jsonb, jsonb)
to authenticated;

commit;

begin;

create or replace function public.create_member_enrollment(
  p_student_id bigint,
  p_enrollment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid;
  actor_account text;
  new_enrollment_id bigint;
  start_date_text text;
  end_date_text text;
  handled_on_text text;
  start_date_value date;
  end_date_value date;
  handled_on_value date;
  normalized_period text;
  normalized_courses text[];
  v_reg_type text;
  v_refunded integer;
  v_refund_info text;
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
    raise exception 'ENROLLMENT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;

  actor_user_id := (select auth.uid());
  actor_account := pg_catalog.lower(nullif(pg_catalog.btrim(auth.jwt() ->> 'email'), ''));
  if actor_user_id is null or actor_account is null then
    raise exception 'AUTH_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.students s where s.student_id = p_student_id) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if p_enrollment is null or pg_catalog.jsonb_typeof(p_enrollment) <> 'object' then
    raise exception 'INVALID_ENROLLMENT_PAYLOAD';
  end if;

  normalized_period := pg_catalog.btrim(p_enrollment ->> 'period');
  if normalized_period is null or normalized_period !~ '^第[1-9][0-9]*期$' then
    raise exception 'PERIOD_INVALID';
  end if;

  if exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and e.period = normalized_period
  ) then
    raise exception 'ENROLLMENT_ALREADY_EXISTS';
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

  v_reg_type := coalesce(nullif(pg_catalog.btrim(p_enrollment ->> 'reg_type'), ''), '續');
  v_refunded := case when (p_enrollment ->> 'refunded')::boolean is true or (p_enrollment ->> 'refunded') = '1' then 1 else 0 end;
  v_refund_info := nullif(pg_catalog.btrim(p_enrollment ->> 'refund_info'), '');

  -- 解析費用欄位
  v_prepaid_amount := private.optional_nonnegative_integer(p_enrollment, 'prepaid_amount');
  v_tuition := private.optional_nonnegative_integer(p_enrollment, 'tuition_fee');
  v_materials := private.optional_nonnegative_integer(p_enrollment, 'materials_fee');
  v_membership := private.optional_nonnegative_integer(p_enrollment, 'membership_fee');
  v_formal_amount := coalesce(v_tuition, 0) + coalesce(v_materials, 0) + coalesce(v_membership, 0);
  v_prepaid_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'prepaid_receipt_number'), '');
  v_fee_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'fee_receipt_number'), '');

  -- 建立報名紀錄
  insert into public.enrollments (
    student_id, period, reg_type, refunded, refund_info,
    period_start_date, period_end_date, notes,
    prepaid_amount, prepaid_receipt_number,
    tuition_fee, materials_fee, membership_fee, fee_receipt_number,
    handled_by_name, handled_by_user_id, handled_by_account, handled_on
  ) values (
    p_student_id, normalized_period, v_reg_type, v_refunded, v_refund_info,
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
    'student_id', p_student_id,
    'enrollment_id', new_enrollment_id
  );
end
$function$;

revoke all on function public.create_member_enrollment(bigint, jsonb)
from public, anon, authenticated;
grant execute on function public.create_member_enrollment(bigint, jsonb)
to authenticated;

commit;

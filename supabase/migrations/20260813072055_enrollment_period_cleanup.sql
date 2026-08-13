begin;

-- Final enrollment vocabulary and constraints.
drop function if exists public.create_enrollment_with_courses(bigint, text, text, text, text, integer, text, text[], jsonb);
drop function if exists public.update_enrollment_with_courses(text, text, text, text, text, integer, text, text[]);
drop function if exists public.update_enrollment_with_courses(bigint, text, text, text, text, integer, text, text[], jsonb);

alter table public.enrollments rename column season to period;
alter table public.enrollments drop column if exists pre_test;
alter table public.enrollments drop column if exists post_test;
alter table public.enrollments drop constraint if exists enrollments_student_season_key;
alter table public.enrollments drop constraint if exists enrollments_student_id_season_key;
drop index if exists public.enrollments_student_season_uidx;
drop index if exists public.enrollments_season_idx;
alter table public.enrollments add constraint enrollments_student_period_key unique (student_id, period);
alter table public.enrollments add constraint enrollments_period_format_check check (period ~ '^第[1-9][0-9]*期$');
create index enrollments_period_idx on public.enrollments (period);

create function public.create_enrollment_with_courses(
  p_student_id bigint, p_period text, p_reg_type text, p_refunded integer,
  p_refund_info text, p_course_names text[], p_payment_records jsonb default '[]'::jsonb
) returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_enrollment_id bigint; v_names text[]; v_payment jsonb; v_course text; v_amount integer; v_receipt bigint;
begin
  if public.current_app_role() not in ('editor','admin') then raise exception 'ENROLLMENT_CREATE_FORBIDDEN' using errcode='42501'; end if;
  if p_period !~ '^第[1-9][0-9]*期$' then raise exception 'PERIOD_INVALID'; end if;
  if not exists (select 1 from public.students s where s.student_id=p_student_id) then raise exception 'STUDENT_NOT_FOUND'; end if;
  select array_agg(name order by name) into v_names from (select min(btrim(x)) name from unnest(coalesce(p_course_names,array[]::text[])) x where nullif(btrim(x),'') is not null group by lower(btrim(x))) n;
  if coalesce(cardinality(v_names),0)=0 then raise exception 'COURSE_REQUIRED'; end if;
  if jsonb_typeof(coalesce(p_payment_records,'[]'::jsonb)) <> 'array' then raise exception 'PAYMENT_RECORDS_INVALID'; end if;
  insert into public.enrollments(student_id,period,reg_type,refunded,refund_info) values(p_student_id,p_period,p_reg_type,p_refunded,p_refund_info) returning enrollment_id into v_enrollment_id;
  insert into public.courses(enrollment_id,course_name) select v_enrollment_id, name from unnest(v_names) name;
  for v_payment in select value from jsonb_array_elements(p_payment_records) loop
    if jsonb_typeof(v_payment)<>'object' or jsonb_typeof(v_payment->'course_names')<>'array' or jsonb_typeof(v_payment->'amount')<>'number' then raise exception 'PAYMENT_RECORDS_INVALID'; end if;
    v_amount := (v_payment->>'amount')::integer;
    if v_amount<0 then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
    insert into public.billing_receipts(amount,invoice_number) values(v_amount,nullif(btrim(v_payment->>'invoice_number'),'')) returning receipt_id into v_receipt;
    for v_course in select value #>> '{}' from jsonb_array_elements(v_payment->'course_names') loop
      if not exists(select 1 from unnest(v_names) n where lower(btrim(n))=lower(btrim(v_course))) then raise exception 'PAYMENT_COURSE_NOT_SELECTED'; end if;
      insert into public.billing_receipt_courses(receipt_id,course_id)
      select v_receipt,c.course_id from public.courses c where c.enrollment_id=v_enrollment_id and lower(btrim(c.course_name))=lower(btrim(v_course));
    end loop;
  end loop;
  return v_enrollment_id;
end $fn$;

create function public.update_enrollment_with_courses(
  p_enrollment_id bigint, p_period text, p_reg_type text, p_refunded integer,
  p_refund_info text, p_course_names text[], p_payment_records jsonb default '[]'::jsonb
) returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_names text[]; v_course text; v_payment jsonb; v_amount integer; v_receipt bigint;
begin
  if public.current_app_role() not in ('editor','admin') then raise exception 'ENROLLMENT_UPDATE_FORBIDDEN' using errcode='42501'; end if;
  if p_period !~ '^第[1-9][0-9]*期$' then raise exception 'PERIOD_INVALID'; end if;
  perform 1 from public.enrollments e where e.enrollment_id=p_enrollment_id for update; if not found then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
  select array_agg(name order by name) into v_names from (select min(btrim(x)) name from unnest(coalesce(p_course_names,array[]::text[])) x where nullif(btrim(x),'') is not null group by lower(btrim(x))) n;
  if coalesce(cardinality(v_names),0)=0 then raise exception 'COURSE_REQUIRED'; end if;
  if exists(select 1 from public.courses c join public.billing_receipt_courses l on l.course_id=c.course_id where c.enrollment_id=p_enrollment_id and not exists(select 1 from unnest(v_names) n where lower(btrim(n))=lower(btrim(c.course_name)))) then raise exception 'COURSE_RECEIPT_LOCKED'; end if;
  update public.enrollments set period=p_period,reg_type=p_reg_type,refunded=p_refunded,refund_info=p_refund_info where enrollment_id=p_enrollment_id;
  delete from public.courses c where c.enrollment_id=p_enrollment_id and not exists(select 1 from unnest(v_names) n where lower(btrim(n))=lower(btrim(c.course_name))) and not exists(select 1 from public.billing_receipt_courses l where l.course_id=c.course_id);
  insert into public.courses(enrollment_id,course_name) select p_enrollment_id,n from unnest(v_names) n where not exists(select 1 from public.courses c where c.enrollment_id=p_enrollment_id and lower(btrim(c.course_name))=lower(btrim(n)));
  -- Existing receipt editing remains handled by the dedicated billing-receipt RPCs.
  if jsonb_typeof(coalesce(p_payment_records,'[]'::jsonb)) <> 'array' then raise exception 'PAYMENT_RECORDS_INVALID'; end if;
  return p_enrollment_id;
end $fn$;

revoke all on function public.create_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb) from public, anon;
revoke all on function public.update_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb) from public, anon;
grant execute on function public.create_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb) to authenticated;
grant execute on function public.update_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb) to authenticated;
commit;

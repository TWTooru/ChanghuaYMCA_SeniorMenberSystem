begin;
select plan(22);

truncate table public.students restart identity cascade;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor@example.com","app_metadata":{"app_role":"editor"}}',
  true
);

select has_function(
  'public', 'create_student_with_initial_enrollment', array['jsonb', 'jsonb'],
  'atomic member enrollment RPC exists'
);
select ok(not pg_catalog.has_function_privilege(
  'public', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'public cannot execute the RPC');
select ok(not pg_catalog.has_function_privilege(
  'anon', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'anon cannot execute the RPC');
select ok(pg_catalog.has_function_privilege(
  'authenticated', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'authenticated can execute the RPC');

select pg_catalog.set_config(
  'test.created',
  public.create_student_with_initial_enrollment(
    '{"email":" New.Member@Example.com ","name":"新會員","gender":"女","phone":" 0912-345-678 ","birth_date":"1985-07-01","address":" 彰化市 ","organization":" YMCA ","education":"專科/大學"}'::jsonb,
    '{"period":"第6期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門","有氧舞蹈"],"notes":" 備註文字 ","prepaid_amount":500,"prepaid_receipt_number":" P-1 ","tuition_fee":2400,"materials_fee":300,"membership_fee":100,"fee_receipt_number":" F-1 ","handled_by_name":" 經手人 ","handled_on":"2026-08-17","handled_by_user_id":"99999999-9999-4999-8999-999999999999","handled_by_account":"spoof@example.com"}'::jsonb
  )::text,
  true
);

select ok(
  ((pg_catalog.current_setting('test.created')::jsonb ->> 'student_id')::bigint > 0),
  'RPC returns a positive student ID'
);
select ok(
  ((pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint > 0),
  'RPC returns a positive enrollment ID'
);
select is(
  (select pg_catalog.jsonb_build_array(email, name)
   from public.students
   where student_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'student_id')::bigint),
  '["new.member@example.com", "新會員"]'::jsonb,
  'student profile is normalized'
);
select is(
  (select pg_catalog.jsonb_build_object(
      'period', period, 'start', period_start_date, 'end', period_end_date,
      'notes', notes, 'prepaid', prepaid_amount, 'prepaid_no', prepaid_receipt_number,
      'tuition', tuition_fee, 'materials', materials_fee, 'membership', membership_fee,
      'fee_no', fee_receipt_number, 'handler', handled_by_name, 'handled_on', handled_on
    )
   from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  '{"period":"第6期","start":"2026-09-01","end":"2026-12-31","notes":"備註文字","prepaid":500,"prepaid_no":"P-1","tuition":2400,"materials":300,"membership":100,"fee_no":"F-1","handler":"經手人","handled_on":"2026-08-17"}'::jsonb,
  'paper-form enrollment values are stored and trimmed'
);
select is(
  (select handled_by_user_id from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'handler user ID comes from auth.uid rather than payload'
);
select is(
  (select handled_by_account from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  'editor@example.com',
  'handler account comes from the JWT rather than payload'
);
select is(
  (select pg_catalog.array_agg(course_name order by course_name) from public.courses
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  array['有氧舞蹈', '瑜伽入門']::text[],
  'all selected courses are created'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"viewer@example.com","app_metadata":{"app_role":"viewer"}}',
  true
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"檢視者","gender":"女","education":"高中"}'::jsonb,
    '{"period":"第7期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門"]}'::jsonb
  )$$,
  '42501', 'INITIAL_ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot execute the mutation'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor@example.com","app_metadata":{"app_role":"editor"}}',
  true
);
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試一","gender":"女","education":"高中"}'::jsonb, '{"period":"第0期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門"]}'::jsonb)$$, 'P0001', 'PERIOD_INVALID', 'invalid period is rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試二","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","courses":["瑜伽入門"]}'::jsonb)$$, 'P0001', 'PERIOD_DATES_REQUIRED', 'missing dates are rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試三","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","period_start_date":"2026-12-31","period_end_date":"2026-09-01","courses":["瑜伽入門"]}'::jsonb)$$, 'P0001', 'PERIOD_DATE_ORDER_INVALID', 'reversed dates are rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試四","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":[]}'::jsonb)$$, 'P0001', 'COURSE_REQUIRED', 'missing courses are rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試五","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門"],"tuition_fee":-1}'::jsonb)$$, 'P0001', 'FEE_AMOUNT_INVALID', 'invalid money is rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試六","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門"],"handled_on":"2026-02-30"}'::jsonb)$$, 'P0001', 'HANDLED_ON_INVALID', 'invalid handled date is rejected');
select throws_ok($$select public.create_student_with_initial_enrollment('{"name":"測試七","gender":"女","education":"高中"}'::jsonb, '{"period":"第7期","period_start_date":"2026-02-30","period_end_date":"2026-12-31","courses":["瑜伽入門"]}'::jsonb)$$, 'P0001', 'PERIOD_DATE_INVALID', 'invalid calendar date is rejected');

select lives_ok(
  $$insert into public.students (student_id, name, gender, education) values (8200, '歷史會員', '女', '高中');
    insert into public.enrollments (student_id, period) values (8200, '第9期')$$,
  'historical enrollments may leave new fields null'
);

create function pg_temp.fail_initial_course_insert()
returns trigger language plpgsql as $$
begin
  if new.course_name = '觸發失敗課程' then raise exception 'TEST_COURSE_FAILURE'; end if;
  return new;
end
$$;
create trigger test_fail_initial_course_insert
before insert on public.courses
for each row execute function pg_temp.fail_initial_course_insert();

select throws_like(
  $$select public.create_student_with_initial_enrollment(
    '{"email":"rollback@example.com","name":"回滾會員","gender":"女","education":"高中"}'::jsonb,
    '{"period":"第10期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["觸發失敗課程"]}'::jsonb
  )$$,
  '%TEST_COURSE_FAILURE%', 'course failure aborts the RPC'
);
select is(
  (select count(*)::integer from public.students where email = 'rollback@example.com'),
  0, 'course failure rolls back the inserted student'
);

select * from finish();
rollback;

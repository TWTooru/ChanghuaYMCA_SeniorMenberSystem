begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'editor.enrollment-forms-fixture@example.com',
    '{"app_role":"viewer"}',
    '{}'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'viewer.enrollment-forms-fixture@example.com',
    '{"app_role":"admin"}',
    '{}'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'admin.enrollment-forms-fixture@example.com',
    '{"app_role":"viewer"}',
    '{}'
  );

update public.app_user_roles
set role = 'editor', updated_at = pg_catalog.now()
where user_id = '11111111-1111-4111-8111-111111111111';

update public.app_user_roles
set role = 'admin', updated_at = pg_catalog.now()
where user_id = '33333333-3333-4333-8333-333333333333';

select plan(30);

truncate table public.students restart identity cascade;

select has_table('public', 'enrollment_forms', 'paper enrollment forms exist');
select col_is_pk('public', 'enrollment_forms', 'form_id', 'form_id is the primary key');
select has_column('public', 'courses', 'form_id', 'courses belong to a form');
select has_column('public', 'billing_receipts', 'form_id', 'receipts belong to a form');
select has_column('public', 'billing_receipts', 'receipt_kind', 'receipts expose their kind');
select has_function('public', 'update_enrollment_form', array['bigint', 'jsonb'], 'form update RPC exists');
select has_function('public', 'set_enrollment_form_refund', array['bigint', 'boolean', 'text'], 'form refund RPC exists');
select has_function('public', 'delete_enrollment_form', array['bigint'], 'form delete RPC exists');
select has_function('public', 'update_enrollment_period', array['bigint', 'text', 'date', 'date'], 'period update RPC exists');

insert into public.course_catalog (course_name, active)
values ('課程A', true), ('課程B', true), ('課程C', true), ('課程D', true), ('課程E', true)
on conflict (course_name) do update set active = excluded.active;

insert into public.students (student_id, name, gender, education)
values (9001, '多表學員', '女', '專科/大學');

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor.enrollment-forms-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"viewer"}}',
  true
);

select pg_catalog.set_config('test.form_one', public.create_member_enrollment(
  9001::bigint,
  '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程A","課程B"],"prepaid_amount":500,"prepaid_receipt_number":"P-1","tuition_fee":2000,"materials_fee":200,"membership_fee":100,"fee_receipt_number":"F-1","handled_by_name":"王承辦","reported_on":"2026-08-20","notes":"第一張"}'::jsonb
)::text, true);

select pg_catalog.set_config('test.form_two', public.create_member_enrollment(
  9001::bigint,
  '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程C","課程D"],"prepaid_amount":300,"prepaid_receipt_number":"P-2","tuition_fee":1800,"materials_fee":100,"membership_fee":0,"fee_receipt_number":"F-2","handled_by_name":"李承辦","reported_on":"2026-08-21","notes":"第二張"}'::jsonb
)::text, true);

-- Assert one enrollment created for student
select is(
  (select count(*)::integer from public.enrollments where student_id = 9001 and period = '第16期'),
  1,
  'only one enrollment is created for the period'
);

-- Assert returned json for form 1 and form 2
select is(
  (select pg_catalog.jsonb_build_object(
    'appended', (pg_catalog.current_setting('test.form_one')::jsonb ->> 'appended')::boolean,
    'seq', (pg_catalog.current_setting('test.form_one')::jsonb ->> 'form_sequence')::integer
  )),
  '{"appended":false,"seq":1}'::jsonb,
  'first form returns appended=false and seq=1'
);

select is(
  (select pg_catalog.jsonb_build_object(
    'appended', (pg_catalog.current_setting('test.form_two')::jsonb ->> 'appended')::boolean,
    'seq', (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_sequence')::integer
  )),
  '{"appended":true,"seq":2}'::jsonb,
  'second form returns appended=true and seq=2'
);

-- Assert form rows details
select is(
  (select pg_catalog.jsonb_build_object(
    'reported_on', reported_on,
    'notes', notes,
    'handler', handled_by_name,
    'tuition', tuition_fee,
    'materials', materials_fee,
    'membership', membership_fee
  ) from public.enrollment_forms
  where form_id = (pg_catalog.current_setting('test.form_one')::jsonb ->> 'form_id')::bigint),
  '{"reported_on":"2026-08-20","notes":"第一張","handler":"王承辦","tuition":2000,"materials":200,"membership":100}'::jsonb,
  'form 1 details are stored accurately'
);

select is(
  (select pg_catalog.jsonb_build_object(
    'reported_on', reported_on,
    'notes', notes,
    'handler', handled_by_name,
    'tuition', tuition_fee,
    'materials', materials_fee,
    'membership', membership_fee
  ) from public.enrollment_forms
  where form_id = (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint),
  '{"reported_on":"2026-08-21","notes":"第二張","handler":"李承辦","tuition":1800,"materials":100,"membership":0}'::jsonb,
  'form 2 details are stored accurately'
);

-- Assert courses split across forms
select is(
  (select pg_catalog.array_agg(course_name order by course_name) from public.courses
   where form_id = (pg_catalog.current_setting('test.form_one')::jsonb ->> 'form_id')::bigint),
  array['課程A', '課程B']::text[],
  'form 1 owns courses A and B'
);

select is(
  (select pg_catalog.array_agg(course_name order by course_name) from public.courses
   where form_id = (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint),
  array['課程C', '課程D']::text[],
  'form 2 owns courses C and D'
);

-- Assert typed receipts per form
select is(
  (select count(*)::integer from public.billing_receipts
   where form_id in (
     (pg_catalog.current_setting('test.form_one')::jsonb ->> 'form_id')::bigint,
     (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint
   )),
  4,
  'four typed receipts created across the two forms'
);

-- Reject duplicate course across forms in same period
select throws_ok(
  $$select public.create_member_enrollment(
    9001::bigint,
    '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程A","課程E"]}'::jsonb
  )$$,
  'P0001', 'COURSE_ALREADY_SELECTED',
  'duplicate course in another form is rejected'
);

-- Reject mismatched period dates
select throws_ok(
  $$select public.create_member_enrollment(
    9001::bigint,
    '{"period":"第16期","period_start_date":"2026-09-15","period_end_date":"2026-12-31","courses":["課程E"]}'::jsonb
  )$$,
  'P0001', 'PERIOD_DATES_MISMATCH',
  'mismatched period dates when appending are rejected'
);

-- Reject invalid reported date
select throws_ok(
  $$select public.create_member_enrollment(
    9001::bigint,
    '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程E"],"reported_on":"2026-02-30"}'::jsonb
  )$$,
  'P0001', 'REPORTED_ON_INVALID',
  'invalid reported_on date is rejected'
);

-- Test viewer permission denied
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"viewer.enrollment-forms-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
select throws_ok(
  $$select public.create_member_enrollment(
    9001::bigint,
    '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程E"]}'::jsonb
  )$$,
  '42501', 'ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot create an enrollment form'
);

-- Reset back to editor
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor.enrollment-forms-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"viewer"}}',
  true
);

-- Test update_enrollment_form
select lives_ok(
  $$select public.update_enrollment_form(
    (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint,
    '{"courses":["課程C","課程E"],"prepaid_amount":400,"prepaid_receipt_number":"P-2-MOD","tuition_fee":2100,"materials_fee":150,"membership_fee":0,"fee_receipt_number":"F-2-MOD","handled_by_name":"李承辦改","reported_on":"2026-08-22","notes":"第二張修改"}'::jsonb
  )$$,
  'editor can update an enrollment form'
);

select is(
  (select pg_catalog.array_agg(course_name order by course_name) from public.courses
   where form_id = (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint),
  array['課程C', '課程E']::text[],
  'form 2 courses updated to C and E'
);

-- Test set_enrollment_form_refund
select lives_ok(
  $$select public.set_enrollment_form_refund(
    (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint,
    true,
    '學員因事退選第二張'
  )$$,
  'editor can refund form 2'
);

select is(
  (select pg_catalog.jsonb_build_object('refunded', refunded, 'info', refund_info)
   from public.enrollment_forms
   where form_id = (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint),
  '{"refunded":true,"info":"學員因事退選第二張"}'::jsonb,
  'form 2 is marked refunded'
);

select is(
  (select refunded from public.enrollment_forms
   where form_id = (pg_catalog.current_setting('test.form_one')::jsonb ->> 'form_id')::bigint),
  false,
  'form 1 remains active when form 2 is refunded'
);

-- Test admin delete form
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","email":"admin.enrollment-forms-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"viewer"}}',
  true
);

select lives_ok(
  $$select public.delete_enrollment_form(
    (pg_catalog.current_setting('test.form_two')::jsonb ->> 'form_id')::bigint
  )$$,
  'admin can delete form 2'
);

select is(
  (select count(*)::integer from public.enrollment_forms where enrollment_id = (
    select enrollment_id from public.enrollments where student_id = 9001 and period = '第16期'
  )),
  1,
  'parent enrollment still exists with remaining form 1'
);

-- Test trigger rollback: trigger failure leaves no partial form or receipts
create function pg_temp.fail_form_course_insert()
returns trigger language plpgsql as $$
begin
  if new.course_name = '觸發失敗課程' then raise exception 'TEST_FORM_COURSE_FAILURE'; end if;
  return new;
end
$$;
create trigger test_fail_form_course_insert
before insert on public.courses
for each row execute function pg_temp.fail_form_course_insert();

select throws_like(
  $$select public.create_member_enrollment(
    9001::bigint,
    '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["觸發失敗課程"],"prepaid_amount":100}'::jsonb
  )$$,
  '%TEST_FORM_COURSE_FAILURE%',
  'course insert failure aborts form creation'
);

select is(
  (select count(*)::integer from public.enrollment_forms where enrollment_id = (
    select enrollment_id from public.enrollments where student_id = 9001 and period = '第16期'
  )),
  1,
  'aborted form creation leaves no partial form row'
);

select * from finish();
rollback;

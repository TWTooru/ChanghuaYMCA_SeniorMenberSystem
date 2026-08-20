begin;
select plan(20);

select has_table('public', 'billing_receipts', 'billing receipt headers exist');
select has_table('public', 'billing_receipt_courses', 'billing receipt course links exist');
select col_is_pk('public', 'billing_receipt_courses', array['receipt_id', 'course_id'], 'billing receipt course links have composite primary key');
select has_function('public', 'create_billing_receipt', array['bigint[]', 'integer', 'text'], 'create receipt RPC exists');
select has_function('public', 'update_billing_receipt', array['bigint', 'integer', 'text'], 'update receipt RPC exists');
select has_function('public', 'delete_billing_receipt', array['bigint'], 'delete receipt RPC exists');
select has_function('public', 'create_enrollment_with_courses', array['bigint', 'text', 'text', 'integer', 'text', 'text[]', 'jsonb'], 'period enrollment RPC exists');
select has_function('public', 'update_enrollment_with_courses', array['bigint', 'text', 'text', 'integer', 'text', 'text[]', 'jsonb'], 'period enrollment update RPC exists');

select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"editor"}}', true);
insert into public.students (student_id, name, gender, education)
values (9001, 'Billing test student', '男', '高中');
insert into public.course_catalog (course_name, active)
values ('A', true), ('B', true);

select lives_ok(
  $$select set_config('test.enrollment_id', public.create_enrollment_with_courses(
    9001::bigint, '第16期', '續', 0, null, array['A', 'B'],
    '[{"course_names":["A"],"amount":1200,"invoice_number":"R-001"}]'::jsonb
  )::text, true)$$,
  'editor can create a period enrollment with grouped payment'
);
select is((select count(*)::integer from public.courses where enrollment_id = current_setting('test.enrollment_id')::bigint), 2, 'both selected courses are created');
select is((select count(*)::integer from public.billing_receipts), 1, 'one grouped receipt is created');
select is((select receipt_kind from public.billing_receipts), 'other', 'grouped receipt has receipt_kind other');
select ok(((select form_id from public.billing_receipts) > 0), 'grouped receipt has a valid form_id');
select is((select count(*)::integer from public.billing_receipt_courses), 1, 'receipt links only its selected course');
select throws_ok(
  $$select public.update_enrollment_with_courses(
    current_setting('test.enrollment_id')::bigint, '第16期', '續', 0, null, array['B'], '[]'::jsonb
  )$$,
  'P0001', 'COURSE_RECEIPT_LOCKED',
  'a receipt-linked course cannot be removed from its enrollment'
);
select throws_ok(
  $$select public.create_billing_receipt(
    array[(select course_id from public.courses where enrollment_id = current_setting('test.enrollment_id')::bigint and course_name = 'A')]::bigint[], -1, null
  )$$,
  'P0001', 'PAYMENT_AMOUNT_INVALID',
  'negative receipt amounts are rejected'
);
select lives_ok(
  $$select public.update_billing_receipt((select receipt_id from public.billing_receipts), 3200, 'R-UPDATED')$$,
  'editor can update receipt billing fields'
);
select results_eq(
  $$select amount, invoice_number from public.billing_receipts$$,
  $$values (3200::integer, 'R-UPDATED'::text)$$,
  'receipt billing fields are updated once on the header'
);
select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"viewer"}}', true);
select throws_ok(
  $$select public.create_enrollment_with_courses(9001::bigint, '第17期', '續', 0, null, array['Viewer'], '[]'::jsonb)$$,
  '42501', 'ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot create an enrollment through RPC'
);
select throws_ok(
  $$select public.create_billing_receipt(array[(select course_id from public.courses limit 1)]::bigint[], 1000, null)$$,
  '42501', 'PAYMENT_FORBIDDEN',
  'viewer cannot create a receipt'
);

select * from finish();
rollback;

begin;
select no_plan();

select has_table('public', 'billing_receipts', 'billing receipt headers exist');
select has_table('public', 'billing_receipt_courses', 'billing receipt course links exist');
select col_type_is('public', 'billing_receipts', 'amount', 'integer', 'billing amount is integer');
select col_is_null('public', 'billing_receipts', 'amount', 'legacy null amount remains representable');
select col_is_unique('public', 'billing_receipt_courses', 'course_id', 'one course belongs to at most one receipt');
select has_function('public', 'create_billing_receipt', array['bigint[]', 'integer', 'text'], 'create receipt RPC exists');
select has_function('public', 'update_billing_receipt', array['bigint', 'integer', 'text'], 'update receipt RPC exists');
select has_function('public', 'delete_billing_receipt', array['bigint'], 'delete receipt RPC exists');
select ok(
  pg_catalog.has_table_privilege('authenticated', 'public.billing_receipts', 'select')
    and not pg_catalog.has_table_privilege('authenticated', 'public.billing_receipts', 'insert'),
  'authenticated can read receipt headers but cannot write them directly'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_billing_receipt(bigint[],integer,text)',
    'execute'
  )
    and not pg_catalog.has_function_privilege(
      'anon',
      'public.create_billing_receipt(bigint[],integer,text)',
      'execute'
    ),
  'only authenticated receives create-receipt execute privilege'
);

select set_config('test.payment_student_id', (910000000000 + txid_current())::text, true);
insert into public.students (student_id, name)
values (current_setting('test.payment_student_id'), 'Payment test student');

with inserted as (
  insert into public.enrollments (student_id, season)
  values (current_setting('test.payment_student_id'), 'Payment Test Season A')
  returning enrollment_id
)
select set_config('test.payment_enrollment_a', enrollment_id::text, true)
from inserted;

with inserted as (
  insert into public.enrollments (student_id, season)
  values (current_setting('test.payment_student_id'), 'Payment Test Season B')
  returning enrollment_id
)
select set_config('test.payment_enrollment_b', enrollment_id::text, true)
from inserted;

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, names.course_name
from public.enrollments e
cross join (values ('A'), ('B')) as names(course_name)
where e.enrollment_id::text = current_setting('test.payment_enrollment_a');

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, 'C'
from public.enrollments e
where e.enrollment_id::text = current_setting('test.payment_enrollment_b');

select set_config(
  'test.payment_course_a',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_a') and c.course_name = 'A'),
  true
);
select set_config(
  'test.payment_course_b',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_a') and c.course_name = 'B'),
  true
);
select set_config(
  'test.payment_course_c',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_b') and c.course_name = 'C'),
  true
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"editor"}}',
  true
);

set local role authenticated;

select lives_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s,%s]::bigint[], 3000, %L)',
    current_setting('test.payment_course_a'),
    current_setting('test.payment_course_b'),
    'R-1'
  ),
  'editor creates one receipt for two courses in one enrollment'
);

select set_config(
  'test.payment_receipt_id',
  (select link.receipt_id::text
   from public.billing_receipt_courses link
   where link.course_id = current_setting('test.payment_course_a')::bigint),
  true
);

select results_eq(
  pg_catalog.format(
    'select count(*)::integer from public.billing_receipt_courses where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (2::integer)$$,
  'one receipt owns both course links'
);

reset role;

select throws_ok(
  pg_catalog.format(
    'update public.courses set enrollment_id = %L where course_id = %s',
    current_setting('test.payment_enrollment_b'),
    current_setting('test.payment_course_b')
  ),
  'P0001',
  'PAYMENT_CROSS_ENROLLMENT',
  'a billed course cannot be moved across enrollments'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_a')
  ),
  'P0001',
  'PAYMENT_ALREADY_EXISTS',
  'the same course cannot be billed twice'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s,%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_b'),
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_CROSS_ENROLLMENT',
  'one receipt cannot cross enrollments'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], null, null)',
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_AMOUNT_REQUIRED',
  'new receipts require an amount'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], -1, null)',
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'new receipts reject negative amounts'
);

select lives_ok(
  pg_catalog.format(
    'select public.update_billing_receipt(%s, 3200, %L)',
    current_setting('test.payment_receipt_id'),
    'R-UPDATED'
  ),
  'editor updates only receipt billing fields'
);

select results_eq(
  pg_catalog.format(
    'select amount, invoice_number from public.billing_receipts where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (3200::integer, 'R-UPDATED'::text)$$,
  'updated billing fields are stored once on the header'
);

select throws_ok(
  pg_catalog.format(
    'select public.update_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[])',
    current_setting('test.payment_enrollment_a'),
    'Payment Test Season A',
    '續',
    '',
    '',
    0,
    '',
    'A'
  ),
  'P0001',
  'COURSE_RECEIPT_LOCKED',
  'an enrollment update cannot remove a course owned by a grouped receipt'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"viewer"}}',
  true
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_c')
  ),
  '42501',
  'PAYMENT_FORBIDDEN',
  'viewer cannot create a receipt'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Viewer Forbidden Season',
    '續',
    '',
    '',
    0,
    '',
    'Viewer Course',
    '[]'
  ),
  '42501',
  'ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot create an enrollment through RPC'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"editor"}}',
  true
);

select set_config(
  'test.payment_enrollment_count_before',
  (select count(*)::text from public.enrollments
   where student_id = current_setting('test.payment_student_id')),
  true
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Duplicate Payment Assignment',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":1000},{"course_names":["X"],"amount":2000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_DUPLICATE',
  'one course cannot appear in two initial payments'
);

select is(
  (select count(*)::text from public.enrollments
   where student_id = current_setting('test.payment_student_id')),
  current_setting('test.payment_enrollment_count_before'),
  'duplicate payment validation happens before enrollment insert'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Unselected Payment Course',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["Y"],"amount":1000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_NOT_SELECTED',
  'initial payment cannot reference an unselected course'
);

select lives_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L,%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Atomic Grouped Payment',
    '續',
    '',
    '',
    0,
    '',
    'D',
    'E',
    '[{"course_names":["D","E"],"amount":4000,"invoice_number":"R-ATOMIC"}]'
  ),
  'editor atomically creates enrollment, courses, receipt, and links'
);

select results_eq(
  $$select count(*)::integer
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Atomic Grouped Payment'
      and receipt.invoice_number = 'R-ATOMIC'$$,
  $$values (2::integer)$$,
  'atomic initial payment owns both newly inserted courses'
);

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, 'Legacy Null Amount'
from public.enrollments e
where e.enrollment_id::text = current_setting('test.payment_enrollment_b');

insert into public.course_receipts (course_id, amount, invoice_number)
select c.course_id, null, 'LEGACY-NULL'
from public.courses c
where c.enrollment_id::text = current_setting('test.payment_enrollment_b')
  and c.course_name = 'Legacy Null Amount';

select results_eq(
  $$select receipt.amount, receipt.invoice_number
    from public.course_receipts old
    join public.billing_receipts receipt
      on receipt.legacy_course_receipt_id = old.receipt_id
    join public.billing_receipt_courses link
      on link.receipt_id = receipt.receipt_id and link.course_id = old.course_id
    where old.invoice_number = 'LEGACY-NULL'$$,
  $$values (null::integer, 'LEGACY-NULL'::text)$$,
  'legacy trigger preserves a null amount and its course link'
);

select set_config(
  'test.payment_legacy_receipt_id',
  (select old.receipt_id::text
   from public.course_receipts old
   where old.invoice_number = 'LEGACY-NULL'),
  true
);

select lives_ok(
  $$select public.delete_billing_receipt(receipt.receipt_id)
    from public.billing_receipts receipt
    where receipt.legacy_course_receipt_id = current_setting('test.payment_legacy_receipt_id')::bigint$$,
  'legacy-backed grouped receipt can be replaced'
);

select lives_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], 7000, %L)',
    (select c.course_id
     from public.courses c
     where c.enrollment_id::text = current_setting('test.payment_enrollment_b')
       and c.course_name = 'Legacy Null Amount'),
    'LEGACY-REPLACED'
  ),
  'replacement receipt claims the legacy course'
);

select lives_ok(
  $$select private.migrate_legacy_billing_receipts()$$,
  'legacy migration can rerun after a receipt replacement'
);

select results_eq(
  $$select count(*)::integer
    from public.billing_receipts receipt
    where receipt.legacy_course_receipt_id =
      current_setting('test.payment_legacy_receipt_id')::bigint$$,
  $$values (0::integer)$$,
  'rerunning migration does not create an orphan legacy header'
);

with inserted as (
  insert into public.enrollments (student_id, season, amount, invoice_number)
  values (current_setting('test.payment_student_id'), 'Legacy Enrollment Billing', 5000, 'LEGACY-ALL')
  returning enrollment_id
)
insert into public.courses (enrollment_id, course_name)
select inserted.enrollment_id, names.course_name
from inserted
cross join (values ('Legacy A'), ('Legacy B')) as names(course_name);

select private.migrate_legacy_billing_receipts();

select results_eq(
  $$select count(*)::integer
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Legacy Enrollment Billing'
      and receipt.amount = 5000
      and receipt.invoice_number = 'LEGACY-ALL'$$,
  $$values (2::integer)$$,
  'legacy enrollment billing migrates to one receipt linked to all courses'
);

select results_eq(
  $$select amount, invoice_number
    from public.enrollments
    where season = 'Legacy Enrollment Billing'$$,
  $$values (null::integer, null::text)$$,
  'legacy enrollment fields clear only after successful conversion'
);

select lives_ok(
  pg_catalog.format(
    'select public.delete_billing_receipt(%s)',
    current_setting('test.payment_receipt_id')
  ),
  'editor deletes a grouped receipt'
);

select results_eq(
  pg_catalog.format(
    'select count(*)::integer from public.billing_receipt_courses where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (0::integer)$$,
  'deleting a receipt cascades its course links'
);

select * from finish();
rollback;

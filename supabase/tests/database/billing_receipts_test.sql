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
select results_eq(
  $$select count(*)::integer
    from (values
      ('public.billing_receipts'),
      ('public.billing_receipt_courses')
    ) as target(table_name)
    where pg_catalog.has_table_privilege('authenticated', target.table_name, 'select')
      and not pg_catalog.has_table_privilege('authenticated', target.table_name, 'insert')
      and not pg_catalog.has_table_privilege('authenticated', target.table_name, 'update')
      and not pg_catalog.has_table_privilege('authenticated', target.table_name, 'delete')
      and not pg_catalog.has_table_privilege('anon', target.table_name, 'select')$$,
  $$values (2::integer)$$,
  'both grouped billing tables are authenticated read-only and hidden from anon'
);
select results_eq(
  $$select count(*)::integer
    from (values
      ('public.create_enrollment_with_courses(text,text,text,text,text,integer,text,text[],jsonb)'),
      ('public.create_billing_receipt(bigint[],integer,text)'),
      ('public.update_billing_receipt(bigint,integer,text)'),
      ('public.delete_billing_receipt(bigint)'),
      ('public.update_enrollment_with_courses(text,text,text,text,text,integer,text,text[])')
    ) as target(signature)
    where pg_catalog.has_function_privilege('authenticated', target.signature, 'execute')
      and not pg_catalog.has_function_privilege('anon', target.signature, 'execute')$$,
  $$values (5::integer)$$,
  'all public write RPCs execute only for authenticated users'
);
select results_eq(
  $$select count(*)::integer
    from (values
      ('public.create_enrollment_with_courses(text,text,text,text,text,integer,text,text[],jsonb)'),
      ('public.create_billing_receipt(bigint[],integer,text)'),
      ('public.update_billing_receipt(bigint,integer,text)'),
      ('public.delete_billing_receipt(bigint)'),
      ('public.update_enrollment_with_courses(text,text,text,text,text,integer,text,text[])')
    ) as target(signature)
    join pg_catalog.pg_proc proc
      on proc.oid = pg_catalog.to_regprocedure(target.signature)
    where proc.prosecdef
      and exists (
        select 1
        from pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as config(setting)
        where pg_catalog.split_part(config.setting, '=', 1) = 'search_path'
          and pg_catalog.replace(
            pg_catalog.split_part(config.setting, '=', 2),
            '"',
            ''
          ) = ''
      )$$,
  $$values (5::integer)$$,
  'all public write RPCs are security definer with an empty search path'
);
select results_eq(
  $$select count(*)::integer
    from (values
      (
        'billing_receipt_courses',
        'billing_receipt_courses_enforce_single_enrollment',
        7::smallint,
        'private.enforce_billing_receipt_single_enrollment()'
      ),
      (
        'courses',
        'courses_prevent_grouped_receipt_cross_enrollment',
        19::smallint,
        'private.prevent_grouped_receipt_cross_enrollment()'
      )
    ) as target(table_name, trigger_name, trigger_type, function_signature)
    join pg_catalog.pg_class relation on relation.relname = target.table_name
    join pg_catalog.pg_namespace relation_schema
      on relation_schema.oid = relation.relnamespace
     and relation_schema.nspname = 'public'
    join pg_catalog.pg_trigger trigger
      on trigger.tgrelid = relation.oid
     and trigger.tgname = target.trigger_name
     and not trigger.tgisinternal
    join pg_catalog.pg_proc proc on proc.oid = trigger.tgfoid
    where trigger.tgenabled = 'O'
      and trigger.tgtype = target.trigger_type
      and proc.oid = pg_catalog.to_regprocedure(target.function_signature)
      and proc.prosecdef
      and not pg_catalog.has_function_privilege('authenticated', proc.oid, 'execute')
      and not pg_catalog.has_function_privilege('anon', proc.oid, 'execute')
      and exists (
        select 1
        from pg_catalog.unnest(coalesce(proc.proconfig, array[]::text[])) as config(setting)
        where pg_catalog.split_part(config.setting, '=', 1) = 'search_path'
          and pg_catalog.replace(
            pg_catalog.split_part(config.setting, '=', 2),
            '"',
            ''
          ) = ''
      )$$,
  $$values (2::integer)$$,
  'cross-enrollment invariant triggers are active, private, and hardened'
);
select ok(
  (
    select pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure(
            'public.create_billing_receipt(bigint[],integer,text)'
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ) like '%order by c.course_id for update;%'
  )
  and (
    select pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure(
            'private.enforce_billing_receipt_single_enrollment()'
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ) like '%where receipt.receipt_id = new.receipt_id for update;%'
  )
  and (
    select pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure(
            'private.enforce_billing_receipt_single_enrollment()'
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ) like '%where course.course_id = new.course_id for share;%'
  )
  and (
    select pg_catalog.lower(
      pg_catalog.regexp_replace(
        pg_catalog.pg_get_functiondef(
          pg_catalog.to_regprocedure(
            'private.enforce_billing_receipt_single_enrollment()'
          )
        ),
        '\s+',
        ' ',
        'g'
      )
    ) like '%order by linked_course.course_id for share of linked_course;%'
  ),
  'receipt creation and link insertion retain race-closing row locks'
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

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, 'Invariant Guard'
from public.enrollments e
where e.enrollment_id::text = current_setting('test.payment_enrollment_a');

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
  'test.payment_course_guard',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_a')
     and c.course_name = 'Invariant Guard'),
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

with inserted as (
  insert into public.billing_receipts (amount, invoice_number)
  values (1, 'INVARIANT-GUARD')
  returning receipt_id
)
select set_config('test.payment_guard_receipt_id', receipt_id::text, true)
from inserted;

insert into public.billing_receipt_courses (receipt_id, course_id)
values (
  current_setting('test.payment_guard_receipt_id')::bigint,
  current_setting('test.payment_course_guard')::bigint
);

select throws_ok(
  pg_catalog.format(
    'insert into public.billing_receipt_courses (receipt_id, course_id) values (%s,%s)',
    current_setting('test.payment_guard_receipt_id'),
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_CROSS_ENROLLMENT',
  'link insertion cannot make a receipt span enrollments'
);

delete from public.billing_receipts
where receipt_id = current_setting('test.payment_guard_receipt_id')::bigint;

set local role authenticated;

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
    'select public.update_billing_receipt(%s, 1, null)',
    current_setting('test.payment_receipt_id')
  ),
  '42501',
  'PAYMENT_FORBIDDEN',
  'viewer cannot update a receipt'
);

select throws_ok(
  pg_catalog.format(
    'select public.delete_billing_receipt(%s)',
    current_setting('test.payment_receipt_id')
  ),
  '42501',
  'PAYMENT_FORBIDDEN',
  'viewer cannot delete a receipt'
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

select throws_ok(
  pg_catalog.format(
    'select public.update_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L,%L,%L]::text[])',
    current_setting('test.payment_enrollment_a'),
    'Payment Test Season A',
    '續',
    '',
    '',
    0,
    '',
    'A',
    'B',
    'Invariant Guard'
  ),
  '42501',
  'ENROLLMENT_UPDATE_FORBIDDEN',
  'viewer cannot update an enrollment through RPC'
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
    'Malformed Course Type',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X",1],"amount":1000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_REQUIRED',
  'initial payment course names must all be JSON strings'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Blank Payment Course',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["   "],"amount":1000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_REQUIRED',
  'initial payment course names must be nonblank strings'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'String Payment Amount',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":"1000"}]'
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'initial payment amount must be a JSON number'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Fractional Payment Amount',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":1000.5}]'
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'initial payment amount must be an integer'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Negative JSON Payment Amount',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":-1}]'
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'initial payment amount rejects negative JSON numbers'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Overflow Payment Amount',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":2147483648}]'
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'initial payment amount must fit a PostgreSQL integer'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Malformed Invoice Type',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":1000,"invoice_number":123}]'
  ),
  'P0001',
  'PAYMENT_RECORDS_INVALID',
  'initial payment invoice number must be a string or null'
);

select is(
  (select count(*)::text from public.enrollments
   where student_id = current_setting('test.payment_student_id')),
  current_setting('test.payment_enrollment_count_before'),
  'malformed initial payments are rejected before enrollment insert'
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
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Zero Integer Payment',
    '續',
    '',
    '',
    0,
    '',
    'ZERO',
    '[{"course_names":["ZERO"],"amount":0}]'
  ),
  'zero integer and absent invoice satisfy the initial payment contract'
);

select results_eq(
  $$select receipt.amount, receipt.invoice_number
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Zero Integer Payment'$$,
  $$values (0::integer, null::text)$$,
  'zero amount is stored without coercing an absent invoice'
);

select lives_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Maximum Integer Payment',
    '續',
    '',
    '',
    0,
    '',
    'MAX',
    '[{"course_names":["MAX"],"amount":2147483647,"invoice_number":null}]'
  ),
  'integer maximum and null invoice satisfy the initial payment contract'
);

select results_eq(
  $$select receipt.amount, receipt.invoice_number
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Maximum Integer Payment'$$,
  $$values (2147483647::integer, null::text)$$,
  'integer maximum is stored without coercing a null invoice'
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

reset role;

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

set local role authenticated;

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

reset role;

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

set local role authenticated;

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

reset role;

select * from finish();
rollback;

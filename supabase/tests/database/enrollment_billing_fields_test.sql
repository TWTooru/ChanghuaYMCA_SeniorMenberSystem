begin;
select plan(9);

select has_column(
  'public',
  'enrollments',
  'amount',
  'enrollments has an amount column'
);
select col_type_is(
  'public',
  'enrollments',
  'amount',
  'integer',
  'amount is stored as an integer'
);
select has_column(
  'public',
  'enrollments',
  'invoice_number',
  'enrollments has an invoice-number column'
);
select col_type_is(
  'public',
  'enrollments',
  'invoice_number',
  'text',
  'invoice number is stored as text'
);
select is(
  (select count(*)::integer
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'enrollments'
     and column_name in ('amount', 'invoice_number')),
  2,
  'enrollment billing fields remain available for legacy receipt migration'
);

select set_config(
  'test.billing_student_id',
  (900000000000 + txid_current())::text,
  true
);

insert into public.students (student_id, name, gender, education)
values (current_setting('test.billing_student_id')::bigint, 'Billing test student', '男', '高中');

select lives_ok(
  $$insert into public.enrollments (student_id, period, amount, invoice_number)
    values (current_setting('test.billing_student_id')::bigint, '第1期', 1200, 'AB12345678')$$,
  'amount and invoice number can be stored'
);
select results_eq(
  $$select amount, invoice_number
    from public.enrollments
    where student_id = current_setting('test.billing_student_id')::bigint and period = '第1期'$$,
  $$values (1200::integer, 'AB12345678'::text)$$,
  'stored billing values are preserved'
);
select lives_ok(
  $$insert into public.enrollments (student_id, period, amount, invoice_number)
    values (current_setting('test.billing_student_id')::bigint, '第2期', null, null)$$,
  'billing values remain nullable'
);
select throws_ok(
  $$insert into public.enrollments (student_id, period, amount)
    values (current_setting('test.billing_student_id')::bigint, '第3期', -1)$$,
  '23514',
  'new row for relation "enrollments" violates check constraint "enrollments_amount_nonnegative"',
  'negative amounts are rejected'
);

select * from finish();
rollback;

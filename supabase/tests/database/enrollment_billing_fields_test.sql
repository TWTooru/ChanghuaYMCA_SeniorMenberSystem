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
  'legacy enrollment billing fields remain until dashboard cutover'
);

select set_config(
  'test.billing_student_id',
  (900000000000 + txid_current())::text,
  true
);

insert into public.students (student_id, name)
values (current_setting('test.billing_student_id'), 'Billing test student');

select lives_ok(
  $$insert into public.enrollments (student_id, season, amount, invoice_number)
    values (current_setting('test.billing_student_id'), 'Billing A', 1200, 'AB12345678')$$,
  'amount and invoice number can be stored'
);
select results_eq(
  $$select amount, invoice_number
    from public.enrollments
    where student_id = current_setting('test.billing_student_id') and season = 'Billing A'$$,
  $$values (1200::integer, 'AB12345678'::text)$$,
  'stored billing values are preserved'
);
select lives_ok(
  $$insert into public.enrollments (student_id, season, amount, invoice_number)
    values (current_setting('test.billing_student_id'), 'Billing B', null, null)$$,
  'billing values remain nullable'
);
select throws_ok(
  $$insert into public.enrollments (student_id, season, amount)
    values (current_setting('test.billing_student_id'), 'Billing C', -1)$$,
  '23514',
  'new row for relation "enrollments" violates check constraint "enrollments_amount_nonnegative"',
  'negative amounts are rejected'
);

select * from finish();
rollback;

begin;
select plan(19);

truncate table public.students restart identity cascade;
insert into public.students (student_id, name, gender, education)
values (8101, 'Initial enrollment test student', '女', '高中');

select col_type_is('public', 'enrollments', 'period_start_date', 'date', 'start date uses date');
select col_type_is('public', 'enrollments', 'period_end_date', 'date', 'end date uses date');
select col_type_is('public', 'enrollments', 'notes', 'text', 'notes use text');
select col_type_is('public', 'enrollments', 'prepaid_amount', 'integer', 'prepaid amount uses integer');
select col_type_is('public', 'enrollments', 'prepaid_receipt_number', 'text', 'prepaid number uses text');
select col_type_is('public', 'enrollments', 'tuition_fee', 'integer', 'tuition uses integer');
select col_type_is('public', 'enrollments', 'materials_fee', 'integer', 'materials fee uses integer');
select col_type_is('public', 'enrollments', 'membership_fee', 'integer', 'membership fee uses integer');
select col_type_is('public', 'enrollments', 'fee_receipt_number', 'text', 'formal receipt number uses text');
select col_type_is('public', 'enrollments', 'handled_by_name', 'text', 'handler name uses text');
select col_type_is('public', 'enrollments', 'handled_by_user_id', 'uuid', 'handler user ID uses uuid');
select col_type_is('public', 'enrollments', 'handled_by_account', 'text', 'handler account uses text');
select col_type_is('public', 'enrollments', 'handled_on', 'date', 'handled date uses date');

select lives_ok(
  $$insert into public.enrollments (
      student_id, period, period_start_date, period_end_date,
      prepaid_amount, tuition_fee, materials_fee, membership_fee
    ) values (8101, '第1期', date '2026-09-01', date '2026-12-31', 0, 2400, 300, 100)$$,
  'valid paper-form enrollment fields are accepted'
);

select throws_like(
  $$insert into public.enrollments
      (student_id, period, period_start_date, period_end_date)
    values (8101, '第2期', date '2026-12-31', date '2026-09-01')$$,
  '%enrollments_period_dates_order_check%',
  'reversed dates are rejected'
);

select throws_like(
  $$insert into public.enrollments (student_id, period, prepaid_amount)
    values (8101, '第3期', -1)$$,
  '%enrollments_prepaid_amount_nonnegative%',
  'negative prepaid amount is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, tuition_fee)
    values (8101, '第4期', -1)$$,
  '%enrollments_tuition_fee_nonnegative%',
  'negative tuition is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, materials_fee)
    values (8101, '第5期', -1)$$,
  '%enrollments_materials_fee_nonnegative%',
  'negative materials fee is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, membership_fee)
    values (8101, '第6期', -1)$$,
  '%enrollments_membership_fee_nonnegative%',
  'negative membership fee is rejected'
);

select * from finish();
rollback;

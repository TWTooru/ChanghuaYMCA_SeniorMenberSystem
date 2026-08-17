begin;

alter table public.enrollments
  add column period_start_date date,
  add column period_end_date date,
  add column notes text,
  add column prepaid_amount integer,
  add column prepaid_receipt_number text,
  add column tuition_fee integer,
  add column materials_fee integer,
  add column membership_fee integer,
  add column fee_receipt_number text,
  add column handled_by_name text,
  add column handled_by_user_id uuid,
  add column handled_by_account text,
  add column handled_on date;

alter table public.enrollments
  add constraint enrollments_period_dates_order_check
    check (period_start_date is null or period_end_date is null or period_end_date >= period_start_date),
  add constraint enrollments_prepaid_amount_nonnegative
    check (prepaid_amount is null or prepaid_amount >= 0),
  add constraint enrollments_tuition_fee_nonnegative
    check (tuition_fee is null or tuition_fee >= 0),
  add constraint enrollments_materials_fee_nonnegative
    check (materials_fee is null or materials_fee >= 0),
  add constraint enrollments_membership_fee_nonnegative
    check (membership_fee is null or membership_fee >= 0);

commit;

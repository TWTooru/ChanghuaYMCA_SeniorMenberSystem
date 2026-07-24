alter table public.enrollments
  add column amount integer,
  add column invoice_number text,
  add constraint enrollments_amount_nonnegative
    check (amount is null or amount >= 0);

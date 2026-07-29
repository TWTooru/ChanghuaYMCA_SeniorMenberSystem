-- 為既有選課紀錄補上可為空的收費與發票欄位；保留空值以相容仍需由 course_receipts 取得舊版收據資訊的資料。
alter table public.enrollments
  add column amount integer,
  add column invoice_number text,
  add constraint enrollments_amount_nonnegative
    check (amount is null or amount >= 0);

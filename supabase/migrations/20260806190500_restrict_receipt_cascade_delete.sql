-- 保護財務資料：收據不再隨 course 級聯刪除，必須先手動移除收據。
alter table public.course_receipts
  drop constraint course_receipts_course_id_fkey;

alter table public.course_receipts
  add constraint course_receipts_course_id_fkey
    foreign key (course_id)
    references public.courses(course_id)
    on delete restrict;

-- 在建立 (student_id, season) 唯一性之前，依人工確認的資料選擇修復歷史重複報名。
-- 這些指定 ID 是 production repair，不能概化成依任意欄位自動刪除的規則。

-- 學生 204、第 7 季：保留使用者選定、含 2023-05-29 前測的資料列。
delete from public.enrollments
where enrollment_id = 'e9201cb9-6d37-4205-b9de-01910cad41f2';

-- 學生 245、第 8 季：保留已有報名資訊的資料列。
delete from public.enrollments
where enrollment_id = 'a4503697-9e2e-40d3-a229-2c07469a54e4';

-- 學生 266、第 11 季：先把課程移到保留的前測資料列，避免刪除時遺失課程。
update public.courses
set enrollment_id = 'b710c1bb-499e-4863-8c7f-51873598c0da'
where enrollment_id = '0763217b-8922-4a14-84a7-8ff98423c826';

delete from public.enrollments
where enrollment_id = '0763217b-8922-4a14-84a7-8ff98423c826';

-- 學生 36、第 9 季：兩筆內容相同，刪除確認為重複的資料列。
delete from public.enrollments
where enrollment_id = 'b7b4ba7e-d496-4f39-aed2-9074e0039282';

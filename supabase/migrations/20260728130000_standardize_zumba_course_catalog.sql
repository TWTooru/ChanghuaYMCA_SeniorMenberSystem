-- 清除已淘汰的課程目錄名稱，避免選課介面出現同一課程的多種標示。
delete from public.course_catalog
where course_name in ('zUMBA', 'ZUMBA心肺運動');

-- 確保唯一的正式名稱「Zumba」存在且啟用；衝突時也會修正名稱與狀態。
insert into public.course_catalog (course_name, active)
values ('Zumba', true)
on conflict ((lower(btrim(course_name))))
do update
set course_name = excluded.course_name,
    active = true,
    updated_at = now();

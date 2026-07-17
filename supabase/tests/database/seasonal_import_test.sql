begin;
select plan(31);
truncate table public.students cascade;
select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"editor"}}', true);

insert into public.students (student_id, name, birth_date, mobile_phone)
values ('398', '舊學生', '1960/01/01', '0912-000-000');

select lives_ok(
  $$select public.import_season_data('{"rows":[
    {"source_row":2,"provided_student_id":"398","student":{"name":"舊學生更新","birth_date":"1960/01/01"},"enrollments":[{"season":"第十六季","reg_type":"續","pre_test":"2026/01/01","post_test":null,"courses":["肌力"]}]},
    {"source_row":3,"provided_student_id":null,"student":{"name":"新學生","birth_date":"1962/02/02","mobile_phone":"0933-000-000"},"enrollments":[{"season":"第十六季","reg_type":"新","pre_test":"2026/01/02","post_test":null,"courses":["攝影","攝影"]}]}
  ]}'::jsonb)$$,
  'editor imports old and new students'
);
select is((select name from public.students where student_id = '398'), '舊學生更新', 'old student is updated');
select is((select name from public.students where student_id = '399'), '新學生', 'new student receives next ID');
select is((select count(*)::integer from public.enrollments), 2, 'one enrollment per student');
select is((select count(*)::integer from public.courses), 2, 'courses are deduplicated');
select is((select birth_date from public.students where student_id = '398'), '1960/01/01', 'birth date is stored as normalized text');
select is((select age from public.students where student_id = '398'), extract(year from age(current_date, date '1960-01-01'))::integer, 'age is recalculated by the RPC');
select is((select is_60_plus from public.students where student_id = '398'), '是', 'sixty-plus is recalculated by the RPC');

select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":2,"provided_student_id":"399","student":{"name":"新學生"},"enrollments":[{"season":"第十六季","reg_type":"續","pre_test":"2026/01/03","post_test":"2026/01/04","courses":["陶笛"]}]}]}'::jsonb)$$,
  'same student and quarter can be reimported'
);
select is((select count(*)::integer from public.enrollments where student_id = '399' and season = '第十六季'), 1, 'reimport stays unique');
select is((select string_agg(course_name, ',') from public.courses c join public.enrollments e using (enrollment_id) where e.student_id = '399'), '陶笛', 'courses are replaced');
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":2,"provided_student_id":"399","student":{"name":"新學生"},"enrollments":[{"season":"第十六季","reg_type":"","pre_test":"","post_test":"","courses":["瑜伽"]}]}]}'::jsonb)$$,
  'blank enrollment fields can be reimported'
);
select is((select reg_type from public.enrollments where student_id = '399' and season = '第十六季'), '續', 'blank registration type preserves existing value');
select is((select pre_test from public.enrollments where student_id = '399' and season = '第十六季'), null, 'blank pre-test clears the existing value');
select is((select post_test from public.enrollments where student_id = '399' and season = '第十六季'), null, 'blank post-test clears the existing value');
select is((select string_agg(course_name, ',') from public.courses c join public.enrollments e using (enrollment_id) where e.student_id = '399'), '瑜伽', 'blank-field reimport still replaces courses');
select is((select mobile_phone from public.students where student_id = '399'), '0933-000-000', 'blank student fields preserve database values');
select ok((select pg_typeof(enrollment_id)::text in ('uuid', 'bigint') from public.enrollments limit 1), 'RPC supports the schema enrollment ID type');
select ok(to_regclass('public.enrollments_student_season_uidx') is not null, 'student-season unique index exists');

select is(
  (public.import_season_data('{"rows":[{"source_row":6,"provided_student_id":null,"student":{"name":"編號測試"},"enrollments":[{"season":"第十六季","reg_type":"新","pre_test":null,"post_test":null,"courses":[]}]}]}'::jsonb) -> 'assigned_ids' -> 0 ->> 'student_id'),
  '400', 'new ID mapping is returned'
);

select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"viewer"}}', true);
select throws_ok(
  $$select public.import_season_data('{"rows":[]}'::jsonb)$$,
  '42501', 'IMPORT_FORBIDDEN', 'viewer cannot import'
);
select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"editor"}}', true);
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":7,"provided_student_id":"399","student":{"name":"新學生"},"enrollments":[{"season":"第十六季","reg_type":"續","pre_test":"2026/02/30","post_test":null,"courses":[]}]}]}'::jsonb)$$,
  'P0001', 'ROW_7:INVALID_DATE:前測', 'invalid normalized dates roll back'
);
select is((select pre_test from public.enrollments where student_id = '399' and season = '第十六季'), null, 'failed invalid-date import preserves prior state');

select throws_ok(
  $$select public.import_season_data('{"rows":[
    {"source_row":8,"provided_student_id":"399","student":{"name":"新學生"},"enrollments":[]},
    {"source_row":9,"provided_student_id":"399","student":{"name":"新學生"},"enrollments":[]}
  ]}'::jsonb)$$,
  'P0001', 'ROW_9:DUPLICATE_STUDENT_ID:399', 'duplicate supplied IDs roll back'
);
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":4,"provided_student_id":"999","student":{"name":"不存在的學生"},"enrollments":[]}]}'::jsonb)$$,
  'unknown supplied ID creates a student'
);
select is((select name from public.students where student_id = '999'), '不存在的學生', 'supplied student ID is preserved');
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":4,"provided_student_id":"999","student":{"name":"不存在的學生更新"},"enrollments":[]}]}'::jsonb)$$,
  'existing supplied ID updates the student'
);
select is((select name from public.students where student_id = '999'), '不存在的學生更新', 'existing supplied student is updated');
select is((select count(*)::integer from public.students), 4, 'supplied-ID upsert changes student count only once');
select lives_ok(
  $$select public.import_season_data('{"mode":"legacy-total","rows":[{"source_row":5,"provided_student_id":"1","student":{"name":"歷史學生"},"enrollments":[]}]}'::jsonb)$$,
  'legacy total may restore a missing historical ID'
);
select is((select name from public.students where student_id = '1'), '歷史學生', 'historical ID is preserved');

select * from finish();
rollback;

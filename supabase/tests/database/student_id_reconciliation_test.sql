begin;
select plan(10);
truncate table public.students cascade;
select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"editor"}}', true);

insert into public.students (student_id, name, gender, birth_date)
values ('10', 'Profile student', 'F', '1960/01/01');
insert into public.enrollments (student_id, season, reg_type)
values ('10', '第十六季', '新');

select is(
  public.update_student_profile('10', '{"student_id":"0020","name":"Profile student","gender":"F","birth_date":"1960-01-01"}'::jsonb) ->> 'student_id',
  '20', 'profile RPC normalizes the new ID'
);
select is((select student_id from public.enrollments where season = '第十六季'), '20', 'student ID update cascades to enrollments');
insert into public.students (student_id, name) values ('30', 'Taken ID');
select throws_ok(
  $$select public.update_student_profile('20', '{"student_id":"30","name":"Profile student"}'::jsonb)$$,
  'P0001', 'STUDENT_ID_EXISTS', 'profile RPC rejects an existing target ID'
);
select throws_ok(
  $$insert into public.students (student_id, name) values ('ABC', 'Invalid ID')$$,
  'P0001', 'INVALID_STUDENT_ID', 'new students require numeric IDs'
);

insert into public.students (student_id, name, gender, birth_date)
values ('50', 'Matched', 'F', '1960/01/01');
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":2,"provided_student_id":null,"student":{"name":"Matched","gender":"F","birth_date":"1960/01/01","mobile_phone":"0912"},"enrollments":[]}]}'::jsonb)$$,
  'blank ID uniquely matches an existing student'
);
select is((select mobile_phone from public.students where student_id = '50'), '0912', 'matched blank-ID row updates the matching student');
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":3,"provided_student_id":null,"student":{"name":"Incomplete","birth_date":"1962/02/02"},"enrollments":[]}]}'::jsonb)$$,
  'incomplete strict identity creates a new student'
);
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":4,"provided_student_id":"A70","student":{"name":"Invalid"},"enrollments":[]}]}'::jsonb)$$,
  'P0001', 'ROW_4:INVALID_STUDENT_ID', 'nonnumeric supplied ID is rejected'
);
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":5,"provided_student_id":"0","student":{"name":"Invalid"},"enrollments":[]}]}'::jsonb)$$,
  'P0001', 'ROW_5:INVALID_STUDENT_ID', 'zero supplied ID is rejected'
);
select ok(to_regprocedure('public.normalize_student_id(text)') is not null, 'normalization helper exists');

select * from finish();
rollback;

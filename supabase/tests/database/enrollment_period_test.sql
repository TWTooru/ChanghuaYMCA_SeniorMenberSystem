begin;
select plan(12);

select has_column('public', 'enrollments', 'period', 'enrollments exposes period');
select hasnt_column('public', 'enrollments', 'season', 'legacy season column is removed');
select hasnt_column('public', 'enrollments', 'pre_test', 'pre-test score is removed');
select hasnt_column('public', 'enrollments', 'post_test', 'post-test score is removed');
select col_type_is('public', 'enrollments', 'student_id', 'bigint', 'enrollment member ID remains bigint');
select has_function('public', 'create_enrollment_with_courses', array['bigint', 'text', 'text', 'integer', 'text', 'text[]', 'jsonb'], 'create RPC has the final period signature');
select has_function('public', 'update_enrollment_with_courses', array['bigint', 'text', 'text', 'integer', 'text', 'text[]', 'jsonb'], 'update RPC has the final period signature');

insert into public.students (student_id, name, gender, education)
values (9101, 'Period test student', '女', '研究所');
select lives_ok(
  $$insert into public.enrollments (student_id, period) values (9101, '第1期')$$,
  'a strict period can be stored'
);
select throws_ok(
  $$insert into public.enrollments (student_id, period) values (9101, '第一期')$$,
  '23514', 'new row for relation "enrollments" violates check constraint "enrollments_period_format_check"',
  'non-canonical period values are rejected'
);
select throws_ok(
  $$insert into public.enrollments (student_id, period) values (9101, '第1期')$$,
  '23505', 'duplicate key value violates unique constraint "enrollments_student_period_key"',
  'a member cannot enroll in the same period twice'
);
select results_eq(
  $$select count(*)::integer from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'enrollments'$$,
  $$values (4::integer)$$,
  'enrollment RLS policies remain present'
);
select ok(
  pg_catalog.has_function_privilege('authenticated', 'public.create_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb)', 'execute')
  and not pg_catalog.has_function_privilege('anon', 'public.create_enrollment_with_courses(bigint,text,text,integer,text,text[],jsonb)', 'execute'),
  'period enrollment write RPC is authenticated-only'
);

select * from finish();
rollback;

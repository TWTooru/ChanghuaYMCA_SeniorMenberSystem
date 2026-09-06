begin;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000001',
  'owner.profile-import-fixture@example.com',
  '{}',
  '{}'
);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'editor.profile-import-fixture@example.com',
    '{"app_role":"viewer"}',
    '{}'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'viewer.profile-import-fixture@example.com',
    '{"app_role":"admin"}',
    '{}'
  );

update public.app_user_roles
set role = 'editor', updated_at = pg_catalog.now()
where user_id = '11111111-1111-4111-8111-111111111111';

select plan(41);

truncate table public.students restart identity cascade;

select has_function(
  'public', 'import_student_profiles', array['jsonb'],
  'member profile import RPC exists'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_proc procedure_record
    join pg_catalog.pg_language language_record
      on language_record.oid = procedure_record.prolang
    where procedure_record.oid =
          'public.import_student_profiles(jsonb)'::pg_catalog.regprocedure
      and language_record.lanname = 'plpgsql'
      and not procedure_record.prosecdef
      and exists (
        select 1
        from pg_catalog.unnest(coalesce(procedure_record.proconfig, array[]::text[]))
          as setting(value)
        where pg_catalog.split_part(setting.value, '=', 1) = 'search_path'
          and pg_catalog.replace(
            pg_catalog.split_part(setting.value, '=', 2), '"', ''
          ) = ''
      )
  ),
  'import RPC is PL/pgSQL security invoker with an empty search path'
);
select ok(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.import_student_profiles(jsonb)', 'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon', 'public.import_student_profiles(jsonb)', 'execute'
  ),
  'import RPC is executable only by authenticated API users'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor.profile-import-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"viewer"}}',
  true
);
select throws_ok(
  $$select public.import_student_profiles('{}'::jsonb)$$,
  'P0001', 'INVALID_IMPORT_PAYLOAD',
  'import requires a JSON array payload'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"viewer.profile-import-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
select throws_ok(
  $$select public.import_student_profiles('[]'::jsonb)$$,
  '42501', 'IMPORT_FORBIDDEN',
  'viewer cannot import profiles'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor.profile-import-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"viewer"}}',
  true
);

insert into public.students
  (student_id, email, name, gender, phone, birth_date, address, organization, education)
values
  (10, 'email-match@example.com', '電子郵件舊名', '男', '02-1111-2222', date '1980-01-01', '舊地址', '舊機關', '高中'),
  (20, null, '備援會員', '女', '0912-345-678', date '1981-02-03', '備援舊址', '備援舊機關', '專科/大學'),
  (30, 'both@example.com', '雙重會員', '男', '0933-444-555', date '1982-03-04', '雙重舊址', '雙重舊機關', '研究所'),
  (40, 'conflict@example.com', '信箱會員', '男', '0900-000-040', date '1983-04-05', null, null, '高中'),
  (41, 'other@example.com', '備援衝突會員', '女', '0900-000-041', date '1984-05-06', null, null, '國中以下'),
  (50, 'preserve@example.com', '保留會員', '女', '0955-666-777', date '1985-06-07', '保留地址', '保留機關', '高中'),
  (60, 'manual@example.com', '手動編輯', '男', '0966-777-888', date '1986-07-08', '手動地址', '手動機關', '專科/大學');
insert into public.students
  (student_id, email, name, gender, phone, birth_date, education)
values
  (42, null, '歧義會員', '男', '0988-000-001', date '1988-01-01', '高中'),
  (43, null, '歧義會員', '女', '0988000001', date '1988-01-01', '研究所');
insert into public.enrollments (student_id, period)
values (60, '第2期');

select lives_ok(
  $$select set_config(
      'test.email_match_result',
      public.import_student_profiles('[{
        "source_row":2,
        "student":{
          "email":" EMAIL-MATCH@EXAMPLE.COM ",
          "name":" 電子郵件新名 ",
          "gender":"女",
          "phone":"",
          "birth_date":"",
          "address":" 新地址 ",
          "organization":"",
          "education":"研究所"
        }
      }]'::jsonb)::text,
      true
    )$$,
  'normalized email alone resolves and updates an existing member'
);
select is(
  (current_setting('test.email_match_result')::jsonb ->> 'students_updated')::integer,
  1,
  'email match reports one updated student'
);
select results_eq(
  $$select student_id, name, phone, birth_date, address, organization
    from public.students where student_id = 10$$,
  $$values (
    10::bigint, '電子郵件新名'::text, '02-1111-2222'::text,
    date '1980-01-01', '新地址'::text, '舊機關'::text
  )$$,
  'email match updates required fields while blank optional values preserve stored data'
);

select lives_ok(
  $$select public.import_student_profiles('[{
    "source_row":2,
    "student":{
      "email":"",
      "name":" 備援會員 ",
      "gender":"女",
      "phone":"0912 345 678",
      "birth_date":"1981-02-03",
      "address":"備援新址",
      "organization":"備援新機關",
      "education":"專科/大學"
    }
  }]'::jsonb)$$,
  'complete name-phone-birth-date fallback resolves an existing member'
);
select results_eq(
  $$select student_id, address, organization
    from public.students where name = '備援會員'$$,
  $$values (20::bigint, '備援新址'::text, '備援新機關'::text)$$,
  'fallback identity updates the matched member'
);

select lives_ok(
  $$select public.import_student_profiles('[{
    "source_row":2,
    "student":{
      "email":"BOTH@example.com",
      "name":"雙重會員",
      "gender":"女",
      "phone":"0933444555",
      "birth_date":"1982-03-04",
      "address":"雙重新址",
      "organization":"雙重新機關",
      "education":"研究所"
    }
  }]'::jsonb)$$,
  'email and fallback may resolve the same member'
);
select results_eq(
  $$select student_id, gender, address from public.students where student_id = 30$$,
  $$values (30::bigint, '女'::text, '雙重新址'::text)$$,
  'both matching identifiers update their single shared member'
);

select throws_ok(
  $$select public.import_student_profiles('[{
    "source_row":2,
    "student":{
      "email":"conflict@example.com",
      "name":"備援衝突會員",
      "gender":"女",
      "phone":"0900000041",
      "birth_date":"1984-05-06",
      "address":"衝突不應寫入",
      "organization":"",
      "education":"國中以下"
    }
  }]'::jsonb)$$,
  'P0001', 'ROW_2:IDENTITY_CONFLICT',
  'different email and fallback matches are rejected as an identity conflict'
);
select is(
  (select address from public.students where student_id = 40),
  null,
  'identity conflict leaves existing members unchanged'
);

select throws_ok(
  $$select public.import_student_profiles('[{
    "source_row":93,
    "student":{
      "email":"",
      "name":"歧義會員",
      "gender":"女",
      "phone":"0988 000 001",
      "birth_date":"1988-01-01",
      "address":"不應寫入",
      "organization":"",
      "education":"研究所"
    }
  }]'::jsonb)$$,
  'P0001', 'ROW_93:AMBIGUOUS_IDENTITY',
  'multiple fallback matches are rejected instead of choosing arbitrarily'
);

select throws_ok(
  $$select public.import_student_profiles('[
    {"source_row":2,"student":{"email":"duplicate@example.com","name":"重複甲","gender":"男","phone":"","birth_date":"","address":"","organization":"","education":"高中"}},
    {"source_row":3,"student":{"email":" DUPLICATE@example.com ","name":"重複乙","gender":"女","phone":"","birth_date":"","address":"","organization":"","education":"研究所"}}
  ]'::jsonb)$$,
  'P0001', 'ROW_3:DUPLICATE_EMAIL',
  'duplicate normalized email in one payload is rejected'
);
select is(
  (select count(*)::integer from public.students where email = 'duplicate@example.com'),
  0,
  'duplicate-email failure rolls back the entire import statement'
);
select throws_ok(
  $$select public.import_student_profiles('[
    {"source_row":2,"student":{"email":"identity-a@example.com","name":" 重複身分 ","gender":"男","phone":"0912-000-999","birth_date":"1990-01-02","address":"","organization":"","education":"高中"}},
    {"source_row":3,"student":{"email":"identity-b@example.com","name":"重複身分","gender":"女","phone":"0912000999","birth_date":"1990-01-02","address":"","organization":"","education":"研究所"}}
  ]'::jsonb)$$,
  'P0001', 'ROW_3:DUPLICATE_IDENTITY',
  'duplicate complete fallback identity in one payload is rejected'
);
select is(
  (select count(*)::integer from public.students where email like 'identity-%@example.com'),
  0,
  'duplicate-fallback failure rolls back the entire import statement'
);

select lives_ok(
  $$select public.import_student_profiles('[{
    "source_row":2,
    "student":{
      "email":"",
      "name":"保留會員",
      "gender":"男",
      "phone":"0955 666 777",
      "birth_date":"1985-06-07",
      "address":"",
      "organization":"",
      "education":"研究所"
    }
  }]'::jsonb)$$,
  'fallback update accepts blank optional import fields'
);
select is(
  (select name from public.students where student_id = 50),
  '保留會員',
  'fallback identity remains matched to the stored member'
);
select results_eq(
  $$select email, address, organization
    from public.students where student_id = 50$$,
  $$values (
    'preserve@example.com'::text, '保留地址'::text, '保留機關'::text
  )$$,
  'blank imported email, address, and organization preserve stored values'
);

select lives_ok(
  $$select set_config(
      'test.new_profile_result',
      public.import_student_profiles('[
        {"source_row":70,"student":{"email":"new-a@example.com","name":"新增甲","gender":"男","phone":"0977-888-999","birth_date":"1991-02-03","address":"台北市","organization":"甲機關","education":"高中"}},
        {"source_row":71,"student":{"email":"","name":"新增乙","gender":"女","phone":"","birth_date":"","address":"","organization":"","education":"國中以下"}}
      ]'::jsonb)::text,
      true
    )$$,
  'unmatched valid rows are inserted with database-generated IDs'
);
select is(
  pg_catalog.jsonb_typeof(
    current_setting('test.new_profile_result')::jsonb -> 'students_inserted'
  ),
  'number',
  'insert count is returned as a JSON number'
);
select is(
  pg_catalog.jsonb_typeof(
    current_setting('test.new_profile_result')::jsonb -> 'students_updated'
  ),
  'number',
  'update count is returned as a JSON number'
);
select is(
  pg_catalog.jsonb_array_length(
    current_setting('test.new_profile_result')::jsonb -> 'assigned_ids'
  ),
  2,
  'each inserted row receives an assigned-ID mapping'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.jsonb_array_elements(
      current_setting('test.new_profile_result')::jsonb -> 'assigned_ids'
    ) assigned(mapping)
    where pg_catalog.jsonb_typeof(assigned.mapping -> 'student_id') = 'number'
  ),
  2,
  'assigned student IDs are JSON numbers rather than text'
);
select results_eq(
  $$select (mapping ->> 'source_row')::integer
    from pg_catalog.jsonb_array_elements(
      current_setting('test.new_profile_result')::jsonb -> 'assigned_ids'
    ) assigned(mapping)
    order by 1$$,
  $$values (70::integer), (71::integer)$$,
  'assigned-ID mappings preserve source row numbers'
);
select is(
  (select count(*)::integer from public.students where name in ('新增甲', '新增乙')),
  2,
  'new profile rows are durably visible inside the transaction'
);

select throws_ok(
  $$select public.import_student_profiles('[
    {"source_row":90,"student":{"email":"atomic-a@example.com","name":"原子甲","gender":"男","phone":"","birth_date":"","address":"","organization":"","education":"高中"}},
    {"source_row":91,"student":{"email":"atomic-b@example.com","name":"原子乙","gender":"其他","phone":"","birth_date":"","address":"","organization":"","education":"高中"}}
  ]'::jsonb)$$,
  'P0001', 'ROW_91:INVALID_GENDER',
  'row-tagged validation rejects an invalid gender'
);
select is(
  (select count(*)::integer from public.students where email like 'atomic-%@example.com'),
  0,
  'a later invalid row rolls back all rows from the import call'
);
select throws_ok(
  $$select public.import_student_profiles('[{
    "source_row":92,
    "student":{"email":"name@example.com","name":" ","gender":"男","phone":"","birth_date":"","address":"","organization":"","education":"高中"}
  }]'::jsonb)$$,
  'P0001', 'ROW_92:NAME_REQUIRED',
  'required-field errors include the source row number'
);
select throws_ok(
  $$select public.import_student_profiles('[{
    "source_row":93,
    "student":{"email":"education@example.com","name":"教育程度缺漏","gender":"女","phone":"","birth_date":"","address":"","organization":""}
  }]'::jsonb)$$,
  'P0001', 'ROW_93:INVALID_EDUCATION',
  'imports still require education after manual entry makes it optional'
);

select lives_ok(
  $$select set_config(
      'test.manual_profile_result',
      public.update_student_profile(60, '{
        "student_id":61,
        "email":"",
        "name":" 手動新名 ",
        "gender":"女",
        "phone":"",
        "birth_date":"",
        "address":"",
        "organization":"",
        "education":"研究所"
      }'::jsonb)::text,
      true
    )$$,
  'manual profile RPC can change ID and explicitly clear optional fields'
);
select is(
  pg_catalog.jsonb_typeof(
    current_setting('test.manual_profile_result')::jsonb -> 'student_id'
  ),
  'number',
  'manual profile RPC returns numeric student IDs'
);
select results_eq(
  $$select email, phone, birth_date, address, organization
    from public.students where student_id = 61$$,
  $$values (
    null::text, null::text, null::date, null::text, null::text
  )$$,
  'manual profile edits clear blank optional values'
);
select results_eq(
  $$select name, gender, education
    from public.students where student_id = 61$$,
  $$values ('手動新名'::text, '女'::text, '研究所'::text)$$,
  'manual profile edits normalize and update required values'
);
select is(
  (select student_id from public.enrollments where period = '第2期'),
  61::bigint,
  'manual student ID changes preserve enrollment relations'
);

insert into public.students (student_id, name, gender, education)
values (62, '已存在編號', '男', '高中');
select throws_ok(
  $$select public.update_student_profile(61, '{
    "student_id":62,"email":"","name":"手動新名","gender":"女",
    "phone":"","birth_date":"","address":"","organization":"",
    "education":"研究所"
  }'::jsonb)$$,
  'P0001', 'STUDENT_ID_EXISTS',
  'manual profile RPC rejects an occupied target ID'
);
select throws_ok(
  $$select public.update_student_profile(61, '{
    "student_id":0,"email":"","name":"手動新名","gender":"女",
    "phone":"","birth_date":"","address":"","organization":"",
    "education":"研究所"
  }'::jsonb)$$,
  'P0001', 'INVALID_STUDENT_ID',
  'manual profile RPC rejects non-positive target IDs'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"viewer.profile-import-fixture@example.com","role":"authenticated","app_metadata":{"app_role":"admin"}}',
  true
);
select throws_ok(
  $$select public.update_student_profile(61, '{
    "student_id":61,"email":"","name":"手動新名","gender":"女",
    "phone":"","birth_date":"","address":"","organization":"",
    "education":"研究所"
  }'::jsonb)$$,
  '42501', 'STUDENT_UPDATE_FORBIDDEN',
  'viewer cannot update a member profile through the RPC'
);

select * from finish();
rollback;

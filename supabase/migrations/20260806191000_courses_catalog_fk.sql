-- Migration: Add FK constraint from courses.course_name to course_catalog.course_name

-- 步驟 1：確保 course_catalog.course_name 有精確的欄位級 UNIQUE 約束。
-- 目前只有函數索引 course_catalog_normalized_name_uidx 在 lower(btrim(course_name)) 上，
-- FK 需要精確的 UNIQUE 約束才能參照。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'course_catalog_course_name_unique'
  ) then
    alter table public.course_catalog
      add constraint course_catalog_course_name_unique unique (course_name);
  end if;
end;
$$;

-- 步驟 2：將所有存在於 courses 但不在 course_catalog 的課程名稱補入目錄。
insert into public.course_catalog (course_name, active)
select distinct c.course_name, true
from public.courses c
where not exists (
  select 1 from public.course_catalog cc
  where cc.course_name = c.course_name
)
on conflict (course_name) do nothing;

-- 步驟 3：建立外鍵約束。ON UPDATE CASCADE 讓目錄改名自動同步到所有選課紀錄。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'courses_course_name_catalog_fkey'
  ) then
    alter table public.courses
      add constraint courses_course_name_catalog_fkey
        foreign key (course_name)
        references public.course_catalog(course_name)
        on update cascade
        on delete restrict;
  end if;
end;
$$;

-- 步驟 4：更新 import_season_data_legacy RPC，確保匯入新課程時先寫入 course_catalog
create or replace function public.import_season_data_legacy(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_student jsonb;
  v_enrollment jsonb;
  v_provided_id text;
  v_student_id text;
  v_enrollment_id public.enrollments.enrollment_id%type;
  v_next_id bigint;
  v_source_row integer;
  v_course_count integer;
  v_course_names text[];
  v_students_inserted integer := 0;
  v_students_updated integer := 0;
  v_enrollments_inserted integer := 0;
  v_enrollments_updated integer := 0;
  v_courses_written integer := 0;
  v_exists boolean;
  v_assigned jsonb := '[]'::jsonb;
  v_seen_ids text[] := array[]::text[];
  v_birth_text text;
  v_birth_date date;
  v_age integer;
  v_sixty_plus text;
  v_pre_test text;
  v_post_test text;
  v_reg_type text;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'IMPORT_FORBIDDEN' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_payload -> 'rows') <> 'array' then
    raise exception 'INVALID_IMPORT_PAYLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.import_season_data')
  );
  select coalesce(max(student_id::bigint), 0)
  into v_next_id
  from public.students
  where student_id ~ '^[0-9]+$';

  for v_row in
    select value
    from pg_catalog.jsonb_array_elements(p_payload -> 'rows')
  loop
    v_source_row := coalesce((v_row ->> 'source_row')::integer, 0);
    v_student := v_row -> 'student';
    v_provided_id := nullif(pg_catalog.btrim(v_row ->> 'provided_student_id'), '');
    if nullif(pg_catalog.btrim(v_student ->> 'name'), '') is null then
      raise exception 'ROW_%:NAME_REQUIRED', v_source_row;
    end if;

    v_birth_text := nullif(pg_catalog.btrim(v_student ->> 'birth_date'), '');
    v_birth_date := null;
    v_age := null;
    v_sixty_plus := null;
    if v_birth_text is not null then
      if v_birth_text !~ '^\d{4}/\d{2}/\d{2}$'
         or pg_catalog.to_char(
           pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD'),
           'YYYY/MM/DD'
         ) <> v_birth_text then
        raise exception 'ROW_%:INVALID_DATE:出生日期', v_source_row;
      end if;
      v_birth_date := pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD');
      v_age := extract(
        year from pg_catalog.age(current_date, v_birth_date)
      )::integer;
      v_sixty_plus := case when v_age >= 60 then '是' else '否' end;
    end if;

    if v_provided_id is not null then
      if v_provided_id = any(v_seen_ids) then
        raise exception
          'ROW_%:DUPLICATE_STUDENT_ID:%',
          v_source_row,
          v_provided_id;
      end if;
      v_seen_ids := pg_catalog.array_append(v_seen_ids, v_provided_id);
      select exists(
        select 1
        from public.students
        where student_id = v_provided_id
      )
      into v_exists;
      v_student_id := v_provided_id;
      if v_exists then
        v_students_updated := v_students_updated + 1;
      else
        v_students_inserted := v_students_inserted + 1;
        if v_provided_id ~ '^[0-9]+$' then
          v_next_id := greatest(v_next_id, v_provided_id::bigint);
        end if;
      end if;
    else
      if exists (
        select 1
        from public.students s
        where pg_catalog.lower(pg_catalog.btrim(s.name))
          = pg_catalog.lower(pg_catalog.btrim(v_student ->> 'name'))
          and (
            (
              v_birth_text is not null
              and s.birth_date is not null
              and s.birth_date::text ~ '^\d{4}[-/]\d{1,2}[-/]\d{1,2}$'
              and pg_catalog.to_char(
                pg_catalog.to_date(
                  pg_catalog.replace(s.birth_date::text, '-', '/'),
                  'YYYY/MM/DD'
                ),
                'YYYY/MM/DD'
              ) = v_birth_text
            )
            or (
              nullif(
                pg_catalog.regexp_replace(
                  v_student ->> 'mobile_phone',
                  '\D',
                  '',
                  'g'
                ),
                ''
              ) is not null
              and pg_catalog.regexp_replace(
                coalesce(s.mobile_phone, ''),
                '\D',
                '',
                'g'
              ) = pg_catalog.regexp_replace(
                v_student ->> 'mobile_phone',
                '\D',
                '',
                'g'
              )
            )
          )
      ) then
        raise exception 'ROW_%:POSSIBLE_DUPLICATE_STUDENT', v_source_row;
      end if;
      v_next_id := v_next_id + 1;
      v_student_id := v_next_id::text;
      v_students_inserted := v_students_inserted + 1;
      v_assigned := v_assigned || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'source_row',
          v_source_row,
          'student_id',
          v_student_id
        )
      );
    end if;

    insert into public.students as current_student (
      student_id,
      name,
      gender,
      birth_date,
      age,
      is_60_plus,
      address,
      home_phone,
      mobile_phone,
      emergency_contact,
      relationship,
      emergency_contact_phone,
      education,
      occupation
    )
    values (
      v_student_id,
      pg_catalog.btrim(v_student ->> 'name'),
      nullif(pg_catalog.btrim(v_student ->> 'gender'), ''),
      v_birth_text,
      v_age,
      v_sixty_plus,
      nullif(pg_catalog.btrim(v_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'home_phone'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'mobile_phone'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'emergency_contact'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'relationship'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'emergency_contact_phone'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'education'), ''),
      nullif(pg_catalog.btrim(v_student ->> 'occupation'), '')
    )
    on conflict (student_id) do update
    set name = excluded.name,
        gender = coalesce(excluded.gender, current_student.gender),
        birth_date = coalesce(excluded.birth_date, current_student.birth_date),
        age = coalesce(excluded.age, current_student.age),
        is_60_plus = coalesce(
          excluded.is_60_plus,
          current_student.is_60_plus
        ),
        address = coalesce(excluded.address, current_student.address),
        home_phone = coalesce(
          excluded.home_phone,
          current_student.home_phone
        ),
        mobile_phone = coalesce(
          excluded.mobile_phone,
          current_student.mobile_phone
        ),
        emergency_contact = coalesce(
          excluded.emergency_contact,
          current_student.emergency_contact
        ),
        relationship = coalesce(
          excluded.relationship,
          current_student.relationship
        ),
        emergency_contact_phone = coalesce(
          excluded.emergency_contact_phone,
          current_student.emergency_contact_phone
        ),
        education = coalesce(excluded.education, current_student.education),
        occupation = coalesce(
          excluded.occupation,
          current_student.occupation
        );

    for v_enrollment in
      select value
      from pg_catalog.jsonb_array_elements(
        coalesce(v_row -> 'enrollments', '[]'::jsonb)
      )
    loop
      if coalesce(v_enrollment ->> 'season', '')
         !~ '^第[一二三四五六七八九十]+季$' then
        raise exception 'ROW_%:INVALID_SEASON', v_source_row;
      end if;
      v_reg_type := nullif(
        pg_catalog.btrim(v_enrollment ->> 'reg_type'),
        ''
      );
      if v_reg_type is not null and v_reg_type not in ('新', '續') then
        raise exception 'ROW_%:INVALID_REG_TYPE', v_source_row;
      end if;
      v_pre_test := nullif(
        pg_catalog.btrim(v_enrollment ->> 'pre_test'),
        ''
      );
      v_post_test := nullif(
        pg_catalog.btrim(v_enrollment ->> 'post_test'),
        ''
      );
      if v_pre_test is not null and (
        v_pre_test !~ '^\d{4}/\d{2}/\d{2}$'
        or pg_catalog.to_char(
          pg_catalog.to_date(v_pre_test, 'YYYY/MM/DD'),
          'YYYY/MM/DD'
        ) <> v_pre_test
      ) then
        raise exception 'ROW_%:INVALID_DATE:前測', v_source_row;
      end if;
      if v_post_test is not null and (
        v_post_test !~ '^\d{4}/\d{2}/\d{2}$'
        or pg_catalog.to_char(
          pg_catalog.to_date(v_post_test, 'YYYY/MM/DD'),
          'YYYY/MM/DD'
        ) <> v_post_test
      ) then
        raise exception 'ROW_%:INVALID_DATE:後測', v_source_row;
      end if;

      select exists(
        select 1
        from public.enrollments
        where student_id = v_student_id
          and season = v_enrollment ->> 'season'
      )
      into v_exists;

      insert into public.enrollments as current_enrollment (
        student_id,
        season,
        reg_type,
        pre_test,
        post_test
      )
      values (
        v_student_id,
        v_enrollment ->> 'season',
        v_reg_type,
        v_pre_test,
        v_post_test
      )
      on conflict (student_id, season) do update
      set reg_type = coalesce(excluded.reg_type, current_enrollment.reg_type),
          pre_test = excluded.pre_test,
          post_test = excluded.post_test
      returning enrollment_id into v_enrollment_id;

      if v_exists then
        v_enrollments_updated := v_enrollments_updated + 1;
      else
        v_enrollments_inserted := v_enrollments_inserted + 1;
      end if;

      select pg_catalog.array_agg(course_name order by course_name)
      into v_course_names
      from (
        select distinct nullif(
          pg_catalog.btrim(value #>> '{}'),
          ''
        ) as course_name
        from pg_catalog.jsonb_array_elements(
          coalesce(v_enrollment -> 'courses', '[]'::jsonb)
        )
      ) names
      where course_name is not null;
      v_course_names := coalesce(v_course_names, array[]::text[]);

      if pg_catalog.cardinality(v_course_names) > 0 then
        insert into public.course_catalog (course_name, active)
        select distinct selected.course_name, true
        from pg_catalog.unnest(v_course_names) as selected(course_name)
        where not exists (
          select 1
          from public.course_catalog cc
          where cc.course_name = selected.course_name
        )
        on conflict (course_name) do nothing;
      end if;

      perform 1
      from public.courses c
      where c.enrollment_id = v_enrollment_id
      for update;

      if exists (
        select 1
        from public.courses c
        join public.course_receipts r on r.course_id = c.course_id
        where c.enrollment_id = v_enrollment_id
          and not exists (
            select 1
            from pg_catalog.unnest(v_course_names) as selected(course_name)
            where pg_catalog.lower(selected.course_name)
              = pg_catalog.lower(pg_catalog.btrim(c.course_name))
          )
      ) then
        raise exception 'COURSE_RECEIPT_LOCKED';
      end if;

      delete from public.courses c
      where c.enrollment_id = v_enrollment_id
        and not exists (
          select 1
          from pg_catalog.unnest(v_course_names) as selected(course_name)
          where pg_catalog.lower(selected.course_name)
            = pg_catalog.lower(pg_catalog.btrim(c.course_name))
        )
        and not exists (
          select 1
          from public.course_receipts r
          where r.course_id = c.course_id
        );

      insert into public.courses (enrollment_id, course_name)
      select v_enrollment_id, selected.course_name
      from pg_catalog.unnest(v_course_names) as selected(course_name)
      where not exists (
        select 1
        from public.courses c
        where c.enrollment_id = v_enrollment_id
          and pg_catalog.lower(pg_catalog.btrim(c.course_name))
            = pg_catalog.lower(selected.course_name)
      );

      v_course_count := pg_catalog.cardinality(v_course_names);
      v_courses_written := v_courses_written + v_course_count;
    end loop;
  end loop;

  return pg_catalog.jsonb_build_object(
    'students_inserted',
    v_students_inserted,
    'students_updated',
    v_students_updated,
    'enrollments_inserted',
    v_enrollments_inserted,
    'enrollments_updated',
    v_enrollments_updated,
    'courses_written',
    v_courses_written,
    'assigned_ids',
    v_assigned
  );
end;
$$;

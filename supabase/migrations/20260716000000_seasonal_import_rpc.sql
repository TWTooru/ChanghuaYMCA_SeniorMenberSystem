create or replace function public.import_season_data(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb; v_student jsonb; v_enrollment jsonb;
  v_provided_id text; v_student_id text; v_enrollment_id bigint;
  v_next_id bigint; v_source_row integer; v_course_count integer;
  v_students_inserted integer := 0; v_students_updated integer := 0;
  v_enrollments_inserted integer := 0; v_enrollments_updated integer := 0;
  v_courses_written integer := 0; v_exists boolean; v_legacy boolean;
  v_assigned jsonb := '[]'::jsonb;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'IMPORT_FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_payload -> 'rows') <> 'array' then
    raise exception 'INVALID_IMPORT_PAYLOAD';
  end if;
  v_legacy := coalesce(p_payload ->> 'mode', '') = 'legacy-total';

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.import_season_data'));
  select coalesce(max(student_id::bigint), 0) into v_next_id
  from public.students where student_id ~ '^[0-9]+$';

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload -> 'rows') loop
    v_source_row := coalesce((v_row ->> 'source_row')::integer, 0);
    v_student := v_row -> 'student';
    v_provided_id := nullif(pg_catalog.btrim(v_row ->> 'provided_student_id'), '');
    if nullif(pg_catalog.btrim(v_student ->> 'name'), '') is null then
      raise exception 'ROW_%:NAME_REQUIRED', v_source_row;
    end if;

    if v_provided_id is not null then
      select exists(select 1 from public.students where student_id = v_provided_id) into v_exists;
      if not v_exists and not v_legacy then raise exception 'ROW_%:STUDENT_ID_NOT_FOUND:%', v_source_row, v_provided_id; end if;
      v_student_id := v_provided_id;
      if v_exists then
        v_students_updated := v_students_updated + 1;
      else
        v_students_inserted := v_students_inserted + 1;
        if v_provided_id ~ '^[0-9]+$' then v_next_id := greatest(v_next_id, v_provided_id::bigint); end if;
      end if;
    else
      if exists (
        select 1 from public.students s
        where pg_catalog.lower(pg_catalog.btrim(s.name)) = pg_catalog.lower(pg_catalog.btrim(v_student ->> 'name'))
          and (
            (nullif(v_student ->> 'birth_date', '') is not null and s.birth_date = (v_student ->> 'birth_date')::date)
            or (nullif(pg_catalog.regexp_replace(v_student ->> 'mobile_phone', '\\D', '', 'g'), '') is not null
                and pg_catalog.regexp_replace(coalesce(s.mobile_phone, ''), '\\D', '', 'g') = pg_catalog.regexp_replace(v_student ->> 'mobile_phone', '\\D', '', 'g'))
          )
      ) then raise exception 'ROW_%:POSSIBLE_DUPLICATE_STUDENT', v_source_row; end if;
      v_next_id := v_next_id + 1;
      v_student_id := v_next_id::text;
      v_students_inserted := v_students_inserted + 1;
      v_assigned := v_assigned || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source_row', v_source_row, 'student_id', v_student_id));
    end if;

    insert into public.students as current_student (
      student_id, original_id, name, gender, birth_date, age, is_60_plus, address,
      home_phone, mobile_phone, emergency_contact, relationship,
      emergency_contact_phone, education, occupation
    ) values (
      v_student_id, nullif(v_student ->> 'original_id', ''), v_student ->> 'name', nullif(v_student ->> 'gender', ''),
      nullif(v_student ->> 'birth_date', '')::date, nullif(v_student ->> 'age', '')::integer,
      nullif(v_student ->> 'is_60_plus', ''), nullif(v_student ->> 'address', ''),
      nullif(v_student ->> 'home_phone', ''), nullif(v_student ->> 'mobile_phone', ''),
      nullif(v_student ->> 'emergency_contact', ''), nullif(v_student ->> 'relationship', ''),
      nullif(v_student ->> 'emergency_contact_phone', ''), nullif(v_student ->> 'education', ''),
      nullif(v_student ->> 'occupation', '')
    ) on conflict (student_id) do update set
      original_id = coalesce(excluded.original_id, current_student.original_id),
      name = coalesce(excluded.name, current_student.name), gender = coalesce(excluded.gender, current_student.gender),
      birth_date = coalesce(excluded.birth_date, current_student.birth_date), age = coalesce(excluded.age, current_student.age),
      is_60_plus = coalesce(excluded.is_60_plus, current_student.is_60_plus), address = coalesce(excluded.address, current_student.address),
      home_phone = coalesce(excluded.home_phone, current_student.home_phone), mobile_phone = coalesce(excluded.mobile_phone, current_student.mobile_phone),
      emergency_contact = coalesce(excluded.emergency_contact, current_student.emergency_contact),
      relationship = coalesce(excluded.relationship, current_student.relationship),
      emergency_contact_phone = coalesce(excluded.emergency_contact_phone, current_student.emergency_contact_phone),
      education = coalesce(excluded.education, current_student.education), occupation = coalesce(excluded.occupation, current_student.occupation);

    for v_enrollment in select value from pg_catalog.jsonb_array_elements(coalesce(v_row -> 'enrollments', '[]'::jsonb)) loop
      if coalesce(v_enrollment ->> 'season', '') !~ '^第[一二三四五六七八九十]+季$' then
        raise exception 'ROW_%:INVALID_SEASON', v_source_row;
      end if;
      select exists(select 1 from public.enrollments where student_id = v_student_id and season = v_enrollment ->> 'season') into v_exists;
      insert into public.enrollments as current_enrollment (student_id, season, reg_type, pre_test, post_test, refunded, refund_info)
      values (v_student_id, v_enrollment ->> 'season', nullif(v_enrollment ->> 'reg_type', ''), nullif(v_enrollment ->> 'pre_test', ''), nullif(v_enrollment ->> 'post_test', ''), 0, null)
      on conflict (student_id, season) do update set
        reg_type = excluded.reg_type, pre_test = excluded.pre_test, post_test = excluded.post_test
      returning enrollment_id into v_enrollment_id;
      if v_exists then v_enrollments_updated := v_enrollments_updated + 1; else v_enrollments_inserted := v_enrollments_inserted + 1; end if;

      delete from public.courses where enrollment_id = v_enrollment_id;
      insert into public.courses (enrollment_id, course_name)
      select v_enrollment_id, course_name
      from (select distinct nullif(pg_catalog.btrim(value #>> '{}'), '') as course_name
            from pg_catalog.jsonb_array_elements(coalesce(v_enrollment -> 'courses', '[]'::jsonb))) names
      where course_name is not null;
      get diagnostics v_course_count = row_count;
      v_courses_written := v_courses_written + v_course_count;
    end loop;
  end loop;

  return pg_catalog.jsonb_build_object(
    'students_inserted', v_students_inserted, 'students_updated', v_students_updated,
    'enrollments_inserted', v_enrollments_inserted, 'enrollments_updated', v_enrollments_updated,
    'courses_written', v_courses_written, 'assigned_ids', v_assigned
  );
end;
$$;

revoke all on function public.import_season_data(jsonb) from public;
grant execute on function public.import_season_data(jsonb) to authenticated;

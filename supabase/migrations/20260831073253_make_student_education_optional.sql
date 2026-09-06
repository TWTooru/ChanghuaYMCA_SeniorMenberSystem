alter table public.students
  alter column education drop not null;

create or replace function public.import_student_profiles(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  app_role text;
  item jsonb;
  profile jsonb;
  source_row integer;
  payload_position integer := 0;
  normalized_email text;
  normalized_name text;
  normalized_phone text;
  normalized_birth_date date;
  normalized_gender text;
  normalized_education text;
  identity_key text;
  email_student_id bigint;
  identity_student_id bigint;
  identity_match_count integer;
  matched_student_id bigint;
  assigned_student_id bigint;
  students_inserted integer := 0;
  students_updated integer := 0;
  assigned_ids jsonb := '[]'::jsonb;
  seen_emails jsonb := '{}'::jsonb;
  seen_identities jsonb := '{}'::jsonb;
begin
  app_role := public.current_app_role()::text;
  if app_role not in ('editor', 'admin') then
    raise exception using errcode = '42501', message = 'IMPORT_FORBIDDEN';
  end if;

  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'P0001', message = 'INVALID_IMPORT_PAYLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.import_student_profiles')
  );

  for item in select value from pg_catalog.jsonb_array_elements(p_rows)
  loop
    payload_position := payload_position + 1;
    begin
      source_row := coalesce(
        nullif(pg_catalog.btrim(item ->> 'source_row'), '')::integer,
        payload_position
      );
    exception when others then
      source_row := payload_position;
    end;

    profile := item -> 'student';
    if profile is null or pg_catalog.jsonb_typeof(profile) <> 'object' then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':INVALID_PROFILE';
    end if;

    normalized_email := pg_catalog.lower(
      nullif(pg_catalog.btrim(profile ->> 'email'), '')
    );
    normalized_name := pg_catalog.btrim(profile ->> 'name');
    normalized_phone := nullif(
      pg_catalog.regexp_replace(profile ->> 'phone', '\D', '', 'g'), ''
    );
    normalized_gender := pg_catalog.btrim(profile ->> 'gender');
    normalized_education := pg_catalog.btrim(profile ->> 'education');

    begin
      normalized_birth_date := nullif(
        pg_catalog.btrim(profile ->> 'birth_date'), ''
      )::date;
    exception when others then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':INVALID_BIRTH_DATE';
    end;

    if normalized_name is null or normalized_name = '' then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':NAME_REQUIRED';
    end if;
    if normalized_gender not in ('男', '女') then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':INVALID_GENDER';
    end if;
    if normalized_education is null
       or normalized_education not in ('國中以下', '高中', '專科/大學', '研究所') then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':INVALID_EDUCATION';
    end if;

    if normalized_email is not null then
      if seen_emails ? normalized_email then
        raise exception using
          errcode = 'P0001', message = 'ROW_' || source_row || ':DUPLICATE_EMAIL';
      end if;
      seen_emails := seen_emails || pg_catalog.jsonb_build_object(normalized_email, true);
    end if;

    identity_key := null;
    if normalized_name <> ''
       and normalized_phone is not null
       and normalized_birth_date is not null then
      identity_key := normalized_name || pg_catalog.chr(31)
        || normalized_phone || pg_catalog.chr(31)
        || normalized_birth_date::text;
      if seen_identities ? identity_key then
        raise exception using
          errcode = 'P0001', message = 'ROW_' || source_row || ':DUPLICATE_IDENTITY';
      end if;
      seen_identities := seen_identities
        || pg_catalog.jsonb_build_object(identity_key, true);
    end if;

    email_student_id := null;
    identity_student_id := null;
    if normalized_email is not null then
      select student_id into email_student_id
      from public.students
      where email = normalized_email;
    end if;
    if identity_key is not null then
      select count(*)::integer, min(student_id)
      into identity_match_count, identity_student_id
      from public.students
      where name = normalized_name
        and pg_catalog.regexp_replace(phone, '\D', '', 'g') = normalized_phone
        and birth_date = normalized_birth_date;

      if identity_match_count > 1 then
        raise exception using
          errcode = 'P0001',
          message = 'ROW_' || source_row || ':AMBIGUOUS_IDENTITY';
      end if;
    end if;

    if email_student_id is not null
       and identity_student_id is not null
       and email_student_id <> identity_student_id then
      raise exception using
        errcode = 'P0001', message = 'ROW_' || source_row || ':IDENTITY_CONFLICT';
    end if;
    matched_student_id := coalesce(email_student_id, identity_student_id);

    if matched_student_id is null then
      insert into public.students (
        email, name, gender, phone, birth_date,
        address, organization, education
      ) values (
        normalized_email,
        normalized_name,
        normalized_gender,
        nullif(pg_catalog.btrim(profile ->> 'phone'), ''),
        normalized_birth_date,
        nullif(pg_catalog.btrim(profile ->> 'address'), ''),
        nullif(pg_catalog.btrim(profile ->> 'organization'), ''),
        normalized_education
      ) returning student_id into assigned_student_id;

      students_inserted := students_inserted + 1;
      assigned_ids := assigned_ids || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'source_row', source_row,
          'student_id', assigned_student_id
        )
      );
    else
      update public.students student_record
      set email = coalesce(normalized_email, student_record.email),
          name = normalized_name,
          gender = normalized_gender,
          phone = coalesce(
            nullif(pg_catalog.btrim(profile ->> 'phone'), ''),
            student_record.phone
          ),
          birth_date = coalesce(normalized_birth_date, student_record.birth_date),
          address = coalesce(
            nullif(pg_catalog.btrim(profile ->> 'address'), ''),
            student_record.address
          ),
          organization = coalesce(
            nullif(pg_catalog.btrim(profile ->> 'organization'), ''),
            student_record.organization
          ),
          education = normalized_education,
          updated_at = pg_catalog.now()
      where student_record.student_id = matched_student_id;
      students_updated := students_updated + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'students_inserted', students_inserted,
    'students_updated', students_updated,
    'assigned_ids', assigned_ids
  );
end
$function$;

revoke all on function public.import_student_profiles(jsonb) from public;
revoke all on function public.import_student_profiles(jsonb) from anon;
grant execute on function public.import_student_profiles(jsonb) to authenticated;

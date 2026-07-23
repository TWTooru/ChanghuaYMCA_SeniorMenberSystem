alter table public.enrollments
  drop constraint if exists enrollments_student_id_fkey;

alter table public.enrollments
  add constraint enrollments_student_id_fkey
  foreign key (student_id)
  references public.students(student_id)
  on update cascade
  on delete cascade;

create or replace function public.normalize_student_id(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := pg_catalog.btrim(coalesce(p_value, ''));
begin
  if v_text !~ '^\d+$' then raise exception 'INVALID_STUDENT_ID'; end if;
  v_text := pg_catalog.regexp_replace(v_text, '^0+', '');
  if v_text = '' then raise exception 'INVALID_STUDENT_ID'; end if;
  return v_text;
end;
$$;

create or replace function public.enforce_student_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.students s where s.student_id = new.student_id) then return new; end if;
    new.student_id := public.normalize_student_id(new.student_id);
  elsif new.student_id is distinct from old.student_id then
    new.student_id := public.normalize_student_id(new.student_id);
  end if;
  return new;
end;
$$;

drop trigger if exists students_enforce_student_id on public.students;
create trigger students_enforce_student_id
before insert or update of student_id on public.students
for each row execute function public.enforce_student_id();

create or replace function public.update_student_profile(p_original_id text, p_student jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.students%rowtype;
  v_updated public.students%rowtype;
  v_requested_id text;
  v_new_id text;
  v_name text;
  v_birth_text text;
  v_birth_date date;
  v_age integer;
  v_sixty_plus text;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'STUDENT_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.student_identity_mutation'));
  select * into v_current from public.students where student_id = p_original_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;

  v_requested_id := pg_catalog.btrim(coalesce(p_student ->> 'student_id', ''));
  if v_requested_id = p_original_id then v_new_id := p_original_id;
  else v_new_id := public.normalize_student_id(v_requested_id); end if;
  if v_new_id <> p_original_id and exists (select 1 from public.students where student_id = v_new_id) then
    raise exception 'STUDENT_ID_EXISTS';
  end if;
  v_name := nullif(pg_catalog.btrim(p_student ->> 'name'), '');
  if v_name is null then raise exception 'NAME_REQUIRED'; end if;
  v_birth_text := nullif(pg_catalog.replace(pg_catalog.btrim(p_student ->> 'birth_date'), '-', '/'), '');
  v_birth_date := null; v_age := null; v_sixty_plus := null;
  if v_birth_text is not null then
    if v_birth_text !~ '^\d{4}/\d{2}/\d{2}$' or pg_catalog.to_char(pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD'), 'YYYY/MM/DD') <> v_birth_text then
      raise exception 'INVALID_BIRTH_DATE';
    end if;
    v_birth_date := pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD');
    v_age := extract(year from pg_catalog.age(current_date, v_birth_date))::integer;
    v_sixty_plus := case when v_age >= 60 then '是' else '否' end;
  end if;
  update public.students set
    student_id = v_new_id, name = v_name, gender = nullif(pg_catalog.btrim(p_student ->> 'gender'), ''),
    birth_date = v_birth_text, age = v_age, is_60_plus = v_sixty_plus,
    address = nullif(pg_catalog.btrim(p_student ->> 'address'), ''), home_phone = nullif(pg_catalog.btrim(p_student ->> 'home_phone'), ''),
    mobile_phone = nullif(pg_catalog.btrim(p_student ->> 'mobile_phone'), ''), emergency_contact = nullif(pg_catalog.btrim(p_student ->> 'emergency_contact'), ''),
    relationship = nullif(pg_catalog.btrim(p_student ->> 'relationship'), ''), emergency_contact_phone = nullif(pg_catalog.btrim(p_student ->> 'emergency_contact_phone'), ''),
    education = nullif(pg_catalog.btrim(p_student ->> 'education'), ''), occupation = nullif(pg_catalog.btrim(p_student ->> 'occupation'), '')
  where student_id = p_original_id returning * into v_updated;
  return pg_catalog.to_jsonb(v_updated);
end;
$$;

revoke all on function public.update_student_profile(text, jsonb) from public;
grant execute on function public.update_student_profile(text, jsonb) to authenticated;

alter function public.import_season_data(jsonb) rename to import_season_data_legacy;

create function public.import_season_data(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb; v_student jsonb; v_rows jsonb := '[]'::jsonb;
  v_source_row integer; v_raw_id text; v_student_id text;
  v_name text; v_gender text; v_birth_text text; v_identity_key text;
  v_seen_ids text[] := array[]::text[]; v_seen_identities text[] := array[]::text[];
  v_seen_identity_rows integer[] := array[]::integer[]; v_identity_index integer;
  v_match_count integer; v_matched_id text; v_next_id numeric; v_result jsonb;
  v_assigned jsonb := '[]'::jsonb;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'IMPORT_FORBIDDEN' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(p_payload -> 'rows') <> 'array' then raise exception 'INVALID_IMPORT_PAYLOAD'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.student_identity_mutation'));
  select coalesce(max(student_id::numeric), 0) into v_next_id from public.students where student_id ~ '^\d+$';

  for v_row in select value from pg_catalog.jsonb_array_elements(p_payload -> 'rows') loop
    v_source_row := coalesce((v_row ->> 'source_row')::integer, 0);
    v_student := v_row -> 'student';
    v_name := nullif(pg_catalog.btrim(v_student ->> 'name'), '');
    v_gender := nullif(pg_catalog.btrim(v_student ->> 'gender'), '');
    if v_name is null then raise exception 'ROW_%:NAME_REQUIRED', v_source_row; end if;
    v_birth_text := nullif(pg_catalog.replace(pg_catalog.btrim(v_student ->> 'birth_date'), '-', '/'), '');
    if v_birth_text is not null and (v_birth_text !~ '^\d{4}/\d{2}/\d{2}$' or pg_catalog.to_char(pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD'), 'YYYY/MM/DD') <> v_birth_text) then
      raise exception 'ROW_%:INVALID_DATE:出生日期', v_source_row;
    end if;
    v_raw_id := nullif(pg_catalog.btrim(v_row ->> 'provided_student_id'), '');
    if v_raw_id is not null then
      begin v_student_id := public.normalize_student_id(v_raw_id);
      exception when others then raise exception 'ROW_%:INVALID_STUDENT_ID', v_source_row; end;
    else
      v_identity_key := null;
      if v_name is not null and v_gender is not null and v_birth_text is not null then
        v_identity_key := pg_catalog.jsonb_build_array(v_name, v_gender, v_birth_text)::text;
        v_identity_index := pg_catalog.array_position(v_seen_identities, v_identity_key);
        if v_identity_index is not null then raise exception 'ROW_%:DUPLICATE_IMPORT_IDENTITY:%', v_source_row, v_seen_identity_rows[v_identity_index]; end if;
        v_seen_identities := pg_catalog.array_append(v_seen_identities, v_identity_key);
        v_seen_identity_rows := pg_catalog.array_append(v_seen_identity_rows, v_source_row);
        select count(*)::integer, min(student_id) into v_match_count, v_matched_id
        from public.students s where pg_catalog.btrim(s.name) = v_name and pg_catalog.btrim(coalesce(s.gender, '')) = v_gender
          and s.birth_date is not null and pg_catalog.to_char(pg_catalog.to_date(pg_catalog.replace(s.birth_date::text, '-', '/'), 'YYYY/MM/DD'), 'YYYY/MM/DD') = v_birth_text;
      else v_match_count := 0; v_matched_id := null; end if;
      if v_match_count > 1 then raise exception 'ROW_%:AMBIGUOUS_STUDENT_MATCH', v_source_row;
      elsif v_match_count = 1 then v_student_id := v_matched_id;
      else
        v_next_id := v_next_id + 1; v_student_id := v_next_id::text;
        v_assigned := v_assigned || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('source_row', v_source_row, 'student_id', v_student_id));
      end if;
    end if;
    if v_student_id = any(v_seen_ids) then raise exception 'ROW_%:DUPLICATE_STUDENT_ID:%', v_source_row, v_student_id; end if;
    v_seen_ids := pg_catalog.array_append(v_seen_ids, v_student_id);
    v_rows := v_rows || pg_catalog.jsonb_build_array(pg_catalog.jsonb_set(v_row, '{provided_student_id}', pg_catalog.to_jsonb(v_student_id)));
  end loop;
  v_result := public.import_season_data_legacy(pg_catalog.jsonb_build_object('mode', p_payload -> 'mode', 'rows', v_rows));
  return pg_catalog.jsonb_set(v_result, '{assigned_ids}', v_assigned);
end;
$$;

revoke all on function public.import_season_data(jsonb) from public;
grant execute on function public.import_season_data(jsonb) to authenticated;

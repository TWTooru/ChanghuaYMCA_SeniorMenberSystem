-- Production enrollments use UUID identifiers, while early local schemas used bigint.
-- Accept a textual identifier so the dashboard RPC remains compatible with both.
drop function if exists public.update_enrollment_with_courses(
  bigint, text, text, text, text, integer, text, text[]
);

create function public.update_enrollment_with_courses(
  p_enrollment_id text,
  p_season text,
  p_reg_type text,
  p_pre_test text,
  p_post_test text,
  p_refunded integer,
  p_refund_info text,
  p_course_names text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_names text[];
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'ENROLLMENT_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;

  perform 1 from public.enrollments e
  where e.enrollment_id::text = p_enrollment_id for update;
  if not found then raise exception 'ENROLLMENT_NOT_FOUND'; end if;

  select array_agg(name order by name) into v_names
  from (
    select min(btrim(input.course_name)) as name
    from unnest(coalesce(p_course_names, array[]::text[])) as input(course_name)
    where btrim(input.course_name) <> ''
    group by lower(btrim(input.course_name))
  ) normalized;
  if coalesce(cardinality(v_names), 0) = 0 then raise exception 'COURSE_REQUIRED'; end if;

  if exists (
    select 1 from public.courses c
    join public.course_receipts r on r.course_id = c.course_id
    where c.enrollment_id::text = p_enrollment_id
      and not exists (
        select 1 from unnest(v_names) as selected(course_name)
        where lower(selected.course_name) = lower(btrim(c.course_name))
      )
  ) then raise exception 'COURSE_RECEIPT_LOCKED'; end if;

  update public.enrollments e
  set season = p_season, reg_type = p_reg_type, pre_test = p_pre_test,
      post_test = p_post_test, refunded = p_refunded, refund_info = p_refund_info
  where e.enrollment_id::text = p_enrollment_id;

  delete from public.courses c
  where c.enrollment_id::text = p_enrollment_id
    and not exists (
      select 1 from unnest(v_names) as selected(course_name)
      where lower(selected.course_name) = lower(btrim(c.course_name))
    )
    and not exists (select 1 from public.course_receipts r where r.course_id = c.course_id);

  insert into public.courses (enrollment_id, course_name)
  select e.enrollment_id, selected.course_name
  from public.enrollments e cross join unnest(v_names) as selected(course_name)
  where e.enrollment_id::text = p_enrollment_id
    and not exists (
      select 1 from public.courses c
      where c.enrollment_id = e.enrollment_id
        and lower(btrim(c.course_name)) = lower(selected.course_name)
    );
end;
$$;

revoke all on function public.update_enrollment_with_courses(text, text, text, text, text, integer, text, text[]) from public;
grant execute on function public.update_enrollment_with_courses(text, text, text, text, text, integer, text, text[]) to authenticated;

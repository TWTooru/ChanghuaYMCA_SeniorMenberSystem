create or replace function public.merge_students(p_source_id bigint, p_target_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_source_exists boolean;
    v_target_exists boolean;
    v_moved_enrollments int;
begin
    if public.current_app_role() not in ('admin') then
        raise exception 'FORBIDDEN: only admin can merge students';
    end if;

    if p_source_id = p_target_id then
        raise exception 'SAME_STUDENT';
    end if;

    select exists(select 1 from public.students where id = p_source_id) into v_source_exists;
    if not v_source_exists then
        raise exception 'SOURCE_NOT_FOUND';
    end if;

    select exists(select 1 from public.students where id = p_target_id) into v_target_exists;
    if not v_target_exists then
        raise exception 'TARGET_NOT_FOUND';
    end if;

    perform pg_advisory_xact_lock(hashtext('public.student_merge'));

    -- Transfer enrollments of source_id to target_id where period not already in target's enrollments
    with moved as (
        update public.enrollments e1
        set student_id = p_target_id
        where student_id = p_source_id
          and not exists (
              select 1 from public.enrollments e2
              where e2.student_id = p_target_id and e2.period = e1.period
          )
        returning id
    )
    select count(*) into v_moved_enrollments from moved;

    -- Delete remaining duplicate enrollments of source student
    delete from public.enrollments where student_id = p_source_id;

    -- Delete source student
    delete from public.students where id = p_source_id;

    return jsonb_build_object(
        'source_id', p_source_id,
        'target_id', p_target_id,
        'moved_enrollments', v_moved_enrollments,
        'deleted_source', true
    );
end;
$$;

grant execute on function public.merge_students(bigint, bigint) to authenticated;

-- Aplicar fichas/modelos a vários alunos de uma vez (tudo ou nada, numa transação).
-- Security invoker: usa as mesmas checagens de duplicate_workout_plan e set_workout_plan_archived.
create function public.apply_plans_to_students(p_plans uuid[], p_students uuid[], p_archive_current boolean default false)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_student uuid;
  v_plan uuid;
  v_old uuid;
  v_created int := 0;
  v_archived int := 0;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais aplicam fichas' using errcode = '42501';
  end if;
  if coalesce(array_length(p_plans, 1), 0) = 0 or coalesce(array_length(p_students, 1), 0) = 0 then
    raise exception 'Escolha pelo menos uma ficha e um aluno' using errcode = 'P0001';
  end if;
  if array_length(p_plans, 1) > 20 or array_length(p_students, 1) > 200 then
    raise exception 'Seleção grande demais (até 20 fichas e 200 alunos por vez)' using errcode = 'P0001';
  end if;

  foreach v_student in array (select array_agg(distinct s) from unnest(p_students) s) loop
    if not public.is_linked_personal(v_student) then
      raise exception 'Aluno não vinculado a você' using errcode = '42501';
    end if;
    -- "Substituir": arquiva as fichas ativas do aluno (as escolhidas como origem ficam como estão).
    if p_archive_current then
      for v_old in
        select id from public.workout_plans
        where student_id = v_student and not is_template and archived_at is null and not (id = any (p_plans))
      loop
        perform public.set_workout_plan_archived(v_old, true);
        v_archived := v_archived + 1;
      end loop;
    end if;
    foreach v_plan in array p_plans loop
      perform public.duplicate_workout_plan(v_plan, v_student);
      v_created := v_created + 1;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'archived', v_archived);
end;
$$;

revoke execute on function public.apply_plans_to_students(uuid[], uuid[], boolean) from public, anon;
grant execute on function public.apply_plans_to_students(uuid[], uuid[], boolean) to authenticated;

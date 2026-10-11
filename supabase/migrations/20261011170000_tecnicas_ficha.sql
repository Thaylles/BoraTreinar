-- Técnica avançada por exercício da ficha (bi-set, tri-set, drop-set, rest-pause, pirâmide).
-- null = execução normal. Bi-set/tri-set agrupam o exercício com o(s) seguinte(s).
alter table public.workout_plan_items
  add column technique text check (technique in ('biset', 'triset', 'dropset', 'restpause', 'piramide'));

create or replace function public.save_workout_plan(
  p_plan uuid,
  p_student uuid,
  p_name text,
  p_goal text,
  p_notes text,
  p_valid_until date,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan uuid := p_plan;
  v_student uuid;
  v_template boolean;
  it jsonb;
  i int := 0;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais montam fichas' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Lista de exercícios inválida' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Máximo de 40 exercícios por ficha' using errcode = 'P0001';
  end if;

  if v_plan is null then
    v_student := p_student;
    v_template := p_student is null;
    if not v_template and not public.is_linked_personal(v_student) then
      raise exception 'Você não acompanha esse aluno' using errcode = '42501';
    end if;
    insert into public.workout_plans (student_id, created_by, name, goal, notes, valid_until, is_template)
      values (v_student, auth.uid(), trim(p_name), nullif(trim(p_goal), ''), nullif(trim(p_notes), ''),
              p_valid_until, v_template)
      returning id into v_plan;
  else
    if not public.can_edit_plan(v_plan) then
      raise exception 'Ficha não encontrada' using errcode = '42501';
    end if;
    select student_id, is_template into v_student, v_template from public.workout_plans where id = v_plan;
    update public.workout_plans
      set name = trim(p_name), goal = nullif(trim(p_goal), ''), notes = nullif(trim(p_notes), ''),
          valid_until = p_valid_until
      where id = v_plan;
    delete from public.workout_plan_items where plan_id = v_plan;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    if v_template then
      if not exists (select 1 from public.equipment e where e.id = (it->>'equipment_id')::uuid
                     and (e.is_default or public.knows_personal(e.created_by))) then
        raise exception 'Exercício indisponível na posição %', i using errcode = 'P0001';
      end if;
    elsif not public.equipment_usable_for_student((it->>'equipment_id')::uuid, v_student) then
      raise exception 'Exercício indisponível para este aluno na posição %', i using errcode = 'P0001';
    end if;

    insert into public.workout_plan_items
      (plan_id, equipment_id, position, sets, reps_min, reps_max, suggested_load, rest_seconds, notes, technique)
    values (
      v_plan,
      (it->>'equipment_id')::uuid,
      i,
      coalesce((it->>'sets')::int, 3),
      (it->>'reps_min')::int,
      (it->>'reps_max')::int,
      (it->>'suggested_load')::numeric,
      coalesce((it->>'rest_seconds')::int, 60),
      nullif(trim(it->>'notes'), ''),
      nullif(it->>'technique', '')
    );
  end loop;

  return v_plan;
end;
$$;

/** Duplica uma ficha/modelo para um aluno (p_student) ou como modelo (p_student null). */
create or replace function public.duplicate_workout_plan(p_plan uuid, p_student uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  src public.workout_plans;
  items jsonb;
begin
  if not public.can_view_plan(p_plan) or not public.current_role_is('personal') then
    raise exception 'Ficha não encontrada' using errcode = '42501';
  end if;
  select * into src from public.workout_plans where id = p_plan;
  select coalesce(jsonb_agg(jsonb_build_object(
           'equipment_id', equipment_id, 'sets', sets, 'reps_min', reps_min, 'reps_max', reps_max,
           'suggested_load', suggested_load, 'rest_seconds', rest_seconds, 'notes', notes,
           'technique', technique)
         order by position), '[]'::jsonb)
    into items
    from public.workout_plan_items where plan_id = p_plan;

  return public.save_workout_plan(
    null, p_student, coalesce(nullif(trim(p_name), ''), src.name), src.goal, src.notes,
    case when p_student is null then null else src.valid_until end, items);
end;
$$;

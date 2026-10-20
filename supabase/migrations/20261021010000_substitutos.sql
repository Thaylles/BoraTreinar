-- ════════════════════════════════════════════════════════════════
-- Exercícios substitutos ("aparelho ocupado")
--  • O Personal pode indicar um substituto para cada exercício da ficha.
--  • No treino, a troca é registrada no exercício feito; a série guarda
--    qual exercício da ficha ele substituiu (replaced_equipment_id).
-- ════════════════════════════════════════════════════════════════

alter table public.workout_plan_items
  add column substitute_equipment_id uuid references public.equipment (id) on delete set null,
  add constraint workout_plan_items_substitute_differs check (substitute_equipment_id is distinct from equipment_id);

alter table public.session_sets
  add column replaced_equipment_id uuid references public.equipment (id) on delete set null;

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
  v_eq uuid;
  v_sub uuid;
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
    v_eq := (it->>'equipment_id')::uuid;
    v_sub := nullif(it->>'substitute_equipment_id', '')::uuid;
    if v_sub = v_eq then
      v_sub := null;
    end if;
    -- O exercício e o substituto precisam estar disponíveis (para o aluno, ou para o Personal no modelo).
    if v_template then
      if not exists (select 1 from public.equipment e where e.id = v_eq
                     and (e.is_default or public.knows_personal(e.created_by))) then
        raise exception 'Exercício indisponível na posição %', i using errcode = 'P0001';
      end if;
      if v_sub is not null and not exists (select 1 from public.equipment e where e.id = v_sub
                     and (e.is_default or public.knows_personal(e.created_by))) then
        raise exception 'Substituto indisponível na posição %', i using errcode = 'P0001';
      end if;
    else
      if not public.equipment_usable_for_student(v_eq, v_student) then
        raise exception 'Exercício indisponível para este aluno na posição %', i using errcode = 'P0001';
      end if;
      if v_sub is not null and not public.equipment_usable_for_student(v_sub, v_student) then
        raise exception 'Substituto indisponível para este aluno na posição %', i using errcode = 'P0001';
      end if;
    end if;

    insert into public.workout_plan_items
      (plan_id, equipment_id, position, sets, reps_min, reps_max, suggested_load, rest_seconds, notes, technique,
       substitute_equipment_id)
    values (
      v_plan, v_eq, i,
      coalesce((it->>'sets')::int, 3),
      (it->>'reps_min')::int,
      (it->>'reps_max')::int,
      (it->>'suggested_load')::numeric,
      coalesce((it->>'rest_seconds')::int, 60),
      nullif(trim(it->>'notes'), ''),
      nullif(it->>'technique', ''),
      v_sub
    );
  end loop;

  return v_plan;
end;
$$;

/** Duplica uma ficha/modelo para um aluno (p_student) ou como modelo (p_student null), com os substitutos. */
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
           'technique', technique, 'substitute_equipment_id', substitute_equipment_id)
         order by position), '[]'::jsonb)
    into items
    from public.workout_plan_items where plan_id = p_plan;

  return public.save_workout_plan(
    null, p_student, coalesce(nullif(trim(p_name), ''), src.name), src.goal, src.notes,
    case when p_student is null then null else src.valid_until end, items);
end;
$$;

-- Salvar treino: grava também qual exercício da ficha foi substituído (opcional).
-- Busca tolerante a espaços: a função pode ter vindo de versões diferentes da migração de cardio.
do $$
declare
  src text := pg_get_functiondef('public.save_workout_session(jsonb)'::regprocedure);
  dst text;
begin
  dst := regexp_replace(src, 'incline_pct, level\)', 'incline_pct, level, replaced_equipment_id)');
  dst := regexp_replace(dst, '(nullif\(st->>''level'',\s*''''\)::smallint)',
                        '\1, nullif(st->>''replaced_equipment_id'', '''')::uuid');
  if dst = src or position('replaced_equipment_id)' in dst) = 0
     or position('nullif(st->>''replaced_equipment_id''' in dst) = 0 then
    raise exception 'save_workout_session: trecho esperado não encontrado';
  end if;
  execute dst;
end $$;

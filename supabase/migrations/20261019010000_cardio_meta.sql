-- ════════════════════════════════════════════════════════════════
-- Cardio completo e meta de cardio
--  • Cada série de cardio guarda tempo (min), distância (km) e a intensidade do painel
--    do aparelho: esteira = velocidade (km/h) + inclinação (%); bicicleta/elíptico = nível.
--  • Meta semanal de cardio por aluno: minutos, distância ou minutos em ritmo forte.
--    Quem define é o Personal; o aluno só define a própria se não tiver Personal.
-- ════════════════════════════════════════════════════════════════

-- Como o aparelho mede a intensidade (só para cardio).
alter table public.equipment
  add column intensity_unit text check (intensity_unit in ('velocidade', 'nivel'));
update public.equipment set intensity_unit = 'velocidade' where muscle_group = 'cardio' and name ilike '%esteira%';
update public.equipment set intensity_unit = 'nivel' where muscle_group = 'cardio' and intensity_unit is null;
grant update (intensity_unit) on public.equipment to authenticated;

alter table public.session_sets
  add column duration_min numeric(5, 1) check (duration_min between 0 and 600),
  add column distance_km numeric(6, 2) check (distance_km between 0 and 300),
  add column speed_kmh numeric(4, 1) check (speed_kmh between 0 and 40),
  add column incline_pct numeric(4, 1) check (incline_pct between 0 and 40),
  add column level smallint check (level between 0 and 50);

-- Salvar treino: grava também os dados de cardio de cada série (opcionais).
do $$
declare
  src text;
  old_insert text := 'insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done)
      values (
        v_id, (ex->>''equipment_id'')::uuid, i, j,
        coalesce((st->>''load_kg'')::numeric, 0),
        coalesce((st->>''reps'')::int, 0),
        coalesce((st->>''done'')::boolean, false)
      );';
begin
  select pg_get_functiondef('public.save_workout_session(jsonb)'::regprocedure) into src;
  if position(old_insert in src) = 0 then
    raise exception 'save_workout_session: trecho esperado não encontrado';
  end if;
  execute replace(src, old_insert,
    'insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done,
                                      duration_min, distance_km, speed_kmh, incline_pct, level)
      values (
        v_id, (ex->>''equipment_id'')::uuid, i, j,
        coalesce((st->>''load_kg'')::numeric, 0),
        coalesce((st->>''reps'')::int, 0),
        coalesce((st->>''done'')::boolean, false),
        nullif(st->>''duration_min'', '''')::numeric,
        nullif(st->>''distance_km'', '''')::numeric,
        nullif(st->>''speed_kmh'', '''')::numeric,
        nullif(st->>''incline_pct'', '''')::numeric,
        nullif(st->>''level'', '''')::smallint
      );');
end $$;

-- ─── Meta de cardio ─────────────────────────────────────────────
create table public.cardio_goals (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  -- minutos/semana, km/semana ou minutos/semana em ritmo forte
  kind text not null check (kind in ('minutos', 'distancia', 'intenso')),
  target numeric(6, 1) not null check (target > 0 and target <= 5000),
  -- Ritmo forte: série com velocidade ≥ min_speed_kmh (esteira) ou nível ≥ min_level (bicicleta/elíptico).
  min_speed_kmh numeric(4, 1) check (min_speed_kmh between 1 and 40),
  min_level smallint check (min_level between 1 and 50),
  set_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (kind <> 'intenso' or min_speed_kmh is not null or min_level is not null)
);

alter table public.cardio_goals enable row level security;
revoke all on public.cardio_goals from anon;
revoke insert, update, delete, truncate on public.cardio_goals from authenticated;
create policy "meta de cardio: aluno e Personais vinculados leem" on public.cardio_goals
  for select to authenticated using (student_id = (select auth.uid()) or public.is_linked_personal(student_id));

/** Quem pode mexer na meta: Personal vinculado; ou o próprio aluno, enquanto não tiver Personal. */
create function private.can_edit_cardio_goal(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_linked_personal(p_student)
      or (p_student = auth.uid() and public.can_train_self()
          and not exists (select 1 from public.personal_students
                           where student_id = p_student and status = 'ativo' and personal_id <> p_student));
$$;
revoke execute on function private.can_edit_cardio_goal(uuid) from public, anon, authenticated;

/** Define (ou troca) a meta de cardio do aluno. */
create function public.set_cardio_goal(p_student uuid, p_kind text, p_target numeric,
                                       p_min_speed numeric default null, p_min_level int default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_personal text;
  v_label text;
begin
  if p_student is null or not private.can_edit_cardio_goal(p_student) then
    raise exception 'Você não pode alterar a meta de cardio deste aluno' using errcode = '42501';
  end if;
  if p_kind not in ('minutos', 'distancia', 'intenso') or p_target is null or p_target <= 0 or p_target > 5000 then
    raise exception 'Meta inválida' using errcode = 'P0001';
  end if;
  if p_kind = 'intenso' and p_min_speed is null and p_min_level is null then
    raise exception 'Informe a velocidade ou o nível que conta como ritmo forte' using errcode = 'P0001';
  end if;
  insert into public.cardio_goals (student_id, kind, target, min_speed_kmh, min_level, set_by, updated_at)
  values (p_student, p_kind, round(p_target, 1),
          case when p_kind = 'intenso' then p_min_speed end,
          case when p_kind = 'intenso' then p_min_level end,
          auth.uid(), now())
  on conflict (student_id) do update
    set kind = excluded.kind, target = excluded.target, min_speed_kmh = excluded.min_speed_kmh,
        min_level = excluded.min_level, set_by = excluded.set_by, updated_at = now();

  if p_student <> auth.uid() then
    select full_name into v_personal from public.profiles where id = auth.uid();
    v_label := case p_kind
      when 'minutos' then trim(to_char(p_target, 'FM9990.9')) || ' min de cardio por semana'
      when 'distancia' then trim(to_char(p_target, 'FM9990.9')) || ' km de cardio por semana'
      else trim(to_char(p_target, 'FM9990.9')) || ' min de cardio em ritmo forte por semana' end;
    perform public.notify(p_student, 'Nova meta de cardio 🏃', v_personal || ' definiu sua meta: ' || v_label || '.', '/aluno');
  end if;
end;
$$;

/** Remove a meta de cardio do aluno. */
create function public.clear_cardio_goal(p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_student is null or not private.can_edit_cardio_goal(p_student) then
    raise exception 'Você não pode alterar a meta de cardio deste aluno' using errcode = '42501';
  end if;
  delete from public.cardio_goals where student_id = p_student;
end;
$$;

/**
 * Cardio da semana (seg–dom, fuso SP) que contém p_day: minutos, km, minutos em ritmo forte
 * e dias com cardio, mais a meta. Para o próprio aluno, Personal vinculado ou o servidor (service role).
 */
create function public.cardio_week(p_student uuid, p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date := date_trunc('week', coalesce(p_day, (now() at time zone 'America/Sao_Paulo')::date))::date;
  g public.cardio_goals;
  r jsonb;
begin
  if auth.uid() is not null and p_student <> auth.uid() and not public.is_linked_personal(p_student) then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into g from public.cardio_goals where student_id = p_student;
  select jsonb_build_object(
    'week_start', v_from,
    'minutes', coalesce(sum(m), 0),
    'km', coalesce(sum(ss.distance_km), 0),
    'intense_minutes', coalesce(sum(m) filter (where
        (g.min_speed_kmh is not null and ss.speed_kmh >= g.min_speed_kmh)
        or (g.min_level is not null and ss.level >= g.min_level)), 0),
    'days', count(distinct (ws.started_at at time zone 'America/Sao_Paulo')::date),
    'goal', case when g.student_id is null then null else jsonb_build_object(
      'kind', g.kind, 'target', g.target, 'min_speed_kmh', g.min_speed_kmh, 'min_level', g.min_level,
      'by_personal', g.set_by is not null and g.set_by <> p_student) end
  ) into r
  from public.workout_sessions ws
  join public.session_sets ss on ss.session_id = ws.id and ss.done
  join public.equipment e on e.id = ss.equipment_id and e.muscle_group = 'cardio'
  cross join lateral (select coalesce(ss.duration_min, ss.reps::numeric) as m) x
  where ws.student_id = p_student
    and (ws.started_at at time zone 'America/Sao_Paulo')::date between v_from and v_from + 6;
  return r;
end;
$$;

revoke execute on function public.set_cardio_goal(uuid, text, numeric, numeric, int),
  public.clear_cardio_goal(uuid), public.cardio_week(uuid, date) from public, anon;
grant execute on function public.set_cardio_goal(uuid, text, numeric, numeric, int),
  public.clear_cardio_goal(uuid), public.cardio_week(uuid, date) to authenticated, service_role;

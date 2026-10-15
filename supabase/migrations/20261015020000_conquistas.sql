-- ════════════════════════════════════════════════════════════════
-- Conquistas (estilo troféus): 100 visíveis + 100 secretas para quem treina,
-- e 30 exclusivas de Personal (alunos, fichas, registros, agenda, financeiro).
-- Cada conquista = métrica ≥ limite. As métricas são calculadas pelo
-- histórico (private.achievement_metrics) e conferidas ao salvar treino, peso,
-- avaliação, foto, vínculo e meta (gatilhos adiados para o fim da transação).
-- ════════════════════════════════════════════════════════════════

create table public.achievements (
  code text primary key,
  title text not null,
  description text not null,
  emoji text not null,
  category text not null,
  tier text not null check (tier in ('bronze', 'prata', 'ouro', 'platina')),
  hidden boolean not null default false,
  metric text not null,
  threshold numeric not null check (threshold > 0),
  sort int not null,
  -- 'aluno': de quem treina (alunos, e Personais no "Meu treino"); 'personal': só de Personal.
  audience text not null default 'aluno' check (audience in ('aluno', 'personal'))
);

create table public.student_achievements (
  student_id uuid not null references public.profiles (id) on delete cascade,
  code text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (student_id, code)
);
create index student_achievements_recent_idx on public.student_achievements (student_id, unlocked_at desc);

-- Ninguém lê o catálogo direto (as secretas ficariam expostas): só por my_achievements().
alter table public.achievements enable row level security;
alter table public.student_achievements enable row level security;
revoke all on public.achievements, public.student_achievements from anon, authenticated;

/** Métricas do aluno para as conquistas (fuso de São Paulo). */
create function private.achievement_metrics(p_student uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ses as (
    select s.id, (s.started_at at time zone 'America/Sao_Paulo') as st, s.kind, s.plan_id, s.logged_by,
           s.effort, s.pain, s.rated_at, s.student_id,
           extract(epoch from s.finished_at - s.started_at) / 60 as minutes
      from public.workout_sessions s where s.student_id = p_student
  ),
  sets as (
    select ss.session_id, ss.exercise_order, ss.set_number, ss.load_kg, ss.reps, ss.done, ss.is_pr, ss.equipment_id,
           e.muscle_group::text as grp, lower(e.name) as eq
      from public.session_sets ss join ses on ses.id = ss.session_id
      join public.equipment e on e.id = ss.equipment_id
  ),
  done as (select * from sets where done),
  per_session as (
    select ses.id, ses.st,
           coalesce(sum(d.load_kg * d.reps), 0) as vol,
           count(d.*) filter (where d.is_pr) as prs,
           count(distinct d.grp) as groups,
           count(distinct d.equipment_id) as eqs,
           bool_or(d.grp in ('quadriceps', 'posterior', 'gluteos', 'adutores', 'panturrilha')) as leg,
           bool_or(d.grp = 'cardio') as cardio,
           count(d.*) as done_sets,
           (select count(*) from sets x where x.session_id = ses.id) as all_sets
      from ses left join done d on d.session_id = ses.id
     group by ses.id, ses.st
  ),
  days as (select distinct st::date as d from ses),
  day_isl as (select d - (row_number() over (order by d))::int as g from days),
  weeks as (select distinct date_trunc('week', st)::date as w from ses),
  week_isl as (select w - (7 * row_number() over (order by w))::int as g from weeks),
  week_counts as (select date_trunc('week', st)::date as w, count(*) as n, count(distinct st::date) as nd from ses group by 1),
  legseq as (
    select leg, sum(case when leg then 1 else 0 end) over (order by st, id) as grp from per_session
  ),
  gaps as (select st - lag(st) over (order by st) as gap from ses),
  w as (select weight_kg, measured_on from public.body_weights where student_id = p_student)
  select jsonb_build_object(
    'sessions', (select count(*) from ses),
    'day_streak', coalesce((select max(c) from (select count(*) c from day_isl group by g) x), 0),
    'week_streak', coalesce((select max(c) from (select count(*) c from week_isl group by g) x), 0),
    'week_max', coalesce((select max(n) from week_counts), 0),
    'goal_weeks', coalesce((select count(*) from week_counts wc
                             where wc.nd >= (select weekly_goal from public.student_settings where student_id = p_student)), 0),
    'month_max', coalesce((select max(c) from (select count(*) c from ses group by date_trunc('month', st)) x), 0),
    'months_distinct', (select count(distinct extract(month from st)) from ses),
    'volume_total', (select coalesce(sum(load_kg * reps), 0) from done),
    'volume_session_max', coalesce((select max(vol) from per_session), 0),
    'sets_total', (select count(*) from done),
    'reps_total', (select coalesce(sum(reps), 0) from done),
    'undone_sets', (select count(*) from sets where not done),
    'prs_total', (select count(*) from done where is_pr),
    'prs_session_max', coalesce((select max(prs) from per_session), 0),
    'distinct_equipment', (select count(distinct equipment_id) from done),
    'max_groups_session', coalesce((select max(groups) from per_session), 0),
    'max_equipment_session', coalesce((select max(eqs) from per_session), 0),
    'g_peito', (select count(*) from done where grp = 'peito'),
    'g_costas', (select count(*) from done where grp = 'costas'),
    'g_ombros', (select count(*) from done where grp = 'ombros'),
    'g_bracos', (select count(*) from done where grp in ('biceps', 'triceps')),
    'g_pernas', (select count(*) from done where grp in ('quadriceps', 'posterior')),
    'g_gluteos', (select count(*) from done where grp = 'gluteos'),
    'g_panturrilha', (select count(*) from done where grp = 'panturrilha'),
    'g_abdomen', (select count(*) from done where grp = 'abdomen'),
    'g_antebraco', (select count(*) from done where grp = 'antebraco'),
    'g_adutores', (select count(*) from done where grp = 'adutores')
  ) || jsonb_build_object(
    'leg_days', (select count(*) from per_session where leg),
    'no_leg_streak', coalesce((select max(c) from (select count(*) c from legseq where not coalesce(leg, false) group by grp) x), 0),
    'cardio_sessions', (select count(*) from per_session where cardio),
    'max_supino', (select coalesce(max(load_kg), 0) from done where eq = 'supino reto com barra'),
    'max_agachamento', (select coalesce(max(load_kg), 0) from done where eq in ('agachamento livre', 'agachamento hack', 'agachamento no smith')),
    'max_legpress', (select coalesce(max(load_kg), 0) from done where eq = 'leg press 45°'),
    'max_terra', (select coalesce(max(load_kg), 0) from done where eq = 'levantamento terra'),
    'max_rosca', (select coalesce(max(load_kg), 0) from done where eq = 'rosca direta com barra'),
    'max_load', (select coalesce(max(load_kg), 0) from done),
    'reps_flexao', (select coalesce(sum(reps), 0) from done where eq = 'flexão de braço'),
    'reps_barra', (select coalesce(sum(reps), 0) from done where eq = 'barra fixa')
  ) || jsonb_build_object(
    'high_rep_sets', (select count(*) from done where reps >= 20),
    'single_rep_sets', (select count(*) from done where reps = 1 and load_kg > 0),
    'set_67', (select count(*) from done a where a.load_kg = 67
                  or (a.reps = 6 and exists (select 1 from done b where b.session_id = a.session_id
                        and b.exercise_order = a.exercise_order and b.set_number = a.set_number + 1 and b.reps = 7))),
    'early', (select count(distinct st::date) from ses where extract(hour from st) between 4 and 5),
    'night', (select count(distinct st::date) from ses where extract(hour from st) >= 22),
    'midnight', (select count(*) from ses where extract(hour from st) < 4),
    'sunday', (select count(distinct st::date) from ses where extract(dow from st) = 0),
    'saturday', (select count(distinct st::date) from ses where extract(dow from st) = 6),
    'monday', (select count(distinct st::date) from ses where extract(dow from st) = 1),
    'friday_night', (select count(distinct st::date) from ses where extract(dow from st) = 5 and extract(hour from st) >= 18),
    'xmas', (select count(*) from ses where to_char(st, 'MM-DD') = '12-25'),
    'newyear', (select count(*) from ses where to_char(st, 'MM-DD') = '01-01'),
    'birthday', (select count(*) from ses, public.profiles pr
                  where pr.id = p_student and pr.birth_date is not null and to_char(st, 'MM-DD') = to_char(pr.birth_date, 'MM-DD')),
    'short_sessions', (select count(*) from per_session ps join ses using (id) where ses.minutes < 25 and ps.done_sets > 0),
    'long_sessions', (select count(*) from ses where minutes >= 120),
    'double_days', (select count(*) from (select st::date from ses group by 1 having count(*) >= 2) x),
    'comebacks', (select count(*) from gaps where gap >= interval '14 days'),
    'free_sessions', (select count(*) from ses where kind = 'livre'),
    'plan_sessions', (select count(*) from ses where plan_id is not null),
    'full_sessions', (select count(*) from per_session where done_sets > 0 and done_sets = all_sets),
    'instructor_sessions', (select count(*) from ses where logged_by is not null and logged_by <> student_id),
    'rated', (select count(*) from ses where rated_at is not null),
    'effort5', (select count(*) from ses where effort = 5),
    'effort1', (select count(*) from ses where effort = 1),
    'pain', (select count(*) from ses where pain),
    'weighins', (select count(*) from w),
    'weight_lost', coalesce(greatest(0, (select weight_kg from w order by measured_on limit 1) - (select min(weight_kg) from w)), 0),
    'weight_gained', coalesce(greatest(0, (select max(weight_kg) from w) - (select weight_kg from w order by measured_on limit 1)), 0),
    'has_personal', (select count(*) from public.personal_students where student_id = p_student and status = 'ativo'),
    'personals_count', (select count(*) from public.personal_students where student_id = p_student and status = 'ativo'),
    'avatar', (select case when avatar_path is not null then 1 else 0 end from public.profiles where id = p_student),
    'visible_unlocked', (select count(*) from public.student_achievements sa join public.achievements a using (code)
                          where sa.student_id = p_student and not a.hidden and a.audience = 'aluno')
  );
$$;

/** Métricas do Personal (como treinador; o próprio treino conta nas métricas de aluno). */
create function private.personal_metrics(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with st as (
    select student_id from public.personal_students where personal_id = p and status = 'ativo' and student_id <> p
  )
  select jsonb_build_object(
    'p_students', (select count(*) from st),
    'p_invites', (select count(*) from public.invites where personal_id = p),
    'p_links_accepted', (select count(*) from public.link_requests where personal_id = p and status = 'aceito'),
    'p_listed', (select case when directory_listed then 1 else 0 end from public.profiles where id = p),
    'p_plans', (select count(*) from public.workout_plans where created_by = p and not is_template and student_id <> p),
    'p_templates', (select count(*) from public.workout_plans where created_by = p and is_template),
    'p_equipment', (select count(*) from public.equipment where created_by = p and not is_default),
    'p_logged', (select count(*) from public.workout_sessions where logged_by = p and student_id <> p),
    'p_classes', (select count(*) from public.class_schedules where personal_id = p and student_id <> p),
    'p_student_sessions', (select count(*) from public.workout_sessions s join st using (student_id)),
    'p_student_prs', (select count(*) from public.session_sets ss
                        join public.workout_sessions s on s.id = ss.session_id join st using (student_id)
                       where ss.is_pr and ss.done),
    'p_packages', (select count(*) from public.payment_packages where personal_id = p),
    'p_paid', (select count(*) from public.payments where personal_id = p and paid_at is not null),
    'p_revenue_month', coalesce((select max(t) from (select sum(amount) t from public.payments
                                   where personal_id = p and paid_at is not null group by month) x), 0)
  );
$$;

/**
 * Confere e libera as conquistas (de aluno e, para Personal, também as de Personal). Avisa com uma notificação (ou um resumo,
 * se forem muitas de uma vez). Retorna os códigos liberados agora.
 */
create function private.check_achievements(p_student uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
  v_new text[] := '{}';
  v_round text[];
  v_coach boolean;
  a record;
begin
  select role in ('personal', 'admin') into v_coach from public.profiles where id = p_student;
  if v_coach is null then
    return v_new;
  end if;
  -- Duas rodadas: a segunda pega conquistas que dependem de outras (ex.: platinar).
  for i in 1..2 loop
    m := private.achievement_metrics(p_student);
    if v_coach then
      m := m || private.personal_metrics(p_student);
    end if;
    with ins as (
      insert into public.student_achievements (student_id, code)
      select p_student, ac.code from public.achievements ac
       where (ac.audience = 'aluno' or v_coach)
         and coalesce((m->>ac.metric)::numeric, 0) >= ac.threshold
         and not exists (select 1 from public.student_achievements sa where sa.student_id = p_student and sa.code = ac.code)
      on conflict do nothing
      returning code
    )
    select coalesce(array_agg(code), '{}') into v_round from ins;
    v_new := v_new || v_round;
    exit when cardinality(v_round) = 0;
  end loop;

  if cardinality(v_new) between 1 and 3 then
    for a in select * from public.achievements where code = any (v_new) order by sort loop
      perform public.notify(p_student,
        case when a.hidden then '🔓 Conquista secreta: ' else '🏆 Conquista: ' end || a.emoji || ' ' || a.title,
        a.description, case when a.audience = 'personal' then '/personal/conquistas' else '/aluno/conquistas' end);
    end loop;
  elsif cardinality(v_new) > 3 then
    perform public.notify(p_student, '🏆 ' || cardinality(v_new) || ' conquistas desbloqueadas!',
      'Abra suas conquistas para ver tudo o que você já liberou.',
      case when v_coach then '/personal/conquistas' else '/aluno/conquistas' end);
  end if;
  return v_new;
end;
$$;
revoke execute on function private.achievement_metrics(uuid), private.personal_metrics(uuid), private.check_achievements(uuid)
  from public, anon, authenticated;

/**
 * Conquistas do aluno logado (ou de um aluno acompanhado, para o Personal). Confere antes
 * as novas. Secretas ainda não liberadas vêm sem título nem descrição.
 * p_audience = 'personal': as conquistas de Personal da própria conta.
 */
create function public.my_achievements(p_student uuid default null, p_audience text default 'aluno')
returns table (code text, title text, description text, emoji text, category text, tier text, hidden boolean,
               unlocked_at timestamptz, progress numeric, threshold numeric, sort int)
language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := coalesce(p_student, auth.uid());
  m jsonb;
begin
  if v_student is null or (v_student <> auth.uid() and not public.is_linked_personal(v_student)) then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  if p_audience is null or p_audience not in ('aluno', 'personal')
     or (p_audience = 'personal' and (v_student <> auth.uid() or not public.current_role_is('personal'))) then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  if v_student = auth.uid() then
    perform private.check_achievements(v_student);
  end if;
  m := case when p_audience = 'personal' then private.personal_metrics(v_student)
            else private.achievement_metrics(v_student) end;
  return query
    select a.code,
           case when a.hidden and sa.unlocked_at is null then null else a.title end,
           case when a.hidden and sa.unlocked_at is null then null else a.description end,
           case when a.hidden and sa.unlocked_at is null then '🔒' else a.emoji end,
           case when a.hidden and sa.unlocked_at is null then 'Secretas' else a.category end,
           a.tier, a.hidden, sa.unlocked_at,
           case when a.hidden and sa.unlocked_at is null then null
                else least(coalesce((m->>a.metric)::numeric, 0), a.threshold) end,
           case when a.hidden and sa.unlocked_at is null then null else a.threshold end,
           a.sort
      from public.achievements a
      left join public.student_achievements sa on sa.code = a.code and sa.student_id = v_student
     where a.audience = p_audience
     order by a.sort;
end;
$$;
revoke execute on function public.my_achievements(uuid, text) from public, anon;
grant execute on function public.my_achievements(uuid, text) to authenticated;

-- ─── Gatilhos (no fim da transação, depois de gravar as séries) ──
create function private.achievements_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  -- Quem pode ter ganhado algo com esta linha (cada tabela tem colunas diferentes).
  if tg_table_name = 'profiles' then
    v_ids := array[new.id];
  elsif tg_table_name = 'workout_sessions' then
    v_ids := array[new.student_id, new.logged_by]
      || array(select personal_id from public.personal_students where student_id = new.student_id and status = 'ativo');
  elsif tg_table_name in ('workout_plans', 'equipment') then
    v_ids := array[new.created_by];
  elsif tg_table_name = 'personal_students' then
    v_ids := array[new.student_id, new.personal_id];
  elsif tg_table_name in ('invites', 'class_schedules', 'payment_packages', 'payments', 'link_requests') then
    v_ids := array[new.personal_id];
  else
    v_ids := array[new.student_id];
  end if;
  for v_id in select distinct x from unnest(v_ids) x where x is not null loop
    begin
      perform private.check_achievements(v_id);
    exception when others then
      raise warning 'conquistas: %', sqlerrm; -- nunca atrapalha salvar o treino
    end;
  end loop;
  return null;
end;
$$;
revoke execute on function private.achievements_trigger() from public, anon, authenticated;

create constraint trigger achievements_on_session after insert or update on public.workout_sessions
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_weight after insert or update on public.body_weights
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_settings after insert or update on public.student_settings
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_link after insert on public.personal_students
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_profile after update of avatar_path, directory_listed on public.profiles
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_plan after insert on public.workout_plans
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_equipment after insert on public.equipment
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_invite after insert on public.invites
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_class after insert on public.class_schedules
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_package after insert on public.payment_packages
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_payment after insert or update of paid_at on public.payments
  deferrable initially deferred for each row execute function private.achievements_trigger();
create constraint trigger achievements_on_link_request after update of status on public.link_requests
  deferrable initially deferred for each row execute function private.achievements_trigger();

-- ─── Catálogo ──────────────────────────────────────────────────
insert into public.achievements (code, title, description, emoji, category, tier, hidden, metric, threshold, sort, audience) values
  ('ta-pago', 'Tá pago!', 'Registre seu primeiro treino.', '✅', 'Frequência', 'bronze', false, 'sessions', 1, 1, 'aluno'),
  ('saindo-da-jaula', 'Saindo da jaula', 'Complete 5 treinos.', '🦁', 'Frequência', 'bronze', false, 'sessions', 5, 2, 'aluno'),
  ('rato-de-academia', 'Rato de academia', 'Complete 10 treinos.', '🐭', 'Frequência', 'bronze', false, 'sessions', 10, 3, 'aluno'),
  ('cliente-vip', 'Cliente VIP', 'Complete 25 treinos.', '🎟️', 'Frequência', 'prata', false, 'sessions', 25, 4, 'aluno'),
  ('hora-do-show', 'Hora do Show', 'Complete 50 treinos.', '🎤', 'Frequência', 'prata', false, 'sessions', 50, 5, 'aluno'),
  ('centenario', 'Centenário', 'Complete 100 treinos.', '💯', 'Frequência', 'ouro', false, 'sessions', 100, 6, 'aluno'),
  ('biiiirl', 'Biiiirl!', 'Complete 200 treinos.', '🗣️', 'Frequência', 'ouro', false, 'sessions', 200, 7, 'aluno'),
  ('um-ano-de-shape', 'Um ano de shape', 'Complete 365 treinos.', '📅', 'Frequência', 'platina', false, 'sessions', 365, 8, 'aluno'),
  ('lenda-da-maromba', 'Lenda da maromba', 'Complete 500 treinos.', '🏛️', 'Frequência', 'platina', false, 'sessions', 500, 9, 'aluno'),
  ('nao-e-fogo-de-palha', 'Não é fogo de palha', 'Treine 2 semanas seguidas.', '🔥', 'Constância', 'bronze', false, 'week_streak', 2, 10, 'aluno'),
  ('um-mes-sem-falhar', 'Um mês sem falhar', 'Treine 4 semanas seguidas.', '📆', 'Constância', 'prata', false, 'week_streak', 4, 11, 'aluno'),
  ('disciplina-motivacao', 'Disciplina > motivação', 'Treine 8 semanas seguidas.', '🧠', 'Constância', 'prata', false, 'week_streak', 8, 12, 'aluno'),
  ('trimestre-de-ferro', 'Trimestre de ferro', 'Treine 12 semanas seguidas.', '⛓️', 'Constância', 'ouro', false, 'week_streak', 12, 13, 'aluno'),
  ('meio-ano-de-foco', 'Meio ano de foco', 'Treine 26 semanas seguidas.', '🧭', 'Constância', 'ouro', false, 'week_streak', 26, 14, 'aluno'),
  ('inimigo-do-fim', 'Inimigo do fim', 'Treine 52 semanas seguidas.', '🏁', 'Constância', 'platina', false, 'week_streak', 52, 15, 'aluno'),
  ('semana-cheia', 'Semana cheia', 'Faça 3 treinos na mesma semana.', '🗓️', 'Constância', 'bronze', false, 'week_max', 3, 16, 'aluno'),
  ('cinco-na-semana', 'Cinco na semana', 'Faça 5 treinos na mesma semana.', '🖐️', 'Constância', 'prata', false, 'week_max', 5, 17, 'aluno'),
  ('mora-na-academia', 'Mora na academia', 'Faça 6 treinos na mesma semana.', '🏠', 'Constância', 'ouro', false, 'week_max', 6, 18, 'aluno'),
  ('trinca', 'Trinca', 'Treine 3 dias seguidos.', '3️⃣', 'Constância', 'bronze', false, 'day_streak', 3, 19, 'aluno'),
  ('semana-perfeita', 'Semana perfeita', 'Treine 7 dias seguidos.', '7️⃣', 'Constância', 'ouro', false, 'day_streak', 7, 20, 'aluno'),
  ('meta-batida', 'Meta batida', 'Bata sua meta semanal uma vez.', '🎯', 'Constância', 'bronze', false, 'goal_weeks', 1, 21, 'aluno'),
  ('meta-e-meta', 'Meta é meta', 'Bata a meta semanal em 4 semanas.', '📌', 'Constância', 'prata', false, 'goal_weeks', 4, 22, 'aluno'),
  ('cumpridor-de-metas', 'Cumpridor de metas', 'Bata a meta semanal em 12 semanas.', '📈', 'Constância', 'ouro', false, 'goal_weeks', 12, 23, 'aluno'),
  ('mes-intenso', 'Mês intenso', 'Faça 12 treinos no mesmo mês.', '🌙', 'Constância', 'prata', false, 'month_max', 12, 24, 'aluno'),
  ('mes-monstro', 'Mês monstro', 'Faça 20 treinos no mesmo mês.', '👹', 'Constância', 'ouro', false, 'month_max', 20, 25, 'aluno'),
  ('10-toneladas', '10 toneladas', 'Some 10 mil kg de volume (carga × repetições).', '🏗️', 'Volume', 'bronze', false, 'volume_total', 10000, 26, 'aluno'),
  ('guindaste-humano', 'Guindaste humano', 'Some 50 mil kg de volume.', '🏗️', 'Volume', 'prata', false, 'volume_total', 50000, 27, 'aluno'),
  ('100-toneladas', '100 toneladas', 'Some 100 mil kg de volume.', '🚛', 'Volume', 'ouro', false, 'volume_total', 100000, 28, 'aluno'),
  ('meio-milhao', 'Meio milhão', 'Some 500 mil kg de volume.', '🚀', 'Volume', 'platina', false, 'volume_total', 500000, 29, 'aluno'),
  ('treino-pesado', 'Treino pesado', 'Faça 5 mil kg de volume num só treino.', '🧱', 'Volume', 'bronze', false, 'volume_session_max', 5000, 30, 'aluno'),
  ('dia-de-caminhao', 'Dia de caminhão', 'Faça 10 mil kg de volume num só treino.', '🚚', 'Volume', 'prata', false, 'volume_session_max', 10000, 31, 'aluno'),
  ('carregou-o-mundo', 'Carregou o mundo', 'Faça 20 mil kg de volume num só treino.', '🌍', 'Volume', 'ouro', false, 'volume_session_max', 20000, 32, 'aluno'),
  ('100-series', '100 séries', 'Complete 100 séries.', '🔢', 'Volume', 'bronze', false, 'sets_total', 100, 33, 'aluno'),
  ('500-series', '500 séries', 'Complete 500 séries.', '📊', 'Volume', 'prata', false, 'sets_total', 500, 34, 'aluno'),
  ('mil-series', 'Mil séries', 'Complete 1.000 séries.', '🏅', 'Volume', 'ouro', false, 'sets_total', 1000, 35, 'aluno'),
  ('mil-repeticoes', 'Mil repetições', 'Some 1.000 repetições.', '🔁', 'Volume', 'bronze', false, 'reps_total', 1000, 36, 'aluno'),
  ('dez-mil-reps', 'Dez mil reps', 'Some 10.000 repetições.', '♾️', 'Volume', 'ouro', false, 'reps_total', 10000, 37, 'aluno'),
  ('supino-de-respeito', 'Supino de respeito', 'Faça supino reto com barra com 40 kg.', '🏋️', 'Força', 'bronze', false, 'max_supino', 40, 38, 'aluno'),
  ('peito-de-aco', 'Peito de aço', 'Faça supino reto com barra com 60 kg.', '🛡️', 'Força', 'prata', false, 'max_supino', 60, 39, 'aluno'),
  ('supino-de-gente-grande', 'Supino de gente grande', 'Faça supino reto com barra com 80 kg.', '💪', 'Força', 'ouro', false, 'max_supino', 80, 40, 'aluno'),
  ('clube-dos-100', 'Clube dos 100', 'Faça supino reto com barra com 100 kg.', '🎖️', 'Força', 'platina', false, 'max_supino', 100, 41, 'aluno'),
  ('agachou-levantou', 'Agachou, levantou', 'Agache com 60 kg (livre, hack ou smith).', '🦵', 'Força', 'bronze', false, 'max_agachamento', 60, 42, 'aluno'),
  ('agacha-que-cresce', 'Agacha que cresce', 'Agache com 100 kg.', '🌱', 'Força', 'prata', false, 'max_agachamento', 100, 43, 'aluno'),
  ('pernas-de-pilastra', 'Pernas de pilastra', 'Agache com 140 kg.', '🏛️', 'Força', 'ouro', false, 'max_agachamento', 140, 44, 'aluno'),
  ('leg-press-iniciado', 'Leg press iniciado', 'Faça leg press 45° com 100 kg.', '🦿', 'Força', 'bronze', false, 'max_legpress', 100, 45, 'aluno'),
  ('leg-press-raiz', 'Leg press raiz', 'Faça leg press 45° com 200 kg.', '🪵', 'Força', 'prata', false, 'max_legpress', 200, 46, 'aluno'),
  ('leg-do-bambam', 'Leg do Bambam', 'Faça leg press 45° com 300 kg.', '🐂', 'Força', 'ouro', false, 'max_legpress', 300, 47, 'aluno'),
  ('terra-firme', 'Terra firme', 'Faça levantamento terra com 60 kg.', '🌎', 'Força', 'bronze', false, 'max_terra', 60, 48, 'aluno'),
  ('puxador-de-chao', 'Puxador de chão', 'Faça levantamento terra com 100 kg.', '⛏️', 'Força', 'prata', false, 'max_terra', 100, 49, 'aluno'),
  ('arrancou-a-raiz', 'Arrancou a raiz', 'Faça levantamento terra com 140 kg.', '🌳', 'Força', 'ouro', false, 'max_terra', 140, 50, 'aluno'),
  ('rosca-de-respeito', 'Rosca de respeito', 'Faça rosca direta com barra com 20 kg.', '💪', 'Força', 'bronze', false, 'max_rosca', 20, 51, 'aluno'),
  ('muque', 'Muque', 'Faça rosca direta com barra com 30 kg.', '🦾', 'Força', 'prata', false, 'max_rosca', 30, 52, 'aluno'),
  ('tres-digitos', 'Três dígitos', 'Levante 100 kg em qualquer exercício.', '💯', 'Força', 'prata', false, 'max_load', 100, 53, 'aluno'),
  ('segunda-e-dia-de-peito', 'Segunda é dia de peito', 'Complete 50 séries de peito.', '🫀', 'Grupos musculares', 'bronze', false, 'g_peito', 50, 54, 'aluno'),
  ('peitoral-de-vitrine', 'Peitoral de vitrine', 'Complete 200 séries de peito.', '🪟', 'Grupos musculares', 'prata', false, 'g_peito', 200, 55, 'aluno'),
  ('costas-largas', 'Costas largas', 'Complete 50 séries de costas.', '🦅', 'Grupos musculares', 'bronze', false, 'g_costas', 50, 56, 'aluno'),
  ('asa-de-morcego', 'Asa de morcego', 'Complete 200 séries de costas.', '🦇', 'Grupos musculares', 'prata', false, 'g_costas', 200, 57, 'aluno'),
  ('ombro-3d', 'Ombro 3D', 'Complete 50 séries de ombros.', '🎳', 'Grupos musculares', 'bronze', false, 'g_ombros', 50, 58, 'aluno'),
  ('trapezio-descendente', 'Trapézio descendente', 'Complete 200 séries de ombros.', '⛰️', 'Grupos musculares', 'prata', false, 'g_ombros', 200, 59, 'aluno'),
  ('braco-de-respeito', 'Braço de respeito', 'Complete 50 séries de bíceps e tríceps.', '💪', 'Grupos musculares', 'bronze', false, 'g_bracos', 50, 60, 'aluno'),
  ('bracao', 'Bração', 'Complete 200 séries de bíceps e tríceps.', '🦾', 'Grupos musculares', 'prata', false, 'g_bracos', 200, 61, 'aluno'),
  ('dia-de-perna-ninguem-pula', 'Dia de perna ninguém pula', 'Complete 50 séries de quadríceps e posterior.', '🦵', 'Grupos musculares', 'bronze', false, 'g_pernas', 50, 62, 'aluno'),
  ('coxa-de-jogador', 'Coxa de jogador', 'Complete 200 séries de quadríceps e posterior.', '⚽', 'Grupos musculares', 'prata', false, 'g_pernas', 200, 63, 'aluno'),
  ('gluteo-de-aco', 'Glúteo de aço', 'Complete 50 séries de glúteos.', '🍑', 'Grupos musculares', 'bronze', false, 'g_gluteos', 50, 64, 'aluno'),
  ('bumbum-na-nuca', 'Bumbum na nuca', 'Complete 200 séries de glúteos.', '🚀', 'Grupos musculares', 'prata', false, 'g_gluteos', 200, 65, 'aluno'),
  ('panturrilha-de-touro', 'Panturrilha de touro', 'Complete 50 séries de panturrilha.', '🐃', 'Grupos musculares', 'bronze', false, 'g_panturrilha', 50, 66, 'aluno'),
  ('tanquinho-em-obras', 'Tanquinho em obras', 'Complete 50 séries de abdômen.', '🚧', 'Grupos musculares', 'bronze', false, 'g_abdomen', 50, 67, 'aluno'),
  ('tanquinho-pronto', 'Tanquinho pronto', 'Complete 200 séries de abdômen.', '🍫', 'Grupos musculares', 'prata', false, 'g_abdomen', 200, 68, 'aluno'),
  ('pegada-de-ferro', 'Pegada de ferro', 'Complete 30 séries de antebraço.', '✊', 'Grupos musculares', 'bronze', false, 'g_antebraco', 30, 69, 'aluno'),
  ('abre-e-fecha', 'Abre e fecha', 'Complete 30 séries de adutores.', '🦋', 'Grupos musculares', 'bronze', false, 'g_adutores', 30, 70, 'aluno'),
  ('turista-da-academia', 'Turista da academia', 'Use 10 aparelhos/exercícios diferentes.', '🧳', 'Grupos musculares', 'bronze', false, 'distinct_equipment', 10, 71, 'aluno'),
  ('conhece-todos-os-aparelhos', 'Conhece todos os aparelhos', 'Use 25 exercícios diferentes.', '🗺️', 'Grupos musculares', 'prata', false, 'distinct_equipment', 25, 72, 'aluno'),
  ('enciclopedia-da-maromba', 'Enciclopédia da maromba', 'Use 40 exercícios diferentes.', '📚', 'Grupos musculares', 'ouro', false, 'distinct_equipment', 40, 73, 'aluno'),
  ('full-body', 'Full body', 'Trabalhe 5 grupos musculares num só treino.', '🧍', 'Grupos musculares', 'bronze', false, 'max_groups_session', 5, 74, 'aluno'),
  ('leg-day-lover', 'Leg day lover', 'Faça 10 treinos com pernas.', '❤️', 'Grupos musculares', 'prata', false, 'leg_days', 10, 75, 'aluno'),
  ('primeiro-suor', 'Primeiro suor', 'Faça cardio pela primeira vez.', '💦', 'Cardio', 'bronze', false, 'cardio_sessions', 1, 76, 'aluno'),
  ('cardio-em-dia', 'Cardio em dia', 'Faça cardio em 10 treinos.', '🏃', 'Cardio', 'bronze', false, 'cardio_sessions', 10, 77, 'aluno'),
  ('pulmao-de-aco', 'Pulmão de aço', 'Faça cardio em 30 treinos.', '🫁', 'Cardio', 'prata', false, 'cardio_sessions', 30, 78, 'aluno'),
  ('maratonista-de-esteira', 'Maratonista de esteira', 'Faça cardio em 100 treinos.', '🏅', 'Cardio', 'ouro', false, 'cardio_sessions', 100, 79, 'aluno'),
  ('novo-recorde', 'Novo recorde!', 'Bata seu primeiro recorde pessoal.', '🏆', 'Recordes', 'bronze', false, 'prs_total', 1, 80, 'aluno'),
  ('quebrando-limites', 'Quebrando limites', 'Bata 10 recordes pessoais.', '📈', 'Recordes', 'bronze', false, 'prs_total', 10, 81, 'aluno'),
  ('farmador-de-aura', 'Farmador de aura', 'Bata 50 recordes pessoais.', '✨', 'Recordes', 'prata', false, 'prs_total', 50, 82, 'aluno'),
  ('aura-infinita', 'Aura infinita', 'Bata 100 recordes pessoais.', '🌟', 'Recordes', 'ouro', false, 'prs_total', 100, 83, 'aluno'),
  ('dia-inspirado', 'Dia inspirado', 'Bata 3 recordes num só treino.', '💡', 'Recordes', 'prata', false, 'prs_session_max', 3, 84, 'aluno'),
  ('o-pai-ta-on', 'O pai tá on', 'Bata 5 recordes num só treino.', '😎', 'Recordes', 'ouro', false, 'prs_session_max', 5, 85, 'aluno'),
  ('subiu-na-balanca', 'Subiu na balança', 'Registre seu peso pela primeira vez.', '⚖️', 'Peso', 'bronze', false, 'weighins', 1, 86, 'aluno'),
  ('balanca-e-minha-amiga', 'Balança é minha amiga', 'Registre seu peso 10 vezes.', '📏', 'Peso', 'prata', false, 'weighins', 10, 87, 'aluno'),
  ('primeiros-2-kg', 'Primeiros 2 kg', 'Perca 2 kg desde a primeira pesagem.', '📉', 'Peso', 'bronze', false, 'weight_lost', 2, 88, 'aluno'),
  ('menos-5', 'Menos 5', 'Perca 5 kg desde a primeira pesagem.', '🔻', 'Peso', 'prata', false, 'weight_lost', 5, 89, 'aluno'),
  ('menos-10', 'Menos 10', 'Perca 10 kg desde a primeira pesagem.', '🏆', 'Peso', 'ouro', false, 'weight_lost', 10, 90, 'aluno'),
  ('feedback-e-tudo', 'Feedback é tudo', 'Avalie um treino (esforço e dor).', '📝', 'Rotina', 'bronze', false, 'rated', 1, 91, 'aluno'),
  ('diario-de-treino', 'Diário de treino', 'Avalie 20 treinos.', '📓', 'Rotina', 'prata', false, 'rated', 20, 92, 'aluno'),
  ('tenho-personal', 'Tenho Personal', 'Tenha um Personal acompanhando você.', '🤝', 'Rotina', 'bronze', false, 'has_personal', 1, 93, 'aluno'),
  ('rostinho-bonito', 'Rostinho bonito', 'Coloque uma foto de perfil.', '📸', 'Rotina', 'bronze', false, 'avatar', 1, 94, 'aluno'),
  ('segue-a-ficha', 'Segue a ficha', 'Faça 10 treinos pela ficha.', '📋', 'Rotina', 'bronze', false, 'plan_sessions', 10, 95, 'aluno'),
  ('sem-deixar-serie-pra-tras', 'Sem deixar série pra trás', 'Complete 10 treinos com todas as séries feitas.', '🧹', 'Rotina', 'prata', false, 'full_sessions', 10, 96, 'aluno'),
  ('treino-livre-alma-livre', 'Treino livre, alma livre', 'Faça 5 treinos livres.', '🕊️', 'Rotina', 'bronze', false, 'free_sessions', 5, 97, 'aluno'),
  ('voltei', 'Voltei!', 'Volte a treinar depois de 14 dias parado.', '🔙', 'Rotina', 'bronze', false, 'comebacks', 1, 98, 'aluno'),
  ('dois-turnos', 'Dois turnos', 'Treine duas vezes no mesmo dia.', '🌗', 'Rotina', 'prata', false, 'double_days', 1, 99, 'aluno'),
  ('queimacao', 'Queimação', 'Faça 10 séries com 20 repetições ou mais.', '🔥', 'Rotina', 'bronze', false, 'high_rep_sets', 10, 100, 'aluno'),
  ('madrugador', 'Madrugador', 'Treinou antes das 6h.', '🌅', 'Horários', 'bronze', true, 'early', 1, 101, 'aluno'),
  ('o-galo-que-lute', 'O galo que lute', 'Treinou antes das 6h em 10 dias.', '🐓', 'Horários', 'prata', true, 'early', 10, 102, 'aluno'),
  ('rotina-sigma', 'Rotina sigma', 'Treinou antes das 6h em 25 dias.', '🗿', 'Horários', 'ouro', true, 'early', 25, 103, 'aluno'),
  ('coruja-da-maromba', 'Coruja da maromba', 'Treinou depois das 22h.', '🦉', 'Horários', 'bronze', true, 'night', 1, 104, 'aluno'),
  ('vampiro-do-ferro', 'Vampiro do ferro', 'Treinou depois das 22h em 10 dias.', '🧛', 'Horários', 'prata', true, 'night', 10, 105, 'aluno'),
  ('insonia-produtiva', 'Insônia produtiva', 'Treinou entre meia-noite e 4h.', '🌃', 'Horários', 'prata', true, 'midnight', 1, 106, 'aluno'),
  ('o-loco-meu', 'Ô loco, meu!', 'Treinou num domingo.', '📺', 'Horários', 'bronze', true, 'sunday', 1, 107, 'aluno'),
  ('ta-pegando-fogo-bicho', 'Tá pegando fogo, bicho!', 'Treinou em 10 domingos.', '🔥', 'Horários', 'prata', true, 'sunday', 10, 108, 'aluno'),
  ('sextou', 'Sextou!', 'Trocou o bar pela academia numa sexta à noite.', '🍻', 'Horários', 'bronze', true, 'friday_night', 1, 109, 'aluno'),
  ('sextou-com-s-de-supino', 'Sextou com S de supino', 'Treinou em 10 sextas à noite.', '🍺', 'Horários', 'prata', true, 'friday_night', 10, 110, 'aluno'),
  ('segunda-sem-preguica', 'Segunda sem preguiça', 'Treinou em 4 segundas-feiras.', '☕', 'Horários', 'bronze', true, 'monday', 4, 111, 'aluno'),
  ('sabadou', 'Sabadou', 'Treinou em 5 sábados.', '🎉', 'Horários', 'bronze', true, 'saturday', 5, 112, 'aluno'),
  ('papai-noel-marombeiro', 'Papai Noel marombeiro', 'Treinou no Natal.', '🎅', 'Horários', 'ouro', true, 'xmas', 1, 113, 'aluno'),
  ('ano-novo-shape-novo', 'Ano novo, shape novo', 'Treinou no dia 1º de janeiro.', '🎆', 'Horários', 'ouro', true, 'newyear', 1, 114, 'aluno'),
  ('parabens-pra-voce', 'Parabéns pra você', 'Treinou no dia do seu aniversário.', '🎂', 'Horários', 'ouro', true, 'birthday', 1, 115, 'aluno'),
  ('e-verao-o-ano-inteiro', 'É verão o ano inteiro', 'Treinou em todos os 12 meses do ano.', '☀️', 'Horários', 'ouro', true, 'months_distinct', 12, 116, 'aluno'),
  ('ja-acabou-jessica', 'Já acabou, Jéssica?', 'Fez um treino com menos de 25 minutos.', '⏱️', 'Duração', 'bronze', true, 'short_sessions', 1, 117, 'aluno'),
  ('speedrun', 'Speedrun', 'Fez 5 treinos com menos de 25 minutos.', '🏎️', 'Duração', 'prata', true, 'short_sessions', 5, 118, 'aluno'),
  ('mora-aqui', 'Mora aqui?', 'Treinou por mais de 2 horas.', '🛏️', 'Duração', 'prata', true, 'long_sessions', 1, 119, 'aluno'),
  ('inimigo-do-relogio', 'Inimigo do relógio', 'Treinou mais de 2 horas em 5 dias.', '⏰', 'Duração', 'ouro', true, 'long_sessions', 5, 120, 'aluno'),
  ('sem-vida-social', 'Sem vida social', 'Treinou duas vezes no mesmo dia em 5 dias.', '📵', 'Duração', 'ouro', true, 'double_days', 5, 121, 'aluno'),
  ('67', '67', 'Fez 6 e depois 7 repetições seguidas no mesmo exercício (ou levantou 67 kg).', '🤲', 'Memes', 'bronze', true, 'set_67', 1, 122, 'aluno'),
  ('e-mais-de-8-mil', 'É mais de 8 mil!', 'Passou de 8 mil kg de volume num só treino.', '🐉', 'Memes', 'prata', true, 'volume_session_max', 8001, 123, 'aluno'),
  ('bora-fio-do-bill', 'Bora, Fio do Bill', 'Treinou 5 dias seguidos.', '🫡', 'Memes', 'prata', true, 'day_streak', 5, 124, 'aluno'),
  ('saindo-da-jaula-o-monstro', 'Saindo da jaula, o monstro!', 'Levantou 150 kg em algum exercício.', '🦍', 'Memes', 'ouro', true, 'max_load', 150, 125, 'aluno'),
  ('ajuda-o-maluco-que-ta-doente', 'Ajuda o maluco que tá doente', 'Avisou o Personal que sentiu dor. Saúde em primeiro lugar!', '🩹', 'Memes', 'bronze', true, 'pain', 1, 126, 'aluno'),
  ('nao-vai-dar-nao', 'Não vai dar não', 'Marcou esforço máximo num treino… e deu!', '😤', 'Memes', 'bronze', true, 'effort5', 1, 127, 'aluno'),
  ('treino-de-frango', 'Treino de frango', 'Marcou 3 treinos como levinhos.', '🐣', 'Memes', 'bronze', true, 'effort1', 3, 128, 'aluno'),
  ('serie-fantasma', 'Série fantasma', 'Deixou 10 séries por fazer.', '👻', 'Memes', 'bronze', true, 'undone_sets', 10, 129, 'aluno'),
  ('perna-de-sabia', 'Perna de sabiá', 'Fez 10 treinos seguidos sem pernas. Bora pro leg day!', '🐦', 'Memes', 'bronze', true, 'no_leg_streak', 10, 130, 'aluno'),
  ('monstro-nao-descansa', 'Monstro não descansa', 'Fez 7 treinos numa só semana.', '🦖', 'Memes', 'ouro', true, 'week_max', 7, 131, 'aluno'),
  ('aura-1000', 'Aura +1000', 'Bateu 200 recordes pessoais.', '👑', 'Memes', 'platina', true, 'prs_total', 200, 132, 'aluno'),
  ('rodizio-de-aparelhos', 'Rodízio de aparelhos', 'Usou 10 exercícios diferentes num só treino.', '🎡', 'Memes', 'prata', true, 'max_equipment_session', 10, 133, 'aluno'),
  ('para-nossa-alegria', 'Para nossa alegria', 'Bateu a meta semanal em 26 semanas.', '🎶', 'Memes', 'ouro', true, 'goal_weeks', 26, 134, 'aluno'),
  ('ai-que-delicia-cara', 'Ai, que delícia, cara', 'Fez 50 séries com 20 repetições ou mais.', '😋', 'Memes', 'prata', true, 'high_rep_sets', 50, 135, 'aluno'),
  ('taca-lhe-pau-marcos', 'Taca-lhe pau, Marcos!', 'Fez 15 mil kg de volume num só treino.', '🏎️', 'Memes', 'ouro', true, 'volume_session_max', 15000, 136, 'aluno'),
  ('ex-frango', 'Ex-frango', 'Somou 5.000 repetições.', '🐔', 'Memes', 'prata', true, 'reps_total', 5000, 137, 'aluno'),
  ('shape-inexplicavel', 'Shape inexplicável', 'Completou 2.000 séries.', '🗿', 'Memes', 'platina', true, 'sets_total', 2000, 138, 'aluno'),
  ('chama-no-zap', 'Chama no zap', 'Tem 2 Personais acompanhando você.', '📱', 'Memes', 'prata', true, 'personals_count', 2, 139, 'aluno'),
  ('rapaz', 'Rapaz…', 'Fez uma série de 1 repetição com carga (teste de força).', '😳', 'Memes', 'bronze', true, 'single_rep_sets', 1, 140, 'aluno'),
  ('fenix', 'Fênix', 'Voltou a treinar depois de 14 dias parado, 3 vezes.', '🐦‍🔥', 'Memes', 'prata', true, 'comebacks', 3, 141, 'aluno'),
  ('platinou-o-boratreinar', 'Platinou o BoraTreinar', 'Desbloqueou todas as 100 conquistas visíveis.', '💎', 'Memes', 'platina', true, 'visible_unlocked', 100, 142, 'aluno'),
  ('imortal', 'Imortal', 'Completou 1.000 treinos.', '🧬', 'Lendas', 'platina', true, 'sessions', 1000, 143, 'aluno'),
  ('dois-anos-sem-falhar', 'Dois anos sem falhar', 'Treinou 104 semanas seguidas.', '🗓️', 'Lendas', 'platina', true, 'week_streak', 104, 144, 'aluno'),
  ('duas-semanas-direto', 'Duas semanas direto', 'Treinou 14 dias seguidos.', '🔗', 'Lendas', 'ouro', true, 'day_streak', 14, 145, 'aluno'),
  ('sem-descanso-vai-com-calma', 'Sem descanso (vai com calma!)', 'Treinou 30 dias seguidos.', '🫠', 'Lendas', 'platina', true, 'day_streak', 30, 146, 'aluno'),
  ('um-milhao-de-quilos', 'Um milhão de quilos', 'Somou 1 milhão de kg de volume.', '🏔️', 'Lendas', 'platina', true, 'volume_total', 1000000, 147, 'aluno'),
  ('mes-lendario', 'Mês lendário', 'Fez 25 treinos no mesmo mês.', '🌕', 'Lendas', 'platina', true, 'month_max', 25, 148, 'aluno'),
  ('meta-e-vida', 'Meta é vida', 'Bateu a meta semanal em 52 semanas.', '🏵️', 'Lendas', 'platina', true, 'goal_weeks', 52, 149, 'aluno'),
  ('natural', 'Natural', 'Completou 150 treinos na base do treino, comida e sono.', '🌿', 'Memes', 'ouro', true, 'sessions', 150, 150, 'aluno'),
  ('dez-semanas-de-ouro', 'Dez semanas de ouro', 'Bateu a meta semanal em 10 semanas.', '🥇', 'Lendas', 'prata', true, 'goal_weeks', 10, 151, 'aluno'),
  ('supino-de-elite', 'Supino de elite', 'Supino reto com barra com 120 kg.', '🏆', 'Força extrema', 'platina', true, 'max_supino', 120, 152, 'aluno'),
  ('agachamento-de-elite', 'Agachamento de elite', 'Agachou com 180 kg.', '🗻', 'Força extrema', 'platina', true, 'max_agachamento', 180, 153, 'aluno'),
  ('leg-press-do-thor', 'Leg press do Thor', 'Leg press 45° com 400 kg.', '⚡', 'Força extrema', 'platina', true, 'max_legpress', 400, 154, 'aluno'),
  ('terra-de-elite', 'Terra de elite', 'Levantamento terra com 200 kg.', '🌋', 'Força extrema', 'platina', true, 'max_terra', 200, 155, 'aluno'),
  ('biceps-de-popeye', 'Bíceps de Popeye', 'Rosca direta com barra com 40 kg.', '🥬', 'Força extrema', 'ouro', true, 'max_rosca', 40, 156, 'aluno'),
  ('duzentao', 'Duzentão', 'Levantou 200 kg em algum exercício.', '🏋️', 'Força extrema', 'ouro', true, 'max_load', 200, 157, 'aluno'),
  ('supino-de-meio-seculo', 'Supino de meio século', 'Supino reto com barra com 50 kg.', '5️⃣', 'Força extrema', 'bronze', true, 'max_supino', 50, 158, 'aluno'),
  ('leg-press-250', 'Leg press 250', 'Leg press 45° com 250 kg.', '🦵', 'Força extrema', 'prata', true, 'max_legpress', 250, 159, 'aluno'),
  ('cem-flexoes', 'Cem flexões', 'Somou 100 flexões de braço.', '🤸', 'Peso do corpo', 'prata', true, 'reps_flexao', 100, 160, 'aluno'),
  ('mil-flexoes', 'Mil flexões', 'Somou 1.000 flexões de braço.', '🪖', 'Peso do corpo', 'ouro', true, 'reps_flexao', 1000, 161, 'aluno'),
  ('barra-fixa-nivel-1', 'Barra fixa nível 1', 'Somou 50 repetições na barra fixa.', '🧗', 'Peso do corpo', 'prata', true, 'reps_barra', 50, 162, 'aluno'),
  ('homem-aranha', 'Homem-Aranha', 'Somou 300 repetições na barra fixa.', '🕷️', 'Peso do corpo', 'ouro', true, 'reps_barra', 300, 163, 'aluno'),
  ('primeira-flexao', 'Primeira flexão', 'Registrou flexões de braço.', '🙌', 'Peso do corpo', 'bronze', true, 'reps_flexao', 1, 164, 'aluno'),
  ('pendurado', 'Pendurado', 'Registrou barra fixa.', '🐒', 'Peso do corpo', 'bronze', true, 'reps_barra', 1, 165, 'aluno'),
  ('peitoral-blindado', 'Peitoral blindado', 'Completou 1.000 séries de peito.', '🛡️', 'Grupos extremos', 'platina', true, 'g_peito', 1000, 166, 'aluno'),
  ('costas-de-armario', 'Costas de armário', 'Completou 1.000 séries de costas.', '🚪', 'Grupos extremos', 'platina', true, 'g_costas', 1000, 167, 'aluno'),
  ('ombros-de-cabide', 'Ombros de cabide', 'Completou 1.000 séries de ombros.', '🧥', 'Grupos extremos', 'platina', true, 'g_ombros', 1000, 168, 'aluno'),
  ('braco-que-nao-cabe-na-manga', 'Braço que não cabe na manga', 'Completou 1.000 séries de braços.', '👕', 'Grupos extremos', 'platina', true, 'g_bracos', 1000, 169, 'aluno'),
  ('perna-de-jogador-da-nba', 'Perna de jogador da NBA', 'Completou 1.000 séries de pernas.', '🏀', 'Grupos extremos', 'platina', true, 'g_pernas', 1000, 170, 'aluno'),
  ('gluteo-olimpico', 'Glúteo olímpico', 'Completou 500 séries de glúteos.', '🥇', 'Grupos extremos', 'ouro', true, 'g_gluteos', 500, 171, 'aluno'),
  ('abdomen-trincado', 'Abdômen trincado', 'Completou 500 séries de abdômen.', '🧊', 'Grupos extremos', 'ouro', true, 'g_abdomen', 500, 172, 'aluno'),
  ('panturrilha-de-aco', 'Panturrilha de aço', 'Completou 300 séries de panturrilha.', '⚙️', 'Grupos extremos', 'ouro', true, 'g_panturrilha', 300, 173, 'aluno'),
  ('antebraco-de-marinheiro', 'Antebraço de marinheiro', 'Completou 150 séries de antebraço.', '⚓', 'Grupos extremos', 'prata', true, 'g_antebraco', 150, 174, 'aluno'),
  ('adutor-de-respeito', 'Adutor de respeito', 'Completou 150 séries de adutores.', '🦩', 'Grupos extremos', 'prata', true, 'g_adutores', 150, 175, 'aluno'),
  ('leg-day-viciado', 'Leg day viciado', 'Fez 100 treinos com pernas.', '💘', 'Grupos extremos', 'ouro', true, 'leg_days', 100, 176, 'aluno'),
  ('catalogo-zerado', 'Catálogo zerado', 'Usou 60 exercícios diferentes.', '🗂️', 'Grupos extremos', 'platina', true, 'distinct_equipment', 60, 177, 'aluno'),
  ('corpo-todo-todo-dia', 'Corpo todo, todo dia', 'Trabalhou 7 grupos musculares num só treino.', '🧩', 'Grupos extremos', 'ouro', true, 'max_groups_session', 7, 178, 'aluno'),
  ('coracao-de-atleta', 'Coração de atleta', 'Fez cardio em 250 treinos.', '❤️‍🔥', 'Cardio extremo', 'platina', true, 'cardio_sessions', 250, 179, 'aluno'),
  ('esteira-e-vida', 'Esteira é vida', 'Fez cardio em 50 treinos.', '🏃‍♀️', 'Cardio extremo', 'ouro', true, 'cardio_sessions', 50, 180, 'aluno'),
  ('cardio-virou-habito', 'Cardio virou hábito', 'Fez cardio em 5 treinos.', '🚴', 'Cardio extremo', 'bronze', true, 'cardio_sessions', 5, 181, 'aluno'),
  ('chuva-de-recordes', 'Chuva de recordes', 'Bateu 8 recordes num só treino.', '🌧️', 'Recordes extremos', 'platina', true, 'prs_session_max', 8, 182, 'aluno'),
  ('fake-natty', 'Fake Natty', 'Bateu 75 recordes pessoais. Tá evoluindo tão rápido que já estão desconfiando!', '🧐', 'Memes', 'prata', true, 'prs_total', 75, 183, 'aluno'),
  ('maquina-de-pr', 'Máquina de PR', 'Bateu 150 recordes pessoais.', '🤖', 'Recordes extremos', 'ouro', true, 'prs_total', 150, 184, 'aluno'),
  ('dia-de-gloria', 'Dia de glória', 'Bateu 4 recordes num só treino.', '🌈', 'Recordes extremos', 'prata', true, 'prs_session_max', 4, 185, 'aluno'),
  ('menos-20', 'Menos 20', 'Perdeu 20 kg desde a primeira pesagem.', '🎉', 'Peso extremo', 'platina', true, 'weight_lost', 20, 186, 'aluno'),
  ('menos-15', 'Menos 15', 'Perdeu 15 kg desde a primeira pesagem.', '🥳', 'Peso extremo', 'ouro', true, 'weight_lost', 15, 187, 'aluno'),
  ('um-ano-de-balanca', 'Um ano de balança', 'Registrou o peso 52 vezes.', '📆', 'Peso extremo', 'ouro', true, 'weighins', 52, 188, 'aluno'),
  ('sai-de-casa-comi-pra-caralho', 'Saí de casa, comi pra caralho', 'Ganhou 3 kg desde a primeira pesagem. Bulking raiz!', '🍗', 'Memes', 'bronze', true, 'weight_gained', 3, 189, 'aluno'),
  ('critico-de-academia', 'Crítico de academia', 'Avaliou 100 treinos.', '🧐', 'Rotina extrema', 'ouro', true, 'rated', 100, 190, 'aluno'),
  ('ficha-e-lei', 'Ficha é lei', 'Fez 100 treinos pela ficha.', '📕', 'Rotina extrema', 'ouro', true, 'plan_sessions', 100, 191, 'aluno'),
  ('espirito-livre', 'Espírito livre', 'Fez 50 treinos livres.', '🦅', 'Rotina extrema', 'ouro', true, 'free_sessions', 50, 192, 'aluno'),
  ('perfeccionista', 'Perfeccionista', 'Completou 100 treinos com todas as séries feitas.', '💎', 'Rotina extrema', 'ouro', true, 'full_sessions', 100, 193, 'aluno'),
  ('registrado-pelo-personal', 'Registrado pelo Personal', 'Teve um treino registrado pelo seu Personal.', '🧑‍🏫', 'Rotina extrema', 'bronze', true, 'instructor_sessions', 1, 194, 'aluno'),
  ('aluno-exemplar', 'Aluno exemplar', 'Teve 20 treinos registrados pelo Personal.', '🍎', 'Rotina extrema', 'prata', true, 'instructor_sessions', 20, 195, 'aluno'),
  ('esforco-maximo-sempre', 'Esforço máximo, sempre', 'Marcou esforço máximo em 10 treinos.', '🥵', 'Rotina extrema', 'ouro', true, 'effort5', 10, 196, 'aluno'),
  ('teste-de-forca-em-serie', 'Teste de força em série', 'Fez 10 séries de 1 repetição com carga.', '🧪', 'Rotina extrema', 'prata', true, 'single_rep_sets', 10, 197, 'aluno'),
  ('queimacao-infinita', 'Queimação infinita', 'Fez 200 séries com 20 repetições ou mais.', '🌋', 'Rotina extrema', 'ouro', true, 'high_rep_sets', 200, 198, 'aluno'),
  ('cinquenta-mil-reps', 'Cinquenta mil reps', 'Somou 50.000 repetições.', '🌀', 'Rotina extrema', 'platina', true, 'reps_total', 50000, 199, 'aluno'),
  ('mestre-dos-dois-turnos', 'Mestre dos dois turnos', 'Treinou duas vezes no mesmo dia em 20 dias.', '🌓', 'Rotina extrema', 'platina', true, 'double_days', 20, 200, 'aluno'),
  ('primeiro-aluno', 'Primeiro aluno', 'Tenha seu primeiro aluno no BoraTreinar.', '🧑‍🎓', 'Alunos', 'bronze', false, 'p_students', 1, 201, 'personal'),
  ('turma-formada', 'Turma formada', 'Acompanhe 5 alunos ao mesmo tempo.', '👥', 'Alunos', 'bronze', false, 'p_students', 5, 202, 'personal'),
  ('professor-de-verdade', 'Professor de verdade', 'Acompanhe 10 alunos ao mesmo tempo.', '🧑‍🏫', 'Alunos', 'prata', false, 'p_students', 10, 203, 'personal'),
  ('academia-lotada', 'Academia lotada', 'Acompanhe 25 alunos ao mesmo tempo.', '🏟️', 'Alunos', 'ouro', false, 'p_students', 25, 204, 'personal'),
  ('lenda-das-academias', 'Lenda das academias', 'Acompanhe 50 alunos ao mesmo tempo.', '👑', 'Alunos', 'platina', false, 'p_students', 50, 205, 'personal'),
  ('convite-enviado', 'Convite enviado', 'Gere seu primeiro link de convite.', '✉️', 'Alunos', 'bronze', false, 'p_invites', 1, 206, 'personal'),
  ('divulgador', 'Divulgador', 'Gere 10 links de convite.', '📣', 'Alunos', 'prata', false, 'p_invites', 10, 207, 'personal'),
  ('aluno-conquistado', 'Aluno conquistado', 'Um aluno aceitou seu pedido para acompanhá-lo.', '🤝', 'Alunos', 'bronze', false, 'p_links_accepted', 1, 208, 'personal'),
  ('vitrine-ligada', 'Vitrine ligada', 'Ative "Aparecer para novos alunos" no seu perfil.', '🪟', 'Alunos', 'bronze', false, 'p_listed', 1, 209, 'personal'),
  ('primeira-ficha', 'Primeira ficha', 'Monte a primeira ficha para um aluno.', '📋', 'Fichas', 'bronze', false, 'p_plans', 1, 210, 'personal'),
  ('montador-de-fichas', 'Montador de fichas', 'Monte 10 fichas para alunos.', '🛠️', 'Fichas', 'prata', false, 'p_plans', 10, 211, 'personal'),
  ('arquiteto-do-shape', 'Arquiteto do shape', 'Monte 50 fichas para alunos.', '📐', 'Fichas', 'ouro', false, 'p_plans', 50, 212, 'personal'),
  ('fabrica-de-fichas', 'Fábrica de fichas', 'Monte 100 fichas para alunos.', '🏭', 'Fichas', 'platina', false, 'p_plans', 100, 213, 'personal'),
  ('modelo-pronto', 'Modelo pronto', 'Crie seu primeiro modelo de treino.', '🧩', 'Fichas', 'bronze', false, 'p_templates', 1, 214, 'personal'),
  ('biblioteca-de-treinos', 'Biblioteca de treinos', 'Crie 10 modelos de treino.', '📚', 'Fichas', 'prata', false, 'p_templates', 10, 215, 'personal'),
  ('inventor-de-exercicio', 'Inventor de exercício', 'Cadastre um exercício novo.', '💡', 'Fichas', 'bronze', false, 'p_equipment', 1, 216, 'personal'),
  ('prancheta-na-mao', 'Prancheta na mão', 'Registre o treino de um aluno.', '📝', 'Registro de treinos', 'bronze', false, 'p_logged', 1, 217, 'personal'),
  ('escriba-da-maromba', 'Escriba da maromba', 'Registre 25 treinos de alunos.', '🖊️', 'Registro de treinos', 'prata', false, 'p_logged', 25, 218, 'personal'),
  ('secretario-do-shape', 'Secretário do shape', 'Registre 100 treinos de alunos.', '🗂️', 'Registro de treinos', 'ouro', false, 'p_logged', 100, 219, 'personal'),
  ('agenda-aberta', 'Agenda aberta', 'Agende sua primeira aula.', '📅', 'Agenda', 'bronze', false, 'p_classes', 1, 220, 'personal'),
  ('agenda-cheia', 'Agenda cheia', 'Agende 20 aulas.', '🗓️', 'Agenda', 'prata', false, 'p_classes', 20, 221, 'personal'),
  ('turma-ativa', 'Turma ativa', 'Seus alunos somam 50 treinos.', '🔥', 'Resultados dos alunos', 'prata', false, 'p_student_sessions', 50, 222, 'personal'),
  ('formando-monstros', 'Formando monstros', 'Seus alunos somam 500 treinos.', '🦍', 'Resultados dos alunos', 'ouro', false, 'p_student_sessions', 500, 223, 'personal'),
  ('fabrica-de-monstros', 'Fábrica de monstros', 'Seus alunos somam 2.000 treinos.', '🏭', 'Resultados dos alunos', 'platina', false, 'p_student_sessions', 2000, 224, 'personal'),
  ('treinador-de-recordes', 'Treinador de recordes', 'Seus alunos bateram 10 recordes pessoais.', '🏆', 'Resultados dos alunos', 'prata', false, 'p_student_prs', 10, 225, 'personal'),
  ('formador-de-aura', 'Formador de aura', 'Seus alunos bateram 100 recordes pessoais.', '✨', 'Resultados dos alunos', 'ouro', false, 'p_student_prs', 100, 226, 'personal'),
  ('tabela-de-precos', 'Tabela de preços', 'Crie seu primeiro pacote no Financeiro.', '🏷️', 'Financeiro', 'bronze', false, 'p_packages', 1, 227, 'personal'),
  ('primeiro-pix', 'Primeiro Pix', 'Marque o primeiro pagamento recebido.', '💸', 'Financeiro', 'bronze', false, 'p_paid', 1, 228, 'personal'),
  ('caixa-cheio', 'Caixa cheio', 'Marque 50 pagamentos recebidos.', '💰', 'Financeiro', 'ouro', false, 'p_paid', 50, 229, 'personal'),
  ('mes-de-ouro', 'Mês de ouro', 'Receba R$ 5.000 num mesmo mês.', '🥇', 'Financeiro', 'ouro', false, 'p_revenue_month', 5000, 230, 'personal');

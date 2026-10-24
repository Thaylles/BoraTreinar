-- ════════════════════════════════════════════════════════════════
-- Lembretes automáticos e renovação de ficha
--  • Lembrete do dia de treino (push): 1h antes da aula marcada pelo Personal ou, sem aula,
--    perto do horário em que o aluno costuma treinar ("Hoje é dia de LOWER 💪").
--    O aluno pode desligar (student_settings.training_reminders).
--  • Ficha vencendo: o Personal é avisado 3 dias antes do "válida até", com atalho para
--    renovar (duplicar e ajustar). Aluno sem Personal recebe o aviso ele mesmo.
--  • Resumo mensal: no dia 1º o aluno é avisado de que o resumo do mês anterior está pronto.
--  • Roda no próprio banco a cada 30 minutos (pg_cron), sem depender do cron da Vercel.
--  • training_summary passa a trazer a força estimada (1RM) de cada exercício.
-- ════════════════════════════════════════════════════════════════

alter table public.student_settings add column training_reminders boolean not null default true;
grant update (training_reminders) on public.student_settings to authenticated;

-- Lembretes já enviados (um por chave), para nunca repetir.
create table private.sent_reminders (
  key text primary key,
  created_at timestamptz not null default now()
);

/** Marca o lembrete como enviado; devolve false se ele já tinha sido enviado. */
create function private.claim_reminder(p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.sent_reminders (key) values (p_key) on conflict do nothing;
  return found;
end;
$$;
revoke execute on function private.claim_reminder(text) from public, anon, authenticated;

/** Próxima ficha do aluno: a que está há mais tempo sem treinar (como na tela inicial). */
create function private.next_plan_name(p_student uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.name
    from public.workout_plans p
    left join lateral (select max(ws.started_at) as last_at from public.workout_sessions ws where ws.plan_id = p.id) l on true
   where p.student_id = p_student and not p.is_template and p.archived_at is null
   order by l.last_at nulls first, p.name
   limit 1;
$$;
revoke execute on function private.next_plan_name(uuid) from public, anon, authenticated;

/**
 * Lembretes do dia de treino. Chamada a cada 30 min (pg_cron); idempotente.
 *  1. Aula hoje começando em até 75 min → "Hoje é dia de <ficha> 💪 · Aula às 18:00 com Nicolas".
 *  2. Sem aula hoje: dia da semana em que o aluno costuma treinar (2+ vezes nas últimas 4 semanas),
 *     ainda sem treino hoje → lembrete na hora antes do horário de costume (mediana dos inícios).
 */
create function public.training_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_now at time zone 'America/Sao_Paulo';
  v_today date := v_local::date;
  v_time time := v_local::time;
  v_dow smallint := extract(dow from v_local)::smallint;
  v_plan text;
  n int := 0;
  r record;
begin
  -- 1. Aulas de hoje
  for r in
    select s.id, s.student_id, s.start_time, split_part(p.full_name, ' ', 1) as personal
      from public.class_schedules s
      join public.profiles p on p.id = s.personal_id
      join public.personal_students ps
        on ps.personal_id = s.personal_id and ps.student_id = s.student_id and ps.status = 'ativo'
      left join public.student_settings st on st.student_id = s.student_id
     where s.weekday = v_dow
       and s.starts_on <= v_today and (s.ends_on is null or s.ends_on >= v_today)
       and not exists (select 1 from public.class_exceptions e where e.schedule_id = s.id and e.on_date = v_today)
       and s.start_time - v_time > interval '0' and s.start_time - v_time <= interval '75 minutes'
       and coalesce(st.training_reminders, true)
     order by s.start_time
  loop
    if private.claim_reminder('aula:' || r.id || ':' || v_today) then
      perform private.claim_reminder('treino:' || r.student_id || ':' || v_today);
      v_plan := private.next_plan_name(r.student_id);
      perform public.notify(r.student_id,
        case when v_plan is null then 'Hoje tem aula 💪' else 'Hoje é dia de ' || v_plan || ' 💪' end,
        'Aula às ' || to_char(r.start_time, 'HH24:MI') || ' com ' || r.personal || '. Bora!',
        '/aluno');
      n := n + 1;
    end if;
  end loop;

  -- 2. Horário de costume (treinos registrados na hora, das últimas 4 semanas)
  for r in
    with recent as (
      select ws.student_id,
             (ws.started_at at time zone 'America/Sao_Paulo') as local_start
        from public.workout_sessions ws
       where ws.started_at >= p_now - interval '28 days'
         and (ws.started_at at time zone 'America/Sao_Paulo')::date < v_today
         and ws.imported_from is null
         and ws.created_at < ws.finished_at + interval '1 hour'
    ), habit as (
      select student_id,
             make_interval(mins => (percentile_cont(0.5) within group (
               order by extract(hour from local_start) * 60 + extract(minute from local_start)))::int) as usual,
             count(*) filter (where extract(dow from local_start) = v_dow) as same_dow
        from recent
       group by student_id
      having count(*) >= 3
    )
    select h.student_id, (time '00:00' + h.usual) as usual_time
      from habit h
      join public.profiles pr on pr.id = h.student_id and pr.role = 'aluno'
      left join public.student_settings st on st.student_id = h.student_id
     where h.same_dow >= 2
       and coalesce(st.training_reminders, true)
       and (time '00:00' + h.usual) - v_time > interval '0'
       and (time '00:00' + h.usual) - v_time <= interval '60 minutes'
       and not exists (select 1 from public.workout_sessions ws
                        where ws.student_id = h.student_id
                          and (ws.started_at at time zone 'America/Sao_Paulo')::date = v_today)
  loop
    if private.claim_reminder('treino:' || r.student_id || ':' || v_today) then
      v_plan := private.next_plan_name(r.student_id);
      perform public.notify(r.student_id,
        case when v_plan is null then 'Hoje é dia de treino 💪' else 'Hoje é dia de ' || v_plan || ' 💪' end,
        'Você costuma treinar por volta das ' || to_char(r.usual_time, 'HH24:MI') || '. Partiu?',
        '/aluno');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.training_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.training_reminders(timestamptz) to service_role;

/**
 * Fichas que vencem nos próximos 3 dias (inclusive hoje): avisa os Personais ativos do aluno,
 * com link para renovar. Aluno sem Personal é avisado ele mesmo. Uma vez por ficha e data.
 */
create function public.expiring_plan_notices(p_date date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_personal uuid;
  v_sent boolean;
  v_when text;
  n int := 0;
begin
  for r in
    select p.id, p.name, p.valid_until, p.student_id, split_part(s.full_name, ' ', 1) as student
      from public.workout_plans p
      join public.profiles s on s.id = p.student_id
     where not p.is_template and p.archived_at is null
       and p.valid_until between p_date and p_date + 3
  loop
    if not private.claim_reminder('ficha:' || r.id || ':' || r.valid_until) then
      continue;
    end if;
    v_when := case r.valid_until - p_date when 0 then 'vence hoje' when 1 then 'vence amanhã'
              else 'vence em ' || (r.valid_until - p_date) || ' dias' end || ' (' || to_char(r.valid_until, 'DD/MM') || ')';
    v_sent := false;
    for v_personal in
      select ps.personal_id from public.personal_students ps
       where ps.student_id = r.student_id and ps.status = 'ativo' and ps.personal_id <> r.student_id
    loop
      perform public.notify(v_personal, '📋 Ficha vencendo: ' || r.name,
        'A ficha de ' || r.student || ' ' || v_when || '. Duplique e ajuste para o próximo ciclo.',
        '/personal/fichas/' || r.id || '?renovar=1');
      v_sent := true;
      n := n + 1;
    end loop;
    if not v_sent then
      perform public.notify(r.student_id, '📋 Sua ficha ' || r.name || ' ' || v_when,
        'Hora de montar o próximo ciclo de treino.', '/aluno/fichas/' || r.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expiring_plan_notices(date) from public, anon, authenticated;
grant execute on function public.expiring_plan_notices(date) to service_role;

/** Dia 1º: "Seu resumo de outubro chegou" para quem treinou no mês anterior. */
create function public.monthly_summary_notices(p_date date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  v_from date := (date_trunc('month', p_date) - interval '1 month')::date;
  v_to date := date_trunc('month', p_date)::date;
  r record;
  n int := 0;
begin
  for r in
    select ws.student_id, count(*) as total
      from public.workout_sessions ws
      join public.profiles p on p.id = ws.student_id and p.role = 'aluno'
     where (ws.started_at at time zone 'America/Sao_Paulo')::date >= v_from
       and (ws.started_at at time zone 'America/Sao_Paulo')::date < v_to
     group by ws.student_id
  loop
    if private.claim_reminder('resumo:' || r.student_id || ':' || to_char(v_from, 'YYYY-MM')) then
      perform public.notify(r.student_id, '📊 Seu resumo de ' || meses[extract(month from v_from)::int] || ' chegou',
        r.total || case when r.total = 1 then ' treino' else ' treinos' end || ' no mês. Veja seus recordes e compartilhe!',
        '/aluno/resumo?mes=' || to_char(v_from, 'YYYY-MM'));
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.monthly_summary_notices(date) from public, anon, authenticated;
grant execute on function public.monthly_summary_notices(date) to service_role;

/** Tarefa agendada: lembretes de treino; entre 8h e 21h, avisos de ficha vencendo e (dia 1º) do resumo do mês. */
create function public.run_scheduled_reminders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
  n int;
begin
  n := public.training_reminders(now());
  if v_local::time between time '08:00' and time '21:00' then
    n := n + public.expiring_plan_notices(v_local::date);
    if extract(day from v_local) = 1 then
      n := n + public.monthly_summary_notices(v_local::date);
    end if;
  end if;
  -- Limpeza: chaves com mais de 60 dias não servem mais.
  delete from private.sent_reminders where created_at < now() - interval '60 days';
  return n;
end;
$$;
revoke execute on function public.run_scheduled_reminders() from public, anon, authenticated;
grant execute on function public.run_scheduled_reminders() to service_role;

/**
 * Renovar ficha ("duplicar e ajustar"): cria a cópia para o mesmo aluno, sem data de validade
 * (o Personal define a nova ao ajustar), e arquiva a antiga quando ele pode editá-la.
 */
create function public.renew_workout_plan(p_plan uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  src public.workout_plans;
  v_new uuid;
begin
  select * into src from public.workout_plans where id = p_plan;
  if src.id is null or src.is_template or not public.is_linked_personal(src.student_id) then
    raise exception 'Ficha não encontrada' using errcode = '42501';
  end if;
  v_new := public.duplicate_workout_plan(p_plan, src.student_id, src.name);
  update public.workout_plans set valid_until = null where id = v_new;
  if public.can_edit_plan(p_plan) then
    update public.workout_plans set archived_at = now() where id = p_plan;
  end if;
  return v_new;
end;
$$;
revoke execute on function public.renew_workout_plan(uuid) from public, anon;
grant execute on function public.renew_workout_plan(uuid) to authenticated;

-- ─── Força estimada (1RM, fórmula de Epley) no resumo de treinos ─────────
-- Melhor série de 1 a 12 repetições: carga × (1 + reps/30).
create or replace function public.training_summary(p_student uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(s order by s->>'started_at'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', ws.id,
      'started_at', ws.started_at,
      'date', (ws.started_at at time zone 'America/Sao_Paulo')::date,
      'kind', ws.kind,
      'plan', ws.plan_name,
      'duration', ws.duration_seconds,
      'ex', coalesce((
        select jsonb_agg(jsonb_build_object(
          'e', x.equipment_id, 'max', x.max_load, 'vol', x.volume, 'sets', x.sets, 'reps', x.reps, 'pr', x.pr, 'rm', x.rm))
        from (
          select ss.equipment_id,
                 max(ss.load_kg) as max_load,
                 sum(ss.load_kg * ss.reps) as volume,
                 count(*) as sets,
                 sum(ss.reps) as reps,
                 bool_or(ss.is_pr) as pr,
                 round(max(case when ss.reps between 1 and 12 and ss.load_kg > 0
                                then ss.load_kg * (1 + ss.reps / 30.0) end), 1) as rm
          from public.session_sets ss
          where ss.session_id = ws.id and ss.done
          group by ss.equipment_id
        ) x
      ), '[]'::jsonb)
    ) as s
    from public.workout_sessions ws
    where ws.student_id = p_student
  ) t;
$$;

-- ─── Agendamento (Supabase): a cada 30 minutos ─────────
-- Fora do Supabase (ex.: testes locais) o pg_cron pode não existir; os lembretes só rodam com ele.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('lembretes-treino', '*/30 * * * *', 'select public.run_scheduled_reminders()');
  else
    raise notice 'pg_cron indisponível: lembretes automáticos desativados';
  end if;
exception when others then
  raise notice 'pg_cron não agendado: %', sqlerrm;
end $$;

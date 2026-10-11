-- Etapa 9: agregados do dashboard.
-- As funções são SECURITY INVOKER: o RLS de workout_sessions/session_sets decide o que cada um vê.
-- Retornam um único jsonb para não esbarrar no limite de linhas da API.

-- Resumo de todos os treinos de um aluno: um item por sessão, com os exercícios agregados.
create function public.training_summary(p_student uuid)
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
      'duration', ws.duration_seconds,
      'ex', coalesce((
        select jsonb_agg(jsonb_build_object(
          'e', x.equipment_id, 'max', x.max_load, 'vol', x.volume, 'sets', x.sets, 'reps', x.reps, 'pr', x.pr))
        from (
          select ss.equipment_id,
                 max(ss.load_kg) as max_load,
                 sum(ss.load_kg * ss.reps) as volume,
                 count(*) as sets,
                 sum(ss.reps) as reps,
                 bool_or(ss.is_pr) as pr
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

-- Visão geral (Personal): por aluno visível, treinos e volume desde p_since e o último treino.
create function public.training_overview(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', t.student_id, 'sessions', t.sessions, 'volume', t.volume, 'last_at', t.last_at)), '[]'::jsonb)
  from (
    select ws.student_id,
           count(*) filter (where ws.started_at >= p_since) as sessions,
           coalesce(sum(v.volume) filter (where ws.started_at >= p_since), 0) as volume,
           max(ws.started_at) as last_at
    from public.workout_sessions ws
    left join lateral (
      select sum(ss.load_kg * ss.reps) as volume
      from public.session_sets ss
      where ss.session_id = ws.id and ss.done
    ) v on true
    group by ws.student_id
  ) t;
$$;

revoke all on function public.training_summary(uuid) from public, anon;
revoke all on function public.training_overview(timestamptz) from public, anon;
grant execute on function public.training_summary(uuid) to authenticated;
grant execute on function public.training_overview(timestamptz) to authenticated;

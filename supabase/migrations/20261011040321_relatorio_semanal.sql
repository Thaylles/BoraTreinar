-- Etapa 10: relatório semanal (domingo, 22h).

-- Histórico de relatórios por Personal. Escrito só pelo servidor (service role); o Personal lê os seus.
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  content jsonb not null,
  ai_used boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (personal_id, week_start),
  check (extract(isodow from week_start) = 1)
);
create index weekly_reports_personal_idx on public.weekly_reports (personal_id, week_start desc);

alter table public.weekly_reports enable row level security;
create policy "relatórios: o próprio Personal" on public.weekly_reports
  for select to authenticated using (personal_id = (select auth.uid()));
revoke all on public.weekly_reports from anon, authenticated;
grant select on public.weekly_reports to authenticated;

-- O resumo de treinos passa a trazer o nome da ficha (o relatório lista quais fichas o aluno fez).
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

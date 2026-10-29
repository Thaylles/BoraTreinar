-- ════════════════════════════════════════════════════════════════
-- Meta de água por dia (cada pessoa define a sua: aluno ou Personal)
--  • water_settings: meta diária (ml) e se quer lembretes.
--  • water_logs: cada copo/garrafa registrada (na tela inicial ou durante o treino).
--  • Lembrete de 3 em 3 horas, das 8h às 20h (horário de Brasília, UTC−3), só para quem
--    tem meta, deixou os lembretes ligados e ainda não bateu a meta do dia.
-- ════════════════════════════════════════════════════════════════

create table public.water_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  daily_ml int not null check (daily_ml between 500 and 8000),
  reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.water_settings enable row level security;
revoke all on public.water_settings from anon;
create policy "água: a própria meta (ler)" on public.water_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "água: a própria meta (criar)" on public.water_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "água: a própria meta (editar)" on public.water_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ml int not null check (ml between 50 and 3000),
  logged_at timestamptz not null default now()
);
create index water_logs_user_idx on public.water_logs (user_id, logged_at desc);
alter table public.water_logs enable row level security;
revoke all on public.water_logs from anon;
revoke update on public.water_logs from authenticated;
create policy "água: os próprios registros (ler)" on public.water_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "água: os próprios registros (criar)" on public.water_logs
  for insert to authenticated with check (user_id = (select auth.uid()) and logged_at <= now() + interval '5 minutes');
create policy "água: os próprios registros (excluir)" on public.water_logs
  for delete to authenticated using (user_id = (select auth.uid()));

/**
 * Lembretes de água. Agendado (pg_cron) às 8h, 11h, 14h, 17h e 20h de Brasília; idempotente
 * (um por pessoa a cada horário). Só para quem ainda não bateu a meta do dia.
 */
create function public.water_reminders(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_local timestamp := p_now at time zone 'America/Sao_Paulo';
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local)::int;
  r record;
  n int := 0;
begin
  if v_hour < 8 or v_hour > 22 then
    return 0;
  end if;
  for r in
    select w.user_id, w.daily_ml, p.role,
           coalesce((select sum(l.ml) from public.water_logs l
                      where l.user_id = w.user_id
                        and (l.logged_at at time zone 'America/Sao_Paulo')::date = v_today), 0) as drank
      from public.water_settings w
      join public.profiles p on p.id = w.user_id
     where w.reminders and p.role in ('aluno', 'personal')
  loop
    continue when r.drank >= r.daily_ml;
    if private.claim_reminder('agua:' || r.user_id || ':' || v_today || ':' || v_hour) then
      perform public.notify(r.user_id, '💧 Hora de beber água',
        case when r.drank = 0 then 'Ainda sem água hoje. Meta: '
             else 'Hoje: ' || replace(to_char(r.drank / 1000.0, 'FM990.0'), '.', ',') || ' L de ' end
          || replace(to_char(r.daily_ml / 1000.0, 'FM990.0'), '.', ',') || ' L.',
        case when r.role = 'personal' then '/personal#agua' else '/aluno#agua' end);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function public.water_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.water_reminders(timestamptz) to service_role;

-- 8h, 11h, 14h, 17h e 20h em Brasília (UTC−3) = 11h, 14h, 17h, 20h e 23h UTC.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lembretes-agua', '0 11,14,17,20,23 * * *', 'select public.water_reminders()');
  else
    raise notice 'pg_cron indisponível: lembretes de água desativados';
  end if;
exception when others then
  raise notice 'pg_cron não agendado: %', sqlerrm;
end $$;

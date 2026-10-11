-- BoraTreinar: etapa 6 (peso corporal). Cole no Supabase → SQL Editor → Run.
begin;

create type public.weigh_in_frequency as enum ('semanal', 'quinzenal');

create table public.student_settings (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  -- Privacidade por padrão: o Personal só vê o peso se o aluno permitir.
  weight_visible_to_personal boolean not null default false,
  weigh_in_frequency public.weigh_in_frequency not null default 'semanal',
  updated_at timestamptz not null default now()
);
create trigger student_settings_updated_at before update on public.student_settings
  for each row execute function public.set_updated_at();

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  measured_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now(),
  -- Uma pesagem por dia (registrar de novo no mesmo dia substitui).
  unique (student_id, measured_on)
);
create index body_weights_student_idx on public.body_weights (student_id, measured_on desc);

create function public.body_weights_check_date() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.measured_on > v_today then
    raise exception 'A data da pesagem não pode ser no futuro' using errcode = 'P0001';
  end if;
  if new.measured_on < v_today - 365 then
    raise exception 'A data da pesagem é muito antiga' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger body_weights_check_date before insert or update on public.body_weights
  for each row execute function public.body_weights_check_date();

create function public.weigh_in_period_days(p_student uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case coalesce(
    (select weigh_in_frequency from public.student_settings where student_id = p_student), 'semanal')
    when 'quinzenal' then 14 else 7 end;
$$;

create function public.weigh_in_overdue(p_student uuid, p_on date) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select max(measured_on) from public.body_weights where student_id = p_student)
      + public.weigh_in_period_days(p_student) <= p_on,
    true);
$$;

create function public.weigh_in_status(p_student uuid)
returns table (frequency public.weigh_in_frequency, last_measured_on date, due_on date, overdue boolean)
language sql stable security definer set search_path = '' as $$
  with base as (
    select
      coalesce((select weigh_in_frequency from public.student_settings where student_id = p_student),
               'semanal'::public.weigh_in_frequency) as frequency,
      (select max(measured_on) from public.body_weights where student_id = p_student) as last_on,
      (now() at time zone 'America/Sao_Paulo')::date as today
  )
  select b.frequency, b.last_on,
         b.last_on + public.weigh_in_period_days(p_student),
         public.weigh_in_overdue(p_student, b.today)
  from base b
  where p_student = auth.uid() or public.is_linked_personal(p_student);
$$;

create function public.can_view_weight(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_student = auth.uid()
    or (public.is_linked_personal(p_student) and coalesce(
          (select weight_visible_to_personal from public.student_settings where student_id = p_student),
          false));
$$;

revoke execute on function
  public.weigh_in_period_days(uuid),
  public.weigh_in_overdue(uuid, date),
  public.weigh_in_status(uuid),
  public.can_view_weight(uuid)
from public, anon;
grant execute on function
  public.weigh_in_period_days(uuid),
  public.weigh_in_overdue(uuid, date),
  public.weigh_in_status(uuid),
  public.can_view_weight(uuid)
to authenticated;

create function public.enforce_weigh_in() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.logged_by = new.student_id
     and public.weigh_in_overdue(new.student_id, (new.started_at at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Pesagem vencida: registre seu peso antes de treinar' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_weigh_in() from public, anon, authenticated;
create trigger workout_sessions_enforce_weigh_in before insert on public.workout_sessions
  for each row execute function public.enforce_weigh_in();

alter table public.student_settings enable row level security;
alter table public.body_weights enable row level security;
revoke all on public.student_settings, public.body_weights from anon;
revoke update, truncate on public.student_settings, public.body_weights from authenticated;
grant update (weight_visible_to_personal, weigh_in_frequency) on public.student_settings to authenticated;
grant update (weight_kg) on public.body_weights to authenticated;

create policy "config: aluno lê as suas" on public.student_settings
  for select to authenticated using (student_id = (select auth.uid()));
create policy "config: Personal vinculado lê" on public.student_settings
  for select to authenticated using (public.is_linked_personal(student_id));
create policy "config: aluno cria as suas" on public.student_settings
  for insert to authenticated
  with check (student_id = (select auth.uid()) and public.current_role_is('aluno'));
create policy "config: aluno altera as suas" on public.student_settings
  for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));

create policy "peso: quem pode ver" on public.body_weights
  for select to authenticated using (public.can_view_weight(student_id));
create policy "peso: aluno registra" on public.body_weights
  for insert to authenticated
  with check (student_id = (select auth.uid()) and public.current_role_is('aluno'));
create policy "peso: aluno corrige" on public.body_weights
  for update to authenticated
  using (student_id = (select auth.uid())) with check (student_id = (select auth.uid()));
create policy "peso: aluno exclui" on public.body_weights
  for delete to authenticated using (student_id = (select auth.uid()));
insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261011030000', 'peso_corporal', '{}') on conflict (version) do nothing;
commit;

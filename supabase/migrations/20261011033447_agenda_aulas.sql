-- ════════════════════════════════════════════════════════════════
-- Etapa 8 — Agenda de aulas presenciais (recorrentes) com exceções
-- ════════════════════════════════════════════════════════════════

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- 0 = domingo … 6 = sábado (fuso America/Sao_Paulo)
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  duration_minutes int not null default 60 check (duration_minutes between 15 and 240),
  starts_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  ends_on date,
  notes text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index class_schedules_student_idx on public.class_schedules (student_id);
create index class_schedules_personal_idx on public.class_schedules (personal_id);

-- Datas canceladas de uma aula recorrente.
create table public.class_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  on_date date not null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (schedule_id, on_date)
);

create function public.can_manage_schedule(p_schedule uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_schedules s
    where s.id = p_schedule and s.personal_id = auth.uid() and public.is_linked_personal(s.student_id)
  );
$$;
create function public.can_view_schedule(p_schedule uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_schedules s
    where s.id = p_schedule and (s.student_id = auth.uid() or public.is_linked_personal(s.student_id))
  );
$$;
revoke execute on function public.can_manage_schedule(uuid), public.can_view_schedule(uuid) from public, anon;
grant execute on function public.can_manage_schedule(uuid), public.can_view_schedule(uuid) to authenticated;

-- ─── Avisos ao aluno ───────────────────────────────────────────
create function public.notify_class_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dias text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  s public.class_schedules;
  v_personal text;
begin
  if tg_table_name = 'class_schedules' then
    select full_name into v_personal from public.profiles where id = new.personal_id;
    perform public.notify(new.student_id, 'Nova aula agendada 📅',
      v_personal || ' marcou aula toda ' || dias[new.weekday + 1] || ' às ' || to_char(new.start_time, 'HH24:MI') || '.',
      '/aluno/aulas');
  else
    select * into s from public.class_schedules where id = new.schedule_id;
    select full_name into v_personal from public.profiles where id = s.personal_id;
    perform public.notify(s.student_id, 'Aula cancelada',
      'A aula de ' || to_char(new.on_date, 'DD/MM') || ' às ' || to_char(s.start_time, 'HH24:MI')
        || ' com ' || v_personal || ' foi cancelada' || coalesce(': ' || new.reason, '.'),
      '/aluno/aulas');
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_class_change() from public, anon, authenticated;
create trigger class_schedules_notify after insert on public.class_schedules
  for each row execute function public.notify_class_change();
create trigger class_exceptions_notify after insert on public.class_exceptions
  for each row execute function public.notify_class_change();

-- ─── RLS ───────────────────────────────────────────────────────
alter table public.class_schedules enable row level security;
alter table public.class_exceptions enable row level security;
revoke all on public.class_schedules, public.class_exceptions from anon;
revoke update, truncate on public.class_schedules, public.class_exceptions from authenticated;
grant update (start_time, duration_minutes, ends_on, notes) on public.class_schedules to authenticated;

create policy "aulas: aluno e Personais vinculados veem" on public.class_schedules
  for select to authenticated using (student_id = (select auth.uid()) or public.is_linked_personal(student_id));
create policy "aulas: Personal agenda para seus alunos" on public.class_schedules
  for insert to authenticated
  with check (personal_id = (select auth.uid()) and public.is_linked_personal(student_id));
create policy "aulas: Personal edita as suas" on public.class_schedules
  for update to authenticated
  using (personal_id = (select auth.uid()) and public.is_linked_personal(student_id))
  with check (personal_id = (select auth.uid()));
create policy "aulas: Personal remove as suas" on public.class_schedules
  for delete to authenticated using (personal_id = (select auth.uid()));

create policy "exceções: quem vê a aula" on public.class_exceptions
  for select to authenticated using (public.can_view_schedule(schedule_id));
create policy "exceções: Personal da aula cancela" on public.class_exceptions
  for insert to authenticated with check (public.can_manage_schedule(schedule_id));
create policy "exceções: Personal da aula desfaz" on public.class_exceptions
  for delete to authenticated using (public.can_manage_schedule(schedule_id));

-- ════════════════════════════════════════════════════════════════
-- Remarcar aulas (só o Personal da aula)
--  • Troca única: uma data vai para outro dia/horário. Na aula semanal, a data original
--    fica cancelada (exceção com rescheduled_to) e nasce uma aula única no novo horário.
--  • Troca recorrente: a partir de uma data, a aula semanal passa para outro dia/horário.
-- ════════════════════════════════════════════════════════════════

alter table public.class_exceptions
  add column rescheduled_to uuid references public.class_schedules (id) on delete set null;

/** Tira os avisos automáticos ("Aula agendada", "Aula cancelada"…) gerados nesta transação. */
create function private.drop_auto_class_notices(p_student uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.notifications
   where user_id = p_student and created_at = now()
     and title in ('Aula agendada 📅', 'Nova aula agendada 📅', 'Aula cancelada');
$$;
revoke execute on function private.drop_auto_class_notices(uuid) from public, anon, authenticated;

/**
 * Remarca uma única data de uma aula para outro dia e horário (de hoje até 60 dias).
 * Retorna o id da aula que passa a valer (a própria, se já era aula única).
 */
create function public.reschedule_class_once(p_schedule uuid, p_date date, p_new_date date, p_new_time time)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.class_schedules;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_new uuid;
  v_personal text;
  v_label text;
begin
  if not public.can_manage_schedule(p_schedule) then
    raise exception 'Aula não encontrada' using errcode = '42501';
  end if;
  select * into s from public.class_schedules where id = p_schedule;
  if p_date is null or p_new_date is null or p_new_time is null then
    raise exception 'Informe a nova data e o horário' using errcode = 'P0001';
  end if;
  if extract(dow from p_date)::smallint <> s.weekday or p_date < s.starts_on
     or (s.ends_on is not null and p_date > s.ends_on)
     or exists (select 1 from public.class_exceptions e where e.schedule_id = s.id and e.on_date = p_date) then
    raise exception 'Essa aula não acontece nessa data' using errcode = 'P0001';
  end if;
  if p_date < v_today then
    raise exception 'Essa aula já passou' using errcode = 'P0001';
  end if;
  if p_new_date < v_today or p_new_date > v_today + 60 then
    raise exception 'Escolha uma data entre hoje e os próximos 60 dias' using errcode = 'P0001';
  end if;
  if p_new_date = p_date and p_new_time = s.start_time then
    raise exception 'Escolha um dia ou horário diferente' using errcode = 'P0001';
  end if;

  if s.ends_on = s.starts_on then
    -- Aula única: só muda de lugar.
    update public.class_schedules
       set starts_on = p_new_date, ends_on = p_new_date,
           weekday = extract(dow from p_new_date)::smallint, start_time = p_new_time
     where id = s.id;
    v_new := s.id;
  else
    insert into public.class_schedules (personal_id, student_id, weekday, start_time, duration_minutes, starts_on, ends_on, notes)
      values (s.personal_id, s.student_id, extract(dow from p_new_date)::smallint, p_new_time, s.duration_minutes,
              p_new_date, p_new_date, s.notes)
      returning id into v_new;
    insert into public.class_exceptions (schedule_id, on_date, reason, rescheduled_to)
      values (s.id, p_date,
              'Remarcada para ' || to_char(p_new_date, 'DD/MM') || ' às ' || to_char(p_new_time, 'HH24:MI'), v_new);
  end if;

  perform private.drop_auto_class_notices(s.student_id);
  select full_name into v_personal from public.profiles where id = s.personal_id;
  v_label := to_char(p_new_date, 'DD/MM') || ' às ' || to_char(p_new_time, 'HH24:MI');
  perform public.notify(s.student_id, 'Aula remarcada 🔄',
    'A aula de ' || to_char(p_date, 'DD/MM') || ' às ' || to_char(s.start_time, 'HH24:MI') || ' com ' || v_personal
      || ' foi remarcada para ' || v_label || '.',
    '/aluno/aulas');
  return v_new;
end;
$$;

/**
 * Muda o dia e o horário de uma aula semanal a partir de uma data (inclusive).
 * As aulas antes dessa data ficam como estavam. Retorna o id da série que passa a valer.
 */
create function public.reschedule_class_series(p_schedule uuid, p_from date, p_weekday smallint, p_time time)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  dias text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  s public.class_schedules;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_new uuid;
  v_personal text;
begin
  if not public.can_manage_schedule(p_schedule) then
    raise exception 'Aula não encontrada' using errcode = '42501';
  end if;
  select * into s from public.class_schedules where id = p_schedule;
  if s.ends_on = s.starts_on then
    raise exception 'Aula única: use a remarcação só desta data' using errcode = 'P0001';
  end if;
  if p_from is null or p_weekday is null or p_weekday not between 0 and 6 or p_time is null then
    raise exception 'Informe o novo dia e o horário' using errcode = 'P0001';
  end if;
  if p_from < v_today then
    raise exception 'A mudança precisa valer a partir de hoje' using errcode = 'P0001';
  end if;
  if s.ends_on is not null and p_from > s.ends_on then
    raise exception 'Essa aula termina antes dessa data' using errcode = 'P0001';
  end if;
  if p_weekday = s.weekday and p_time = s.start_time then
    raise exception 'Escolha um dia ou horário diferente' using errcode = 'P0001';
  end if;

  if p_from <= s.starts_on then
    update public.class_schedules set weekday = p_weekday, start_time = p_time where id = s.id;
    v_new := s.id;
  else
    update public.class_schedules set ends_on = p_from - 1 where id = s.id;
    insert into public.class_schedules (personal_id, student_id, weekday, start_time, duration_minutes, starts_on, ends_on, notes)
      values (s.personal_id, s.student_id, p_weekday, p_time, s.duration_minutes, p_from, s.ends_on, s.notes)
      returning id into v_new;
  end if;

  perform private.drop_auto_class_notices(s.student_id);
  select full_name into v_personal from public.profiles where id = s.personal_id;
  perform public.notify(s.student_id, 'Horário das aulas alterado 🔄',
    'A partir de ' || to_char(greatest(p_from, s.starts_on), 'DD/MM') || ', as aulas com ' || v_personal
      || ' passam de ' || dias[s.weekday + 1] || ' às ' || to_char(s.start_time, 'HH24:MI')
      || ' para toda ' || dias[p_weekday + 1] || ' às ' || to_char(p_time, 'HH24:MI') || '.',
    '/aluno/aulas');
  return v_new;
end;
$$;

revoke execute on function public.reschedule_class_once(uuid, date, date, time),
  public.reschedule_class_series(uuid, date, smallint, time) from public, anon;
grant execute on function public.reschedule_class_once(uuid, date, date, time),
  public.reschedule_class_series(uuid, date, smallint, time) to authenticated;

-- Desfazer a remarcação (reativar a data original) apaga a aula que a substituía.
create function public.drop_rescheduled_class() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.class_schedules;
  v_personal text;
begin
  if old.rescheduled_to is not null then
    delete from public.class_schedules where id = old.rescheduled_to;
    -- Avisa o aluno, a não ser que a aula original inteira esteja sendo removida.
    select * into s from public.class_schedules where id = old.schedule_id;
    if s.id is not null then
      select full_name into v_personal from public.profiles where id = s.personal_id;
      perform public.notify(s.student_id, 'Remarcação desfeita',
        'A aula de ' || to_char(old.on_date, 'DD/MM') || ' com ' || v_personal || ' volta para o horário de sempre: '
          || to_char(s.start_time, 'HH24:MI') || '.',
        '/aluno/aulas');
    end if;
  end if;
  return old;
end;
$$;
revoke execute on function public.drop_rescheduled_class() from public, anon, authenticated;
create trigger class_exceptions_drop_rescheduled after delete on public.class_exceptions
  for each row execute function public.drop_rescheduled_class();

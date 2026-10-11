-- ════════════════════════════════════════════════════════════════
-- Aulas únicas + lembrete diário (7h) para o Personal
-- Aula única = class_schedules com starts_on = ends_on (mesmo dia da semana).
-- Aulas semanais seguem valendo todas as semanas até o Personal remover
-- o aluno da agenda ou cancelar uma data.
-- ════════════════════════════════════════════════════════════════

-- Aula única precisa cair no dia da semana informado.
alter table public.class_schedules
  add constraint class_schedules_single_weekday
  check (ends_on is distinct from starts_on or weekday = extract(dow from starts_on)::smallint);

-- Aviso ao aluno diferencia aula semanal de aula única.
create or replace function public.notify_class_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dias text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  s public.class_schedules;
  v_personal text;
begin
  if tg_table_name = 'class_schedules' then
    select full_name into v_personal from public.profiles where id = new.personal_id;
    if new.ends_on = new.starts_on then
      perform public.notify(new.student_id, 'Aula agendada 📅',
        v_personal || ' marcou uma aula em ' || to_char(new.starts_on, 'DD/MM') || ' às '
          || to_char(new.start_time, 'HH24:MI') || '.',
        '/aluno/aulas');
    else
      perform public.notify(new.student_id, 'Nova aula agendada 📅',
        v_personal || ' marcou aula toda ' || dias[new.weekday + 1] || ' às ' || to_char(new.start_time, 'HH24:MI') || '.',
        '/aluno/aulas');
    end if;
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

/**
 * Aulas do dia (fuso SP) agrupadas por Personal, já descontando datas canceladas e
 * vínculos encerrados. Cria uma notificação por Personal (idempotente: não repete no mesmo dia).
 * Retorna os dados para o envio do e-mail. Só o servidor (service_role) chama.
 */
create function public.daily_class_reminders(p_date date)
returns table (personal_id uuid, personal_name text, personal_email text, classes jsonb, notified boolean)
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_link text := '/personal/agenda?dia=' || p_date::text;
  v_count int;
  v_new boolean;
begin
  for r in
    select s.personal_id as pid, p.full_name as pname, p.email as pemail,
           jsonb_agg(jsonb_build_object(
             'time', to_char(s.start_time, 'HH24:MI'),
             'student_id', st.id,
             'student_name', st.full_name,
             'phone', st.phone
           ) order by s.start_time, st.full_name) as items
    from public.class_schedules s
    join public.profiles p on p.id = s.personal_id
    join public.profiles st on st.id = s.student_id
    join public.personal_students ps
      on ps.personal_id = s.personal_id and ps.student_id = s.student_id and ps.status = 'ativo'
    where s.weekday = extract(dow from p_date)::smallint
      and s.starts_on <= p_date
      and (s.ends_on is null or s.ends_on >= p_date)
      and not exists (select 1 from public.class_exceptions e where e.schedule_id = s.id and e.on_date = p_date)
    group by s.personal_id, p.full_name, p.email
  loop
    v_count := jsonb_array_length(r.items);
    v_new := not exists (
      select 1 from public.notifications n where n.user_id = r.pid and n.link = v_link
    );
    if v_new then
      perform public.notify(
        r.pid,
        'Bom dia! Hoje você tem ' || v_count || case when v_count = 1 then ' aula ☀️' else ' aulas ☀️' end,
        'Mande uma mensagem para confirmar: '
          || (select string_agg((i->>'time') || ' ' || split_part(i->>'student_name', ' ', 1), ', ')
              from jsonb_array_elements(r.items) i) || '.',
        v_link
      );
    end if;
    personal_id := r.pid;
    personal_name := r.pname;
    personal_email := r.pemail;
    classes := r.items;
    notified := v_new;
    return next;
  end loop;
end;
$$;
revoke execute on function public.daily_class_reminders(date) from public, anon, authenticated;
grant execute on function public.daily_class_reminders(date) to service_role;

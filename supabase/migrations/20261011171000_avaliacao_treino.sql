-- Avaliação do treino pelo aluno: esforço percebido (1 a 5), dor/desconforto e um comentário.
alter table public.workout_sessions
  add column effort smallint check (effort between 1 and 5),
  add column pain boolean not null default false,
  add column feedback text check (feedback is null or char_length(feedback) <= 500),
  add column rated_at timestamptz;

/**
 * O aluno avalia um treino seu (até 7 dias depois). Se relatar dor, os Personais
 * que o acompanham recebem uma notificação com o link do treino.
 */
create function public.rate_workout_session(p_session uuid, p_effort int, p_pain boolean, p_feedback text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.workout_sessions;
  v_name text;
  v_note text := nullif(trim(coalesce(p_feedback, '')), '');
begin
  select * into s from public.workout_sessions where id = p_session;
  if s.id is null or s.student_id is distinct from auth.uid() then
    raise exception 'Treino não encontrado' using errcode = '42501';
  end if;
  if p_effort is null or p_effort not between 1 and 5 then
    raise exception 'Escolha uma nota de 1 a 5' using errcode = 'P0001';
  end if;
  if s.finished_at < now() - interval '7 days' then
    raise exception 'Esse treino já não pode mais ser avaliado' using errcode = 'P0001';
  end if;

  update public.workout_sessions
     set effort = p_effort, pain = coalesce(p_pain, false), feedback = left(v_note, 500), rated_at = now()
   where id = p_session;

  -- Avisa sobre dor só uma vez por treino (na primeira avaliação com dor).
  if coalesce(p_pain, false) and not s.pain then
    select full_name into v_name from public.profiles where id = s.student_id;
    insert into public.notifications (user_id, title, body, link)
    select ps.personal_id,
           '⚠️ ' || split_part(v_name, ' ', 1) || ' relatou dor no treino',
           coalesce(s.plan_name, 'Treino livre') || coalesce(': "' || left(v_note, 140) || '"', '.'),
           '/personal/treinos/' || s.id
      from public.personal_students ps
     where ps.student_id = s.student_id and ps.status = 'ativo' and ps.archived_at is null;
  end if;
end;
$$;

revoke execute on function public.rate_workout_session(uuid, int, boolean, text) from public, anon;
grant execute on function public.rate_workout_session(uuid, int, boolean, text) to authenticated;

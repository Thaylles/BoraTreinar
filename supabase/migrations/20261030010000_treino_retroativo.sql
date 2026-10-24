-- ════════════════════════════════════════════════════════════════
-- Treino esquecido: o app registra treinos de até 7 dias atrás
--  • O aluno (ou o Personal) pode lançar um treino que esqueceu de registrar, com a data e o
--    horário em que aconteceu. Mais antigo que 7 dias (calendário de São Paulo) ou no futuro: recusado.
--  • Importações do Health Connect (feitas pelo servidor) e cargas internas não passam pela trava.
-- ════════════════════════════════════════════════════════════════

create function public.check_session_dates() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.imported_from is not null then
    return new;
  end if;
  if (new.started_at at time zone 'America/Sao_Paulo')::date
       < (now() at time zone 'America/Sao_Paulo')::date - 7 then
    raise exception 'Só dá para registrar treinos dos últimos 7 dias' using errcode = 'P0001';
  end if;
  if new.started_at > now() + interval '10 minutes' then
    raise exception 'A data do treino não pode ser no futuro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_session_dates() from public, anon, authenticated;
create trigger workout_sessions_check_dates before insert on public.workout_sessions
  for each row execute function public.check_session_dates();

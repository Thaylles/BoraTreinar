-- Notificações push no celular (Web Push).
-- Cada notificação criada no app (por função do banco ou pelo servidor) dispara um POST para
-- /api/push/dispatch, que envia o push aos aparelhos inscritos. A URL e o segredo ficam em
-- private.push_config (fora da API); sem essa linha, nada é enviado (ambiente local/testes).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke update, truncate on public.push_subscriptions from authenticated;
create policy "push: as próprias (ler)" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "push: as próprias (criar)" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "push: as próprias (excluir)" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.push_config (
  id boolean primary key default true check (id),
  dispatch_url text not null,
  secret text not null
);

-- pg_net pode não existir fora do Supabase (ex.: testes locais); o push só roda com ele.
do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'pg_net indisponível: push desativado';
end $$;

create function public.notify_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cfg private.push_config;
begin
  select * into cfg from private.push_config limit 1;
  if cfg.dispatch_url is null then
    return new;
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return new;
  end if;
  perform net.http_post(
    url := cfg.dispatch_url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('content-type', 'application/json', 'x-push-secret', cfg.secret)
  );
  return new;
exception when others then
  -- O push nunca impede a notificação de ser criada.
  raise warning 'push não enviado: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function public.notify_push() from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.notify_push();

-- "Seu Personal atualizou sua ficha": avisa o aluno quando uma ficha dele é criada ou salva
-- (no máximo um aviso por ficha a cada 10 minutos, para não repetir em edições seguidas).
create function public.notify_plan_saved() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_link text := '/aluno/fichas/' || new.id;
begin
  if new.student_id is null or new.is_template or new.archived_at is not null
     or new.created_by = new.student_id then
    return new;
  end if;
  if exists (select 1 from public.notifications
              where user_id = new.student_id and link = v_link and created_at > now() - interval '10 minutes') then
    return new;
  end if;
  insert into public.notifications (user_id, title, body, link)
  values (new.student_id,
          case when tg_op = 'INSERT' then '📋 Nova ficha: ' else '✏️ Ficha atualizada: ' end || new.name,
          'Seu Personal ' || case when tg_op = 'INSERT' then 'montou um treino novo para você.' else 'fez ajustes no seu treino.' end,
          v_link);
  return new;
end;
$$;
revoke execute on function public.notify_plan_saved() from public, anon, authenticated;

create trigger workout_plans_notify after insert or update of name, goal, notes, valid_until on public.workout_plans
  for each row execute function public.notify_plan_saved();

/**
 * Lembrete de inatividade (cron diário): alunos que treinaram nos últimos 30 dias, mas não
 * nos últimos 4, recebem "Faz X dias que você não treina" (no máximo um a cada 4 dias).
 */
create function public.inactivity_nudges() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  with last_session as (
    select student_id, max(started_at) as last_at
      from public.workout_sessions
     where started_at > now() - interval '30 days'
     group by student_id
  )
  insert into public.notifications (user_id, title, body, link)
  select l.student_id,
         '💪 Faz ' || extract(day from now() - l.last_at)::int || ' dias que você não treina',
         'Bora voltar? Abra sua ficha e mande ver hoje.',
         '/aluno'
    from last_session l
    join public.profiles p on p.id = l.student_id and p.role = 'aluno'
   where l.last_at < now() - interval '4 days'
     and not exists (select 1 from public.notifications x
                      where x.user_id = l.student_id and x.link = '/aluno' and x.title like '💪 Faz %'
                        and x.created_at > now() - interval '4 days');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.inactivity_nudges() from public, anon, authenticated;
grant execute on function public.inactivity_nudges() to service_role;

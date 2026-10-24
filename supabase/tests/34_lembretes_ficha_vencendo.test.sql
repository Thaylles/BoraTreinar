-- Lembretes do dia de treino, aviso de ficha vencendo, renovação e força estimada.
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email))::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALHOU: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create or replace function pg_temp.fails(sql text) returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.notes(p_email text, p_like text) returns bigint language sql as $$
  select count(*) from public.notifications n join auth.users u on u.id = n.user_id
   where u.email = p_email and n.title like p_like;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('lem.p@p.com', '{"role":"personal","full_name":"Paulo Lembrete"}'),
  ('lem.o@p.com', '{"role":"personal","full_name":"Olga Outra"}'),
  ('lem.a@a.com', '{"role":"aluno","full_name":"Ana Costume","phone":"11955550061","terms_accepted":true}'),
  ('lem.b@a.com', '{"role":"aluno","full_name":"Bruno Aula","phone":"11955550062","terms_accepted":true}'),
  ('lem.c@a.com', '{"role":"aluno","full_name":"Caio Quieto","phone":"11955550063","terms_accepted":true}');

-- d = amanhã (fuso SP): o dia simulado dos lembretes
create temp table t as select
  (select id from auth.users where email = 'lem.p@p.com') as pers,
  (select id from auth.users where email = 'lem.a@a.com') as ana,
  (select id from auth.users where email = 'lem.b@a.com') as bruno,
  (select id from auth.users where email = 'lem.c@a.com') as caio,
  (now() at time zone 'America/Sao_Paulo')::date as hoje,
  (now() at time zone 'America/Sao_Paulo')::date + 1 as d;
grant all on t to authenticated;

create or replace function pg_temp.em(p_date date, p_time time) returns timestamptz language sql as $$
  select (p_date + p_time) at time zone 'America/Sao_Paulo';
$$;

reset role;
select set_config('request.jwt.claims', '{}', false);
insert into public.personal_students (personal_id, student_id, role) select pers, bruno, 'responsavel' from t;
insert into public.workout_plans (student_id, created_by, name) select bruno, pers, 'LOWER' from t;
insert into public.workout_plans (student_id, created_by, name) select bruno, pers, 'UPPER' from t;
insert into public.workout_plans (student_id, created_by, name) select ana, ana, 'Full body' from t;

-- Ana e Caio treinaram às 7h no mesmo dia da semana nas 3 últimas semanas (registrados na hora).
insert into public.workout_sessions (client_id, student_id, kind, started_at, finished_at, created_at)
select gen_random_uuid(), u.id, 'livre', pg_temp.em(t.d - k * 7, '07:00'), pg_temp.em(t.d - k * 7, '07:50'), pg_temp.em(t.d - k * 7, '07:50')
  from t, generate_series(1, 3) k, (select ana as id from t union all select caio from t) u;
insert into public.student_settings (student_id, training_reminders) select caio, false from t;

-- Bruno tem aula toda semana no dia d, às 18h.
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on)
  select pers, bruno, extract(dow from d)::smallint, '18:00', hoje from t;

-- ─── Lembrete pelo horário de costume ────────────────────────
select public.training_reminders(pg_temp.em((select d from t), '05:30'));
select pg_temp.assert(pg_temp.notes('lem.a@a.com', 'Hoje é dia de%') = 0, 'cedo demais: sem lembrete');
select public.training_reminders(pg_temp.em((select d from t), '06:30'));
select pg_temp.assert(pg_temp.notes('lem.a@a.com', 'Hoje é dia de Full body 💪') = 1, 'lembrete 1h antes do horário de costume, com a ficha');
select pg_temp.assert((select body from public.notifications n where n.user_id = (select ana from t) and n.title like 'Hoje é dia de%')
  like '%por volta das 07:00%', 'mensagem traz o horário de costume');
select public.training_reminders(pg_temp.em((select d from t), '06:45'));
select pg_temp.assert(pg_temp.notes('lem.a@a.com', 'Hoje é dia de%') = 1, 'não repete o lembrete');
select pg_temp.assert(pg_temp.notes('lem.c@a.com', 'Hoje é dia de%') = 0, 'aluno que desligou não recebe');
select public.training_reminders(pg_temp.em((select d + 1 from t), '06:30'));
select pg_temp.assert(pg_temp.notes('lem.a@a.com', 'Hoje é dia de%') = 1, 'dia da semana sem costume: sem lembrete');

-- ─── Lembrete da aula ────────────────────────────────────────
select public.training_reminders(pg_temp.em((select d from t), '16:30'));
select pg_temp.assert(pg_temp.notes('lem.b@a.com', 'Hoje é dia de%') = 0, 'aula daqui a 1h30: ainda não');
select public.training_reminders(pg_temp.em((select d from t), '17:00'));
select pg_temp.assert(pg_temp.notes('lem.b@a.com', 'Hoje é dia de LOWER 💪') = 1, 'lembrete 1h antes da aula, com a próxima ficha');
select pg_temp.assert((select body from public.notifications n where n.user_id = (select bruno from t) and n.title like 'Hoje é dia de%')
  = 'Aula às 18:00 com Paulo. Bora!', 'mensagem da aula');
select public.training_reminders(pg_temp.em((select d from t), '17:30'));
select pg_temp.assert(pg_temp.notes('lem.b@a.com', 'Hoje é dia de%') = 1, 'aula: não repete');
insert into public.class_exceptions (schedule_id, on_date)
  select id, (select d + 7 from t) from public.class_schedules where student_id = (select bruno from t);
select public.training_reminders(pg_temp.em((select d + 7 from t), '17:00'));
select pg_temp.assert(pg_temp.notes('lem.b@a.com', 'Hoje é dia de%') = 1, 'aula cancelada: sem lembrete');

-- ─── Ficha vencendo ──────────────────────────────────────────
update public.workout_plans set valid_until = (select hoje + 3 from t) where name = 'LOWER' and student_id = (select bruno from t);
update public.workout_plans set valid_until = (select hoje + 1 from t) where student_id = (select ana from t);
update public.workout_plans set valid_until = (select hoje + 4 from t) where name = 'UPPER' and student_id = (select bruno from t);
select public.expiring_plan_notices((select hoje from t));
select pg_temp.assert(pg_temp.notes('lem.p@p.com', '📋 Ficha vencendo: LOWER') = 1, 'Personal é avisado 3 dias antes');
select pg_temp.assert((select link from public.notifications where user_id = (select pers from t) and title like '📋 Ficha vencendo%')
  like '/personal/fichas/%?renovar=1', 'aviso leva ao atalho de renovar');
select pg_temp.assert(pg_temp.notes('lem.p@p.com', '📋 Ficha vencendo: UPPER') = 0, 'ficha que vence em 4 dias ainda não');
select pg_temp.assert(pg_temp.notes('lem.a@a.com', '📋 Sua ficha Full body vence amanhã%') = 1, 'aluno sem Personal é avisado ele mesmo');
select public.expiring_plan_notices((select hoje from t));
select pg_temp.assert(pg_temp.notes('lem.p@p.com', '📋 Ficha vencendo%') = 1, 'aviso de ficha não repete');
select pg_temp.assert(public.run_scheduled_reminders() >= 0, 'tarefa agendada roda');

-- ─── Resumo do mês (dia 1º) ──────────────────────────────────
select public.monthly_summary_notices((date_trunc('month', (select d from t) - 7) + interval '1 month')::date);
select pg_temp.assert(pg_temp.notes('lem.a@a.com', '📊 Seu resumo de %') = 1, 'aviso do resumo do mês para quem treinou');
select pg_temp.assert((select link from public.notifications where user_id = (select ana from t) and title like '📊%')
  = '/aluno/resumo?mes=' || to_char((select d from t) - 7, 'YYYY-MM'), 'aviso leva ao resumo do mês certo');
select public.monthly_summary_notices((date_trunc('month', (select d from t) - 7) + interval '1 month')::date);
select pg_temp.assert(pg_temp.notes('lem.a@a.com', '📊 Seu resumo de %') = 1, 'resumo do mês não repete');
select pg_temp.assert(pg_temp.notes('lem.b@a.com', '📊 Seu resumo de %') = 0, 'quem não treinou não recebe resumo');

-- ─── Renovar (duplicar e ajustar) ────────────────────────────
create temp table t_old as select id from public.workout_plans where name = 'LOWER' and student_id = (select bruno from t);
grant all on t_old to authenticated;
select pg_temp.as_user('lem.o@p.com');
select pg_temp.assert(pg_temp.fails($$select public.renew_workout_plan((select id from t_old))$$), 'outro Personal não renova');
select pg_temp.as_user('lem.p@p.com');
create temp table t_new as select public.renew_workout_plan((select id from t_old)) as id;
select pg_temp.assert((select archived_at is not null from public.workout_plans where id = (select id from t_old)), 'ficha antiga arquivada');
select pg_temp.assert((select name = 'LOWER' and valid_until is null and archived_at is null and student_id = (select bruno from t)
  from public.workout_plans where id = (select id from t_new)), 'cópia ativa, mesmo nome, sem validade');
select pg_temp.as_user('lem.b@a.com');
select pg_temp.assert(pg_temp.fails($$select public.renew_workout_plan((select id from t_old))$$), 'aluno não usa a renovação');

-- ─── Força estimada no resumo ────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{}', false);
insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done)
select (select id from public.workout_sessions where student_id = (select ana from t) order by started_at desc limit 1),
       (select id from public.equipment order by name limit 1), 1, s, l, r, true
  from (values (1, 100, 10), (2, 110, 3), (3, 60, 20)) v(s, l, r);
select pg_temp.assert((select (x->>'rm')::numeric from jsonb_array_elements(public.training_summary((select ana from t))) s,
  jsonb_array_elements(s->'ex') x limit 1) = 133.3, '1RM estimado = melhor série de até 12 reps (Epley)');
select pg_temp.assert(pg_temp.fails($$select public.training_reminders()$$) = false, 'lembretes rodam com a hora atual');
set role authenticated;
select pg_temp.assert(pg_temp.fails($$select public.training_reminders()$$), 'usuário comum não dispara lembretes');
reset role;
\echo '✅ Todos os testes de lembretes e ficha vencendo passaram'

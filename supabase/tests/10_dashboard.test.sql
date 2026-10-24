-- Testes dos agregados do dashboard (etapa 9).
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

create or replace function pg_temp.eq(p_name text) returns uuid language sql as $$
  select id from public.equipment where name = p_name limit 1
$$;

-- Cenário: Dora (Personal) com a aluna Eva; Fábio é Personal sem vínculo; Gil é outro aluno de Fábio.
insert into auth.users (email, raw_user_meta_data) values
  ('dora@p.com', '{"role":"personal","full_name":"Dora Personal"}'),
  ('fabio@p.com', '{"role":"personal","full_name":"Fábio Personal"}');
select pg_temp.as_user('dora@p.com');
create temp table d_i1 as select * from public.create_invite(7, null);
grant all on d_i1 to authenticated;
select pg_temp.as_user('fabio@p.com');
create temp table d_i2 as select * from public.create_invite(7, null);
grant all on d_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'eva@a.com', jsonb_build_object('role','aluno','full_name','Eva Aluna',
  'phone','11955554444','invite_token', token, 'terms_accepted', true) from d_i1;
insert into auth.users (email, raw_user_meta_data)
select 'gil@a.com', jsonb_build_object('role','aluno','full_name','Gil Aluno',
  'phone','11955553333','invite_token', token, 'terms_accepted', true) from d_i2;
create temp table d_ids as select (select id from auth.users where email = 'eva@a.com') as eva;
grant all on d_ids to authenticated;

create or replace function pg_temp.treino(p_client uuid, p_load numeric, p_days_ago int) returns jsonb language sql as $$
  select public.save_workout_session(jsonb_build_object(
    'client_id', p_client, 'student_id', (select eva from d_ids), 'kind', 'livre',
    'started_at', now() - make_interval(days => p_days_ago) - interval '1 hour',
    'finished_at', now() - make_interval(days => p_days_ago),
    'exercises', jsonb_build_array(
      jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'sets', jsonb_build_array(
        jsonb_build_object('load_kg', p_load, 'reps', 10, 'done', true),
        jsonb_build_object('load_kg', p_load, 'reps', 10, 'done', true),
        jsonb_build_object('load_kg', 200, 'reps', 1, 'done', false))))))
$$;

select pg_temp.as_user('eva@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 60);
select pg_temp.treino('00000000-0000-0000-0000-0000000000d1', 20, 0);
-- Treino de 8 dias atrás (o app só registra até 7 dias; aqui a data é ajustada direto no banco).
reset role;
update public.workout_sessions set started_at = now() - interval '8 days 1 hour', finished_at = now() - interval '8 days'
 where client_id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.as_user('eva@a.com');
select pg_temp.treino('00000000-0000-0000-0000-0000000000d2', 25, 1);

create temp table d_sum as select public.training_summary(auth.uid()) as j;
grant all on d_sum to authenticated;
select pg_temp.assert(jsonb_array_length((select j from d_sum)) = 2, 'aluna vê o resumo dos próprios treinos');
select pg_temp.assert(((select j from d_sum)->1->'ex'->0->>'max')::numeric = 25, 'carga máxima só das séries feitas');
select pg_temp.assert(((select j from d_sum)->1->'ex'->0->>'vol')::numeric = 500, 'volume = séries feitas × reps × carga');
select pg_temp.assert(((select j from d_sum)->1->'ex'->0->>'sets')::int = 2, 'conta só séries feitas');
select pg_temp.assert(((select j from d_sum)->0->>'started_at') < ((select j from d_sum)->1->>'started_at'), 'ordenado por data');
select pg_temp.assert(((select j from d_sum)->1->>'date') = to_char((now() - interval '1 day 1 hour') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
  'data no fuso de São Paulo');

select pg_temp.as_user('dora@p.com');
select pg_temp.assert(jsonb_array_length(public.training_summary((select eva from d_ids))) = 2, 'Personal vinculada vê o resumo');
create temp table d_ov as select public.training_overview(now() - interval '7 days') as j;
grant all on d_ov to authenticated;
select pg_temp.assert(jsonb_array_length((select j from d_ov)) = 1, 'visão geral só com alunos visíveis');
select pg_temp.assert(((select j from d_ov)->0->>'sessions')::int = 1, 'visão geral conta treinos do período');
select pg_temp.assert(((select j from d_ov)->0->>'volume')::numeric = 500, 'visão geral soma o volume do período');
select pg_temp.assert(((select j from d_ov)->0->>'last_at') is not null, 'visão geral traz o último treino');

select pg_temp.as_user('fabio@p.com');
select pg_temp.assert(public.training_summary((select eva from d_ids)) = '[]'::jsonb, 'Personal sem vínculo não vê o resumo');
select pg_temp.assert(public.training_overview(now() - interval '30 days') = '[]'::jsonb, 'Personal sem alunos com treino: visão vazia');

select pg_temp.as_user('gil@a.com');
select pg_temp.assert(public.training_summary((select eva from d_ids)) = '[]'::jsonb, 'outro aluno não vê o resumo');

reset role;
set role anon;
select pg_temp.assert((select count(*) from information_schema.routine_privileges
  where routine_name = 'training_summary' and grantee in ('anon', 'PUBLIC')) = 0, 'anon não executa');
reset role;
\echo '✅ Todos os testes do dashboard passaram'

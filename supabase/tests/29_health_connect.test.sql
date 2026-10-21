-- Health Connect: tokens do app e importação de atividades.
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
insert into auth.users (email, raw_user_meta_data) values
  ('hc.a@a.com', '{"role":"aluno","full_name":"Alice Corre","phone":"11955550051","terms_accepted":true}'),
  ('hc.b@a.com', '{"role":"aluno","full_name":"Bruno Outro","phone":"11955550052","terms_accepted":true}');
create temp table c as select (select id from auth.users where email = 'hc.a@a.com') as alice;
grant all on c to authenticated;

-- Tokens
select pg_temp.as_user('hc.a@a.com');
insert into public.app_tokens (token_hash) values (repeat('a', 64));
select pg_temp.assert((select count(*) from public.app_tokens) = 1, 'aluno cria o token do app');
select pg_temp.assert(pg_temp.fails($$insert into public.app_tokens (user_id, token_hash) select id, repeat('b', 64) from auth.users where email = 'hc.b@a.com'$$), 'não cria token para outra pessoa');
select pg_temp.assert(pg_temp.fails($$update public.app_tokens set last_imported = 9$$), 'não altera o token');
select pg_temp.assert(pg_temp.fails($$select public.import_health_sessions(auth.uid(), '[]')$$), 'aluno não chama a importação direto');
select pg_temp.as_user('hc.b@a.com');
select pg_temp.assert(not exists (select 1 from public.app_tokens), 'outro aluno não vê o token');
delete from public.app_tokens;
reset role;
select pg_temp.assert((select count(*) from public.app_tokens) = 1, 'outro aluno não revoga');

-- Importação (servidor)
select pg_temp.assert(public.import_health_sessions((select alice from c), jsonb_build_array(
  jsonb_build_object('id', 'run-1', 'category', 'corrida', 'start', '2026-10-20T10:00:00Z', 'end', '2026-10-20T10:30:00Z',
                     'distance_m', 5000, 'origin', 'Samsung Health'),
  jsonb_build_object('id', 'gym-1', 'category', 'musculacao', 'start', '2026-10-19T18:00:00Z', 'end', '2026-10-19T19:00:00Z'),
  jsonb_build_object('id', 'bad-1', 'category', 'corrida', 'start', '2026-10-20T10:00:00Z', 'end', '2026-10-20T09:00:00Z'),
  jsonb_build_object('id', 'fut-1', 'category', 'corrida', 'start', now() + interval '1 day', 'end', now() + interval '1 day 1 hour'),
  jsonb_build_object('id', 'x', 'category', 'corrida', 'start', 'abc', 'end', 'def')
)) = 2, 'importa só as atividades válidas');
select pg_temp.assert(public.import_health_sessions((select alice from c), jsonb_build_array(
  jsonb_build_object('id', 'run-1', 'category', 'corrida', 'start', '2026-10-20T10:00:00Z', 'end', '2026-10-20T10:30:00Z')
)) = 0, 'atividade repetida é ignorada');
select pg_temp.assert((select s.plan_name || '|' || s.source_app || '|' || e.name || '|' || ss.duration_min || '|' || ss.distance_km || '|' || ss.speed_kmh
  from public.workout_sessions s join public.session_sets ss on ss.session_id = s.id join public.equipment e on e.id = ss.equipment_id
  where s.student_id = (select alice from c) and s.imported_from = 'health_connect') = 'Corrida ao ar livre|Samsung Health|Corrida ao ar livre|30.0|5.00|10.0',
  'corrida vira cardio com tempo, distância e velocidade média');
select pg_temp.assert((select count(*) from public.workout_sessions s where s.student_id = (select alice from c) and s.plan_name = 'Musculação'
  and not exists (select 1 from public.session_sets ss where ss.session_id = s.id)) = 1, 'musculação entra sem séries');
select pg_temp.as_user('hc.a@a.com');
select pg_temp.assert((public.cardio_week((select alice from c), date '2026-10-20')->>'km')::numeric = 5, 'conta na semana de cardio');
reset role;
\echo ✅ Todos os testes de Health Connect passaram

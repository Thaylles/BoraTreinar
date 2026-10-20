-- Exercícios substitutos: indicação na ficha, duplicação e troca registrada no treino.
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

create or replace function pg_temp.eq(p_name text) returns uuid language sql as $$
  select id from public.equipment where name = p_name limit 1
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('sub.p@p.com', '{"role":"personal","full_name":"Paulo Subs"}'),
  ('sub.a@a.com', '{"role":"aluno","full_name":"Ana Subs","phone":"11966660001","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'sub.p@p.com') as paulo,
  (select id from auth.users where email = 'sub.a@a.com') as ana;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paulo from c), (select ana from c), 'responsavel');

select pg_temp.as_user('sub.p@p.com');
create temp table plan as select public.save_workout_plan(null, (select ana from c), 'Treino A', null, null, null, jsonb_build_array(
  jsonb_build_object('equipment_id', pg_temp.eq('Leg press 45°'), 'sets', 3, 'reps_min', 10, 'reps_max', 12,
                     'substitute_equipment_id', pg_temp.eq('Agachamento hack')),
  jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'sets', 3, 'substitute_equipment_id', pg_temp.eq('Supino reto com barra')),
  jsonb_build_object('equipment_id', pg_temp.eq('Cadeira extensora'), 'sets', 3))) as id;
select pg_temp.assert((select substitute_equipment_id from public.workout_plan_items where plan_id = (select id from plan) and position = 1) = pg_temp.eq('Agachamento hack'),
  'Personal indica substituto');
select pg_temp.assert((select substitute_equipment_id is null from public.workout_plan_items where plan_id = (select id from plan) and position = 2),
  'substituto igual ao exercício é ignorado');
create temp table dup as select public.duplicate_workout_plan((select id from plan), null, 'Modelo A') as id;
select pg_temp.assert((select substitute_equipment_id from public.workout_plan_items where plan_id = (select id from dup) and position = 1)
  = pg_temp.eq('Agachamento hack'), 'duplicar mantém o substituto');
reset role;
select pg_temp.as_user('sub.p@p.com');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, (select ana from c), 'X', null, null, null, jsonb_build_array(
  jsonb_build_object('equipment_id', pg_temp.eq('Leg press 45°'), 'substitute_equipment_id', gen_random_uuid())))$$),
  'substituto inexistente é recusado');

-- A aluna troca o leg press (ocupado) pelo hack: a série fica no hack, marcando o original
select pg_temp.as_user('sub.a@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 60);
select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'ficha', 'plan_id', (select id from plan),
  'started_at', now() - interval '40 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Agachamento hack'), 'sets', jsonb_build_array(
      jsonb_build_object('load_kg', 60, 'reps', 10, 'done', true, 'replaced_equipment_id', pg_temp.eq('Leg press 45°')))),
    jsonb_build_object('equipment_id', pg_temp.eq('Esteira'), 'sets', jsonb_build_array(
      jsonb_build_object('load_kg', 0, 'reps', 20, 'done', true, 'duration_min', 20, 'speed_kmh', 8))))));
select pg_temp.assert((select equipment_id = pg_temp.eq('Agachamento hack') and replaced_equipment_id = pg_temp.eq('Leg press 45°')
  from public.session_sets where exercise_order = 1 and session_id in (select id from public.workout_sessions where student_id = auth.uid())),
  'treino registra o exercício feito e qual ele substituiu');
select pg_temp.assert((select replaced_equipment_id is null and duration_min = 20 from public.session_sets where exercise_order = 2
  and session_id in (select id from public.workout_sessions where student_id = auth.uid())), 'cardio continua gravando normalmente');

reset role;
\echo '✅ Todos os testes de substitutos passaram'

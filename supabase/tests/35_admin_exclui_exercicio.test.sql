-- Admin exclui exercício (direto ou passando fichas e treinos para um substituto).
\set ON_ERROR_STOP 1

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

reset role;
select set_config('request.jwt.claims', '{}', false);
insert into auth.users (email, raw_user_meta_data) values
  ('exc.p@p.com', '{"role":"personal","full_name":"Edu Exclui"}'),
  ('exc.a@a.com', '{"role":"aluno","full_name":"Ana Exclui","phone":"11955550071","terms_accepted":true}');

create temp table t as select
  (select id from auth.users where email = 'exc.p@p.com') as pers,
  (select id from auth.users where email = 'exc.a@a.com') as aluna;
insert into public.equipment (name, muscle_group, created_by) select 'Supino duplicado', 'peito', pers from t;
insert into public.equipment (name, muscle_group, created_by) select 'Supino certo', 'peito', pers from t;
insert into public.equipment (name, muscle_group, created_by) select 'Exercício sem uso', 'peito', pers from t;
alter table t add column dup uuid, add column ok uuid, add column livre uuid;
update t set dup = (select id from public.equipment where name = 'Supino duplicado'),
             ok = (select id from public.equipment where name = 'Supino certo'),
             livre = (select id from public.equipment where name = 'Exercício sem uso');

insert into public.workout_plans (student_id, created_by, name) select aluna, pers, 'A' from t;
insert into public.workout_plan_items (plan_id, equipment_id, position, sets, substitute_equipment_id)
  select (select id from public.workout_plans where student_id = t.aluna), dup, 1, 3, ok from t;
insert into public.workout_sessions (client_id, student_id, kind, started_at, finished_at)
  select gen_random_uuid(), aluna, 'livre', now() - interval '1 day', now() - interval '23 hours' from t;
insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done)
  select (select id from public.workout_sessions where student_id = t.aluna), dup, 1, 1, 40, 10, true from t;
insert into public.exercise_media (equipment_id, kind, source, status, path)
  select livre, 'gif', 'banco_publico', 'rascunho', 'gif/teste.gif' from t;

-- Só o servidor (service role) chama
set role authenticated;
select pg_temp.assert(pg_temp.fails($$select public.admin_delete_equipment((select livre from t))$$), 'usuário comum não exclui');
reset role;

-- Sem uso: exclui direto (e a execução vai junto)
create temp table r1 as select public.admin_delete_equipment((select livre from t)) as r;
select pg_temp.assert(not exists (select 1 from public.equipment where id = (select livre from t)), 'exercício sem uso excluído');
select pg_temp.assert((select r->'media_paths' from r1) = '["gif/teste.gif"]'::jsonb, 'devolve os arquivos para apagar');
select pg_temp.assert(not exists (select 1 from public.exercise_media where path = 'gif/teste.gif'), 'execução excluída junto');

-- Em uso: precisa de substituto
select pg_temp.assert(pg_temp.fails($$select public.admin_delete_equipment((select dup from t))$$), 'em uso sem substituto: recusa');
select pg_temp.assert(pg_temp.fails($$select public.admin_delete_equipment((select dup from t), (select dup from t))$$), 'não substitui por ele mesmo');
create temp table r2 as select public.admin_delete_equipment((select dup from t), (select ok from t)) as r;
select pg_temp.assert(not exists (select 1 from public.equipment where id = (select dup from t)), 'exercício em uso excluído');
select pg_temp.assert((select r->>'items' = '1' and r->>'sets' = '1' from r2), 'conta o que foi passado');
select pg_temp.assert((select equipment_id = (select ok from t) and substitute_equipment_id is null
  from public.workout_plan_items where plan_id = (select id from public.workout_plans where student_id = (select aluna from t))),
  'ficha passa para o substituto (sem substituto igual ao próprio)');
select pg_temp.assert((select equipment_id from public.session_sets
  where session_id = (select id from public.workout_sessions where student_id = (select aluna from t))) = (select ok from t),
  'treino registrado continua, agora no substituto');
\echo '✅ Todos os testes de exclusão de exercício pelo admin passaram'

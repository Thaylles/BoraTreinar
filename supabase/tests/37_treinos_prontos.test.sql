-- Treinos prontos: 4 por nível; aluno copia para as fichas, Personal copia como modelos.
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

reset role;
select set_config('request.jwt.claims', '{}', false);
select pg_temp.assert((select count(*) from public.starter_workouts) = 12, '12 treinos prontos');
select pg_temp.assert((select bool_and(c = 4) from (select count(*) c from public.starter_workouts group by level) x)
  and (select count(distinct level) from public.starter_workouts) = 3, '4 treinos em cada um dos 3 níveis');
select pg_temp.assert(not exists (select 1 from public.starter_workouts s
  where (select count(*) from public.starter_workout_items i where i.starter_id = s.id) < 5), 'todo treino tem pelo menos 5 exercícios do catálogo');

insert into auth.users (email, raw_user_meta_data) values
  ('pronto.a@a.com', '{"role":"aluno","full_name":"Ana Pronta","phone":"11955550091","terms_accepted":true}'),
  ('pronto.p@p.com', '{"role":"personal","full_name":"Paulo Pronto"}');

select pg_temp.as_user('pronto.a@a.com');
select pg_temp.assert((select count(*) from public.starter_workouts where level = 'iniciante') = 4, 'aluno vê os treinos prontos');
select pg_temp.assert(pg_temp.fails($$insert into public.starter_workouts (level, position, name) values ('iniciante', 9, 'x')$$), 'aluno não cria treino pronto');
select pg_temp.assert(public.adopt_starter_workouts('iniciante') = 4, 'aluno copia os 4 treinos de iniciante');
select pg_temp.assert((select count(*) from public.workout_plans where student_id = auth.uid() and created_by = auth.uid() and not is_template) = 4,
  'viram fichas do próprio aluno');
select pg_temp.assert((select count(*) from public.workout_plan_items i join public.workout_plans p on p.id = i.plan_id
  where p.student_id = auth.uid()) = (select count(*) from public.starter_workout_items i join public.starter_workouts s on s.id = i.starter_id
  where s.level = 'iniciante'), 'com todos os exercícios');
select pg_temp.assert(public.adopt_starter_workouts('iniciante') = 0, 'copiar de novo não duplica');
select pg_temp.assert(pg_temp.fails($$select public.adopt_starter_workouts('iniciante', true)$$), 'aluno não cria modelos');
select pg_temp.assert(pg_temp.fails($$select public.adopt_starter_workouts('expert')$$), 'nível inválido');

select pg_temp.as_user('pronto.p@p.com');
select pg_temp.assert(public.adopt_starter_workouts('avancado', true) = 4, 'Personal copia como modelos');
select pg_temp.assert((select count(*) from public.workout_plans where created_by = auth.uid() and is_template) = 4, 'viram modelos do Personal');
select pg_temp.assert(public.adopt_starter_workouts('intermediario') = 4, 'Personal também copia para o próprio treino');
reset role;
\echo '✅ Todos os testes de treinos prontos passaram'

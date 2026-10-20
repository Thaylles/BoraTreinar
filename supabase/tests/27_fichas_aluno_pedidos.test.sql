-- Fichas montadas pelo aluno e pedidos de exercício.
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
  ('fa.p@p.com', '{"role":"personal","full_name":"Paula Fichas"}'),
  ('fa.q@p.com', '{"role":"personal","full_name":"Quico Outro"}'),
  ('fa.a@a.com', '{"role":"aluno","full_name":"Alice Autônoma","phone":"11955550031","terms_accepted":true}'),
  ('fa.b@a.com', '{"role":"aluno","full_name":"Bruno Sozinho","phone":"11955550032","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'fa.p@p.com') as paula,
  (select id from auth.users where email = 'fa.a@a.com') as alice,
  (select id from auth.users where email = 'fa.b@a.com') as bruno,
  (select id from public.equipment where is_default and muscle_group = 'peito' order by name limit 1) as eq1,
  (select id from public.equipment where is_default and muscle_group = 'costas' order by name limit 1) as eq2;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select alice from c), 'responsavel');
create temp table r (plan uuid, eq uuid);
grant all on r to authenticated;

-- Fichas do aluno
select pg_temp.as_user('fa.a@a.com');
insert into r (plan) select public.save_my_plan(null, ' Treino em casa ', 'Manter', null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c), 'sets', 4, 'reps_min', 8, 'reps_max', 12, 'rest_seconds', 90),
                    jsonb_build_object('equipment_id', (select eq2 from c))));
select pg_temp.assert((select name from public.workout_plans where id = (select plan from r)) = 'Treino em casa', 'aluno com Personal cria ficha própria');
select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select plan from r)) = 2, 'com os exercícios');
select pg_temp.assert((select sets from public.workout_plan_items where plan_id = (select plan from r) and position = 1) = 4, 'séries salvas');
select public.save_my_plan((select plan from r), 'Treino em casa B', null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select eq2 from c))));
select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select plan from r)) = 1, 'aluno edita a própria ficha');
select pg_temp.assert(pg_temp.fails($$select public.save_my_plan(null, 'Vazia', null, null, '[]')$$), 'ficha sem exercícios é recusada');
reset role;
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select paula from c) and title like '📋 Alice criou uma ficha'), 'Personal é avisado');
select pg_temp.assert(not exists (select 1 from public.notifications where user_id = (select alice from c) and title like '📋 Nova ficha%'), 'aluno não recebe "seu Personal montou"');

-- Personal vê, mas não edita nem exclui
select pg_temp.as_user('fa.p@p.com');
select pg_temp.assert(exists (select 1 from public.workout_plans where id = (select plan from r)), 'Personal vê a ficha do aluno');
select pg_temp.assert(not public.can_edit_plan((select plan from r)), 'Personal não edita ficha do aluno');
select pg_temp.assert(pg_temp.fails(format($f$select public.save_workout_plan(%L, null, 'X', null, null, null, %L)$f$,
  (select plan from r), jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c))))), 'save_workout_plan recusa ficha do aluno');
delete from public.workout_plans where id = (select plan from r);
select pg_temp.assert(exists (select 1 from public.workout_plans where id = (select plan from r)), 'Personal não exclui ficha do aluno');
select pg_temp.assert(pg_temp.fails($$select public.save_my_plan(null, 'P', null, null, '[]')$$), 'Personal não usa save_my_plan');

-- Outro aluno
select pg_temp.as_user('fa.b@a.com');
select pg_temp.assert(not exists (select 1 from public.workout_plans where id = (select plan from r)), 'outro aluno não vê');
select pg_temp.assert(pg_temp.fails(format($f$select public.save_my_plan(%L, 'Hack', null, null, %L)$f$,
  (select plan from r), jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c))))), 'outro aluno não edita');
select public.save_my_plan(null, 'Meu A', null, null, jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c))));
select pg_temp.assert((select count(*) from public.workout_plans where created_by = (select bruno from c)) = 1, 'aluno sem Personal cria ficha');

select pg_temp.as_user('fa.a@a.com');
delete from public.workout_plans where id = (select plan from r);
select pg_temp.assert(not exists (select 1 from public.workout_plans where id = (select plan from r)), 'aluno exclui a própria ficha');

-- Pedidos de exercício
select pg_temp.as_user('fa.a@a.com');
select public.request_exercise('  Remada  Cavalinho  na máquina ', 'Máquina com apoio no peito');
select public.request_exercise('remada cavalinho na maquina');
select pg_temp.assert((select count(*) from public.exercise_requests) = 1, 'pedido repetido do mesmo aluno não duplica');
select pg_temp.assert(pg_temp.fails(format('select public.request_exercise(%L)', (select name from public.equipment where id = (select eq1 from c)))), 'exercício que já existe é recusado');
select pg_temp.as_user('fa.b@a.com');
select public.request_exercise('Remada cavalinho na máquina');
select pg_temp.assert((select count(*) from public.exercise_requests) = 1, 'aluno só vê os próprios pedidos');
select pg_temp.as_user('fa.q@p.com');
select pg_temp.assert((select count(*) from public.exercise_requests) = 2, 'qualquer Personal vê os pedidos abertos');
select pg_temp.assert(pg_temp.fails($$select public.dismiss_exercise_request('remada cavalinho na maquina')$$), 'Personal não descarta');
insert into r (eq) select public.add_requested_exercise('remada cavalinho na maquina', 'Remada cavalinho (máquina)', 'costas');
select pg_temp.assert(not exists (select 1 from public.exercise_requests), 'pedido atendido some para os Personais');
reset role;
select pg_temp.assert((select is_default from public.equipment where id = (select eq from r where eq is not null)), 'exercício entra no catálogo padrão');
select pg_temp.assert((select count(*) from public.exercise_requests where status = 'adicionado' and equipment_id = (select eq from r where eq is not null)) = 2, 'os dois pedidos foram atendidos');
select pg_temp.assert((select count(*) from public.notifications where title like '✅ Exercício no catálogo:%' and user_id in ((select alice from c), (select bruno from c))) = 2, 'quem pediu é avisado');
select pg_temp.as_user('fa.b@a.com');
select pg_temp.assert(public.equipment_usable_for_student((select eq from r where eq is not null), (select bruno from c)), 'aluno sem Personal já pode usar');
select public.request_exercise('Abdominal infra no banco');
select pg_temp.as_user('fa.p@p.com');
select pg_temp.assert(pg_temp.fails(format('select public.link_requested_exercise(%L, %L)', 'abdominal infra no banco', (select id from public.equipment where not is_default limit 1))), 'só aponta para exercício do catálogo padrão');
select pg_temp.assert(public.link_requested_exercise('abdominal infra no banco', (select eq1 from c)) = 1, 'Já existe: aponta para o exercício');
reset role;
select pg_temp.assert(pg_temp.fails($$insert into public.exercise_requests (name, requested_by) select 'x', alice from c$$) is not null, 'tabela fechada');
\echo ✅ Todos os testes de fichas do aluno e pedidos passaram

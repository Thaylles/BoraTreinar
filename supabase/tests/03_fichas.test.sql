-- Testes de fichas e modelos (etapa 4).
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

-- Cenário: Joana (Personal) com alunos Kauã e Lia; Marcos (Personal) sem relação.
insert into auth.users (email, raw_user_meta_data) values
  ('joana@p.com',  '{"role":"personal","full_name":"Joana Personal"}'),
  ('marcos@p.com', '{"role":"personal","full_name":"Marcos Personal"}');
select pg_temp.as_user('joana@p.com');
create temp table t_i1 as select * from public.create_invite(7, null);
create temp table t_i2 as select * from public.create_invite(7, null);
grant all on t_i1, t_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'kaua@a.com', jsonb_build_object('role','aluno','full_name','Kauã Aluno',
  'phone','11977776666','invite_token', token, 'terms_accepted', true) from t_i1;
insert into auth.users (email, raw_user_meta_data)
select 'lia@a.com', jsonb_build_object('role','aluno','full_name','Lia Aluna',
  'phone','11977775555','invite_token', token, 'terms_accepted', true) from t_i2;

create temp table ids as select
  (select id from auth.users where email = 'kaua@a.com') as kaua,
  (select id from auth.users where email = 'lia@a.com') as lia;
grant all on ids to authenticated;

-- Joana monta Treino A para Kauã
select pg_temp.as_user('joana@p.com');
create temp table t_plan as select public.save_workout_plan(
  null, (select kaua from ids), 'Treino A', 'Hipertrofia', 'Foco em peito', null,
  jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'reps_min', 8, 'reps_max', 12, 'suggested_load', 40, 'rest_seconds', 90),
    jsonb_build_object('equipment_id', pg_temp.eq('Crossover'), 'sets', 4, 'reps_min', 12)
  )) as id;
grant all on t_plan to authenticated;

select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select id from t_plan)) = 2, 'ficha com 2 exercícios');
select pg_temp.assert((select sets from public.workout_plan_items where plan_id = (select id from t_plan) and position = 1) = 3, 'séries padrão = 3');
select pg_temp.assert((select created_by from public.workout_plans where id = (select id from t_plan)) = auth.uid(), 'ficha registra quem criou');
select pg_temp.assert(pg_temp.fails($$insert into public.workout_plans (student_id, created_by, name) values ((select kaua from ids), auth.uid(), 'x')$$),
  'insert direto em fichas é bloqueado');

-- Reordenar/editar substitui os itens
select public.save_workout_plan((select id from t_plan), null, 'Treino A', 'Hipertrofia', null, null,
  jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Crossover')),
    jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra')),
    jsonb_build_object('equipment_id', pg_temp.eq('Peck deck (voador)'))));
select pg_temp.assert((select e.name from public.workout_plan_items i join public.equipment e on e.id = i.equipment_id
  where plan_id = (select id from t_plan) and position = 1) = 'Crossover', 'reordenação salva');

-- Exercício próprio da Joana pode ir na ficha do aluno dela
insert into public.equipment (name, muscle_group, created_by) values ('Supino articulado Joana', 'peito', auth.uid());
select pg_temp.assert(public.save_workout_plan(null, (select kaua from ids), 'Treino B', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino articulado Joana')))) is not null,
  'exercício próprio do Personal entra na ficha');

-- Aluno vê as próprias fichas e itens, não as da colega
select pg_temp.as_user('kaua@a.com');
select pg_temp.assert((select count(*) from public.workout_plans) = 2, 'Kauã vê suas 2 fichas');
select pg_temp.assert((select count(*) from public.workout_plan_items) = 4, 'Kauã vê os itens');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, auth.uid(), 'Minha', null, null, null, '[]')$$),
  'aluno não monta ficha');
delete from public.workout_plans;
select pg_temp.assert((select count(*) from public.workout_plans) = 2, 'aluno não exclui ficha');

select pg_temp.as_user('lia@a.com');
select pg_temp.assert((select count(*) from public.workout_plans) = 0, 'Lia não vê fichas do Kauã');

-- Personal sem vínculo
select pg_temp.as_user('marcos@p.com');
select pg_temp.assert((select count(*) from public.workout_plans) = 0, 'Marcos não vê fichas');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, (select kaua from ids), 'Invasão', null, null, null, '[]')$$),
  'Marcos não cria ficha para aluno alheio');
select pg_temp.assert(pg_temp.fails($$select public.duplicate_workout_plan((select id from t_plan), null)$$),
  'Marcos não duplica ficha alheia');
insert into public.equipment (name, muscle_group, created_by) values ('Máquina do Marcos', 'costas', auth.uid());
create temp table t_meq as select id from public.equipment where name = 'Máquina do Marcos';
grant all on t_meq to authenticated;

-- Joana não pode usar exercício que o aluno não enxerga
select pg_temp.as_user('joana@p.com');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, (select kaua from ids), 'X', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select id from t_meq))))$$),
  'exercício de Personal sem relação é rejeitado');

-- Modelos e duplicação
create temp table t_tpl as select public.duplicate_workout_plan((select id from t_plan), null, 'Modelo peito') as id;
grant all on t_tpl to authenticated;
select pg_temp.assert((select is_template and student_id is null from public.workout_plans where id = (select id from t_tpl)),
  'salvar como modelo');
select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select id from t_tpl)) = 3, 'modelo copia os itens');
create temp table t_dup as select public.duplicate_workout_plan((select id from t_tpl), (select lia from ids)) as id;
grant all on t_dup to authenticated;
select pg_temp.assert((select student_id from public.workout_plans where id = (select id from t_dup)) = (select lia from ids),
  'modelo aplicado para outra aluna');

select pg_temp.as_user('lia@a.com');
select pg_temp.assert((select count(*) from public.workout_plans) = 1, 'Lia vê a ficha vinda do modelo');
select pg_temp.assert((select count(*) from public.workout_plans where is_template) = 0, 'aluno não vê modelos');

-- Compartilhamento: Marcos passa a ver e editar as fichas do Kauã
select pg_temp.as_user('joana@p.com');
create temp table t_tr as select * from public.request_student_transfer((select kaua from ids),
  (select id from public.find_personal_by_email('marcos@p.com')), 'compartilhamento');
grant all on t_tr to authenticated;
select pg_temp.as_user('marcos@p.com');
select public.respond_student_transfer((select id from t_tr), true);
select pg_temp.assert((select count(*) from public.workout_plans) = 2, 'Personal compartilhado vê as fichas');
select pg_temp.assert(public.save_workout_plan(null, (select kaua from ids), 'Treino C', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select id from t_meq)))) is not null,
  'Personal compartilhado monta ficha com exercício próprio');
select pg_temp.assert((select count(*) from public.workout_plans where is_template) = 0, 'Marcos não vê modelos da Joana');

select pg_temp.as_user('kaua@a.com');
select pg_temp.assert(exists (select 1 from public.workout_plans p join public.profiles pr on pr.id = p.created_by
  where p.name = 'Treino C' and pr.full_name = 'Marcos Personal'), 'aluno vê quem criou a ficha');

-- Exercício em uso não pode ser excluído
select pg_temp.as_user('joana@p.com');
select pg_temp.assert(pg_temp.fails($$delete from public.equipment where name = 'Supino articulado Joana'$$),
  'exercício em uso em ficha não é excluído');

reset role;
\echo '✅ Todos os testes de fichas passaram'

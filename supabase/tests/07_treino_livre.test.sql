-- Testes do treino livre (etapa 7).
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
  ('xis@p.com', '{"role":"personal","full_name":"Xis Personal"}'),
  ('ypi@p.com', '{"role":"personal","full_name":"Ypi Personal"}');
select pg_temp.as_user('xis@p.com');
create temp table t_i as select * from public.create_invite(7, null);
grant all on t_i to authenticated;
insert into public.equipment (name, muscle_group, created_by) values ('Remada do Xis', 'costas', auth.uid());
select pg_temp.as_user('ypi@p.com');
insert into public.equipment (name, muscle_group, created_by) values ('Máquina da Ypi', 'peito', auth.uid());
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'zeca@a.com', jsonb_build_object('role','aluno','full_name','Zeca Aluno',
  'phone','11933332222','invite_token', token, 'terms_accepted', true) from t_i;

create or replace function pg_temp.livre(p_names text[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'client_id', gen_random_uuid(), 'student_id', auth.uid(),
    'kind', 'livre', 'plan_name', 'Treino livre',
    'started_at', now() - interval '45 minutes', 'finished_at', now(),
    'exercises', (select jsonb_agg(jsonb_build_object('equipment_id', e.id,
        'sets', jsonb_build_array(jsonb_build_object('load_kg', 20, 'reps', 12, 'done', true))))
      from unnest(p_names) n join public.equipment e on e.name = n))
$$;

select pg_temp.as_user('zeca@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 75);
select pg_temp.assert(not pg_temp.fails($$select public.save_workout_session(pg_temp.livre(array['Supino reto com barra', 'Remada do Xis']))$$),
  'treino livre com catálogo padrão + exercício do próprio Personal');
select pg_temp.assert((select kind from public.workout_sessions limit 1) = 'livre' and (select plan_id from public.workout_sessions limit 1) is null,
  'gravado como treino livre, sem ficha');

reset role;
create temp table t_ypi as select id from public.equipment where name = 'Máquina da Ypi';
grant all on t_ypi to authenticated;
select pg_temp.as_user('zeca@a.com');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', now() - interval '10 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', (select id from t_ypi),
    'sets', jsonb_build_array(jsonb_build_object('load_kg', 10, 'reps', 10, 'done', true))))))$$),
  'treino livre NÃO aceita exercício fora do catálogo do aluno');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', now() - interval '10 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', gen_random_uuid(),
    'sets', jsonb_build_array(jsonb_build_object('load_kg', 10, 'reps', 10, 'done', true))))))$$),
  'treino livre NÃO aceita exercício inexistente');
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by)
  values ('Inventado pelo aluno', 'peito', auth.uid())$$), 'aluno não cria exercício');

select pg_temp.as_user('xis@p.com');
select pg_temp.assert((select count(*) from public.workout_sessions where kind = 'livre') = 1, 'Personal vê o treino livre do aluno');

reset role;
\echo '✅ Todos os testes de treino livre passaram'

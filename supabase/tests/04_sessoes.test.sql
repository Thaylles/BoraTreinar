-- Testes de execução de treino (etapa 5).
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

-- Cenário: Nina (Personal) com aluno Otto; Pedro (aluno de outro Personal, Quim).
insert into auth.users (email, raw_user_meta_data) values
  ('nina@p.com', '{"role":"personal","full_name":"Nina Personal"}'),
  ('quim@p.com', '{"role":"personal","full_name":"Quim Personal"}');
select pg_temp.as_user('nina@p.com');
create temp table t_i1 as select * from public.create_invite(7, null);
grant all on t_i1 to authenticated;
select pg_temp.as_user('quim@p.com');
create temp table t_i2 as select * from public.create_invite(7, null);
grant all on t_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'otto@a.com', jsonb_build_object('role','aluno','full_name','Otto Aluno',
  'phone','11966665555','invite_token', token, 'terms_accepted', true) from t_i1;
insert into auth.users (email, raw_user_meta_data)
select 'pedro@a.com', jsonb_build_object('role','aluno','full_name','Pedro Aluno',
  'phone','11966664444','invite_token', token, 'terms_accepted', true) from t_i2;
create temp table ids as select
  (select id from auth.users where email = 'otto@a.com') as otto,
  (select id from auth.users where email = 'pedro@a.com') as pedro;
grant all on ids to authenticated;

select pg_temp.as_user('nina@p.com');
create temp table t_plan as select public.save_workout_plan(null, (select otto from ids), 'Treino A', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra')),
                    jsonb_build_object('equipment_id', pg_temp.eq('Prancha')))) as id;
grant all on t_plan to authenticated;

create or replace function pg_temp.payload(p_client uuid, p_load numeric, p_kind text default 'ficha') returns jsonb language sql as $$
  select jsonb_build_object(
    'client_id', p_client, 'student_id', (select otto from ids), 'plan_id', (select id from t_plan), 'kind', p_kind,
    'started_at', now() - interval '50 minutes', 'finished_at', now(),
    'exercises', jsonb_build_array(
      jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'sets', jsonb_build_array(
        jsonb_build_object('load_kg', p_load, 'reps', 10, 'done', true),
        jsonb_build_object('load_kg', p_load, 'reps', 8, 'done', true),
        jsonb_build_object('load_kg', p_load + 10, 'reps', 3, 'done', false))),
      jsonb_build_object('equipment_id', pg_temp.eq('Prancha'), 'sets', jsonb_build_array(
        jsonb_build_object('load_kg', 0, 'reps', 60, 'done', true)))))
$$;

-- Aluno registra o primeiro treino
select pg_temp.as_user('otto@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 80); -- pesagem em dia (etapa 6)
create temp table r1 as select public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000001', 40)) as r;
grant all on r1 to authenticated;
select pg_temp.assert((select count(*) from public.session_sets) = 4, 'séries gravadas (feitas e não feitas)');
select pg_temp.assert((select duration_seconds from public.workout_sessions) between 2990 and 3010, 'duração calculada');
select pg_temp.assert((select logged_by = student_id from public.workout_sessions), 'registrado pelo próprio aluno');
select pg_temp.assert(jsonb_array_length((select r->'prs' from r1)) = 1, 'primeira carga já conta como recorde');

-- Reenvio (sync offline) não duplica
select pg_temp.assert((public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000001', 40))->>'duplicate')::boolean,
  'reenvio com mesmo client_id é ignorado');
select pg_temp.assert((select count(*) from public.workout_sessions) = 1, 'sem sessão duplicada');

-- Mesma carga: não é recorde; carga não feita (50) não conta
select pg_temp.assert(jsonb_array_length(public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000002', 40))->'prs') = 0,
  'mesma carga não é recorde');
select pg_temp.assert(jsonb_array_length(public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000003', 45))->'prs') = 1,
  'carga maior é recorde');
select pg_temp.assert((select count(*) from public.session_sets where is_pr) = 2, 'PR marcado em uma série por sessão');

-- Personal registra manualmente
select pg_temp.as_user('nina@p.com');
select public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000004', 45));
select pg_temp.assert((select count(*) from public.workout_sessions where logged_by = auth.uid()) = 1,
  'registro manual marcado como do instrutor');
select pg_temp.assert((select count(*) from public.workout_sessions) = 4, 'Personal vê os treinos do aluno');

-- Regras de acesso
select pg_temp.as_user('quim@p.com');
select pg_temp.assert((select count(*) from public.workout_sessions) = 0, 'Personal sem vínculo não vê treinos');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000005', 40))$$),
  'Personal sem vínculo não registra');

select pg_temp.as_user('pedro@a.com');
select pg_temp.assert((select count(*) from public.workout_sessions) = 0, 'outro aluno não vê treinos');
select pg_temp.assert((select count(*) from public.session_sets) = 0, 'outro aluno não vê séries');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.payload('00000000-0000-0000-0000-000000000006', 40))$$),
  'aluno não registra treino de outro');

select pg_temp.as_user('otto@a.com');
select pg_temp.assert(pg_temp.fails($$insert into public.workout_sessions (client_id, student_id, started_at, finished_at, kind)
  values (gen_random_uuid(), auth.uid(), now(), now(), 'livre')$$), 'insert direto bloqueado');
select pg_temp.assert(pg_temp.fails($$update public.session_sets set load_kg = 999$$) or
  (select max(load_kg) from public.session_sets) < 999, 'aluno não altera séries');

-- Exercício fora do catálogo do aluno (criado por Personal sem vínculo) é rejeitado
select pg_temp.as_user('quim@p.com');
insert into public.equipment (name, muscle_group, created_by) values ('Aparelho do Quim', 'costas', auth.uid());
reset role;
create temp table t_qeq as select id from public.equipment where name = 'Aparelho do Quim';
grant all on t_qeq to authenticated;
select pg_temp.as_user('otto@a.com');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', now() - interval '10 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', (select id from t_qeq),
     'sets', jsonb_build_array(jsonb_build_object('load_kg', 10, 'reps', 10, 'done', true))))))$$),
  'exercício fora do catálogo do aluno é rejeitado');

-- Ficha de outro aluno não pode ser usada
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'ficha', 'plan_id', gen_random_uuid(),
  'started_at', now(), 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Prancha'),
     'sets', jsonb_build_array(jsonb_build_object('load_kg', 0, 'reps', 30, 'done', true))))))$$),
  'ficha inexistente/alheia é rejeitada');

-- Aluno pode excluir o próprio treino
delete from public.workout_sessions where client_id = '00000000-0000-0000-0000-000000000002';
select pg_temp.assert((select count(*) from public.workout_sessions) = 3, 'aluno exclui o próprio treino');

reset role;
\echo '✅ Todos os testes de sessões passaram'

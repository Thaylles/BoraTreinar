-- Treino esquecido: registro retroativo de até 7 dias.
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
  ('retro.a@a.com', '{"role":"aluno","full_name":"Rita Retro","phone":"11955550051","terms_accepted":true}');

create or replace function pg_temp.livre_em(p_start timestamptz, p_min int) returns jsonb language sql as $$
  select jsonb_build_object(
    'client_id', gen_random_uuid(), 'student_id', auth.uid(),
    'kind', 'livre', 'plan_name', 'Treino livre',
    'started_at', p_start, 'finished_at', p_start + make_interval(mins => p_min),
    'exercises', jsonb_build_array(jsonb_build_object(
      'equipment_id', (select id from public.equipment where is_default and muscle_group = 'peito' order by name limit 1),
      'sets', jsonb_build_array(jsonb_build_object('load_kg', 20, 'reps', 12, 'done', true)))))
$$;

select pg_temp.as_user('retro.a@a.com');
insert into public.body_weights (student_id, weight_kg, measured_on)
  values (auth.uid(), 70, (now() at time zone 'America/Sao_Paulo')::date - 8);
create temp table rt as select public.save_workout_session(pg_temp.livre_em(
  ((now() at time zone 'America/Sao_Paulo')::date - 7 + time '18:00') at time zone 'America/Sao_Paulo', 50)) as r;
grant all on rt to authenticated;
select pg_temp.assert((select (r->>'duplicate')::boolean = false from rt), 'treino de 7 dias atrás é registrado');
select pg_temp.assert((select extract(epoch from finished_at - started_at) / 60 from public.workout_sessions
  where id = (select (r->>'id')::uuid from rt)) = 50, 'com a duração informada');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.livre_em(
  ((now() at time zone 'America/Sao_Paulo')::date - 8 + time '23:00') at time zone 'America/Sao_Paulo', 30))$$),
  'treino de 8 dias atrás é recusado');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.livre_em(now() + interval '2 hours', 30))$$),
  'treino no futuro é recusado');

-- O Personal vinculado também registra treino esquecido do aluno (mesmo limite de 7 dias)
reset role;
insert into auth.users (email, raw_user_meta_data) values ('retro.p@p.com', '{"role":"personal","full_name":"Pedro Retro"}');
insert into public.personal_students (personal_id, student_id, role)
  values ((select id from auth.users where email = 'retro.p@p.com'), (select id from auth.users where email = 'retro.a@a.com'), 'responsavel');
create temp table rp as select id from auth.users where email = 'retro.a@a.com';
grant all on rp to authenticated;
create or replace function pg_temp.livre_de(p_start timestamptz) returns jsonb language sql as $$
  select pg_temp.livre_em(p_start, 40) || jsonb_build_object('student_id', (select id from rp))
$$;
select pg_temp.as_user('retro.p@p.com');
select pg_temp.assert(not pg_temp.fails($$select public.save_workout_session(pg_temp.livre_de(now() - interval '3 days'))$$),
  'Personal registra treino de 3 dias atrás');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.livre_de(now() - interval '9 days'))$$),
  'Personal também não passa de 7 dias');
reset role;
select pg_temp.assert((select count(*) from public.workout_sessions s join auth.users u on u.id = s.logged_by
  where u.email = 'retro.p@p.com') = 1, 'treino fica marcado como registrado pelo Personal');

-- Cargas internas (sem usuário) e importações não passam pela trava
reset role;
select set_config('request.jwt.claims', '{}', false);
insert into public.workout_sessions (client_id, student_id, plan_name, kind, started_at, finished_at)
values (gen_random_uuid(), (select id from auth.users where email = 'retro.a@a.com'), 'Antigo', 'livre',
        now() - interval '30 days', now() - interval '30 days' + interval '1 hour');
select pg_temp.assert(true, 'carga interna antiga continua possível');
\echo '✅ Todos os testes de treino esquecido passaram'

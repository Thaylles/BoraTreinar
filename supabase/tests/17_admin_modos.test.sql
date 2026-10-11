-- Admin com modos (Personal e aluno) e aceite de convite por conta existente.
-- Cenário próprio: Ada (admin), Nil (Personal), Ivo e Rosa (alunos).
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
  ('modo.ada@p.com', '{"role":"personal","full_name":"Ada Admin"}'),
  ('modo.nil@p.com', '{"role":"personal","full_name":"Nil Personal"}'),
  ('modo.zuca@p.com', '{"role":"personal","full_name":"Zuca Personal"}');
update public.profiles set role = 'admin' where email = 'modo.ada@p.com';

-- Papéis
select pg_temp.as_user('modo.ada@p.com');
select pg_temp.assert(public.current_role_is('admin') and public.current_role_is('personal') and public.current_role_is('aluno'),
  'admin atua como admin, Personal e aluno');
select pg_temp.as_user('modo.nil@p.com');
select pg_temp.assert(public.current_role_is('personal') and not public.current_role_is('aluno') and not public.current_role_is('admin'),
  'Personal continua só Personal');

-- Admin no modo Personal: convida e monta ficha para o próprio aluno
select pg_temp.as_user('modo.ada@p.com');
create temp table md_i1 as select * from public.create_invite(7, null);
grant all on md_i1 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'modo.ivo@a.com', jsonb_build_object('role','aluno','full_name','Ivo','phone','11933331111','invite_token', token, 'terms_accepted', true) from md_i1;
create temp table md_ids as select
  (select id from auth.users where email = 'modo.ada@p.com') as ada,
  (select id from auth.users where email = 'modo.nil@p.com') as nil,
  (select id from auth.users where email = 'modo.zuca@p.com') as zuca,
  (select id from auth.users where email = 'modo.ivo@a.com') as ivo;
grant all on md_ids to authenticated;
select pg_temp.assert((select count(*) from public.personal_students where personal_id = (select ada from md_ids)
  and student_id = (select ivo from md_ids) and status = 'ativo') = 1, 'aluno vinculado ao admin pelo convite');
select pg_temp.as_user('modo.ada@p.com');
select public.save_workout_plan(null, (select ivo from md_ids), 'Treino do Ivo', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Prancha'))));
select pg_temp.assert((select count(*) from public.workout_plans where student_id = (select ivo from md_ids)) = 1, 'admin monta ficha como Personal');

-- Admin no modo aluno: aceita convite do Nil e treina
select pg_temp.as_user('modo.nil@p.com');
create temp table md_i2 as select * from public.create_invite(7, null);
create temp table md_i3 as select * from public.create_invite(7, null);
grant all on md_i2, md_i3 to authenticated;
select pg_temp.as_user('modo.ada@p.com');
select pg_temp.assert(pg_temp.fails($$select public.accept_invite((select token from md_i1))$$), 'convite já usado é recusado');
select public.accept_invite((select token from md_i2));
select pg_temp.assert((select role from public.personal_students where personal_id = (select nil from md_ids)
  and student_id = (select ada from md_ids) and status = 'ativo') = 'responsavel', 'admin vira aluno do Nil (responsável)');
select pg_temp.assert(pg_temp.fails($$select public.accept_invite((select token from md_i3))$$), 'não aceita dois convites do mesmo Personal');
select pg_temp.as_user('modo.nil@p.com');
select pg_temp.assert((select count(*) from public.notifications where user_id = auth.uid() and title = 'Novo aluno na área! 🎉') = 1,
  'Personal avisado do aceite');
select public.save_workout_plan(null, (select ada from md_ids), 'Treino da Ada', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'))));
select pg_temp.as_user('modo.ada@p.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 70);
select public.save_workout_session(jsonb_build_object(
  'client_id', '20000000-0000-0000-0000-000000000017', 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', now() - interval '30 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'),
    'sets', jsonb_build_array(jsonb_build_object('load_kg', 20, 'reps', 10, 'done', true))))));
select pg_temp.assert((select count(*) from public.workout_sessions where student_id = auth.uid() and logged_by = auth.uid()) = 1,
  'admin registra o próprio treino como aluno');
select pg_temp.as_user('modo.nil@p.com');
select pg_temp.assert((select count(*) from public.workout_sessions where student_id = (select ada from md_ids)) = 1,
  'Personal do admin vê o treino dele');
select pg_temp.assert(exists (select 1 from public.find_personal_by_email('modo.ada@p.com')), 'admin aparece na busca de Personal');

-- Regras do aceite
select pg_temp.as_user('modo.ada@p.com');
create temp table md_i4 as select * from public.create_invite(7, null);
grant all on md_i4 to authenticated;
select pg_temp.assert(pg_temp.fails($$select public.accept_invite((select token from md_i4))$$), 'não aceita o próprio convite');
select pg_temp.as_user('modo.zuca@p.com');
select pg_temp.assert(pg_temp.fails($$select public.accept_invite((select token from md_i4))$$), 'Personal não aceita convite de aluno');
select pg_temp.as_user('modo.ivo@a.com');
select public.accept_invite((select token from md_i3));
select pg_temp.assert((select role from public.personal_students where personal_id = (select nil from md_ids)
  and student_id = (select ivo from md_ids) and status = 'ativo') = 'compartilhado', 'aluno com responsável entra como compartilhado');
reset role;
\echo '✅ Todos os testes de modos do admin passaram'

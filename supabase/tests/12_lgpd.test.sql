-- Testes da exclusão de conta (LGPD). Reaproveita o cenário dos testes 10/11 (Dora, Fábio, Eva, Gil).
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
create temp table l_ids as select
  (select id from auth.users where email = 'dora@p.com') as dora,
  (select id from auth.users where email = 'eva@a.com') as eva;
grant all on l_ids to authenticated;
-- relatório salvo da Dora com a Eva e outro aluno fictício
update public.weekly_reports set content = jsonb_build_object('students', jsonb_build_array(
  jsonb_build_object('id', (select eva from l_ids)::text, 'name', 'Eva Aluna'),
  jsonb_build_object('id', 'outro', 'name', 'Outro')))
where personal_id = (select dora from l_ids);
select pg_temp.assert((select count(*) from public.workout_sessions where student_id = (select eva from l_ids)) > 0, 'Eva tem treinos antes');

select pg_temp.as_user('dora@p.com');
select pg_temp.assert(pg_temp.fails('select public.delete_own_account()'), 'Personal não exclui a conta por aqui');

select pg_temp.as_user('eva@a.com');
select public.delete_own_account();

reset role;
select pg_temp.assert(not exists (select 1 from auth.users where email = 'eva@a.com'), 'usuário apagado');
select pg_temp.assert(not exists (select 1 from public.profiles where id = (select eva from l_ids)), 'perfil apagado');
select pg_temp.assert(not exists (select 1 from public.workout_sessions where student_id = (select eva from l_ids)), 'treinos apagados');
select pg_temp.assert(not exists (select 1 from public.body_weights where student_id = (select eva from l_ids)), 'pesagens apagadas');
select pg_temp.assert(not exists (select 1 from public.personal_students where student_id = (select eva from l_ids)), 'vínculos apagados');
select pg_temp.assert((select content->'students' from public.weekly_reports where personal_id = (select dora from l_ids))
  = '[{"id": "outro", "name": "Outro"}]'::jsonb, 'aluno removido dos relatórios salvos');
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select dora from l_ids) and title = 'Aluno excluiu a conta'),
  'Personal é avisado');
select pg_temp.assert(exists (select 1 from auth.users where email = 'dora@p.com'), 'Personal continua existindo');

set role anon;
select pg_temp.assert(pg_temp.fails('select public.delete_own_account()'), 'anônimo não executa');
reset role;
\echo '✅ Todos os testes de LGPD passaram'

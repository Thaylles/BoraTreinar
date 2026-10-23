-- O aluno autoriza o Personal a editar as fichas que ele montou.
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
  ('pe.p@p.com', '{"role":"personal","full_name":"Paula Edita"}'),
  ('pe.q@p.com', '{"role":"personal","full_name":"Quico Outro"}'),
  ('pe.a@a.com', '{"role":"aluno","full_name":"Alice Autoriza","phone":"11955550041","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'pe.p@p.com') as paula,
  (select id from auth.users where email = 'pe.a@a.com') as alice,
  (select id from public.equipment where is_default and muscle_group = 'peito' order by name limit 1) as eq1,
  (select id from public.equipment where is_default and muscle_group = 'costas' order by name limit 1) as eq2;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select alice from c), 'responsavel');
create temp table r (plan uuid);
grant all on r to authenticated;

select pg_temp.as_user('pe.a@a.com');
insert into r select public.save_my_plan(null, 'Upper', null, null, jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c))));

-- Sem autorização: a Personal não edita nem exclui
select pg_temp.as_user('pe.p@p.com');
select pg_temp.assert(not public.can_edit_plan((select plan from r)), 'sem autorização, Personal não edita a ficha do aluno');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan((select plan from r), null, 'X', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select eq2 from c))))$$), 'sem autorização, salvar falha');

-- A aluna autoriza
select pg_temp.as_user('pe.a@a.com');
insert into public.student_settings (student_id, personal_edits_plans) values (auth.uid(), true);
select pg_temp.as_user('pe.p@p.com');
select pg_temp.assert(public.can_edit_plan((select plan from r)), 'com autorização, Personal edita');
select public.save_workout_plan((select plan from r), null, 'Upper ajustado', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c)), jsonb_build_object('equipment_id', (select eq2 from c))));
reset role;
select pg_temp.assert((select name = 'Upper ajustado' and created_by = (select alice from c) from public.workout_plans where id = (select plan from r)),
  'ficha ajustada continua sendo da aluna');
select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select plan from r)) = 2, 'exercícios salvos');
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select alice from c) and title like '✏️ Ficha atualizada%'),
  'aluna é avisada do ajuste');

-- A aluna continua editando; outro Personal não
select pg_temp.as_user('pe.a@a.com');
select public.save_my_plan((select plan from r), 'Upper da Alice', null, null, jsonb_build_array(jsonb_build_object('equipment_id', (select eq1 from c))));
select pg_temp.assert((select count(*) from public.notifications where user_id = auth.uid() and title like '✏️ Ficha atualizada%') = 1,
  'a própria aluna salvando não gera aviso');
select pg_temp.as_user('pe.q@p.com');
select pg_temp.assert(not public.can_edit_plan((select plan from r)), 'outro Personal não edita');

-- Revogar a autorização volta a bloquear
select pg_temp.as_user('pe.a@a.com');
update public.student_settings set personal_edits_plans = false where student_id = auth.uid();
select pg_temp.as_user('pe.p@p.com');
select pg_temp.assert(not public.can_edit_plan((select plan from r)), 'autorização revogada');
delete from public.workout_plans where id = (select plan from r);
reset role;
select pg_temp.assert(exists (select 1 from public.workout_plans where id = (select plan from r)), 'sem autorização, Personal não exclui');
-- Com autorização, exclui
update public.student_settings set personal_edits_plans = true where student_id = (select alice from c);
select pg_temp.as_user('pe.p@p.com');
delete from public.workout_plans where id = (select plan from r);
reset role;
select pg_temp.assert(not exists (select 1 from public.workout_plans where id = (select plan from r)), 'com autorização, Personal exclui');

-- Cadeira flexora com a foto certa
select pg_temp.assert((select image_url from public.equipment where is_default and name = 'Cadeira flexora') = '/catalogo/fotos/52b-cadeira-flexora.webp',
  'cadeira flexora com a foto nova');
\echo '✅ Todos os testes de edição das fichas do aluno passaram'

-- Técnica Cluster na ficha e foto nova da panturrilha no leg press.
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
  ('clu.rui@p.com', '{"role":"personal","full_name":"Rui Personal"}');
select pg_temp.as_user('clu.rui@p.com');
create temp table c_i as select * from public.create_invite(7, null);
grant all on c_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'clu.ana@a.com', jsonb_build_object('role','aluno','full_name','Ana Souza','phone','11922224444','invite_token', token, 'terms_accepted', true) from c_i;

create temp table c_ana as select id from auth.users where email = 'clu.ana@a.com';
grant all on c_ana to authenticated;
select pg_temp.as_user('clu.rui@p.com');
create temp table c_plan as select public.save_workout_plan(null, (select id from c_ana),
  'Treino C', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'technique', 'cluster'))) as id;
grant all on c_plan to authenticated;
select pg_temp.assert((select technique from public.workout_plan_items where plan_id = (select id from c_plan)) = 'cluster',
  'técnica Cluster gravada');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, (select id from c_ana),
  'X', null, null, null, jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Prancha'), 'technique', 'clusters')))$$),
  'técnica inválida continua recusada');

reset role;
select pg_temp.assert((select image_url from public.equipment where is_default and name = 'Panturrilha no leg press')
  = '/catalogo/fotos/61b-panturrilha-no-leg-press.webp', 'panturrilha no leg press com a foto nova');

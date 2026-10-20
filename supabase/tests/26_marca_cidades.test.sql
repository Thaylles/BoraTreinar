-- Logo do Personal para os alunos e cidades de atendimento na vitrine.
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
  ('mc.p@p.com', '{"role":"personal","full_name":"Paula Marca","phone":"51999990001"}'),
  ('mc.q@p.com', '{"role":"personal","full_name":"Quico Serra","phone":"54999990002"}'),
  ('mc.a@a.com', '{"role":"aluno","full_name":"Alice Aluna","phone":"51955550021","terms_accepted":true}'),
  ('mc.b@a.com', '{"role":"aluno","full_name":"Bruno Sem","phone":"51955550022","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'mc.p@p.com') as paula,
  (select id from auth.users where email = 'mc.a@a.com') as alice;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select alice from c), 'responsavel');

-- Logo
select pg_temp.as_user('mc.p@p.com');
update public.profiles set logo_path = (select paula from c)::text || '/logo-1.webp' where id = (select paula from c);
select pg_temp.as_user('mc.a@a.com');
select pg_temp.assert((select logo_path from public.my_personal_logo()) like '%/logo-1.webp', 'aluno vê o logo do seu Personal');
select pg_temp.assert((select full_name from public.my_personal_logo()) = 'Paula Marca', 'com o nome do Personal');
select pg_temp.as_user('mc.b@a.com');
select pg_temp.assert(not exists (select 1 from public.my_personal_logo()), 'aluno sem Personal não vê logo');
select pg_temp.as_user('mc.q@p.com');
select pg_temp.assert(not exists (select 1 from public.my_personal_logo()), 'outro Personal não vê logo');

-- Cidades (códigos IBGE do RS): Porto Alegre 4314902, Canoas 4304606, Caxias do Sul 4305108
select pg_temp.as_user('mc.p@p.com');
update public.profiles set service_cities = '{4314902,4304606}', directory_listed = true, birth_date = '1990-05-01' where id = (select paula from c);
select pg_temp.assert(pg_temp.fails($$update public.profiles set service_cities = '{3550308}' where id = auth.uid()$$), 'cidade fora do RS é recusada');
select pg_temp.as_user('mc.q@p.com');
update public.profiles set service_cities = '{4305108}', directory_listed = true where id = auth.uid();
select pg_temp.as_user('mc.b@a.com');
select pg_temp.assert((select count(*) from public.personal_directory() where full_name in ('Paula Marca', 'Quico Serra')) = 2, 'sem filtro: todos da vitrine');
select pg_temp.assert((select string_agg(full_name, ',') from public.personal_directory(4304606)) = 'Paula Marca', 'filtro por Canoas');
select pg_temp.assert((select string_agg(full_name, ',') from public.personal_directory(4305108)) = 'Quico Serra', 'filtro por Caxias do Sul');
select pg_temp.assert(not exists (select 1 from public.personal_directory(4300406)), 'cidade sem Personal: vazio');
select pg_temp.assert((select cities from public.personal_directory(4314902)) = '{4314902,4304606}', 'vitrine mostra as cidades');
select pg_temp.assert((select age from public.personal_directory(4314902)) is not null, 'vitrine mostra a idade');
reset role;
\echo ✅ Todos os testes de logo e cidades passaram

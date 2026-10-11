-- Área admin: papel, travas do catálogo. Reaproveita Dora (Personal) dos testes anteriores.
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

-- Ninguém vira admin no cadastro
reset role;
select pg_temp.assert(pg_temp.fails($$insert into auth.users (email, raw_user_meta_data)
  values ('hacker@x.com', '{"role":"admin","full_name":"Hacker"}')$$), 'cadastro não aceita papel admin');

-- Admin promovido pelo dono do banco
insert into auth.users (email, raw_user_meta_data) values ('adm@site.com', '{"role":"personal","full_name":"Admin do Site"}');
update public.profiles set role = 'admin' where email = 'adm@site.com';

select pg_temp.as_user('adm@site.com');
select pg_temp.assert(public.is_admin(), 'admin é reconhecido');
select pg_temp.as_user('dora@p.com');
select pg_temp.assert(not public.is_admin(), 'Personal não é admin');
select pg_temp.assert(pg_temp.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$), 'Personal não muda o próprio papel');
select pg_temp.assert(pg_temp.fails($$update public.profiles set catalog_blocked = false where id = auth.uid()$$), 'Personal não mexe no próprio bloqueio');

-- Personal cria um exercício normalmente
insert into public.equipment (name, muscle_group, created_by) values ('Máquina da Dora', 'costas', auth.uid());
reset role;
create temp table a_eq as select id from public.equipment where name = 'Máquina da Dora';
grant all on a_eq to authenticated;

-- Exercício travado: Personal não edita, não exclui, não troca foto, não destrava
update public.equipment set locked = true where id = (select id from a_eq);
select pg_temp.as_user('dora@p.com');
update public.equipment set name = 'Renomeado' where id = (select id from a_eq);
select pg_temp.assert((select name from public.equipment where id = (select id from a_eq)) = 'Máquina da Dora', 'exercício travado não é editado');
delete from public.equipment where id = (select id from a_eq);
select pg_temp.assert(exists (select 1 from public.equipment where id = (select id from a_eq)), 'exercício travado não é excluído');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image((select id from a_eq), null)$$), 'foto de exercício travado não muda');
select pg_temp.assert(pg_temp.fails($$update public.equipment set locked = false where id = (select id from a_eq)$$), 'Personal não destrava');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image((select id from public.equipment where is_default and locked limit 1), null)$$)
  or not exists (select 1 from public.equipment where is_default and locked), 'padrão travado também protegido');

-- Personal bloqueado: não cria, edita, exclui nem troca foto
reset role;
update public.equipment set locked = false where id = (select id from a_eq);
update public.profiles set catalog_blocked = true where email = 'dora@p.com';
select pg_temp.as_user('dora@p.com');
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by) values ('Outra', 'costas', auth.uid())$$),
  'Personal bloqueado não cria exercício');
update public.equipment set name = 'Renomeado' where id = (select id from a_eq);
select pg_temp.assert((select name from public.equipment where id = (select id from a_eq)) = 'Máquina da Dora', 'Personal bloqueado não edita');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image((select id from public.equipment where is_default limit 1), null)$$),
  'Personal bloqueado não troca foto do padrão');

-- Desbloqueado volta a editar
reset role;
update public.profiles set catalog_blocked = false where email = 'dora@p.com';
select pg_temp.as_user('dora@p.com');
update public.equipment set name = 'Renomeado' where id = (select id from a_eq);
select pg_temp.assert((select name from public.equipment where id = (select id from a_eq)) = 'Renomeado', 'desbloqueado volta a editar');
reset role;
\echo '✅ Todos os testes de admin passaram'

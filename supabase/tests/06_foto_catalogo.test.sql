-- Testes da foto única do catálogo padrão.
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
  ('ugo@p.com',  '{"role":"personal","full_name":"Ugo Personal"}'),
  ('vera@p.com', '{"role":"personal","full_name":"Vera Personal"}');
select pg_temp.as_user('ugo@p.com');
create temp table t_i as select * from public.create_invite(7, null);
grant all on t_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'wil@a.com', jsonb_build_object('role','aluno','full_name','Wil Aluno',
  'phone','11944443333','invite_token', token, 'terms_accepted', true) from t_i;
create temp table eq as select id from public.equipment where name = 'Leg press 45°';
-- O catálogo padrão vem travado pelas fotos do admin; aqui testamos um exercício destravado.
update public.equipment set locked = false where id = (select id from eq);
grant all on eq to authenticated;

select pg_temp.as_user('ugo@p.com');
select public.set_equipment_image((select id from eq), auth.uid()::text || '/legpress.webp');
select pg_temp.assert((select image_path from public.equipment where id = (select id from eq)) like '%/legpress.webp',
  'Personal troca a foto de um exercício padrão');
select pg_temp.assert((select image_credit from public.equipment where id = (select id from eq)) = 'Foto enviada por Ugo Personal',
  'crédito de quem enviou');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image((select id from eq),
  (select id::text from auth.users where email = 'vera@p.com') || '/x.webp')$$), 'não usa imagem da pasta de outro Personal');
select pg_temp.assert(pg_temp.fails($$update public.equipment set image_path = 'x' where id = (select id from eq)$$)
  or (select image_path from public.equipment where id = (select id from eq)) <> 'x', 'update direto no padrão continua bloqueado');

select pg_temp.as_user('vera@p.com');
select pg_temp.assert((select image_path from public.equipment where id = (select id from eq)) like '%/legpress.webp',
  'a foto vale para todos os Personais');
insert into public.equipment (name, muscle_group, created_by) values ('Máquina da Vera', 'costas', auth.uid());
select public.set_equipment_image((select id from eq), null);
select pg_temp.assert((select image_path is null and image_credit like 'Ilustração%' from public.equipment where id = (select id from eq)),
  'remover a foto volta para a ilustração');

select pg_temp.as_user('ugo@p.com');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image(
  (select id from public.equipment where name = 'Máquina da Vera'), auth.uid()::text || '/y.webp')$$),
  'não troca foto de exercício criado por outro Personal');

select pg_temp.as_user('wil@a.com');
select pg_temp.assert(pg_temp.fails($$select public.set_equipment_image((select id from eq), auth.uid()::text || '/z.webp')$$),
  'aluno não troca foto');

reset role;
\echo '✅ Todos os testes da foto do catálogo passaram'

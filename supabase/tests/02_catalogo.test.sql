-- Testes do catálogo de equipamentos (etapa 3).
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

-- Cenário: Gil (Personal) com aluna Hana; Iara (Personal) sem relação.
insert into auth.users (email, raw_user_meta_data) values
  ('gil@p.com',  '{"role":"personal","full_name":"Gil Personal"}'),
  ('iara@p.com', '{"role":"personal","full_name":"Iara Personal"}');
select pg_temp.as_user('gil@p.com');
create temp table t_inv as select * from public.create_invite(7, null);
grant all on t_inv to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'hana@a.com', jsonb_build_object('role','aluno','full_name','Hana Aluna',
  'phone','11988887777','invite_token', token, 'terms_accepted', true) from t_inv;

select pg_temp.as_user('gil@p.com');
select pg_temp.assert((select count(*) from public.equipment where is_default) >= 60, 'catálogo padrão populado (60+)');
select pg_temp.assert(not exists (select 1 from public.equipment where is_default and image_url is null),
  'todo item padrão tem imagem');

insert into public.equipment (name, muscle_group, created_by) values ('Remada máquina articulada', 'costas', auth.uid());
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by, is_default)
  values ('Hack fake', 'quadriceps', auth.uid(), true)$$), 'Personal não cria item padrão');
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by)
  values ('De outro', 'peito', (select id from auth.users where email = 'iara@p.com'))$$), 'Personal não cria em nome de outro');
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by)
  values ('remada MÁQUINA articulada', 'costas', auth.uid())$$), 'nome repetido do mesmo Personal é rejeitado');
select pg_temp.assert(pg_temp.fails($$update public.equipment set is_default = true where created_by = auth.uid()$$),
  'Personal não promove item a padrão');
update public.equipment set description = 'Hack!' where name = 'Supino reto com barra';
select pg_temp.assert((select description from public.equipment where name = 'Supino reto com barra') <> 'Hack!',
  'Personal não edita item padrão');

select pg_temp.as_user('hana@a.com');
select pg_temp.assert(exists (select 1 from public.equipment where name = 'Remada máquina articulada'),
  'aluna vê exercício criado pelo seu Personal');
select pg_temp.assert(pg_temp.fails($$insert into public.equipment (name, muscle_group, created_by)
  values ('Inventado', 'peito', auth.uid())$$), 'aluno não cria exercício');

select pg_temp.as_user('iara@p.com');
select pg_temp.assert(not exists (select 1 from public.equipment where name = 'Remada máquina articulada'),
  'Personal sem relação não vê exercício alheio');
delete from public.equipment where name = 'Remada máquina articulada';
select pg_temp.as_user('gil@p.com');
select pg_temp.assert(exists (select 1 from public.equipment where name = 'Remada máquina articulada'),
  'Personal não exclui exercício alheio');

-- Storage
select pg_temp.as_user('gil@p.com');
insert into storage.objects (bucket_id, name) values ('equipment', (select auth.uid())::text || '/foto.webp');
select pg_temp.assert(pg_temp.fails($$insert into storage.objects (bucket_id, name)
  values ('equipment', (select id::text from auth.users where email = 'iara@p.com') || '/x.webp')$$),
  'Personal não envia imagem na pasta de outro');
select pg_temp.as_user('hana@a.com');
select pg_temp.assert(pg_temp.fails($$insert into storage.objects (bucket_id, name)
  values ('equipment', (select auth.uid())::text || '/x.webp')$$), 'aluno não envia imagem');

reset role;
\echo '✅ Todos os testes do catálogo passaram'

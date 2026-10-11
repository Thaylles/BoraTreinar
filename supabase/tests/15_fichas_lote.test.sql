-- Aplicar fichas em lote. Cenário próprio: Nico (Personal) com alunos Lia e Teo; Quico (outro Personal) com Bia.
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
  ('lote.nico@p.com', '{"role":"personal","full_name":"Nico Personal"}'),
  ('lote.quico@p.com', '{"role":"personal","full_name":"Quico Personal"}');
select pg_temp.as_user('lote.nico@p.com');
create temp table l_i1 as select * from public.create_invite(7, null);
create temp table l_i2 as select * from public.create_invite(7, null);
grant all on l_i1, l_i2 to authenticated;
select pg_temp.as_user('lote.quico@p.com');
create temp table l_i3 as select * from public.create_invite(7, null);
grant all on l_i3 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'lote.lia@a.com', jsonb_build_object('role','aluno','full_name','Lia','phone','11911112222','invite_token', token, 'terms_accepted', true) from l_i1;
insert into auth.users (email, raw_user_meta_data)
select 'lote.teo@a.com', jsonb_build_object('role','aluno','full_name','Teo','phone','11911113333','invite_token', token, 'terms_accepted', true) from l_i2;
insert into auth.users (email, raw_user_meta_data)
select 'lote.bia@a.com', jsonb_build_object('role','aluno','full_name','Bia','phone','11911114444','invite_token', token, 'terms_accepted', true) from l_i3;
create temp table l_ids as select
  (select id from auth.users where email = 'lote.lia@a.com') as lia,
  (select id from auth.users where email = 'lote.teo@a.com') as teo,
  (select id from auth.users where email = 'lote.bia@a.com') as bia;
grant all on l_ids to authenticated;

select pg_temp.as_user('lote.nico@p.com');
create temp table l_m as select
  public.save_workout_plan(null, null, 'Iniciante Inferior 1', null, null, null,
    jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Leg press 45°')))) as m1,
  public.save_workout_plan(null, null, 'Intermediário Superior 1', null, null, null,
    jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra')))) as m2;
grant all on l_m to authenticated;
-- Ficha antiga da Lia
select public.save_workout_plan(null, (select lia from l_ids), 'Ficha antiga', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Prancha'))));

create temp table l_r as select public.apply_plans_to_students(
  array[(select m1 from l_m), (select m2 from l_m)], array[(select lia from l_ids), (select teo from l_ids)], true) as r;
grant all on l_r to authenticated;
select pg_temp.assert(((select r from l_r)->>'created')::int = 4, '2 modelos × 2 alunos = 4 fichas');
select pg_temp.assert(((select r from l_r)->>'archived')::int = 1, 'ficha antiga da Lia arquivada');
select pg_temp.assert((select count(*) from public.workout_plans where student_id = (select lia from l_ids) and archived_at is null) = 2,
  'Lia fica só com as 2 novas ativas');
select pg_temp.assert((select archived_at is not null from public.workout_plans where name = 'Ficha antiga'), 'antiga continua existindo (arquivada)');
select pg_temp.assert((select count(*) from public.workout_plan_items i join public.workout_plans p on p.id = i.plan_id
  where p.student_id = (select teo from l_ids)) = 2, 'itens copiados');

-- Sem substituir: só acrescenta
select public.apply_plans_to_students(array[(select m1 from l_m)], array[(select teo from l_ids)], false);
select pg_temp.assert((select count(*) from public.workout_plans where student_id = (select teo from l_ids) and archived_at is null) = 3,
  'sem substituir, acrescenta');

-- Aluno de outro Personal: nada é aplicado (tudo ou nada)
select pg_temp.assert(pg_temp.fails($$select public.apply_plans_to_students(array[(select m1 from l_m)],
  array[(select lia from l_ids), (select bia from l_ids)], true)$$), 'aluno de outro Personal é recusado');
select pg_temp.assert((select count(*) from public.workout_plans where student_id = (select lia from l_ids) and archived_at is null) = 2,
  'falha não deixa nada pela metade');

-- Modelo de outro Personal não pode ser usado
select pg_temp.as_user('lote.quico@p.com');
select pg_temp.assert(pg_temp.fails($$select public.apply_plans_to_students(array[(select m1 from l_m)], array[(select bia from l_ids)], false)$$),
  'modelo alheio é recusado');
select pg_temp.as_user('lote.lia@a.com');
select pg_temp.assert(pg_temp.fails($$select public.apply_plans_to_students(array[(select m1 from l_m)], array[auth.uid()], false)$$),
  'aluno não aplica fichas');
reset role;
\echo '✅ Todos os testes de fichas em lote passaram'

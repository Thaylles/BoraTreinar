-- Conquistas: catálogo, liberação automática, secretas mascaradas e permissões.
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
  ('conq.p@p.com', '{"role":"personal","full_name":"Paulo Conquista"}');
select pg_temp.as_user('conq.p@p.com');
create temp table c_i as select * from public.create_invite(7, null);
grant all on c_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'conq.a@a.com', jsonb_build_object('role','aluno','full_name','Ana Conquista','phone','11955554444','invite_token', token, 'terms_accepted', true) from c_i;
insert into auth.users (email, raw_user_meta_data) values
  ('conq.b@a.com', '{"role":"aluno","full_name":"Bia Sozinha","phone":"11955553333","terms_accepted":true}');
create temp table c as select (select id from auth.users where email = 'conq.a@a.com') as ana,
  (select id from auth.users where email = 'conq.b@a.com') as bia;
grant all on c to authenticated;

select pg_temp.assert((select count(*) from public.achievements) = 200, '200 conquistas no catálogo');
select pg_temp.assert((select count(*) from public.achievements where hidden) = 100, '100 secretas');
select pg_temp.assert((select count(distinct metric) from public.achievements) >= 60, 'métricas variadas');
-- Toda métrica usada existe no cálculo
select pg_temp.assert(not exists (select 1 from public.achievements a
  where not (private.achievement_metrics((select ana from c)) ? a.metric)), 'todas as métricas são calculadas');

select pg_temp.assert((select count(*) from public.student_achievements sa where sa.student_id = (select ana from c) and sa.code = 'tenho-personal') = 1,
  'vínculo com Personal libera "Tenho Personal" na hora');

-- Treino às 5h30 (SP), supino 40 kg, 6 e depois 7 repetições
select pg_temp.as_user('conq.a@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 80);
select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', ((now() at time zone 'America/Sao_Paulo')::date + time '05:30') at time zone 'America/Sao_Paulo' - interval '1 day',
  'finished_at', ((now() at time zone 'America/Sao_Paulo')::date + time '06:20') at time zone 'America/Sao_Paulo' - interval '1 day',
  'exercises', jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'sets', jsonb_build_array(
      jsonb_build_object('load_kg', 40, 'reps', 6, 'done', true),
      jsonb_build_object('load_kg', 40, 'reps', 7, 'done', true))))));

reset role;
select pg_temp.assert((select array_agg(code order by code) from public.student_achievements where student_id = (select ana from c)
  and code in ('ta-pago', 'supino-de-respeito', 'novo-recorde', 'madrugador', '67', 'subiu-na-balanca')) =
  array['67', 'madrugador', 'novo-recorde', 'subiu-na-balanca', 'supino-de-respeito', 'ta-pago'], 'treino libera conquistas visíveis e secretas');
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from c) and link = '/aluno/conquistas') >= 1,
  'aluna é avisada das conquistas');
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from c) and title like '%conquistas desbloqueadas!') >= 1,
  'várias de uma vez viram um resumo');

-- Leitura pela RPC
select pg_temp.as_user('conq.a@a.com');
select pg_temp.assert(pg_temp.fails($$select * from public.achievements$$), 'catálogo não é lido direto');
select pg_temp.assert((select count(*) from public.my_achievements()) = 200, 'aluna vê as 200');
select pg_temp.assert((select count(*) from public.my_achievements() where hidden and unlocked_at is null and title is null and description is null) =
  (select count(*) from public.my_achievements() where hidden and unlocked_at is null), 'secretas bloqueadas vêm sem nome');
select pg_temp.assert((select title from public.my_achievements() where code = 'madrugador') = 'Madrugador', 'secreta liberada mostra o nome');
select pg_temp.assert((select progress = 1 and threshold = 5 from public.my_achievements() where code = 'saindo-da-jaula'), 'progresso das visíveis');
select pg_temp.assert(pg_temp.fails($$select * from public.my_achievements((select bia from c))$$), 'aluna não vê conquistas de outra');

select pg_temp.as_user('conq.p@p.com');
select pg_temp.assert((select count(*) from public.my_achievements((select ana from c)) where unlocked_at is not null) >= 6, 'Personal vê as conquistas da aluna');
select pg_temp.assert(pg_temp.fails($$select * from public.my_achievements((select bia from c))$$), 'Personal não vê aluno de fora');

select pg_temp.as_user('conq.b@a.com');
select pg_temp.assert((select count(*) from public.my_achievements() where unlocked_at is not null) = 0, 'aluno sem treino começa zerado');

reset role;
\echo '✅ Todos os testes de conquistas passaram'

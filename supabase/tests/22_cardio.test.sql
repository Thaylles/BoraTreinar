-- Cardio completo (tempo, distância, intensidade) e meta semanal de cardio.
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
  ('car.p@p.com', '{"role":"personal","full_name":"Paula Cardio"}'),
  ('car.a@a.com', '{"role":"aluno","full_name":"Ana Corre","phone":"11944441111","terms_accepted":true}'),
  ('car.b@a.com', '{"role":"aluno","full_name":"Beto Bike","phone":"11944442222","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'car.p@p.com') as paula,
  (select id from auth.users where email = 'car.a@a.com') as ana,
  (select id from auth.users where email = 'car.b@a.com') as beto;
grant all on c to authenticated;

select pg_temp.assert((select intensity_unit from public.equipment where name = 'Esteira') = 'velocidade', 'esteira mede velocidade');
select pg_temp.assert((select bool_and(intensity_unit = 'nivel') from public.equipment where name in ('Bicicleta ergométrica', 'Elíptico')),
  'bicicleta e elíptico medem nível');

-- Ana (sem Personal) faz esteira 30 min / 4,5 km a 9 km/h e bicicleta 15 min no nível 6.
select pg_temp.as_user('car.a@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 60);
select public.save_workout_session(jsonb_build_object(
  'client_id', gen_random_uuid(), 'student_id', auth.uid(), 'kind', 'livre',
  'started_at', now() - interval '50 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Esteira'), 'sets', jsonb_build_array(
      jsonb_build_object('load_kg', 0, 'reps', 30, 'done', true, 'duration_min', 30, 'distance_km', 4.5, 'speed_kmh', 9, 'incline_pct', 1))),
    jsonb_build_object('equipment_id', pg_temp.eq('Bicicleta ergométrica'), 'sets', jsonb_build_array(
      jsonb_build_object('load_kg', 0, 'reps', 15, 'done', true, 'duration_min', 15, 'level', 6))))));
select pg_temp.assert((select count(*) from public.session_sets ss join public.workout_sessions ws on ws.id = ss.session_id
  where ws.student_id = auth.uid() and ss.duration_min = 30 and ss.distance_km = 4.5 and ss.speed_kmh = 9 and ss.incline_pct = 1) = 1,
  'série de cardio guarda tempo, distância, velocidade e inclinação');
select pg_temp.assert((public.cardio_week(auth.uid())->>'minutes')::numeric = 45 and (public.cardio_week(auth.uid())->>'km')::numeric = 4.5
  and (public.cardio_week(auth.uid())->>'days')::int = 1, 'semana soma 45 min e 4,5 km de cardio');
select pg_temp.assert(public.cardio_week(auth.uid())->'goal' = 'null'::jsonb, 'sem meta ainda');

-- Sem Personal, a Ana define a própria meta
select public.set_cardio_goal(auth.uid(), 'intenso', 40, 8.5, 5);
select pg_temp.assert((public.cardio_week(auth.uid())->>'intense_minutes')::numeric = 45, 'ritmo forte: esteira ≥ 8,5 km/h e bicicleta nível ≥ 5');
select pg_temp.assert(pg_temp.fails($$select public.set_cardio_goal(auth.uid(), 'intenso', 40)$$), 'ritmo forte exige velocidade ou nível');
select pg_temp.assert(pg_temp.fails($$select public.set_cardio_goal(auth.uid(), 'minutos', 0)$$), 'meta zero é rejeitada');
select public.set_cardio_goal(auth.uid(), 'minutos', 150);
select pg_temp.assert((select kind = 'minutos' and target = 150 and min_speed_kmh is null from public.cardio_goals where student_id = auth.uid()),
  'aluna sem Personal troca a própria meta');
select pg_temp.assert(pg_temp.fails($$select public.cardio_week((select beto from c))$$), 'aluno não vê o cardio de outro');
select pg_temp.assert(pg_temp.fails($$select public.set_cardio_goal((select beto from c), 'minutos', 60)$$), 'aluno não mexe na meta de outro');
select pg_temp.assert(pg_temp.fails($$insert into public.cardio_goals (student_id, kind, target) values (auth.uid(), 'minutos', 10)$$),
  'meta só pela função');

-- Com Personal, quem define é a Paula
reset role;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select ana from c), 'responsavel');
select pg_temp.as_user('car.a@a.com');
select pg_temp.assert(pg_temp.fails($$select public.set_cardio_goal(auth.uid(), 'minutos', 90)$$), 'com Personal, a aluna não define a meta');
select pg_temp.as_user('car.p@p.com');
select pg_temp.assert((public.cardio_week((select ana from c))->>'minutes')::numeric = 45, 'Personal vê o cardio da aluna');
select public.set_cardio_goal((select ana from c), 'distancia', 12);
select pg_temp.assert((public.cardio_week((select ana from c))->'goal'->>'by_personal')::boolean, 'meta marcada como do Personal');
select pg_temp.assert(pg_temp.fails($$select public.set_cardio_goal((select beto from c), 'minutos', 60)$$), 'Personal não mexe em aluno de fora');
select pg_temp.assert(pg_temp.fails($$select public.cardio_week((select beto from c))$$), 'Personal não vê aluno de fora');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from c) and title like 'Nova meta de cardio%') = 1,
  'aluna é avisada da meta');
-- Sem vínculo de novo, a aluna volta a cuidar da própria meta
delete from public.personal_students where student_id = (select ana from c);
select pg_temp.as_user('car.a@a.com');
select pg_temp.assert((select kind from public.cardio_goals where student_id = auth.uid()) = 'distancia', 'aluna lê a meta da Personal');
select public.clear_cardio_goal(auth.uid());
select pg_temp.assert(not exists (select 1 from public.cardio_goals where student_id = auth.uid()), 'sem Personal, a aluna pode remover a meta');

reset role;
\echo '✅ Todos os testes de cardio passaram'

-- Testes de peso corporal, privacidade e trava de pesagem (etapa 6).
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

-- Cenário: Rita (Personal) com aluno Sol; Tânia (Personal) sem vínculo.
insert into auth.users (email, raw_user_meta_data) values
  ('rita@p.com',  '{"role":"personal","full_name":"Rita Personal"}'),
  ('tania@p.com', '{"role":"personal","full_name":"Tânia Personal"}');
select pg_temp.as_user('rita@p.com');
create temp table t_i as select * from public.create_invite(7, null);
grant all on t_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'sol@a.com', jsonb_build_object('role','aluno','full_name','Sol Aluno',
  'phone','11955554444','invite_token', token, 'terms_accepted', true) from t_i;
create temp table ids as select (select id from auth.users where email = 'sol@a.com') as sol;
grant all on ids to authenticated;

select pg_temp.as_user('rita@p.com');
create temp table t_plan as select public.save_workout_plan(null, (select sol from ids), 'Treino A', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', (select id from public.equipment where name = 'Prancha')))) as id;
grant all on t_plan to authenticated;

create or replace function pg_temp.session(p_started timestamptz) returns jsonb language sql as $$
  select jsonb_build_object(
    'client_id', gen_random_uuid(), 'student_id', (select sol from ids), 'plan_id', (select id from t_plan),
    'kind', 'ficha', 'started_at', p_started, 'finished_at', p_started + interval '30 minutes',
    'exercises', jsonb_build_array(jsonb_build_object(
      'equipment_id', (select id from public.equipment where name = 'Prancha'),
      'sets', jsonb_build_array(jsonb_build_object('load_kg', 0, 'reps', 60, 'done', true)))))
$$;

-- ── Trava ─────────────────────────────────────────────────────
select pg_temp.as_user('sol@a.com');
select pg_temp.assert((select overdue from public.weigh_in_status(auth.uid())), 'sem pesagem = vencida');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.session(now() - interval '40 minutes'))$$),
  'aluno NÃO registra treino com pesagem vencida');

select pg_temp.as_user('rita@p.com');
select pg_temp.assert(not pg_temp.fails($$select public.save_workout_session(pg_temp.session(now() - interval '40 minutes'))$$),
  'registro manual do Personal não é bloqueado');

select pg_temp.as_user('sol@a.com');
insert into public.body_weights (student_id, weight_kg, measured_on)
  values (auth.uid(), 82.5, (now() at time zone 'America/Sao_Paulo')::date - 8);
select pg_temp.assert((select overdue from public.weigh_in_status(auth.uid())), 'pesagem de 8 dias atrás vence no semanal');
insert into public.student_settings (student_id, weigh_in_frequency) values (auth.uid(), 'quinzenal');
select pg_temp.assert(not (select overdue from public.weigh_in_status(auth.uid())), 'no quinzenal, 8 dias ainda está em dia');
select pg_temp.assert(not pg_temp.fails($$select public.save_workout_session(pg_temp.session(now() - interval '40 minutes'))$$),
  'com pesagem em dia o aluno treina');
update public.student_settings set weigh_in_frequency = 'semanal';
select pg_temp.assert(pg_temp.fails($$select public.save_workout_session(pg_temp.session(now() - interval '40 minutes'))$$),
  'voltando ao semanal, trava de novo');
-- Treino iniciado quando estava em dia (offline) continua aceito
select pg_temp.assert(not pg_temp.fails($$select public.save_workout_session(pg_temp.session(now() - interval '2 days'))$$),
  'treino iniciado quando a pesagem estava em dia é aceito');

insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 81.2);
select pg_temp.assert(not (select overdue from public.weigh_in_status(auth.uid())), 'pesou hoje: liberado');
select pg_temp.assert(pg_temp.fails($$insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 81)$$),
  'uma pesagem por dia');
update public.body_weights set weight_kg = 81.0 where measured_on = (now() at time zone 'America/Sao_Paulo')::date;
select pg_temp.assert((select weight_kg from public.body_weights where measured_on = (now() at time zone 'America/Sao_Paulo')::date) = 81.0,
  'aluno corrige o peso do dia');
select pg_temp.assert(pg_temp.fails($$insert into public.body_weights (student_id, weight_kg, measured_on)
  values (auth.uid(), 80, (now() at time zone 'America/Sao_Paulo')::date + 1)$$), 'data futura é rejeitada');
select pg_temp.assert(pg_temp.fails($$insert into public.body_weights (student_id, weight_kg, measured_on)
  values (auth.uid(), 5, (now() at time zone 'America/Sao_Paulo')::date - 2)$$), 'peso absurdo é rejeitado');

-- ── Privacidade ───────────────────────────────────────────────
select pg_temp.as_user('rita@p.com');
select pg_temp.assert((select count(*) from public.body_weights) = 0, 'Personal NÃO vê o peso por padrão');
select pg_temp.assert(pg_temp.fails($$insert into public.body_weights (student_id, weight_kg) values ((select sol from ids), 70)$$),
  'Personal não registra peso do aluno');
select pg_temp.assert((select last_measured_on from public.weigh_in_status((select sol from ids))) is not null,
  'Personal vê só a data da última pesagem (sem o valor)');
select pg_temp.assert(pg_temp.fails($$update public.student_settings set weight_visible_to_personal = true$$)
  or not (select coalesce(bool_or(weight_visible_to_personal), false) from public.student_settings),
  'Personal não altera a privacidade do aluno');

select pg_temp.as_user('sol@a.com');
update public.student_settings set weight_visible_to_personal = true;
select pg_temp.as_user('rita@p.com');
select pg_temp.assert((select count(*) from public.body_weights) = 2, 'com permissão, Personal vê o peso');

select pg_temp.as_user('tania@p.com');
select pg_temp.assert((select count(*) from public.body_weights) = 0, 'Personal sem vínculo nunca vê o peso');
select pg_temp.assert(not exists (select 1 from public.weigh_in_status((select sol from ids))), 'nem a situação da pesagem');

select pg_temp.as_user('sol@a.com');
update public.student_settings set weight_visible_to_personal = false;
select pg_temp.as_user('rita@p.com');
select pg_temp.assert((select count(*) from public.body_weights) = 0, 'revogou: Personal deixa de ver na hora');

reset role;
\echo '✅ Todos os testes de peso passaram'

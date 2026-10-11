-- Melhorias: técnica na ficha, avaliação do treino, meta semanal, avisos de ficha, inatividade e push.
-- Cenário próprio: Rui (Personal) com a aluna Ana; Zeca é outro aluno (de outro Personal, Duda).
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
  ('melh.rui@p.com', '{"role":"personal","full_name":"Rui Personal"}'),
  ('melh.duda@p.com', '{"role":"personal","full_name":"Duda Personal"}');
select pg_temp.as_user('melh.rui@p.com');
create temp table m_i1 as select * from public.create_invite(7, null);
grant all on m_i1 to authenticated;
select pg_temp.as_user('melh.duda@p.com');
create temp table m_i2 as select * from public.create_invite(7, null);
grant all on m_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'melh.ana@a.com', jsonb_build_object('role','aluno','full_name','Ana Souza','phone','11922221111','invite_token', token, 'terms_accepted', true) from m_i1;
insert into auth.users (email, raw_user_meta_data)
select 'melh.zeca@a.com', jsonb_build_object('role','aluno','full_name','Zeca','phone','11922223333','invite_token', token, 'terms_accepted', true) from m_i2;
create temp table m_ids as select
  (select id from auth.users where email = 'melh.rui@p.com') as rui,
  (select id from auth.users where email = 'melh.ana@a.com') as ana,
  (select id from auth.users where email = 'melh.zeca@a.com') as zeca;
grant all on m_ids to authenticated;

-- ─── Técnica por exercício ───────────────────────────────────
select pg_temp.as_user('melh.rui@p.com');
create temp table m_plan as select public.save_workout_plan(null, (select ana from m_ids), 'Treino A', null, null, null,
  jsonb_build_array(
    jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'), 'technique', 'biset', 'notes', 'Cadência 3-1-1'),
    jsonb_build_object('equipment_id', pg_temp.eq('Crucifixo reto com halteres')),
    jsonb_build_object('equipment_id', pg_temp.eq('Tríceps corda'), 'technique', 'dropset'))) as id;
grant all on m_plan to authenticated;
select pg_temp.assert((select technique from public.workout_plan_items where plan_id = (select id from m_plan) and position = 1) = 'biset',
  'técnica gravada');
select pg_temp.assert((select technique from public.workout_plan_items where plan_id = (select id from m_plan) and position = 2) is null,
  'sem técnica = normal');
select pg_temp.assert(pg_temp.fails($$select public.save_workout_plan(null, (select ana from m_ids), 'X', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Prancha'), 'technique', 'inventada')))$$), 'técnica inválida é recusada');
create temp table m_dup as select public.duplicate_workout_plan((select id from m_plan), null, 'Modelo A') as id;
grant all on m_dup to authenticated;
select pg_temp.assert((select count(*) from public.workout_plan_items where plan_id = (select id from m_dup) and technique is not null) = 2,
  'duplicar mantém as técnicas');

-- ─── Aviso de ficha nova/atualizada para o aluno ─────────────
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from m_ids)
  and link = '/aluno/fichas/' || (select id from m_plan) and title like '📋 Nova ficha:%') = 1, 'aluno avisado da ficha nova');
select pg_temp.assert((select count(*) from public.notifications n join public.workout_plans p on '/aluno/fichas/' || p.id = n.link
  where p.id = (select id from m_dup)) = 0, 'modelo não gera aviso');
select pg_temp.as_user('melh.rui@p.com');
select public.save_workout_plan((select id from m_plan), null, 'Treino A editado', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'))));
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from m_ids)
  and link = '/aluno/fichas/' || (select id from m_plan)) = 1, 'edição logo em seguida não repete o aviso');
update public.notifications set created_at = now() - interval '1 hour' where user_id = (select ana from m_ids);
select pg_temp.as_user('melh.rui@p.com');
select public.save_workout_plan((select id from m_plan), null, 'Treino A v2', null, null, null,
  jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'))));
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from m_ids)
  and title like '✏️ Ficha atualizada:%') = 1, 'edição mais tarde avisa "ficha atualizada"');

-- ─── Avaliação do treino ─────────────────────────────────────
select pg_temp.as_user('melh.ana@a.com');
insert into public.body_weights (student_id, weight_kg) values (auth.uid(), 62);
create temp table m_s as select (public.save_workout_session(jsonb_build_object(
  'client_id', '10000000-0000-0000-0000-000000000016', 'student_id', auth.uid(), 'plan_id', (select id from m_plan), 'kind', 'ficha',
  'started_at', now() - interval '40 minutes', 'finished_at', now(),
  'exercises', jsonb_build_array(jsonb_build_object('equipment_id', pg_temp.eq('Supino reto com barra'),
    'sets', jsonb_build_array(jsonb_build_object('load_kg', 30, 'reps', 10, 'done', true)))))) ->> 'id')::uuid as id;
grant all on m_s to authenticated;
select pg_temp.assert(pg_temp.fails($$select public.rate_workout_session((select id from m_s), 6, false, null)$$), 'nota fora de 1–5 recusada');
select public.rate_workout_session((select id from m_s), 4, false, 'Puxado!');
select pg_temp.assert((select effort = 4 and not pain and feedback = 'Puxado!' from public.workout_sessions where id = (select id from m_s)),
  'avaliação gravada');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select rui from m_ids) and title like '⚠️%') = 0,
  'sem dor, Personal não é avisado');
select pg_temp.as_user('melh.ana@a.com');
select public.rate_workout_session((select id from m_s), 5, true, 'Dor no ombro direito');
select public.rate_workout_session((select id from m_s), 5, true, 'Dor no ombro direito');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select rui from m_ids)
  and title = '⚠️ Ana relatou dor no treino' and link = '/personal/treinos/' || (select id from m_s)) = 1,
  'dor avisa o Personal uma única vez, com link do treino');
select pg_temp.as_user('melh.rui@p.com');
select pg_temp.assert(pg_temp.fails($$select public.rate_workout_session((select id from m_s), 3, false, null)$$), 'Personal não avalia pelo aluno');
select pg_temp.as_user('melh.zeca@a.com');
select pg_temp.assert(pg_temp.fails($$select public.rate_workout_session((select id from m_s), 3, false, null)$$), 'outro aluno não avalia');
reset role;
update public.workout_sessions set started_at = now() - interval '9 days', finished_at = now() - interval '8 days' where id = (select id from m_s);
select pg_temp.as_user('melh.ana@a.com');
select pg_temp.assert(pg_temp.fails($$select public.rate_workout_session((select id from m_s), 3, false, null)$$), 'depois de 7 dias não avalia');

-- ─── Meta semanal ────────────────────────────────────────────
insert into public.student_settings (student_id, weekly_goal) values (auth.uid(), 3)
  on conflict (student_id) do update set weekly_goal = 3;
select pg_temp.assert((select weekly_goal from public.student_settings where student_id = auth.uid()) = 3, 'aluno define a meta');
update public.student_settings set weekly_goal = 5 where student_id = auth.uid();
select pg_temp.assert((select weekly_goal from public.student_settings where student_id = auth.uid()) = 5, 'aluno altera a meta');
select pg_temp.assert(pg_temp.fails($$update public.student_settings set weekly_goal = 9 where student_id = auth.uid()$$), 'meta acima de 7 recusada');
select pg_temp.as_user('melh.rui@p.com');
update public.student_settings set weekly_goal = 1 where student_id = (select ana from m_ids);
select pg_temp.assert((select weekly_goal from public.student_settings where student_id = (select ana from m_ids)) = 5, 'Personal não altera a meta do aluno');

-- ─── Inscrições de push ──────────────────────────────────────
select pg_temp.as_user('melh.ana@a.com');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://push.example/ana', 'k', 'a');
select pg_temp.assert(pg_temp.fails($$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ((select zeca from m_ids), 'https://push.example/x', 'k', 'a')$$), 'não inscreve outra pessoa');
select pg_temp.as_user('melh.zeca@a.com');
select pg_temp.assert((select count(*) from public.push_subscriptions) = 0, 'não vê inscrições alheias');
select pg_temp.assert(pg_temp.fails($$select * from private.push_config$$), 'configuração do push é privada');
reset role;
-- Sem configuração, notificar não quebra nada (o push só sai com private.push_config).
insert into public.notifications (user_id, title) values ((select ana from m_ids), 'teste push');
select pg_temp.assert((select count(*) from public.notifications where title = 'teste push') = 1, 'notificação criada sem push configurado');

-- ─── Lembrete de inatividade ─────────────────────────────────
update public.workout_sessions set started_at = now() - interval '6 days', finished_at = now() - interval '6 days' + interval '40 minutes'
 where id = (select id from m_s);
select pg_temp.assert(public.inactivity_nudges() >= 1, 'aluna parada há 6 dias recebe lembrete');
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from m_ids) and title = '💪 Faz 6 dias que você não treina') = 1,
  'texto com os dias sem treinar');
select public.inactivity_nudges();
select pg_temp.assert((select count(*) from public.notifications where user_id = (select ana from m_ids) and title like '💪 Faz %') = 1,
  'não repete o lembrete no dia seguinte');
select pg_temp.as_user('melh.ana@a.com');
select pg_temp.assert(pg_temp.fails($$select public.inactivity_nudges()$$), 'aluno não dispara lembretes');
reset role;
\echo '✅ Todos os testes de melhorias passaram'

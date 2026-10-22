-- Pedido de troca de aula pelo aluno (mesma semana ou seguinte) e resposta do Personal.
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
  ('tro.p@p.com', '{"role":"personal","full_name":"Tina Troca"}'),
  ('tro.o@p.com', '{"role":"personal","full_name":"Otto Outro"}');
select pg_temp.as_user('tro.p@p.com');
create temp table t_i as select * from public.create_invite(7, null);
grant all on t_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'tro.a@a.com', jsonb_build_object('role','aluno','full_name','Bia Troca',
  'phone','11922225555','invite_token', token, 'terms_accepted', true) from t_i;
-- d = próxima quarta (a partir de amanhã, fuso SP); w = segunda da semana de d
create temp table t as select
  (select id from auth.users where email = 'tro.a@a.com') as bia,
  ((now() at time zone 'America/Sao_Paulo')::date + 1
    + ((3 - extract(dow from (now() at time zone 'America/Sao_Paulo')::date + 1)::int + 7) % 7)) as d;
alter table t add column w date;
update t set w = date_trunc('week', d)::date;
grant all on t to authenticated;

select pg_temp.as_user('tro.p@p.com');
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on)
  values (auth.uid(), (select bia from t), 3, '15:00', (now() at time zone 'America/Sao_Paulo')::date);
create temp table t_s as select id from public.class_schedules;
grant all on t_s to authenticated;

-- ─── Pedido do aluno ─────────────────────────────────────────
select pg_temp.as_user('tro.a@a.com');
select pg_temp.assert(pg_temp.fails($$select public.request_class_change((select id from t_s), (select d from t), (select w + 14 from t), '10:00')$$),
  'troca para depois da semana seguinte é recusada');
select pg_temp.assert(pg_temp.fails($$select public.request_class_change((select id from t_s), (select d + 1 from t), (select d + 2 from t), '10:00')$$),
  'data sem aula não pode ser trocada');
select pg_temp.assert(pg_temp.fails($$select public.request_class_change((select id from t_s), (select d from t), (select d from t), '15:00')$$),
  'mesmo dia e horário é recusado');
create temp table t_r1 as select public.request_class_change((select id from t_s), (select d from t), (select w + 11 from t), '18:00', 'Viagem') as id;
grant all on t_r1 to authenticated;
select pg_temp.assert((select status = 'pendente' and new_date = (select w + 11 from t) from public.class_change_requests where id = (select id from t_r1)),
  'pedido para a sexta da semana seguinte fica pendente');
select pg_temp.assert(pg_temp.fails($$select public.request_class_change((select id from t_s), (select d from t), (select d + 1 from t), '10:00')$$),
  'um pedido pendente por aula');
select pg_temp.assert(pg_temp.fails($$insert into public.class_change_requests (schedule_id, on_date, student_id, personal_id, new_date, new_time)
  values ((select id from t_s), (select d + 7 from t), auth.uid(), auth.uid(), (select d + 8 from t), '10:00')$$), 'pedido só pela função');
select pg_temp.assert(pg_temp.fails($$select public.answer_class_change((select id from t_r1), true)$$), 'aluna não aceita o próprio pedido');

reset role;
select pg_temp.assert((select count(*) from public.notifications n join auth.users u on u.id = n.user_id
  where u.email = 'tro.p@p.com' and n.title like 'Pedido de troca de aula%') = 1, 'Personal é avisada do pedido');

-- ─── Outro Personal não vê nem responde ──────────────────────
select pg_temp.as_user('tro.o@p.com');
select pg_temp.assert(not exists (select 1 from public.class_change_requests), 'outro Personal não vê o pedido');
select pg_temp.assert(pg_temp.fails($$select public.answer_class_change((select id from t_r1), true)$$), 'outro Personal não responde');

-- ─── Personal aceita: a aula é remarcada ─────────────────────
select pg_temp.as_user('tro.p@p.com');
select public.answer_class_change((select id from t_r1), true);
select pg_temp.assert((select status from public.class_change_requests where id = (select id from t_r1)) = 'aceito', 'pedido aceito');
select pg_temp.assert(exists (select 1 from public.class_exceptions where schedule_id = (select id from t_s) and on_date = (select d from t)
  and rescheduled_to is not null), 'data original fica remarcada');
select pg_temp.assert(exists (select 1 from public.class_schedules where starts_on = (select w + 11 from t) and ends_on = starts_on
  and start_time = '18:00'), 'aula única criada no novo horário');
select pg_temp.assert(pg_temp.fails($$select public.answer_class_change((select id from t_r1), false)$$), 'pedido respondido não muda');

-- ─── Recusa e desistência ────────────────────────────────────
select pg_temp.as_user('tro.a@a.com');
create temp table t_r2 as select public.request_class_change((select id from t_s), (select d + 7 from t), (select d + 8 from t), '07:00') as id;
grant all on t_r2 to authenticated;
select pg_temp.as_user('tro.p@p.com');
select public.answer_class_change((select id from t_r2), false, 'Estou sem horário na quinta');
select pg_temp.as_user('tro.a@a.com');
select pg_temp.assert((select status = 'recusado' and reply like 'Estou sem%' from public.class_change_requests where id = (select id from t_r2)),
  'pedido recusado com resposta');
select pg_temp.assert(exists (select 1 from public.notifications where title = 'Troca de aula não aceita' and body like '%sem horário%'),
  'aluna recebe a recusa');
create temp table t_r3 as select public.request_class_change((select id from t_s), (select d + 7 from t), (select d + 9 from t), '07:00') as id;
grant all on t_r3 to authenticated;
select public.cancel_class_change((select id from t_r3));
select pg_temp.assert((select status from public.class_change_requests where id = (select id from t_r3)) = 'cancelado', 'aluna desiste do pedido');

reset role;
\echo '✅ Todos os testes de troca de aula passaram'

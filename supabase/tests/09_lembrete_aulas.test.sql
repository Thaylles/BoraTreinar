-- Testes de aulas únicas e do lembrete diário das 7h.
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
  ('lembra.p@p.com', '{"role":"personal","full_name":"Lia Lembrete"}');
select pg_temp.as_user('lembra.p@p.com');
create temp table t_i as select * from public.create_invite(7, null);
create temp table t_i2 as select * from public.create_invite(7, null);
grant all on t_i, t_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'mel@a.com', jsonb_build_object('role','aluno','full_name','Mel Silva',
  'phone','11911110000','invite_token', token, 'terms_accepted', true) from t_i;
insert into auth.users (email, raw_user_meta_data)
select 'nei@a.com', jsonb_build_object('role','aluno','full_name','Nei Souza',
  'phone','11911119999','invite_token', token, 'terms_accepted', true) from t_i2;
create temp table ids as select
  (select id from auth.users where email = 'mel@a.com') as mel,
  (select id from auth.users where email = 'nei@a.com') as nei;
grant all on ids to authenticated;

-- 2026-10-14 é quarta (3); 2026-10-21 também.
select pg_temp.as_user('lembra.p@p.com');
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on)
  values (auth.uid(), (select mel from ids), 3, '07:00', '2026-10-01');
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on, ends_on)
  values (auth.uid(), (select nei from ids), 3, '18:00', '2026-10-14', '2026-10-14');
select pg_temp.assert(pg_temp.fails($$insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on, ends_on)
  values (auth.uid(), (select nei from ids), 1, '18:00', '2026-10-14', '2026-10-14')$$),
  'aula única com dia da semana errado é rejeitada');

select pg_temp.as_user('nei@a.com');
select pg_temp.assert(exists (select 1 from public.notifications where body like '%marcou uma aula em 14/10%'),
  'aluno avisado da aula única com a data');

-- Lembrete (servidor)
reset role;
set role service_role;
create temp table r1 as select * from public.daily_class_reminders('2026-10-14') where personal_name = 'Lia Lembrete';
reset role;
select pg_temp.assert((select count(*) from r1) = 1, 'um lembrete por Personal');
select pg_temp.assert((select jsonb_array_length(classes) from r1) = 2, 'semanal + única no mesmo dia');
select pg_temp.assert((select classes->0->>'student_name' from r1) = 'Mel Silva', 'ordenado por horário');
select pg_temp.assert((select count(*) from public.notifications n join auth.users u on u.id = n.user_id
  where u.email = 'lembra.p@p.com' and n.link = '/personal/agenda?dia=2026-10-14') = 1, 'notificação criada para o Personal');

set role service_role;
create temp table r2 as select * from public.daily_class_reminders('2026-10-14') where personal_name = 'Lia Lembrete';
reset role;
select pg_temp.assert(not (select notified from r2), 'rodar de novo não duplica a notificação');

-- Semana seguinte: aula única não aparece; cancelamento remove a semanal
select pg_temp.as_user('lembra.p@p.com');
insert into public.class_exceptions (schedule_id, on_date)
  select id, '2026-10-28' from public.class_schedules where weekday = 3 and ends_on is null;
reset role;
set role service_role;
create temp table r3 as select * from public.daily_class_reminders('2026-10-21') where personal_name = 'Lia Lembrete';
create temp table r4 as select * from public.daily_class_reminders('2026-10-28') where personal_name = 'Lia Lembrete';
reset role;
select pg_temp.assert((select jsonb_array_length(classes) from r3) = 1, 'semana seguinte: só a semanal (continua no mês)');
select pg_temp.assert((select count(*) from r4) = 0, 'data cancelada não gera lembrete');

-- Vínculo encerrado: aluno sai do lembrete
select pg_temp.as_user('lembra.p@p.com');
reset role;
update public.personal_students set status = 'revogado' where student_id = (select mel from ids);
set role service_role;
create temp table r5 as select * from public.daily_class_reminders('2026-11-04') where personal_name = 'Lia Lembrete';
reset role;
select pg_temp.assert((select count(*) from r5) = 0, 'aluno sem vínculo ativo não entra no lembrete');

select pg_temp.as_user('lembra.p@p.com');
select pg_temp.assert(pg_temp.fails($$select * from public.daily_class_reminders('2026-10-14')$$), 'usuário comum não chama o lembrete');

reset role;
\echo '✅ Todos os testes de lembrete passaram'

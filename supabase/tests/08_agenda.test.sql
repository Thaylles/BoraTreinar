-- Testes da agenda de aulas (etapa 8).
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
  ('agenda.p@p.com', '{"role":"personal","full_name":"Paula Agenda"}'),
  ('outro.p@p.com',  '{"role":"personal","full_name":"Otávio Personal"}');
select pg_temp.as_user('agenda.p@p.com');
create temp table t_i as select * from public.create_invite(7, null);
create temp table t_i2 as select * from public.create_invite(7, null);
grant all on t_i, t_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'aula.a@a.com', jsonb_build_object('role','aluno','full_name','Ana Aula',
  'phone','11922221111','invite_token', token, 'terms_accepted', true) from t_i;
insert into auth.users (email, raw_user_meta_data)
select 'aula.b@a.com', jsonb_build_object('role','aluno','full_name','Beto Aula',
  'phone','11922220000','invite_token', token, 'terms_accepted', true) from t_i2;
create temp table ids as select (select id from auth.users where email = 'aula.a@a.com') as ana;
grant all on ids to authenticated;

select pg_temp.as_user('agenda.p@p.com');
insert into public.class_schedules (personal_id, student_id, weekday, start_time)
  values (auth.uid(), (select ana from ids), 1, '07:00'), (auth.uid(), (select ana from ids), 3, '07:00');
select pg_temp.assert((select count(*) from public.class_schedules) = 2, 'Personal agenda aulas seg e qua');
select pg_temp.assert(pg_temp.fails($$insert into public.class_schedules (personal_id, student_id, weekday, start_time)
  values (auth.uid(), (select ana from ids), 7, '07:00')$$), 'dia da semana inválido é rejeitado');
create temp table t_s as select id from public.class_schedules where weekday = 1;
grant all on t_s to authenticated;
insert into public.class_exceptions (schedule_id, on_date, reason) values ((select id from t_s), '2026-10-12', 'Feriado');

select pg_temp.as_user('aula.a@a.com');
select pg_temp.assert((select count(*) from public.class_schedules) = 2, 'aluna vê a própria agenda');
select pg_temp.assert((select count(*) from public.class_exceptions) = 1, 'aluna vê o cancelamento');
select pg_temp.assert((select count(*) from public.notifications where title like 'Nova aula%') = 2, 'aluna avisada das aulas novas');
select pg_temp.assert((select count(*) from public.notifications where title = 'Aula cancelada') = 1, 'aluna avisada do cancelamento');
select pg_temp.assert(pg_temp.fails($$insert into public.class_schedules (personal_id, student_id, weekday, start_time)
  values (auth.uid(), auth.uid(), 2, '08:00')$$), 'aluno não cria aula');
select pg_temp.assert(pg_temp.fails($$insert into public.class_exceptions (schedule_id, on_date)
  values ((select id from t_s), '2026-10-19')$$), 'aluno não cancela aula');

select pg_temp.as_user('aula.b@a.com');
select pg_temp.assert((select count(*) from public.class_schedules) = 0, 'outro aluno não vê a agenda da colega');

select pg_temp.as_user('outro.p@p.com');
select pg_temp.assert((select count(*) from public.class_schedules) = 0, 'Personal sem vínculo não vê');
select pg_temp.assert(pg_temp.fails($$insert into public.class_schedules (personal_id, student_id, weekday, start_time)
  values (auth.uid(), (select ana from ids), 2, '08:00')$$), 'Personal sem vínculo não agenda');
delete from public.class_schedules;
select pg_temp.as_user('agenda.p@p.com');
select pg_temp.assert((select count(*) from public.class_schedules) = 2, 'Personal sem vínculo não apaga');

reset role;
\echo '✅ Todos os testes de agenda passaram'

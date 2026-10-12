-- Remarcar aulas: troca única (aula semanal e aula única), troca recorrente e desfazer.
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
  ('rem.p@p.com', '{"role":"personal","full_name":"Rita Remarca"}'),
  ('rem.o@p.com', '{"role":"personal","full_name":"Olavo Outro"}');
select pg_temp.as_user('rem.p@p.com');
create temp table r_i as select * from public.create_invite(7, null);
grant all on r_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'rem.a@a.com', jsonb_build_object('role','aluno','full_name','Alice Remarca',
  'phone','11922221111','invite_token', token, 'terms_accepted', true) from r_i;
-- d = próxima quarta (a partir de amanhã, fuso SP)
create temp table r as select
  (select id from auth.users where email = 'rem.a@a.com') as alice,
  ((now() at time zone 'America/Sao_Paulo')::date + 1
    + ((3 - extract(dow from (now() at time zone 'America/Sao_Paulo')::date + 1)::int + 7) % 7)) as d;
grant all on r to authenticated;

select pg_temp.as_user('rem.p@p.com');
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on)
  values (auth.uid(), (select alice from r), 3, '15:00', (now() at time zone 'America/Sao_Paulo')::date);
create temp table r_s as select id from public.class_schedules;
grant all on r_s to authenticated;

-- ─── Troca única de uma aula semanal ─────────────────────────
create temp table r_one as select public.reschedule_class_once((select id from r_s), (select d from r), (select d + 2 from r), '18:00') as id;
grant all on r_one to authenticated;
select pg_temp.assert((select starts_on = ends_on and weekday = 5 and start_time = '18:00' from public.class_schedules where id = (select id from r_one)),
  'troca única cria aula única na sexta 18h');
select pg_temp.assert((select rescheduled_to = (select id from r_one) and reason like 'Remarcada para %'
  from public.class_exceptions where schedule_id = (select id from r_s) and on_date = (select d from r)), 'data original fica marcada como remarcada');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_once((select id from r_s), (select d from r), (select d + 1 from r), '10:00')$$),
  'mesma data não pode ser remarcada duas vezes');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_once((select id from r_s), (select d + 1 from r), (select d + 2 from r), '10:00')$$),
  'data sem aula não pode ser remarcada');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_once((select id from r_s), (select d + 7 from r), (select d - 30 from r), '10:00')$$),
  'nova data no passado é rejeitada');

select pg_temp.as_user('rem.a@a.com');
select pg_temp.assert((select count(*) from public.notifications where title = 'Aula remarcada 🔄') = 1, 'aluna recebe aviso de remarcação');
select pg_temp.assert((select count(*) from public.notifications where title in ('Aula agendada 📅', 'Aula cancelada')) = 0,
  'sem avisos automáticos duplicados');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_once((select id from r_s), (select d + 7 from r), (select d + 8 from r), '10:00')$$),
  'aluna não remarca');
select pg_temp.as_user('rem.o@p.com');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_once((select id from r_s), (select d + 7 from r), (select d + 8 from r), '10:00')$$),
  'outro Personal não remarca');

-- Remarcar de novo a aula única só a move de lugar.
select pg_temp.as_user('rem.p@p.com');
select pg_temp.assert(public.reschedule_class_once((select id from r_one), (select d + 2 from r), (select d + 1 from r), '07:00') = (select id from r_one),
  'aula única é movida no lugar');
select pg_temp.assert((select weekday = 4 and starts_on = (select d + 1 from r) from public.class_schedules where id = (select id from r_one)),
  'aula única agora na quinta');

-- Desfazer: reativar a data original apaga a aula substituta e avisa.
delete from public.class_exceptions where schedule_id = (select id from r_s) and on_date = (select d from r);
select pg_temp.assert(not exists (select 1 from public.class_schedules where id = (select id from r_one)), 'desfazer apaga a aula substituta');
select pg_temp.as_user('rem.a@a.com');
select pg_temp.assert((select count(*) from public.notifications where title = 'Remarcação desfeita') = 1, 'aluna avisada do desfazer');

-- ─── Troca recorrente ────────────────────────────────────────
select pg_temp.as_user('rem.p@p.com');
create temp table r_ser as select public.reschedule_class_series((select id from r_s), (select d + 7 from r), 4::smallint, '18:00') as id;
grant all on r_ser to authenticated;
select pg_temp.assert((select ends_on = (select d + 6 from r) from public.class_schedules where id = (select id from r_s)),
  'série antiga termina na véspera da mudança');
select pg_temp.assert((select weekday = 4 and start_time = '18:00' and starts_on = (select d + 7 from r) and ends_on is null
  from public.class_schedules where id = (select id from r_ser)), 'nova série toda quinta 18h');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_series((select id from r_ser), (select d + 7 from r), 4::smallint, '18:00')$$),
  'mesmo dia e horário é rejeitado');
select pg_temp.assert(public.reschedule_class_series((select id from r_ser), (select d from r), 5::smallint, '19:00') = (select id from r_ser),
  'série que ainda não começou muda no lugar');
select pg_temp.assert(pg_temp.fails($$select public.reschedule_class_series((select id from r_ser), (select d - 30 from r), 2::smallint, '19:00')$$),
  'mudança no passado é rejeitada');
select pg_temp.as_user('rem.a@a.com');
select pg_temp.assert((select count(*) from public.notifications where title = 'Horário das aulas alterado 🔄') = 2, 'aluna avisada da mudança de horário');
select pg_temp.assert((select count(*) from public.notifications where title = 'Nova aula agendada 📅') = 1, 'só o aviso da aula original');

reset role;
\echo '✅ Todos os testes de remarcação passaram'

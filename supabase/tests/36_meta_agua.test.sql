-- Meta de água: cada um vê e registra só a própria; lembretes de 3 em 3 horas.
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

create or replace function pg_temp.notes(p_email text) returns bigint language sql as $$
  select count(*) from public.notifications n join auth.users u on u.id = n.user_id
   where u.email = p_email and n.title = '💧 Hora de beber água';
$$;

reset role;
select set_config('request.jwt.claims', '{}', false);
insert into auth.users (email, raw_user_meta_data) values
  ('agua.a@a.com', '{"role":"aluno","full_name":"Ana Água","phone":"11955550081","terms_accepted":true}'),
  ('agua.b@a.com', '{"role":"aluno","full_name":"Bia Água","phone":"11955550082","terms_accepted":true}'),
  ('agua.p@p.com', '{"role":"personal","full_name":"Pedro Água"}');

-- ─── Cada um com a sua meta e os seus registros ─────────────
select pg_temp.as_user('agua.a@a.com');
insert into public.water_settings (user_id, daily_ml) values (auth.uid(), 2000);
insert into public.water_logs (user_id, ml) values (auth.uid(), 500);
select pg_temp.assert(pg_temp.fails($$insert into public.water_settings (user_id, daily_ml) values (auth.uid(), 100)$$), 'meta mínima de 500 ml');
select pg_temp.assert(pg_temp.fails($$insert into public.water_logs (user_id, ml) values (auth.uid(), 5000)$$), 'registro máximo de 3 L');
select pg_temp.assert(pg_temp.fails($$insert into public.water_logs (user_id, ml) values ((select id from auth.users where email = 'agua.b@a.com'), 500)$$),
  'não registra água para outra pessoa');

select pg_temp.as_user('agua.b@a.com');
select pg_temp.assert(not exists (select 1 from public.water_logs) and not exists (select 1 from public.water_settings), 'não vê a água dos outros');
insert into public.water_settings (user_id, daily_ml, reminders) values (auth.uid(), 2000, false);

select pg_temp.as_user('agua.p@p.com');
insert into public.water_settings (user_id, daily_ml) values (auth.uid(), 1000);
insert into public.water_logs (user_id, ml) values (auth.uid(), 1000);

-- ─── Lembretes ──────────────────────────────────────────────
set role authenticated;
select pg_temp.assert(pg_temp.fails($$select public.water_reminders()$$), 'usuário comum não dispara lembretes');
reset role;
select set_config('request.jwt.claims', '{}', false);

create or replace function pg_temp.hoje_as(p_time time) returns timestamptz language sql as $$
  select ((now() at time zone 'America/Sao_Paulo')::date + p_time) at time zone 'America/Sao_Paulo';
$$;
select public.water_reminders(pg_temp.hoje_as('06:00'));
select pg_temp.assert(pg_temp.notes('agua.a@a.com') = 0, 'antes das 8h: sem lembrete');
select public.water_reminders(pg_temp.hoje_as('11:00'));
select pg_temp.assert(pg_temp.notes('agua.a@a.com') = 1, 'lembrete para quem não bateu a meta');
select pg_temp.assert((select body from public.notifications n join auth.users u on u.id = n.user_id
  where u.email = 'agua.a@a.com' and n.title = '💧 Hora de beber água') = 'Hoje: 0,5 L de 2,0 L.', 'mostra quanto bebeu e a meta');
select public.water_reminders(pg_temp.hoje_as('11:20'));
select pg_temp.assert(pg_temp.notes('agua.a@a.com') = 1, 'não repete no mesmo horário');
select pg_temp.assert(pg_temp.notes('agua.b@a.com') = 0, 'lembretes desligados: nada');
select pg_temp.assert(pg_temp.notes('agua.p@p.com') = 0, 'meta batida: nada');
select public.water_reminders(pg_temp.hoje_as('14:00'));
select pg_temp.assert(pg_temp.notes('agua.a@a.com') = 2, 'novo lembrete 3 horas depois');
select public.water_reminders(pg_temp.hoje_as('23:00'));
select pg_temp.assert(pg_temp.notes('agua.a@a.com') = 2, 'depois das 22h: sem lembrete');
\echo '✅ Todos os testes de meta de água passaram'

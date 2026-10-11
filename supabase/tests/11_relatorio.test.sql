-- Testes do relatório semanal (etapa 10). Reaproveita o cenário do teste 10 (Dora, Fábio, Eva).
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

-- O servidor (service role) grava os relatórios
reset role;
create temp table r_ids as select
  (select id from auth.users where email = 'dora@p.com') as dora,
  (select id from auth.users where email = 'fabio@p.com') as fabio,
  (select id from auth.users where email = 'eva@a.com') as eva;
grant all on r_ids to authenticated, service_role;
set role service_role;
insert into public.weekly_reports (personal_id, week_start, content)
select dora, date '2026-10-05', '{"students": []}' from r_ids;
insert into public.weekly_reports (personal_id, week_start, content)
select fabio, date '2026-10-05', '{"students": []}' from r_ids;
reset role;
select pg_temp.assert(pg_temp.fails($$insert into public.weekly_reports (personal_id, week_start, content)
  select id, date '2026-10-07', '{}' from auth.users where email = 'dora@p.com'$$), 'semana do relatório começa na segunda');

select pg_temp.as_user('dora@p.com');
select pg_temp.assert((select count(*) from public.weekly_reports) = 1, 'Personal vê só os próprios relatórios');
select pg_temp.assert(pg_temp.fails($$insert into public.weekly_reports (personal_id, week_start, content)
  values (auth.uid(), date '2026-09-28', '{}')$$), 'Personal não cria relatório');
select pg_temp.assert(pg_temp.fails($$update public.weekly_reports set content = '{}'$$)
  or (select content->'students' from public.weekly_reports limit 1) is not null, 'Personal não altera relatório');
select pg_temp.assert(((public.training_summary((select eva from r_ids))->0) ? 'plan'),
  'resumo traz o nome da ficha');

select pg_temp.as_user('eva@a.com');
select pg_temp.assert((select count(*) from public.weekly_reports) = 0, 'aluno não vê relatórios');

reset role;
\echo '✅ Todos os testes do relatório passaram'

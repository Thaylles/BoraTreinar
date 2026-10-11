-- Preferência de sugestões no relatório (regras × IAs). Reaproveita Dora e Fábio dos testes 10/11.
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

select pg_temp.as_user('dora@p.com');
update public.weekly_reports set preferred_source = 'gemini';
select pg_temp.assert((select preferred_source from public.weekly_reports) = 'gemini', 'Personal marca a preferida no próprio relatório');
select pg_temp.assert(pg_temp.fails($$update public.weekly_reports set preferred_source = 'chatgpt'$$), 'só fontes conhecidas');
select pg_temp.assert(pg_temp.fails($$update public.weekly_reports set content = '{}'$$), 'Personal não altera o conteúdo');
select pg_temp.assert(pg_temp.fails($$update public.weekly_reports set ai_used = true$$), 'Personal não altera outras colunas');

select pg_temp.as_user('fabio@p.com');
update public.weekly_reports set preferred_source = 'claude' where personal_id <> auth.uid();
reset role;
select pg_temp.assert((select preferred_source from public.weekly_reports r join auth.users u on u.id = r.personal_id where u.email = 'dora@p.com') = 'gemini',
  'outro Personal não mexe no relatório alheio');
\echo '✅ Todos os testes de preferência de IA passaram'

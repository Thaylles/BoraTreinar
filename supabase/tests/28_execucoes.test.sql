-- Execuções (GIF/vídeo) dos exercícios: só as aprovadas aparecem.
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
  ('ex.p@p.com', '{"role":"personal","full_name":"Paula Exec"}'),
  ('ex.a@a.com', '{"role":"aluno","full_name":"Alice Exec","phone":"11955550041","terms_accepted":true}');
create temp table c as select (select id from public.equipment where is_default order by name limit 1) as eq;
grant all on c to authenticated;

-- O servidor do admin grava (service role = sem RLS aqui).
insert into public.exercise_media (equipment_id, kind, source, status, path) values
  ((select eq from c), 'gif', 'banco_publico', 'rascunho', 'a/1.gif'),
  ((select eq from c), 'video', 'ia', 'aprovado', 'a/2.mp4');
insert into public.exercise_media (equipment_id, kind, source, status, operation) values ((select eq from c), 'video', 'ia', 'gerando', 'operations/x');
select pg_temp.assert(pg_temp.fails($$insert into public.exercise_media (equipment_id, kind, source, status, path) select eq, 'gif', 'ia', 'aprovado', 'b.gif' from c$$), 'só uma execução aprovada por exercício');
select pg_temp.assert(pg_temp.fails($$insert into public.exercise_media (equipment_id, kind, source, status) select eq, 'gif', 'ia', 'rascunho' from c$$), 'rascunho precisa de arquivo');

select pg_temp.as_user('ex.a@a.com');
select pg_temp.assert((select count(*) from public.exercise_media) = 1, 'aluno vê só a aprovada');
select pg_temp.assert((select path from public.exercise_media) = 'a/2.mp4', 'a aprovada é o vídeo');
select pg_temp.assert(pg_temp.fails($$insert into public.exercise_media (equipment_id, kind, source, path) select eq, 'gif', 'ia', 'x.gif' from c$$), 'aluno não grava');
select pg_temp.as_user('ex.p@p.com');
select pg_temp.assert((select count(*) from public.exercise_media) = 1, 'Personal vê só a aprovada');
select pg_temp.assert(pg_temp.fails($$update public.exercise_media set status = 'aprovado'$$), 'Personal não altera');
reset role;
select pg_temp.assert((select count(*) from public.exercise_media where status = 'aprovado') = 1, 'Personal não altera status');
\echo ✅ Todos os testes de execuções passaram

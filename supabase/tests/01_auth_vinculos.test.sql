-- Testes de RLS/RPC da etapa 2. Rodar com: npm run test:db
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email))::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', false);
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

set client_min_messages = notice;

-- ── Cadastro de Personais ─────────────────────────────────────
insert into auth.users (email, raw_user_meta_data) values
  ('ana@p.com',   '{"role":"personal","full_name":"Ana Personal"}'),
  ('bruno@p.com', '{"role":"personal","full_name":"Bruno Personal"}'),
  ('caio@p.com',  '{"role":"personal","full_name":"Caio Personal"}');

select pg_temp.assert(pg_temp.fails($$insert into auth.users (email, raw_user_meta_data)
  values ('x@x.com', '{"role":"admin","full_name":"Hacker"}')$$), 'papel inválido é rejeitado');
select pg_temp.assert(pg_temp.fails($$insert into auth.users (email, raw_user_meta_data)
  values ('x@x.com', '{"role":"aluno","full_name":"Sem Termo","phone":"11999999999"}')$$),
  'aluno sem aceitar o termo é rejeitado');

-- ── Convites ──────────────────────────────────────────────────
select pg_temp.as_user('ana@p.com');
create temp table t_inv as select * from public.create_invite(7, 'Diego');
grant all on t_inv to authenticated, anon;
select pg_temp.assert((select count(*) from public.invites) = 1, 'Personal vê o próprio convite');
select pg_temp.assert(pg_temp.fails($$select public.create_invite(0)$$), 'validade 0 é rejeitada');
select pg_temp.assert(pg_temp.fails($$insert into public.invites (personal_id, expires_at)
  values (auth.uid(), now() + interval '1 day')$$), 'insert direto em invites é bloqueado');

select pg_temp.as_user('bruno@p.com');
select pg_temp.assert((select count(*) from public.invites) = 0, 'outro Personal não vê convites alheios');

reset role;
set role anon;
select pg_temp.assert((select status from public.get_invite_public((select token from t_inv))) = 'pendente',
  'anon consulta convite público');
select pg_temp.assert(pg_temp.fails($$select * from public.invites$$), 'anon não lê invites');

-- ── Cadastro do aluno pelo convite ────────────────────────────
select pg_temp.as_admin();
select pg_temp.assert(pg_temp.fails(format($$insert into auth.users (email, raw_user_meta_data)
  values ('d@a.com', '{"role":"aluno","full_name":"Diego","phone":"11999990000","invite_token":"%s"}')$$,
  (select token from t_inv))), 'aluno sem aceitar termo é rejeitado');

insert into auth.users (email, raw_user_meta_data)
select 'diego@a.com', jsonb_build_object('role','aluno','full_name','Diego Aluno',
  'phone','(11) 99999-0000','invite_token', token, 'terms_accepted', true) from t_inv;

select pg_temp.assert((select phone from public.profiles where email = 'diego@a.com') = '11999990000',
  'telefone normalizado');
select pg_temp.assert(pg_temp.fails(format($$insert into auth.users (email, raw_user_meta_data)
  values ('e@a.com', '{"role":"aluno","full_name":"Outro","phone":"11999990001","invite_token":"%s","terms_accepted":true}')$$,
  (select token from t_inv))), 'convite usado não pode ser reutilizado');

-- Segundo aluno, de outro Personal
select pg_temp.as_user('bruno@p.com');
create temp table t_inv2 as select * from public.create_invite(7, null);
grant all on t_inv2 to authenticated, anon;
select pg_temp.as_admin();
insert into auth.users (email, raw_user_meta_data)
select 'elisa@a.com', jsonb_build_object('role','aluno','full_name','Elisa Aluna',
  'phone','21988887777','invite_token', token, 'terms_accepted', true) from t_inv2;

-- Convite revogado
select pg_temp.as_user('ana@p.com');
create temp table t_inv3 as select * from public.create_invite(3, null);
grant all on t_inv3 to authenticated, anon;
select public.revoke_invite((select id from t_inv3));
select pg_temp.as_admin();
select pg_temp.assert(pg_temp.fails(format($$insert into auth.users (email, raw_user_meta_data)
  values ('f@a.com', '{"role":"aluno","full_name":"Fabi","phone":"11999990002","invite_token":"%s","terms_accepted":true}')$$,
  (select token from t_inv3))), 'convite revogado é rejeitado');

-- ── Isolamento ────────────────────────────────────────────────
select pg_temp.as_user('diego@a.com');
select pg_temp.assert((select count(*) from public.profiles where role = 'aluno') = 1, 'aluno só vê a si mesmo');
select pg_temp.assert((select count(*) from public.profiles where role = 'personal') = 1, 'aluno vê só o seu Personal');
select pg_temp.assert(pg_temp.fails($$update public.profiles set role = 'personal' where id = auth.uid()$$),
  'aluno não muda o próprio papel');
update public.profiles set full_name = 'Diego A.' where id = auth.uid();
select pg_temp.assert((select full_name from public.profiles where id = auth.uid()) = 'Diego A.', 'aluno edita o nome');
select pg_temp.assert(pg_temp.fails($$select public.create_invite(7)$$), 'aluno não cria convite');

select pg_temp.as_user('ana@p.com');
select pg_temp.assert((select count(*) from public.profiles where role = 'aluno') = 1, 'Ana vê só o Diego');
select pg_temp.assert((select count(*) from public.notifications where link is distinct from '/aluno/conquistas') = 1, 'Ana foi notificada do novo aluno');

-- ── Compartilhamento ──────────────────────────────────────────
select pg_temp.as_user('ana@p.com');
select pg_temp.assert((select id from public.find_personal_by_email('BRUNO@p.com')) is not null, 'busca Personal por e-mail');
create temp table t_tr as select * from public.request_student_transfer(
  (select id from public.profiles where email = 'diego@a.com'),
  (select id from public.find_personal_by_email('bruno@p.com')), 'compartilhamento');
grant all on t_tr to authenticated, anon;

select pg_temp.as_user('bruno@p.com');
select pg_temp.assert(not exists (select 1 from public.personal_students
  where student_id = (select student_id from t_tr) and status = 'ativo' and personal_id = auth.uid()),
  'antes de aceitar, Bruno não tem vínculo');
select public.respond_student_transfer((select id from t_tr), true);
select pg_temp.assert((select count(*) from public.profiles where role = 'aluno') = 2, 'Bruno vê Elisa e Diego após aceitar');

select pg_temp.as_user('ana@p.com');
select pg_temp.assert((select count(*) from public.profiles where email = 'diego@a.com') = 1, 'Ana continua vendo Diego');
select pg_temp.assert((select count(*) from public.profiles where email = 'elisa@a.com') = 0, 'Ana não vê Elisa');

select pg_temp.as_user('diego@a.com');
select pg_temp.assert((select count(*) from public.profiles where role = 'personal') = 2, 'Diego vê os dois Personais');

-- Compartilhado não pode transferir
select pg_temp.as_user('bruno@p.com');
select pg_temp.assert(pg_temp.fails(format($$select public.request_student_transfer('%s', '%s', 'transferencia')$$,
  (select student_id from t_tr), (select id from public.profiles where email = 'caio@p.com' limit 1))),
  'Personal compartilhado não transfere');

-- Revogar compartilhamento
select pg_temp.as_user('ana@p.com');
select public.revoke_student_share((select student_id from t_tr), (select to_personal_id from t_tr));
select pg_temp.as_user('bruno@p.com');
select pg_temp.assert((select count(*) from public.profiles where email = 'diego@a.com') = 0, 'após revogar, Bruno perde acesso');

-- ── Transferência ─────────────────────────────────────────────
select pg_temp.as_user('ana@p.com');
create temp table t_tr2 as select * from public.request_student_transfer(
  (select id from public.profiles where email = 'diego@a.com'),
  (select id from public.find_personal_by_email('caio@p.com')), 'transferencia');
grant all on t_tr2 to authenticated, anon;

select pg_temp.as_user('bruno@p.com');
select pg_temp.assert(pg_temp.fails($$select public.respond_student_transfer((select id from t_tr2), true)$$),
  'terceiro não aceita pedido alheio');

select pg_temp.as_user('caio@p.com');
select pg_temp.assert((select count(*) from public.profiles where email = 'diego@a.com') = 1,
  'Caio vê o aluno no pedido pendente');
select public.respond_student_transfer((select id from t_tr2), true);

select pg_temp.as_user('ana@p.com');
select pg_temp.assert((select count(*) from public.profiles where email = 'diego@a.com') = 0, 'após transferir, Ana perde acesso');
select pg_temp.assert((select count(*) from public.personal_students where status = 'ativo') = 0, 'Ana sem vínculos ativos');

select pg_temp.as_user('caio@p.com');
select pg_temp.assert(public.is_responsible_personal((select student_id from t_tr2)), 'Caio é o novo responsável');

select pg_temp.as_user('diego@a.com');
select pg_temp.assert((select count(*) from public.notifications where link is distinct from '/aluno/conquistas') = 3, 'Diego notificado (compart., revogação, transferência)');
select pg_temp.assert(pg_temp.fails($$insert into public.notifications (user_id, title) values (auth.uid(), 'x')$$),
  'aluno não cria notificação');

reset role;
\echo '✅ Todos os testes da etapa 2 passaram'

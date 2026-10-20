-- Pix do Personal, aviso "Já paguei" e comentários no treino.
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
  ('pix.p@p.com', '{"role":"personal","full_name":"Paula Pix"}'),
  ('pix.q@p.com', '{"role":"personal","full_name":"Quico Fora"}'),
  ('pix.a@a.com', '{"role":"aluno","full_name":"Alice Pagante","phone":"11955550011","terms_accepted":true}'),
  ('pix.b@a.com', '{"role":"aluno","full_name":"Bruno Outro","phone":"11955550012","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'pix.p@p.com') as paula,
  (select id from auth.users where email = 'pix.a@a.com') as alice,
  gen_random_uuid() as pay, gen_random_uuid() as sess;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select alice from c), 'responsavel');
insert into public.payments (id, personal_id, student_id, month, description, amount, due_on)
  values ((select pay from c), (select paula from c), (select alice from c), date '2026-10-01', 'Outubro', 350, date '2026-10-10');
insert into public.workout_sessions (id, client_id, student_id, plan_name, kind, started_at, finished_at)
  values ((select sess from c), gen_random_uuid(), (select alice from c), 'Treino A', 'ficha', now() - interval '1 hour', now());

-- Pix
select pg_temp.as_user('pix.a@a.com');
select pg_temp.assert(pg_temp.fails($$insert into public.pix_settings (key_type, pix_key, holder_name, city) values ('email', 'a@a.com', 'Alice', 'SP')$$), 'aluno não cadastra Pix');
select pg_temp.as_user('pix.p@p.com');
insert into public.pix_settings (key_type, pix_key, holder_name, city, payment_link) values ('email', 'paula@pix.com', 'Paula Pix', 'São Paulo', 'https://pag.example/paula');
select pg_temp.assert(pg_temp.fails($$update public.pix_settings set payment_link = 'http://inseguro.com'$$), 'link precisa ser https');
select pg_temp.as_user('pix.a@a.com');
select pg_temp.assert((select pix_key from public.pix_settings) = 'paula@pix.com', 'aluno vinculado lê o Pix do Personal');
select pg_temp.as_user('pix.b@a.com');
select pg_temp.assert(not exists (select 1 from public.pix_settings), 'aluno sem vínculo não vê o Pix');
select pg_temp.as_user('pix.q@p.com');
select pg_temp.assert(not exists (select 1 from public.pix_settings), 'outro Personal não vê o Pix');

-- Já paguei
select pg_temp.as_user('pix.b@a.com');
select pg_temp.assert(pg_temp.fails(format('select public.report_payment(%L)', (select pay from c))), 'outro aluno não avisa pagamento');
select pg_temp.as_user('pix.a@a.com');
select public.report_payment((select pay from c));
select pg_temp.assert((select reported_paid_at is not null and paid_at is null from public.payments where id = (select pay from c)), 'aluno avisou que pagou');
reset role;
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select paula from c) and title like '%avisou que pagou%'), 'Personal recebe o aviso');
select pg_temp.assert(public.payment_reminders(date '2026-10-10') = 0, 'quem avisou que pagou não recebe lembrete');
select pg_temp.as_user('pix.p@p.com');
select public.reject_payment_report((select pay from c));
select pg_temp.assert((select reported_paid_at is null from public.payments where id = (select pay from c)), 'Personal responde que não recebeu');
reset role;
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select alice from c) and title = 'Pagamento não identificado'), 'aluno é avisado');
select pg_temp.assert(public.payment_reminders(date '2026-10-10') = 1, 'lembrete volta depois da recusa');

-- Comentários
select pg_temp.as_user('pix.p@p.com');
select public.add_session_comment((select sess from c), '  Mandou bem! Na próxima sobe 2 kg no supino.  ');
select pg_temp.assert(pg_temp.fails(format('select public.add_session_comment(%L, %L)', (select sess from c), '   ')), 'comentário vazio é recusado');
reset role;
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select alice from c) and title like '💬 Paula comentou seu treino'
  and link = '/aluno/historico/' || (select sess from c)), 'aluno é avisado do comentário');
select pg_temp.as_user('pix.a@a.com');
select public.add_session_comment((select sess from c), 'Valeu! Senti o ombro na última série.');
select pg_temp.assert((select count(*) from public.session_comments) = 2, 'aluno vê a conversa');
select pg_temp.assert((select body from public.session_comments order by created_at limit 1) = 'Mandou bem! Na próxima sobe 2 kg no supino.', 'texto sem espaços sobrando');
select pg_temp.assert(pg_temp.fails($$insert into public.session_comments (session_id, author_id, body) select sess, alice, 'direto' from c$$), 'insert direto é bloqueado');
delete from public.session_comments where author_id <> (select alice from c);
select pg_temp.assert((select count(*) from public.session_comments) = 2, 'não apaga comentário dos outros');
reset role;
select pg_temp.assert(exists (select 1 from public.notifications where user_id = (select paula from c) and title like '💬 Alice comentou o treino'), 'Personal é avisado');
select pg_temp.as_user('pix.b@a.com');
select pg_temp.assert(not exists (select 1 from public.session_comments), 'outro aluno não vê comentários');
select pg_temp.assert(pg_temp.fails(format('select public.add_session_comment(%L, %L)', (select sess from c), 'oi')), 'outro aluno não comenta');
select pg_temp.as_user('pix.q@p.com');
select pg_temp.assert(not exists (select 1 from public.session_comments), 'Personal sem vínculo não vê comentários');
select pg_temp.as_user('pix.a@a.com');
delete from public.session_comments where author_id = (select alice from c);
select pg_temp.assert((select count(*) from public.session_comments) = 1, 'autor apaga o próprio comentário');
reset role;
\echo ✅ Todos os testes de Pix e comentários passaram

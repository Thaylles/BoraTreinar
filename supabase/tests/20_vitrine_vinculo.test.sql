-- Aluno sem convite, vitrine de Personais e pedido de vínculo confirmado pelo aluno.
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
  ('vit.p@p.com', '{"role":"personal","full_name":"Vera Vitrine","phone":"11933334444","birth_date":"1990-05-20"}'),
  ('vit.q@p.com', '{"role":"personal","full_name":"Quico Quieto","phone":"11933335555"}'),
  ('vit.r@p.com', '{"role":"personal","full_name":"Rui Responsável"}');

-- ─── Aluno sem convite ───────────────────────────────────────
insert into auth.users (email, raw_user_meta_data) values
  ('vit.a@a.com', '{"role":"aluno","full_name":"Alana Livre","phone":"(11) 97654-3219","terms_accepted":true}');
select pg_temp.assert((select role = 'aluno' and phone = '11976543219' from public.profiles p join auth.users u on u.id = p.id where u.email = 'vit.a@a.com'),
  'aluno cria conta sem convite');
select pg_temp.assert(pg_temp.fails($$insert into auth.users (email, raw_user_meta_data) values
  ('vit.b@a.com', '{"role":"aluno","full_name":"Sem Fone","terms_accepted":true}')$$), 'aluno sem WhatsApp continua barrado');
select pg_temp.assert(pg_temp.fails($$insert into auth.users (email, raw_user_meta_data) values
  ('vit.c@a.com', '{"role":"aluno","full_name":"Convite Falso","phone":"11911112222","terms_accepted":true,"invite_token":"nao-existe"}')$$),
  'convite inválido continua barrado');
select pg_temp.assert((select count(*) from public.personal_students ps join auth.users u on u.id = ps.student_id where u.email = 'vit.a@a.com') = 0,
  'aluno sem convite começa sem Personal');

-- ─── Vitrine ─────────────────────────────────────────────────
select pg_temp.as_user('vit.p@p.com');
update public.profiles set directory_listed = true where id = auth.uid();
insert into public.payment_packages (name, kind, classes_per_week, price) values ('Diária', 'por_aula', null, 60), ('2x', 'mensal', 2, 350);
select pg_temp.as_user('vit.a@a.com');
select pg_temp.assert((select count(*) from public.personal_directory()) = 1, 'só quem ativou aparece na vitrine');
select pg_temp.assert((select age >= 36 and phone = '11933334444' and jsonb_array_length(packages) = 2 and min_class_price = 40.38
  from public.personal_directory()), 'vitrine mostra idade, WhatsApp, pacotes e menor valor por aula');
reset role;
select pg_temp.assert(pg_temp.fails($$set role anon; select * from public.personal_directory()$$), 'visitante sem login não vê a vitrine');
reset role;

-- ─── Pedido de vínculo ───────────────────────────────────────
select pg_temp.as_user('vit.q@p.com');
select pg_temp.assert((select full_name from public.find_student_for_link('VIT.A@a.com')) = 'Alana Livre', 'acha aluno pelo e-mail');
select pg_temp.assert((select full_name from public.find_student_for_link('+55 (11) 97654-3219')) = 'Alana Livre', 'acha aluno pelo WhatsApp');
select pg_temp.assert(pg_temp.fails($$select * from public.find_student_for_link('9888')$$), 'busca parcial não lista ninguém');
select pg_temp.assert((select count(*) from public.find_student_for_link('vit.p@p.com')) = 0, 'busca não acha Personais');
create temp table v_req as select public.request_student_link((select id from public.find_student_for_link('vit.a@a.com'))) as id;
grant all on v_req to authenticated;
select pg_temp.assert(public.request_student_link((select id from public.find_student_for_link('vit.a@a.com'))) = (select id from v_req),
  'pedir de novo não duplica');
select pg_temp.assert((select pending from public.find_student_for_link('vit.a@a.com')), 'busca mostra pedido pendente');
select pg_temp.assert((select count(*) from public.profiles where full_name = 'Alana Livre') = 1, 'Personal vê nome do aluno com pedido pendente');
select pg_temp.assert((select count(*) from public.workout_sessions) = 0 and not public.is_linked_personal((select student_id from public.link_requests limit 1)),
  'antes de aceitar, não há vínculo');

select pg_temp.as_user('vit.a@a.com');
select pg_temp.assert((select count(*) from public.notifications where title like 'Quico Quieto quer te acompanhar%') = 1, 'aluna recebe o pedido');
select pg_temp.assert((select count(*) from public.profiles where full_name = 'Quico Quieto') = 1, 'aluna vê quem pediu');
select pg_temp.assert(pg_temp.fails($$select public.request_student_link(auth.uid())$$), 'aluno não faz pedido');
select public.respond_link_request((select id from v_req), true);
select pg_temp.assert((select role = 'responsavel' from public.personal_students where student_id = auth.uid() and status = 'ativo'),
  'aceitou: vira responsável (não tinha Personal)');

-- Segundo Personal vira compartilhado; recusar não vincula.
select pg_temp.as_user('vit.r@p.com');
create temp table v_req2 as select public.request_student_link((select id from public.find_student_for_link('vit.a@a.com'))) as id;
grant all on v_req2 to authenticated;
select pg_temp.as_user('vit.p@p.com');
create temp table v_req3 as select public.request_student_link((select id from public.find_student_for_link('11976543219'))) as id;
grant all on v_req3 to authenticated;
select pg_temp.as_user('vit.a@a.com');
select public.respond_link_request((select id from v_req2), true);
select public.respond_link_request((select id from v_req3), false);
select pg_temp.assert((select count(*) from public.personal_students where student_id = auth.uid() and status = 'ativo' and role = 'compartilhado') = 1,
  'segundo Personal entra como compartilhado');
select pg_temp.assert((select count(*) from public.personal_students where student_id = auth.uid() and status = 'ativo') = 2, 'recusado não vincula');
select pg_temp.assert(pg_temp.fails($$select public.respond_link_request((select id from v_req3), true)$$), 'pedido respondido não muda');
select pg_temp.as_user('vit.p@p.com');
select pg_temp.assert((select count(*) from public.notifications where title = 'Pedido recusado') = 1, 'Personal sabe que foi recusado');
select pg_temp.assert(pg_temp.fails($$select public.request_student_link((select id from public.profiles where full_name = 'Rui Responsável'))$$),
  'não pede vínculo com Personal');

reset role;
\echo '✅ Todos os testes de vitrine e vínculo passaram'

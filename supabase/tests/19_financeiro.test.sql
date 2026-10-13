-- Foto de perfil e financeiro do Personal (pacotes, planos, cobranças, lembretes).
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
  ('fin.p@p.com', '{"role":"personal","full_name":"Fábio Financeiro"}'),
  ('fin.o@p.com', '{"role":"personal","full_name":"Olga Outra"}');
select pg_temp.as_user('fin.p@p.com');
create temp table f_i as select * from public.create_invite(7, null);
grant all on f_i to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'fin.g@a.com', jsonb_build_object('role','aluno','full_name','Gina Paga',
  'phone','11922221111','invite_token', token, 'terms_accepted', true) from f_i;
select pg_temp.as_user('fin.p@p.com');
create temp table f_i2 as select * from public.create_invite(7, null);
grant all on f_i2 to authenticated;
reset role;
insert into auth.users (email, raw_user_meta_data)
select 'fin.h@a.com', jsonb_build_object('role','aluno','full_name','Hugo Aulas',
  'phone','11922221112','invite_token', token, 'terms_accepted', true) from f_i2;
create temp table f as select
  (select id from auth.users where email = 'fin.p@p.com') as fabio,
  (select id from auth.users where email = 'fin.g@a.com') as gina,
  (select id from auth.users where email = 'fin.h@a.com') as hugo,
  date_trunc('month', now() at time zone 'America/Sao_Paulo')::date as m,
  (now() at time zone 'America/Sao_Paulo')::date as today;
grant all on f to authenticated;

-- ─── Foto de perfil ──────────────────────────────────────────
select pg_temp.as_user('fin.g@a.com');
update public.profiles set avatar_path = auth.uid()::text || '/' || gen_random_uuid()::text || '.webp' where id = auth.uid();
select pg_temp.assert((select avatar_path is not null from public.profiles where id = auth.uid()), 'aluna salva a própria foto');
select pg_temp.assert(pg_temp.fails($$update public.profiles set avatar_path = (select fabio from f)::text || '/' || gen_random_uuid()::text || '.webp' where id = auth.uid()$$),
  'não aponta para arquivo de outra pessoa');
select pg_temp.assert(pg_temp.fails($$update public.profiles set avatar_path = 'qualquer.png' where id = auth.uid()$$), 'caminho inválido é rejeitado');

-- ─── Pacotes ─────────────────────────────────────────────────
select pg_temp.as_user('fin.p@p.com');
insert into public.payment_packages (name, kind, classes_per_week, price) values
  ('Diária', 'por_aula', null, 50), ('2x por semana', 'mensal', 2, 350);
select pg_temp.assert((select count(*) from public.payment_packages) = 2, 'Personal cria pacotes');
select pg_temp.assert(pg_temp.fails($$insert into public.payment_packages (name, kind, classes_per_week, price) values ('X', 'mensal', null, 10)$$),
  'mensal exige aulas por semana');
select pg_temp.as_user('fin.g@a.com');
select pg_temp.assert(pg_temp.fails($$insert into public.payment_packages (name, kind, price) values ('X', 'por_aula', 10)$$), 'aluno não cria pacote');
select pg_temp.assert((select count(*) from public.payment_packages) = 0, 'aluno não vê pacotes');
select pg_temp.as_user('fin.o@p.com');
select pg_temp.assert((select count(*) from public.payment_packages) = 0, 'outro Personal não vê pacotes');

-- ─── Planos e cobranças ──────────────────────────────────────
select pg_temp.as_user('fin.p@p.com');
insert into public.class_schedules (personal_id, student_id, weekday, start_time, starts_on)
  values (auth.uid(), (select hugo from f), 2, '07:00', (select m from f)), (auth.uid(), (select hugo from f), 4, '07:00', (select m from f));
select public.set_student_billing((select gina from f), (select id from public.payment_packages where kind = 'mensal'), null, null, null, 10);
select public.set_student_billing((select hugo from f), (select id from public.payment_packages where kind = 'por_aula'), null, null, null, 31);
select pg_temp.assert((select amount = 350 and due_on = (select m + 9 from f) and description = '2x por semana'
  from public.payments where student_id = (select gina from f)), 'mensalidade gerada com vencimento no dia 10');
reset role;
create temp table f_n as select private.classes_in_month((select fabio from f), (select hugo from f), (select m from f)) as n;
grant all on f_n to authenticated;
select pg_temp.as_user('fin.p@p.com');
select pg_temp.assert((select amount = 50 * (select n from f_n) and classes = (select n from f_n) and (select n from f_n) >= 8
  and due_on = (select (m + interval '1 month' - interval '1 day')::date from f)
  from public.payments where student_id = (select hugo from f)), 'por aula: valor × aulas do mês, dia 31 vira último dia');
select pg_temp.assert(public.ensure_month_charges((select m from f)) = 0, 'abrir o mês de novo não duplica');
select pg_temp.assert(public.ensure_month_charges((select (m + interval '1 month')::date from f)) = 2, 'mês que vem é gerado sob demanda');
select pg_temp.assert(public.ensure_month_charges((select (m + interval '3 months')::date from f)) = 0, 'meses distantes não são gerados');

-- Trocar o plano refaz a cobrança em aberto.
select public.set_student_billing((select gina from f), null, 'Pacote especial', 'mensal', 300, 5);
select pg_temp.assert((select amount = 300 and due_on = (select m + 4 from f) from public.payments
  where student_id = (select gina from f) and month = (select m from f)), 'novo plano refaz a cobrança do mês');

select pg_temp.as_user('fin.o@p.com');
select pg_temp.assert(pg_temp.fails($$select public.set_student_billing((select gina from f), null, 'X', 'mensal', 100, 5)$$),
  'Personal sem vínculo não define plano');
select pg_temp.assert((select count(*) from public.payments) = 0, 'outro Personal não vê cobranças');

select pg_temp.as_user('fin.g@a.com');
select pg_temp.assert((select count(*) from public.payments) = 2, 'aluna vê só as próprias cobranças (2 meses)');
select pg_temp.assert(pg_temp.fails($$update public.payments set paid_at = now()$$), 'aluna não marca como pago');
select pg_temp.assert(pg_temp.fails($$select public.set_payment_paid((select id from public.payments where month = (select m from f)), true)$$),
  'aluna não usa a função de pago');

-- ─── Pago / lembretes ────────────────────────────────────────
select pg_temp.as_user('fin.p@p.com');
select public.set_payment_paid((select id from public.payments where student_id = (select gina from f) and month = (select m from f)), true);
select pg_temp.assert((select paid_at is not null from public.payments where student_id = (select gina from f) and month = (select m from f)), 'marcada como paga');
select pg_temp.assert(pg_temp.fails($$select public.set_payment_amount((select id from public.payments where student_id = (select gina from f) and month = (select m from f)), 1)$$),
  'cobrança paga não muda de valor');
select public.set_payment_amount((select id from public.payments where student_id = (select hugo from f) and month = (select m from f)), 420);

reset role;
update public.payments set due_on = (select today + 1 from f) where student_id = (select hugo from f) and month = (select m from f);
select pg_temp.assert(public.payment_reminders((select today from f)) = 1, 'lembrete 1 dia antes');
select pg_temp.assert(public.payment_reminders((select today from f)) = 0, 'lembrete não repete no mesmo dia');
select pg_temp.assert(public.payment_reminders((select today + 1 from f)) = 1, 'lembrete no dia');
select pg_temp.assert(public.payment_reminders((select today + 2 from f)) = 1, 'lembrete no dia seguinte');
select pg_temp.assert(public.payment_reminders((select today + 3 from f)) = 0, 'depois disso, sem lembrete');

select pg_temp.as_user('fin.h@a.com');
select pg_temp.assert((select count(*) from public.notifications where title in ('Pagamento vence amanhã 💸', 'Hoje é dia de pagar 💸', 'Pagamento pendente')) = 3,
  'aluno recebe os 3 lembretes');
select pg_temp.assert((select body like 'R$ 420,00%' from public.notifications where title = 'Hoje é dia de pagar 💸'), 'valor formatado em reais');
select pg_temp.as_user('fin.g@a.com');
select pg_temp.assert((select count(*) from public.notifications where title = 'Pagamento confirmado ✅') = 1, 'aluna avisada do pagamento');
select pg_temp.as_user('fin.p@p.com');
select pg_temp.assert((select count(*) from public.notifications where title like '%ainda não pagou') = 1, 'Personal avisado do atraso');

-- Tirar o plano apaga as cobranças em aberto (a paga fica).
select public.remove_student_billing((select gina from f));
select pg_temp.assert((select count(*) from public.payments where student_id = (select gina from f)) = 1, 'cobrança paga continua no histórico');

reset role;
\echo '✅ Todos os testes de foto e financeiro passaram'

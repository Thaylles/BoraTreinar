-- Anamnese / PAR-Q: respostas padronizadas, permissões, avisos e liberação médica.
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
  ('ana.p@p.com', '{"role":"personal","full_name":"Paula Saúde"}'),
  ('ana.q@p.com', '{"role":"personal","full_name":"Quico Fora"}'),
  ('ana.a@a.com', '{"role":"aluno","full_name":"Alice Anamnese","phone":"11955550001","terms_accepted":true}'),
  ('ana.b@a.com', '{"role":"aluno","full_name":"Bruno Outro","phone":"11955550002","terms_accepted":true}');
create temp table c as select
  (select id from auth.users where email = 'ana.p@p.com') as paula,
  (select id from auth.users where email = 'ana.a@a.com') as alice;
grant all on c to authenticated;
insert into public.personal_students (personal_id, student_id, role) values ((select paula from c), (select alice from c), 'responsavel');

select pg_temp.as_user('ana.a@a.com');
select pg_temp.assert(pg_temp.fails($$select public.save_health_form('{"pain_regions":["joelho","nariz"]}')$$), 'opção fora da lista é rejeitada');
select pg_temp.assert(pg_temp.fails($$select public.set_health_clearance(null)$$), 'liberação só depois da anamnese');
select public.save_health_form('{"pain_regions":["joelho","lombar"],"muscle_pain":["posterior"],"goals":["hipertrofia","saude"],
  "activity_level":"pouco_ativo","experience":"menos_6m","sleep":"7_8","smoker":false,"notes":"  Dor ao agachar  "}');
select pg_temp.assert((select pain_regions = array['joelho','lombar'] or pain_regions = array['lombar','joelho'] from public.health_forms), 'aluna salva a anamnese');
select pg_temp.assert((select notes from public.health_forms) = 'Dor ao agachar', 'observação sem espaços sobrando');
select pg_temp.assert(pg_temp.fails($$insert into public.health_forms (student_id) values (auth.uid())$$), 'escrita só pela função');

reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select paula from c) and title = '🩺 Anamnese preenchida') = 1,
  'Personal é avisada da anamnese');

-- PAR-Q com "sim": aviso de atenção e liberação médica
select pg_temp.as_user('ana.a@a.com');
select public.save_health_form('{"parq_yes":["remedio_pressao"],"pain_regions":["joelho"],"conditions":["hipertensao"],"medications":["pressao"]}');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select paula from c) and title like '⚠️ Anamnese%') = 1,
  'PAR-Q com sim avisa a Personal');
select pg_temp.as_user('ana.a@a.com');
select public.save_health_form('{"parq_yes":["remedio_pressao"],"pain_regions":["joelho"]}');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = (select paula from c) and title like '⚠️ Anamnese%') = 1,
  'sem novo "sim", não repete o aviso');

select pg_temp.as_user('ana.a@a.com');
insert into storage.objects (bucket_id, name) values ('medical', (select alice from c)::text || '/liberacao.pdf');
select pg_temp.assert(pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('medical', (select paula from c)::text || '/x.pdf')$$),
  'aluna não envia na pasta de outro');
select pg_temp.assert(pg_temp.fails($$select public.set_health_clearance((select paula from c)::text || '/x.pdf')$$), 'caminho de outra pessoa é recusado');
select public.set_health_clearance((select alice from c)::text || '/liberacao.pdf');
select pg_temp.assert((select clearance_path like '%/liberacao.pdf' from public.health_forms), 'liberação anexada');

select pg_temp.as_user('ana.p@p.com');
select pg_temp.assert((select count(*) from public.health_forms) = 1, 'Personal vê a anamnese da aluna');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'medical') = 1, 'Personal abre a liberação médica');
select pg_temp.assert(pg_temp.fails($$select public.save_health_form('{}')$$), 'Personal não preenche anamnese');

select pg_temp.as_user('ana.q@p.com');
select pg_temp.assert((select count(*) from public.health_forms) = 0, 'Personal de fora não vê');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'medical') = 0, 'Personal de fora não abre a liberação');
select pg_temp.as_user('ana.b@a.com');
select pg_temp.assert((select count(*) from public.health_forms) = 0, 'outro aluno não vê');

reset role;
\echo '✅ Todos os testes de anamnese passaram'

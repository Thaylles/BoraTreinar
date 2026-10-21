-- ════════════════════════════════════════════════════════════════
-- Health Connect (Android): Samsung Health, Google Fit, Fitbit, relógios… e GymRats
--  • O app Android do BoraTreinar recebe um token do usuário (app_tokens) e sincroniza:
--    importa as atividades do Health Connect como treinos (cardio com tempo e distância)
--    e envia os treinos do BoraTreinar para o Health Connect (de onde o GymRats lê).
--  • A importação roda no servidor (service role) com o token conferido.
-- ════════════════════════════════════════════════════════════════

-- Tokens do app Android (guardamos só o hash; o usuário vê e revoga os seus).
create table public.app_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  label text not null default 'App Android' check (char_length(label) <= 60),
  created_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_imported int,
  last_exported int
);
create index app_tokens_user_idx on public.app_tokens (user_id);
alter table public.app_tokens enable row level security;
revoke all on public.app_tokens from anon;
revoke update, truncate on public.app_tokens from authenticated;
create policy "tokens do app: dono vê" on public.app_tokens for select to authenticated using (user_id = (select auth.uid()));
/** Quantos tokens o usuário logado já tem (limite de 5 aparelhos). */
create function public.my_app_token_count() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.app_tokens where user_id = auth.uid();
$$;
revoke execute on function public.my_app_token_count() from public, anon;
grant execute on function public.my_app_token_count() to authenticated;
create policy "tokens do app: dono cria" on public.app_tokens for insert to authenticated
  with check (user_id = (select auth.uid()) and public.my_app_token_count() < 5);
create policy "tokens do app: dono revoga" on public.app_tokens for delete to authenticated using (user_id = (select auth.uid()));

-- Treino importado de outro app (via Health Connect).
alter table public.workout_sessions
  add column imported_from text check (imported_from in ('health_connect')),
  add column source_app text check (char_length(source_app) <= 60);

-- Cardios que chegam do Health Connect e não existiam no catálogo.
insert into public.equipment (name, muscle_group, description, image_url, image_credit, is_bodyweight, is_default, intensity_unit) values
  ('Corrida ao ar livre', 'cardio', 'Corrida na rua ou na pista. Registre tempo e distância.', '/catalogo/corrida.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'velocidade'),
  ('Caminhada', 'cardio', 'Caminhada ao ar livre. Registre tempo e distância.', '/catalogo/caminhada.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'velocidade'),
  ('Pedal ao ar livre', 'cardio', 'Bicicleta na rua ou na trilha. Registre tempo e distância.', '/catalogo/pedal.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'velocidade'),
  ('Natação', 'cardio', 'Registre o tempo e, se souber, a distância.', '/catalogo/natacao.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'nivel'),
  ('Remo ergômetro', 'cardio', 'Registre o tempo, a distância e o nível do aparelho.', '/catalogo/remo.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'nivel'),
  ('Escada / stepper', 'cardio', 'Simulador de escada. Registre o tempo e o nível.', '/catalogo/escada.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'nivel'),
  ('Outro cardio', 'cardio', 'Qualquer outra atividade aeróbica (dança, luta, esportes…).', '/catalogo/outro-cardio.svg', 'Ilustração própria BoraTreinar (licença MIT)', true, true, 'nivel')
on conflict do nothing;

/**
 * Importa atividades do Health Connect para o aluno (chamada pelo servidor, service role).
 * Cada item: id, category, start, end, distance_m (opcional), title (opcional), origin (opcional).
 * Cardio vira treino livre com uma série (tempo, distância e velocidade média); musculação e
 * outras atividades viram treino sem séries (contam para a frequência). Repetidos são ignorados.
 * Retorna quantos treinos novos entraram.
 */
create function public.import_health_sessions(p_student uuid, p_items jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_min numeric;
  v_km numeric;
  v_cat text;
  v_eq uuid;
  v_eq_name text;
  v_label text;
  v_title text;
  v_session uuid;
  n int := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 300 then
    raise exception 'Lista de atividades inválida' using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    begin
      v_start := (it->>'start')::timestamptz;
      v_end := (it->>'end')::timestamptz;
    exception when others then
      continue;
    end;
    if v_start is null or v_end is null or v_end <= v_start or v_end - v_start > interval '12 hours'
       or v_end > now() + interval '10 minutes' or coalesce(it->>'id', '') = '' then
      continue;
    end if;
    v_min := round(extract(epoch from v_end - v_start) / 60.0, 1);
    v_km := least(300, round(coalesce(nullif(it->>'distance_m', '')::numeric, 0) / 1000.0, 2));
    v_cat := coalesce(it->>'category', 'outro');
    v_eq_name := case v_cat
      when 'corrida' then 'Corrida ao ar livre'
      when 'caminhada' then 'Caminhada'
      when 'esteira' then 'Esteira'
      when 'bike' then 'Pedal ao ar livre'
      when 'bike_ergometrica' then 'Bicicleta ergométrica'
      when 'eliptico' then 'Elíptico'
      when 'natacao' then 'Natação'
      when 'remo' then 'Remo ergômetro'
      when 'escada' then 'Escada / stepper'
      when 'outro_cardio' then 'Outro cardio'
    end;
    v_label := case v_cat when 'musculacao' then 'Musculação' when 'outro' then 'Atividade' else v_eq_name end;
    v_title := left(coalesce(nullif(trim(it->>'title'), ''), v_label), 60);
    insert into public.workout_sessions (client_id, student_id, plan_name, kind, started_at, finished_at, imported_from, source_app)
      values (md5('hc:' || p_student || ':' || (it->>'id'))::uuid, p_student, v_title, 'livre', v_start, v_end,
              'health_connect', left(nullif(trim(it->>'origin'), ''), 60))
      on conflict (client_id) do nothing
      returning id into v_session;
    if v_session is null then
      continue;
    end if;
    n := n + 1;
    if v_eq_name is not null then
      select id into v_eq from public.equipment where is_default and name = v_eq_name;
      if v_eq is not null then
        insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done,
                                         duration_min, distance_km, speed_kmh)
        values (v_session, v_eq, 1, 1, 0, least(999, round(v_min)::int), true, least(600, v_min),
                nullif(v_km, 0),
                case when v_km > 0 and v_min > 0 then least(40, round(v_km / (v_min / 60.0), 1)) end);
      end if;
    end if;
    v_session := null;
    v_eq := null;
  end loop;
  return n;
end;
$$;
revoke execute on function public.import_health_sessions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_health_sessions(uuid, jsonb) to service_role;

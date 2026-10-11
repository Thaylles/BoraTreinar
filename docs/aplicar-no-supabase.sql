-- BoraTreinar: migrações pendentes (fichas + sessões de treino)
-- Cole tudo no Supabase → SQL Editor → New query → Run.
begin;

-- ════════════════════════════════════════════════════════════════
-- Etapa 4 — Fichas de treino (por aluno) e modelos do Personal
-- Gravação sempre via RPC (save_workout_plan / duplicate_workout_plan),
-- que valida acesso ao aluno e visibilidade dos exercícios.
-- ════════════════════════════════════════════════════════════════

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  -- null = modelo do Personal (não pertence a aluno)
  student_id uuid references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 60),
  goal text check (goal is null or char_length(goal) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  valid_until date,
  is_template boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_template = (student_id is null))
);
create index workout_plans_student_idx on public.workout_plans (student_id) where not is_template;
create index workout_plans_template_idx on public.workout_plans (created_by) where is_template;
create trigger workout_plans_updated_at before update on public.workout_plans
  for each row execute function public.set_updated_at();

create table public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  position int not null,
  sets int not null default 3 check (sets between 1 and 20),
  reps_min int check (reps_min is null or reps_min between 0 and 999),
  reps_max int check (reps_max is null or (reps_max between 0 and 999 and reps_max >= coalesce(reps_min, 0))),
  suggested_load numeric(6, 2) check (suggested_load is null or suggested_load between 0 and 9999),
  rest_seconds int not null default 60 check (rest_seconds between 0 and 900),
  notes text check (notes is null or char_length(notes) <= 500),
  unique (plan_id, position)
);
create index workout_plan_items_equipment_idx on public.workout_plan_items (equipment_id);

-- ─── Helpers ───────────────────────────────────────────────────

/** Exercício pode ser usado na ficha deste aluno (o aluno precisa conseguir vê-lo). */
create function public.equipment_usable_for_student(p_equipment uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.equipment e
    where e.id = p_equipment
      and (e.is_default or exists (
        select 1 from public.personal_students ps
        where ps.student_id = p_student and ps.personal_id = e.created_by and ps.status = 'ativo'
      ))
  );
$$;

create function public.can_view_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = p_plan and (
      (p.is_template and p.created_by = auth.uid())
      or (not p.is_template and (p.student_id = auth.uid() or public.is_linked_personal(p.student_id)))
    )
  );
$$;

create function public.can_edit_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = p_plan and (
      (p.is_template and p.created_by = auth.uid())
      or (not p.is_template and public.is_linked_personal(p.student_id))
    )
  );
$$;

revoke execute on function
  public.equipment_usable_for_student(uuid, uuid),
  public.can_view_plan(uuid),
  public.can_edit_plan(uuid)
from public, anon;
grant execute on function
  public.equipment_usable_for_student(uuid, uuid),
  public.can_view_plan(uuid),
  public.can_edit_plan(uuid)
to authenticated;

-- ─── RPC: salvar ficha (cria ou atualiza, substituindo os itens) ─
/**
 * p_items: [{equipment_id, sets, reps_min, reps_max, suggested_load, rest_seconds, notes}, ...]
 * na ordem desejada. p_student null = modelo.
 */
create function public.save_workout_plan(
  p_plan uuid,
  p_student uuid,
  p_name text,
  p_goal text,
  p_notes text,
  p_valid_until date,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_plan uuid := p_plan;
  v_student uuid;
  v_template boolean;
  it jsonb;
  i int := 0;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais montam fichas' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Lista de exercícios inválida' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Máximo de 40 exercícios por ficha' using errcode = 'P0001';
  end if;

  if v_plan is null then
    v_student := p_student;
    v_template := p_student is null;
    if not v_template and not public.is_linked_personal(v_student) then
      raise exception 'Você não acompanha esse aluno' using errcode = '42501';
    end if;
    insert into public.workout_plans (student_id, created_by, name, goal, notes, valid_until, is_template)
      values (v_student, auth.uid(), trim(p_name), nullif(trim(p_goal), ''), nullif(trim(p_notes), ''),
              p_valid_until, v_template)
      returning id into v_plan;
  else
    if not public.can_edit_plan(v_plan) then
      raise exception 'Ficha não encontrada' using errcode = '42501';
    end if;
    select student_id, is_template into v_student, v_template from public.workout_plans where id = v_plan;
    update public.workout_plans
      set name = trim(p_name), goal = nullif(trim(p_goal), ''), notes = nullif(trim(p_notes), ''),
          valid_until = p_valid_until
      where id = v_plan;
    delete from public.workout_plan_items where plan_id = v_plan;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    if v_template then
      if not exists (select 1 from public.equipment e where e.id = (it->>'equipment_id')::uuid
                     and (e.is_default or public.knows_personal(e.created_by))) then
        raise exception 'Exercício indisponível na posição %', i using errcode = 'P0001';
      end if;
    elsif not public.equipment_usable_for_student((it->>'equipment_id')::uuid, v_student) then
      raise exception 'Exercício indisponível para este aluno na posição %', i using errcode = 'P0001';
    end if;

    insert into public.workout_plan_items
      (plan_id, equipment_id, position, sets, reps_min, reps_max, suggested_load, rest_seconds, notes)
    values (
      v_plan,
      (it->>'equipment_id')::uuid,
      i,
      coalesce((it->>'sets')::int, 3),
      (it->>'reps_min')::int,
      (it->>'reps_max')::int,
      (it->>'suggested_load')::numeric,
      coalesce((it->>'rest_seconds')::int, 60),
      nullif(trim(it->>'notes'), '')
    );
  end loop;

  return v_plan;
end;
$$;

/** Duplica uma ficha/modelo para um aluno (p_student) ou como modelo (p_student null). */
create function public.duplicate_workout_plan(p_plan uuid, p_student uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  src public.workout_plans;
  items jsonb;
begin
  if not public.can_view_plan(p_plan) or not public.current_role_is('personal') then
    raise exception 'Ficha não encontrada' using errcode = '42501';
  end if;
  select * into src from public.workout_plans where id = p_plan;
  select coalesce(jsonb_agg(jsonb_build_object(
           'equipment_id', equipment_id, 'sets', sets, 'reps_min', reps_min, 'reps_max', reps_max,
           'suggested_load', suggested_load, 'rest_seconds', rest_seconds, 'notes', notes)
         order by position), '[]'::jsonb)
    into items
    from public.workout_plan_items where plan_id = p_plan;

  return public.save_workout_plan(
    null, p_student, coalesce(nullif(trim(p_name), ''), src.name), src.goal, src.notes,
    case when p_student is null then null else src.valid_until end, items);
end;
$$;

create function public.set_workout_plan_archived(p_plan uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_plan(p_plan) then
    raise exception 'Ficha não encontrada' using errcode = '42501';
  end if;
  update public.workout_plans set archived_at = case when p_archived then now() end where id = p_plan;
end;
$$;

revoke execute on function
  public.save_workout_plan(uuid, uuid, text, text, text, date, jsonb),
  public.duplicate_workout_plan(uuid, uuid, text),
  public.set_workout_plan_archived(uuid, boolean)
from public, anon;
grant execute on function
  public.save_workout_plan(uuid, uuid, text, text, text, date, jsonb),
  public.duplicate_workout_plan(uuid, uuid, text),
  public.set_workout_plan_archived(uuid, boolean)
to authenticated;

-- ─── RLS: leitura direta; escrita só via RPC (exceto excluir) ──
alter table public.workout_plans enable row level security;
alter table public.workout_plan_items enable row level security;
revoke all on public.workout_plans, public.workout_plan_items from anon;
revoke insert, update, truncate on public.workout_plans, public.workout_plan_items from authenticated;
revoke delete on public.workout_plan_items from authenticated;

create policy "fichas: quem pode ver" on public.workout_plans
  for select to authenticated using (
    (is_template and created_by = (select auth.uid()))
    or (not is_template and (student_id = (select auth.uid()) or public.is_linked_personal(student_id)))
  );
create policy "fichas: Personal exclui" on public.workout_plans
  for delete to authenticated using (
    (is_template and created_by = (select auth.uid()))
    or (not is_template and public.is_linked_personal(student_id))
  );
create policy "itens: quem vê a ficha" on public.workout_plan_items
  for select to authenticated using (public.can_view_plan(plan_id));

-- ════════════════════════════════════════════════════════════════
-- Etapa 5 — Execução do treino: sessões e séries
-- Gravação via save_workout_session (atômica e idempotente por client_id,
-- para sincronizar treinos feitos offline).
-- ════════════════════════════════════════════════════════════════

create type public.session_kind as enum ('ficha', 'livre');

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  -- Gerado no aparelho ao iniciar o treino; evita duplicar ao re-sincronizar.
  client_id uuid not null unique,
  student_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.workout_plans (id) on delete set null,
  plan_name text,
  kind public.session_kind not null default 'ficha',
  -- Quem registrou: o próprio aluno ou um Personal ("registrado pelo instrutor").
  logged_by uuid references public.profiles (id) on delete set null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_seconds int generated always as (greatest(0, extract(epoch from finished_at - started_at)::int)) stored,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (finished_at >= started_at),
  check (kind = 'livre' or plan_name is not null)
);
create index workout_sessions_student_idx on public.workout_sessions (student_id, started_at desc);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  equipment_id uuid not null references public.equipment (id) on delete restrict,
  exercise_order int not null,
  set_number int not null,
  load_kg numeric(6, 2) not null default 0 check (load_kg between 0 and 9999),
  reps int not null default 0 check (reps between 0 and 999),
  done boolean not null,
  -- Recorde pessoal: maior carga já feita pelo aluno nesse exercício (calculado ao salvar).
  is_pr boolean not null default false,
  unique (session_id, exercise_order, set_number)
);
create index session_sets_equipment_idx on public.session_sets (equipment_id);

create function public.can_view_session(p_session uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_sessions s
    where s.id = p_session and (s.student_id = auth.uid() or public.is_linked_personal(s.student_id))
  );
$$;
revoke execute on function public.can_view_session(uuid) from public, anon;
grant execute on function public.can_view_session(uuid) to authenticated;

/**
 * p: {
 *   client_id, student_id, plan_id?, kind ('ficha'|'livre'), started_at, finished_at, notes?,
 *   exercises: [{ equipment_id, sets: [{ load_kg, reps, done }] }]
 * }
 * Retorna {id, prs: [equipment_id...], duplicate: bool}.
 */
create function public.save_workout_session(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := (p->>'student_id')::uuid;
  v_client uuid := (p->>'client_id')::uuid;
  v_kind public.session_kind := coalesce(p->>'kind', 'ficha')::public.session_kind;
  v_plan uuid := nullif(p->>'plan_id', '')::uuid;
  v_plan_name text;
  v_id uuid;
  v_existing uuid;
  ex jsonb;
  st jsonb;
  i int := 0;
  j int;
  v_prs uuid[] := '{}';
  r record;
begin
  if v_client is null or v_student is null then
    raise exception 'Dados do treino incompletos' using errcode = 'P0001';
  end if;

  -- Quem pode registrar: o próprio aluno ou Personal vinculado.
  if not (v_student = auth.uid() and public.current_role_is('aluno'))
     and not public.is_linked_personal(v_student) then
    raise exception 'Você não pode registrar treino para este aluno' using errcode = '42501';
  end if;

  select id into v_existing from public.workout_sessions where client_id = v_client;
  if found then
    return jsonb_build_object('id', v_existing, 'prs', '[]'::jsonb, 'duplicate', true);
  end if;

  if jsonb_typeof(p->'exercises') is distinct from 'array' or jsonb_array_length(p->'exercises') = 0 then
    raise exception 'O treino não tem exercícios' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p->'exercises') > 60 then
    raise exception 'Treino com exercícios demais' using errcode = 'P0001';
  end if;

  if v_kind = 'ficha' then
    select name into v_plan_name from public.workout_plans
      where id = v_plan and student_id = v_student and not is_template;
    if v_plan_name is null then
      raise exception 'Ficha não encontrada para este aluno' using errcode = 'P0001';
    end if;
  else
    v_plan := null;
    v_plan_name := nullif(trim(p->>'plan_name'), '');
  end if;

  insert into public.workout_sessions
    (client_id, student_id, plan_id, plan_name, kind, logged_by, started_at, finished_at, notes)
  values (
    v_client, v_student, v_plan, v_plan_name, v_kind, auth.uid(),
    (p->>'started_at')::timestamptz,
    least((p->>'finished_at')::timestamptz, now() + interval '5 minutes'),
    nullif(trim(p->>'notes'), '')
  )
  returning id into v_id;

  for ex in select * from jsonb_array_elements(p->'exercises') loop
    i := i + 1;
    -- Só exercícios do catálogo que o aluno enxerga (inclui a regra do treino livre).
    if not public.equipment_usable_for_student((ex->>'equipment_id')::uuid, v_student) then
      raise exception 'Exercício fora do catálogo disponível (posição %)', i using errcode = 'P0001';
    end if;
    if jsonb_array_length(ex->'sets') > 20 then
      raise exception 'Séries demais no exercício %', i using errcode = 'P0001';
    end if;
    j := 0;
    for st in select * from jsonb_array_elements(ex->'sets') loop
      j := j + 1;
      insert into public.session_sets (session_id, equipment_id, exercise_order, set_number, load_kg, reps, done)
      values (
        v_id, (ex->>'equipment_id')::uuid, i, j,
        coalesce((st->>'load_kg')::numeric, 0),
        coalesce((st->>'reps')::int, 0),
        coalesce((st->>'done')::boolean, false)
      );
    end loop;
  end loop;

  -- Recordes: maior carga feita nesta sessão > maior carga feita antes (carga > 0).
  for r in
    select s.equipment_id, max(s.load_kg) as best
    from public.session_sets s
    where s.session_id = v_id and s.done and s.load_kg > 0
    group by s.equipment_id
  loop
    if r.best > coalesce((
      select max(ss.load_kg) from public.session_sets ss
      join public.workout_sessions ws on ws.id = ss.session_id
      where ws.student_id = v_student and ws.id <> v_id and ss.equipment_id = r.equipment_id and ss.done
    ), 0) then
      update public.session_sets set is_pr = true
        where id = (select id from public.session_sets
                    where session_id = v_id and equipment_id = r.equipment_id and done and load_kg = r.best
                    order by exercise_order, set_number limit 1);
      v_prs := v_prs || r.equipment_id;
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'prs', to_jsonb(v_prs), 'duplicate', false);
end;
$$;
revoke execute on function public.save_workout_session(jsonb) from public, anon;
grant execute on function public.save_workout_session(jsonb) to authenticated;

alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;
revoke all on public.workout_sessions, public.session_sets from anon;
revoke insert, update, truncate on public.workout_sessions, public.session_sets from authenticated;
revoke delete on public.session_sets from authenticated;

create policy "sessões: aluno e Personais vinculados" on public.workout_sessions
  for select to authenticated using (
    student_id = (select auth.uid()) or public.is_linked_personal(student_id)
  );
-- Excluir: o aluno (treino próprio) ou o Personal que registrou.
create policy "sessões: excluir" on public.workout_sessions
  for delete to authenticated using (
    student_id = (select auth.uid())
    or (logged_by = (select auth.uid()) and public.is_linked_personal(student_id))
  );
create policy "séries: quem vê a sessão" on public.session_sets
  for select to authenticated using (public.can_view_session(session_id));

-- Registra no histórico de migrações (para o 'supabase db push' não reaplicar depois)
insert into supabase_migrations.schema_migrations (version, name, statements) values
  ('20261010150000', 'fichas', '{}'),
  ('20261010160000', 'sessoes_treino', '{}')
on conflict (version) do nothing;

commit;

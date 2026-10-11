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

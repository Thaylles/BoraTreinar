-- ════════════════════════════════════════════════════════════════
-- Fichas montadas pelo próprio aluno e pedidos de exercício
--  • O aluno (com ou sem Personal) cria, edita e exclui as próprias fichas
--    (workout_plans com created_by = student_id). O Personal vê, mas não edita.
--  • Quando o aluno não acha um exercício, sugere o nome. Personais e admins veem os
--    pedidos abertos até alguém adicionar ao catálogo padrão (ou apontar um que já existe).
-- ════════════════════════════════════════════════════════════════

-- ─── Fichas do aluno ────────────────────────────────────────────

-- O Personal edita as fichas que ele monta; as fichas criadas pelo aluno são só do aluno.
create or replace function public.can_edit_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = p_plan and (
      (p.is_template and p.created_by = auth.uid())
      or (not p.is_template and public.is_linked_personal(p.student_id)
          and p.created_by is distinct from p.student_id)
    )
  );
$$;

drop policy "fichas: Personal exclui" on public.workout_plans;
create policy "fichas: Personal exclui" on public.workout_plans
  for delete to authenticated using (
    (is_template and created_by = (select auth.uid()))
    or (not is_template and public.is_linked_personal(student_id) and created_by is distinct from student_id)
  );
create policy "fichas: aluno exclui as que criou" on public.workout_plans
  for delete to authenticated using (
    not is_template and student_id = (select auth.uid()) and created_by = (select auth.uid())
  );

/**
 * O aluno cria (p_plan null) ou edita uma ficha própria. Itens: equipment_id, sets, reps_min,
 * reps_max, suggested_load, rest_seconds, notes, technique. Até 30 fichas e 40 exercícios.
 */
create function public.save_my_plan(p_plan uuid, p_name text, p_goal text, p_notes text, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_plan uuid := p_plan;
  it jsonb;
  i int := 0;
  v_eq uuid;
begin
  if v_me is null or not public.current_role_is('aluno') then
    raise exception 'Só alunos montam as próprias fichas' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Dê um nome para a ficha (até 60 letras)' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Adicione pelo menos um exercício' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 40 then
    raise exception 'Máximo de 40 exercícios por ficha' using errcode = 'P0001';
  end if;

  if v_plan is null then
    if (select count(*) from public.workout_plans
         where student_id = v_me and created_by = v_me and not is_template) >= 30 then
      raise exception 'Você já tem 30 fichas. Exclua alguma para criar outra' using errcode = 'P0001';
    end if;
    insert into public.workout_plans (student_id, created_by, name, goal, notes, is_template)
      values (v_me, v_me, trim(p_name), nullif(trim(p_goal), ''), nullif(trim(p_notes), ''), false)
      returning id into v_plan;
  else
    if not exists (select 1 from public.workout_plans
                    where id = v_plan and student_id = v_me and created_by = v_me and not is_template) then
      raise exception 'Ficha não encontrada' using errcode = '42501';
    end if;
    update public.workout_plans
       set name = trim(p_name), goal = nullif(trim(p_goal), ''), notes = nullif(trim(p_notes), '')
     where id = v_plan;
    delete from public.workout_plan_items where plan_id = v_plan;
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    v_eq := (it->>'equipment_id')::uuid;
    if not public.equipment_usable_for_student(v_eq, v_me) then
      raise exception 'Exercício indisponível na posição %', i using errcode = 'P0001';
    end if;
    insert into public.workout_plan_items
      (plan_id, equipment_id, position, sets, reps_min, reps_max, suggested_load, rest_seconds, notes, technique)
    values (
      v_plan, v_eq, i,
      coalesce((it->>'sets')::int, 3),
      (it->>'reps_min')::int,
      (it->>'reps_max')::int,
      (it->>'suggested_load')::numeric,
      coalesce((it->>'rest_seconds')::int, 60),
      nullif(trim(it->>'notes'), ''),
      nullif(it->>'technique', '')
    );
  end loop;
  return v_plan;
end;
$$;
revoke execute on function public.save_my_plan(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.save_my_plan(uuid, text, text, text, jsonb) to authenticated;

-- Avisa os Personais quando o aluno cria uma ficha própria.
create function private.notify_student_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.is_template or new.created_by is distinct from new.student_id then
    return new;
  end if;
  select full_name into v_name from public.profiles where id = new.student_id;
  perform private.notify_student_personals(new.student_id, '📋 ' || split_part(v_name, ' ', 1) || ' criou uma ficha',
    'Ficha "' || new.name || '", montada pelo próprio aluno.');
  return new;
end;
$$;
revoke execute on function private.notify_student_plan() from public, anon, authenticated;
create trigger workout_plans_student_notify after insert on public.workout_plans
  for each row execute function private.notify_student_plan();

-- ─── Pedidos de exercício ───────────────────────────────────────

/** Chave de comparação de nomes: sem acento, minúsculo e espaços simples. */
create function private.exercise_key(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(trim(p),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g');
$$;

create table public.exercise_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  name_key text not null generated always as (private.exercise_key(name)) stored,
  note text check (char_length(note) <= 300),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto', 'adicionado', 'descartado')),
  equipment_id uuid references public.equipment (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index exercise_requests_one_open on public.exercise_requests (requested_by, name_key) where status = 'aberto';
create index exercise_requests_open_idx on public.exercise_requests (name_key) where status = 'aberto';

alter table public.exercise_requests enable row level security;
revoke all on public.exercise_requests from anon;
revoke insert, update, delete, truncate on public.exercise_requests from authenticated;
create policy "pedidos de exercício: quem pediu vê os seus" on public.exercise_requests
  for select to authenticated using (requested_by = (select auth.uid()));
create policy "pedidos de exercício: Personais e admins veem os abertos" on public.exercise_requests
  for select to authenticated using (status = 'aberto' and public.current_role_is('personal'));

/** O aluno pede um exercício que não achou. Avisa os admins na primeira vez que o nome aparece. */
create function public.request_exercise(p_name text, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_key text := private.exercise_key(v_name);
  v_existing text;
  v_id uuid;
  v_first boolean;
begin
  if v_me is null then
    raise exception 'Entre na sua conta' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'Escreva o nome do exercício (2 a 80 letras)' using errcode = 'P0001';
  end if;
  select e.name into v_existing from public.equipment e
   where private.exercise_key(e.name) = v_key
     and (e.is_default or public.equipment_usable_for_student(e.id, v_me))
   limit 1;
  if v_existing is not null then
    raise exception 'Esse exercício já está no catálogo: %', v_existing using errcode = 'P0001';
  end if;
  select id into v_id from public.exercise_requests where requested_by = v_me and name_key = v_key and status = 'aberto';
  if v_id is not null then
    return v_id;
  end if;
  if (select count(*) from public.exercise_requests where requested_by = v_me and status = 'aberto') >= 10 then
    raise exception 'Você já tem 10 pedidos aguardando. Espere algum ser atendido' using errcode = 'P0001';
  end if;
  v_first := not exists (select 1 from public.exercise_requests where name_key = v_key and status = 'aberto');
  insert into public.exercise_requests (name, note, requested_by)
    values (v_name, nullif(left(trim(p_note), 300), ''), v_me)
    returning id into v_id;
  if v_first then
    perform public.notify(a.id, '💡 Pedido de exercício: ' || v_name,
      'Um aluno não encontrou esse exercício no catálogo.', '/admin/pedidos')
      from public.profiles a where a.role = 'admin';
  end if;
  return v_id;
end;
$$;

/** Fecha os pedidos abertos com essa chave e avisa quem pediu. */
create function private.close_exercise_requests(p_key text, p_status text, p_equipment uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_eq text;
  n int := 0;
begin
  select name into v_eq from public.equipment where id = p_equipment;
  for r in update public.exercise_requests
              set status = p_status, equipment_id = p_equipment, resolved_by = auth.uid(), resolved_at = now()
            where name_key = p_key and status = 'aberto'
        returning requested_by, name
  loop
    n := n + 1;
    if p_status = 'adicionado' then
      perform public.notify(r.requested_by, '✅ Exercício no catálogo: ' || v_eq,
        'Você pediu "' || r.name || '" e ele já está disponível para suas fichas e treinos.',
        '/aluno/exercicios/' || p_equipment);
    else
      perform public.notify(r.requested_by, 'Pedido de exercício não adicionado',
        '"' || r.name || '" não entrou no catálogo. Talvez ele exista com outro nome: tente buscar de novo.', '/aluno/livre');
    end if;
  end loop;
  return n;
end;
$$;
revoke execute on function private.exercise_key(text), private.close_exercise_requests(text, text, uuid) from public, anon, authenticated;

/** Personal ou admin adiciona o exercício pedido ao catálogo padrão (todos passam a ver). */
create function public.add_requested_exercise(p_key text, p_name text, p_group public.muscle_group,
                                              p_bodyweight boolean default false, p_description text default null,
                                              p_intensity text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if not public.current_role_is('personal') or public.catalog_blocked() then
    raise exception 'Sem permissão para adicionar exercícios' using errcode = '42501';
  end if;
  if not exists (select 1 from public.exercise_requests where name_key = p_key and status = 'aberto') then
    raise exception 'Esse pedido já foi atendido' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'O nome precisa ter entre 2 e 80 letras' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipment where is_default and private.exercise_key(name) = private.exercise_key(v_name)) then
    raise exception 'Já existe um exercício com esse nome no catálogo: use "Já existe"' using errcode = 'P0001';
  end if;
  insert into public.equipment (name, muscle_group, description, is_bodyweight, is_default, created_by, intensity_unit)
    values (v_name, p_group, nullif(left(trim(p_description), 1000), ''), coalesce(p_bodyweight, false), true, auth.uid(),
            case when p_group = 'cardio' then coalesce(nullif(p_intensity, ''), 'nivel') end)
    returning id into v_id;
  perform private.close_exercise_requests(p_key, 'adicionado', v_id);
  return v_id;
end;
$$;

/** O exercício pedido já existe no catálogo padrão (com outro nome): aponta para ele. */
create function public.link_requested_exercise(p_key text, p_equipment uuid) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.current_role_is('personal') then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if not exists (select 1 from public.equipment where id = p_equipment and is_default) then
    raise exception 'Escolha um exercício do catálogo padrão' using errcode = 'P0001';
  end if;
  return private.close_exercise_requests(p_key, 'adicionado', p_equipment);
end;
$$;

/** Admin descarta um pedido (nome inválido, repetido, brincadeira). */
create function public.dismiss_exercise_request(p_key text) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Só o admin descarta pedidos' using errcode = '42501';
  end if;
  return private.close_exercise_requests(p_key, 'descartado', null);
end;
$$;

revoke execute on function public.request_exercise(text, text),
  public.add_requested_exercise(text, text, public.muscle_group, boolean, text, text),
  public.link_requested_exercise(text, uuid), public.dismiss_exercise_request(text) from public, anon;
grant execute on function public.request_exercise(text, text),
  public.add_requested_exercise(text, text, public.muscle_group, boolean, text, text),
  public.link_requested_exercise(text, uuid), public.dismiss_exercise_request(text) to authenticated;

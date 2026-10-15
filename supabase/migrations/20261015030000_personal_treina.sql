-- ════════════════════════════════════════════════════════════════
-- Personal também treina ("Meu treino"): a conta de Personal pode registrar
-- o próprio treino e o próprio peso, como um aluno. Não vira aluno de ninguém:
-- convites e pedidos de vínculo continuam só para contas de aluno.
-- ════════════════════════════════════════════════════════════════

/** Conta que pode treinar por conta própria: aluno ou Personal (e admin nos dois modos). */
create function public.can_train_self() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_role_is('aluno') or public.current_role_is('personal');
$$;
revoke execute on function public.can_train_self() from public, anon;
grant execute on function public.can_train_self() to authenticated;

-- Salvar treino: o próprio usuário (aluno ou Personal) ou um Personal vinculado.
do $$
declare
  src text;
  old_check text := '(v_student = auth.uid() and public.current_role_is(''aluno''))';
begin
  select pg_get_functiondef('public.save_workout_session(jsonb)'::regprocedure) into src;
  if position(old_check in src) = 0 then
    raise exception 'save_workout_session: trecho esperado não encontrado';
  end if;
  execute replace(src, old_check, '(v_student = auth.uid() and public.can_train_self())');
end $$;

-- Exercícios que o próprio usuário cadastrou também valem nos treinos dele.
create or replace function public.equipment_usable_for_student(p_equipment uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.equipment e
    where e.id = p_equipment
      and (e.is_default or e.created_by = p_student or exists (
        select 1 from public.personal_students ps
        where ps.student_id = p_student and ps.personal_id = e.created_by and ps.status = 'ativo'
      ))
  );
$$;

-- Peso e configurações de pesagem: também para o Personal que treina.
drop policy "config: aluno cria as suas" on public.student_settings;
create policy "config: aluno cria as suas" on public.student_settings
  for insert to authenticated
  with check (student_id = (select auth.uid()) and public.can_train_self());
drop policy "peso: aluno registra" on public.body_weights;
create policy "peso: aluno registra" on public.body_weights
  for insert to authenticated
  with check (student_id = (select auth.uid()) and public.can_train_self());

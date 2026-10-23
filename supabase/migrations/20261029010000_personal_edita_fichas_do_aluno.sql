-- ════════════════════════════════════════════════════════════════
-- O aluno pode autorizar o Personal a editar as fichas que ele mesmo montou
--  • student_settings.personal_edits_plans (padrão: não). Com a autorização, o Personal
--    vinculado edita e exclui também as fichas criadas pelo aluno; o aluno continua editando.
--  • O aluno é avisado quando o Personal ajusta uma dessas fichas.
--  • Cadeira flexora: a foto mostrava a cadeira extensora.
-- ════════════════════════════════════════════════════════════════

alter table public.student_settings add column personal_edits_plans boolean not null default false;
grant update (personal_edits_plans) on public.student_settings to authenticated;

/** O aluno autorizou o Personal a editar as fichas que ele montou? */
create function public.student_allows_plan_edit(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select personal_edits_plans from public.student_settings where student_id = p_student), false);
$$;
revoke execute on function public.student_allows_plan_edit(uuid) from public, anon;
grant execute on function public.student_allows_plan_edit(uuid) to authenticated;

create or replace function public.can_edit_plan(p_plan uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = p_plan and (
      (p.is_template and p.created_by = auth.uid())
      or (not p.is_template and public.is_linked_personal(p.student_id)
          and (p.created_by is distinct from p.student_id or public.student_allows_plan_edit(p.student_id)))
    )
  );
$$;

alter policy "fichas: Personal exclui" on public.workout_plans
  using (
    (is_template and created_by = (select auth.uid()))
    or (not is_template and public.is_linked_personal(student_id)
        and (created_by is distinct from student_id or public.student_allows_plan_edit(student_id)))
  );

-- Aviso "Ficha atualizada" também quando o Personal ajusta uma ficha montada pelo aluno
-- (só não avisa quando é o próprio aluno que salva).
create or replace function public.notify_plan_saved() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_link text := '/aluno/fichas/' || new.id;
begin
  if new.student_id is null or new.is_template or new.archived_at is not null
     or auth.uid() is not distinct from new.student_id then
    return new;
  end if;
  if exists (select 1 from public.notifications
              where user_id = new.student_id and link = v_link and created_at > now() - interval '10 minutes') then
    return new;
  end if;
  insert into public.notifications (user_id, title, body, link)
  values (new.student_id,
          case when tg_op = 'INSERT' then '📋 Nova ficha: ' else '✏️ Ficha atualizada: ' end || new.name,
          'Seu Personal ' || case when tg_op = 'INSERT' then 'montou um treino novo para você.' else 'fez ajustes no seu treino.' end,
          v_link);
  return new;
end;
$$;

-- Cadeira flexora: foto do exercício certo (a anterior era da cadeira extensora).
update public.equipment
   set image_url = '/catalogo/fotos/52b-cadeira-flexora.webp',
       image_path = null,
       image_updated_at = now(),
       image_credit = 'Free Exercise DB (domínio público)'
 where is_default and name = 'Cadeira flexora';

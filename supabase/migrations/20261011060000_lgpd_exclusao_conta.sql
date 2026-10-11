-- LGPD: o aluno pode excluir a própria conta.
-- Apaga o usuário (e, em cascata, perfil, vínculos, treinos, pesagens, fichas e aulas),
-- remove o aluno dos relatórios semanais já salvos e avisa os Personais vinculados.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception 'Faça login novamente.';
  end if;
  select full_name into v_name from public.profiles where id = v_uid and role = 'aluno';
  if not found then
    raise exception 'Só contas de aluno podem ser excluídas por aqui. Fale com o suporte.';
  end if;

  insert into public.notifications (user_id, title, body, link)
  select distinct ps.personal_id, 'Aluno excluiu a conta',
         coalesce(v_name, 'Um aluno') || ' excluiu a conta no BoraTreinar. Os dados dele foram apagados.', null
  from public.personal_students ps
  where ps.student_id = v_uid and ps.status = 'ativo';

  update public.weekly_reports r
     set content = jsonb_set(r.content, '{students}', coalesce((
           select jsonb_agg(s) from jsonb_array_elements(r.content->'students') s where s->>'id' <> v_uid::text
         ), '[]'::jsonb))
   where r.content->'students' @> jsonb_build_array(jsonb_build_object('id', v_uid::text));

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

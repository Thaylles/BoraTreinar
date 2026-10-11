-- Admin com modos: a conta admin também atua como Personal (seus alunos, fichas, agenda)
-- e como aluno (seus treinos). current_role_is('personal'|'aluno') passa a valer para o admin;
-- current_role_is('admin') continua exclusivo. Também permite que uma conta já existente
-- (aluno ou admin) aceite o convite de um Personal.

create or replace function public.current_role_is(r public.user_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (role = r or (role = 'admin' and r in ('personal', 'aluno')))
  );
$$;

/** Busca exata de Personal por e-mail (para compartilhar/transferir); inclui o admin. */
create or replace function public.find_personal_by_email(p_email text)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name from public.profiles p
  where public.current_role_is('personal')
    and p.role in ('personal', 'admin')
    and lower(p.email) = lower(trim(p_email))
    and p.id <> auth.uid();
$$;

-- Transferência/compartilhamento também pode ter o admin (no modo Personal) como destino.
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.request_student_transfer(uuid, uuid, public.transfer_kind)'::regprocedure) into src;
  if position('where id = p_to_personal and role = ''personal''' in src) = 0 then
    raise exception 'request_student_transfer: trecho esperado não encontrado';
  end if;
  src := replace(src, 'where id = p_to_personal and role = ''personal''', 'where id = p_to_personal and role in (''personal'', ''admin'')');
  execute src;
end $$;

/**
 * Conta já existente (aluno, ou admin no modo aluno) aceita o convite de um Personal:
 * cria o vínculo (responsável se for o primeiro, senão compartilhado) e marca o convite como usado.
 */
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.invites%rowtype;
  v_me uuid := auth.uid();
  v_name text;
begin
  if not public.current_role_is('aluno') then
    raise exception 'Só contas de aluno podem aceitar convites' using errcode = '42501';
  end if;
  select * into v from public.invites where token = p_token for update;
  if not found or v.revoked_at is not null or v.used_at is not null or v.expires_at <= now() then
    raise exception 'Convite inválido ou expirado' using errcode = 'P0001';
  end if;
  if v.personal_id = v_me then
    raise exception 'Você não pode aceitar o próprio convite' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.personal_students
              where personal_id = v.personal_id and student_id = v_me and status = 'ativo') then
    raise exception 'Você já treina com esse Personal' using errcode = 'P0001';
  end if;

  update public.invites set used_at = now(), used_by = v_me where id = v.id;
  insert into public.personal_students (personal_id, student_id, role)
  values (
    v.personal_id, v_me,
    case when exists (select 1 from public.personal_students
                       where student_id = v_me and status = 'ativo' and role = 'responsavel')
         then 'compartilhado'::public.link_role else 'responsavel'::public.link_role end
  );

  select full_name into v_name from public.profiles where id = v_me;
  perform public.notify(v.personal_id, 'Novo aluno na área! 🎉', v_name || ' aceitou o seu convite.', '/personal/alunos/' || v_me);
  return v.personal_id;
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Lembrete de inatividade também para o admin que treina.
do $$
declare
  src text;
begin
  select pg_get_functiondef('public.inactivity_nudges()'::regprocedure) into src;
  if position('p.role = ''aluno''' in src) = 0 then
    raise exception 'inactivity_nudges: trecho esperado não encontrado';
  end if;
  src := replace(src, 'p.role = ''aluno''', 'p.role in (''aluno'', ''admin'')');
  execute src;
end $$;

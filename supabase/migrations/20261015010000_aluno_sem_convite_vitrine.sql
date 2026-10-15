-- ════════════════════════════════════════════════════════════════
-- Aluno cria conta sem convite + vitrine de Personais + Personal adiciona
-- aluno que já tem conta (o aluno confirma).
-- ════════════════════════════════════════════════════════════════

-- ─── Cadastro: convite passa a ser opcional para o aluno ───────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_phone text := nullif(regexp_replace(coalesce(meta->>'phone', ''), '\D', '', 'g'), '');
  v_invite public.invites%rowtype;
  v_has_invite boolean := nullif(meta->>'invite_token', '') is not null;
begin
  if coalesce(meta->>'role', '') not in ('personal', 'aluno') then
    raise exception 'Perfil inválido' using errcode = 'P0001';
  end if;
  v_role := (meta->>'role')::public.user_role;

  if v_role = 'aluno' then
    if v_has_invite then
      select * into v_invite from public.invites
        where token = meta->>'invite_token'
        for update;
      if not found or v_invite.revoked_at is not null or v_invite.used_at is not null
         or v_invite.expires_at <= now() then
        raise exception 'Convite inválido ou expirado' using errcode = 'P0001';
      end if;
    end if;
    if coalesce((meta->>'terms_accepted')::boolean, false) is not true then
      raise exception 'É preciso aceitar o termo de uso e privacidade' using errcode = 'P0001';
    end if;
    if v_phone is null then
      raise exception 'Telefone (WhatsApp) é obrigatório' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, role, full_name, email, phone, birth_date, terms_accepted_at)
  values (
    new.id,
    v_role,
    trim(meta->>'full_name'),
    new.email,
    v_phone,
    nullif(meta->>'birth_date', '')::date,
    case when coalesce((meta->>'terms_accepted')::boolean, false) then now() end
  );

  if v_role = 'aluno' and v_has_invite then
    update public.invites set used_at = now(), used_by = new.id where id = v_invite.id;
    insert into public.personal_students (personal_id, student_id, role)
      values (v_invite.personal_id, new.id, 'responsavel');
    perform public.notify(
      v_invite.personal_id,
      'Novo aluno na área! 🎉',
      trim(meta->>'full_name') || ' se cadastrou pelo seu convite.',
      '/personal/alunos/' || new.id
    );
  end if;

  return new;
end;
$$;

-- ─── Vitrine de Personais ──────────────────────────────────────
alter table public.profiles add column directory_listed boolean not null default false;
grant update (directory_listed) on public.profiles to authenticated;

/**
 * Personais que aceitaram aparecer para novos alunos: foto, idade, WhatsApp e preços
 * (pacotes). Para qualquer usuário logado.
 */
create function public.personal_directory()
returns table (id uuid, full_name text, avatar_path text, age int, phone text, packages jsonb, min_class_price numeric)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.avatar_path,
         case when p.birth_date is not null
              then extract(year from age((now() at time zone 'America/Sao_Paulo')::date, p.birth_date))::int end,
         p.phone,
         coalesce((select jsonb_agg(jsonb_build_object('name', k.name, 'kind', k.kind,
                                                       'classes_per_week', k.classes_per_week, 'price', k.price)
                                    order by k.kind desc, k.price)
                     from public.payment_packages k where k.personal_id = p.id), '[]'::jsonb),
         (select min(case when k.kind = 'por_aula' then k.price
                          else round(k.price / (k.classes_per_week * 52.0 / 12), 2) end)
            from public.payment_packages k where k.personal_id = p.id)
    from public.profiles p
   where p.role = 'personal' and p.directory_listed and p.phone is not null
     and auth.uid() is not null
   order by p.full_name;
$$;
revoke execute on function public.personal_directory() from public, anon;
grant execute on function public.personal_directory() to authenticated;

-- ─── Pedidos de vínculo (Personal → aluno que já tem conta) ────
create table public.link_requests (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index link_requests_one_pending on public.link_requests (personal_id, student_id) where status = 'pendente';
create index link_requests_student_idx on public.link_requests (student_id, status);

alter table public.link_requests enable row level security;
revoke all on public.link_requests from anon;
revoke insert, update, delete, truncate on public.link_requests from authenticated;
create policy "pedidos de vínculo: as partes veem" on public.link_requests
  for select to authenticated using ((select auth.uid()) in (personal_id, student_id));

-- O aluno vê o nome e a foto de quem pediu para acompanhá-lo.
create policy "perfil: aluno vê quem pediu vínculo" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.link_requests r
            where r.personal_id = profiles.id and r.student_id = (select auth.uid()) and r.status = 'pendente')
  );
-- O Personal vê o nome e a foto do aluno a quem pediu (enquanto o pedido está pendente).
create policy "perfil: Personal vê aluno com pedido pendente" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.link_requests r
            where r.student_id = profiles.id and r.personal_id = (select auth.uid()) and r.status = 'pendente')
  );

/**
 * O Personal procura um aluno pelo e-mail ou WhatsApp exatos (sem listar ninguém).
 * Retorna os alunos com esse contato exato (até 5) e se já está vinculado ou com pedido pendente.
 */
create function public.find_student_for_link(p_query text)
returns table (id uuid, full_name text, avatar_path text, linked boolean, pending boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  d text := regexp_replace(q, '\D', '', 'g');
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais' using errcode = '42501';
  end if;
  if position('@' in q) = 0 then
    if length(d) < 10 then
      raise exception 'Digite o e-mail ou o WhatsApp completo (com DDD)' using errcode = 'P0001';
    end if;
    if length(d) >= 12 and left(d, 2) = '55' then d := substr(d, 3); end if;
  end if;
  return query
    select p.id, p.full_name, p.avatar_path,
           exists (select 1 from public.personal_students ps
                    where ps.personal_id = auth.uid() and ps.student_id = p.id and ps.status = 'ativo'),
           exists (select 1 from public.link_requests r
                    where r.personal_id = auth.uid() and r.student_id = p.id and r.status = 'pendente')
      from public.profiles p
     where p.role = 'aluno' and p.id <> auth.uid()
       and case when position('@' in q) > 0 then lower(p.email) = q
                else p.phone in (d, '55' || d) end
     order by p.full_name
     limit 5;
end;
$$;

/** Pede para acompanhar um aluno. O aluno recebe um aviso e confirma. */
create function public.request_student_link(p_student uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'aluno') then
    raise exception 'Aluno não encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.personal_students
              where personal_id = auth.uid() and student_id = p_student and status = 'ativo') then
    raise exception 'Esse aluno já está com você' using errcode = 'P0001';
  end if;
  select id into v_id from public.link_requests
   where personal_id = auth.uid() and student_id = p_student and status = 'pendente';
  if v_id is not null then
    return v_id;
  end if;
  insert into public.link_requests (personal_id, student_id) values (auth.uid(), p_student) returning id into v_id;
  select full_name into v_name from public.profiles where id = auth.uid();
  perform public.notify(p_student, v_name || ' quer te acompanhar 💪',
    'Confirme para ' || split_part(v_name, ' ', 1) || ' montar suas fichas e ver seus treinos.', '/aluno/personais');
  return v_id;
end;
$$;

/** O aluno aceita ou recusa. Sem Personal responsável, quem pediu vira o responsável. */
create function public.respond_link_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.link_requests;
  v_name text;
begin
  select * into r from public.link_requests where id = p_request and student_id = auth.uid() and status = 'pendente' for update;
  if r.id is null then
    raise exception 'Pedido não encontrado' using errcode = 'P0001';
  end if;
  update public.link_requests set status = case when p_accept then 'aceito' else 'recusado' end, responded_at = now()
   where id = r.id;
  select full_name into v_name from public.profiles where id = auth.uid();
  if p_accept then
    if not exists (select 1 from public.personal_students
                    where personal_id = r.personal_id and student_id = r.student_id and status = 'ativo') then
      insert into public.personal_students (personal_id, student_id, role)
      values (r.personal_id, r.student_id,
              case when exists (select 1 from public.personal_students
                                 where student_id = r.student_id and status = 'ativo' and role = 'responsavel')
                   then 'compartilhado'::public.link_role else 'responsavel'::public.link_role end);
    end if;
    perform public.notify(r.personal_id, v_name || ' aceitou! 🎉', 'Agora você acompanha os treinos dele(a).',
      '/personal/alunos/' || r.student_id);
  else
    perform public.notify(r.personal_id, 'Pedido recusado', v_name || ' não aceitou o pedido de acompanhamento.',
      '/personal/alunos');
  end if;
end;
$$;

/** O Personal desiste de um pedido pendente. */
create function public.cancel_link_request(p_request uuid) returns void
language sql security definer set search_path = '' as $$
  update public.link_requests set status = 'cancelado', responded_at = now()
   where id = p_request and personal_id = auth.uid() and status = 'pendente';
$$;

revoke execute on function public.find_student_for_link(text), public.request_student_link(uuid),
  public.respond_link_request(uuid, boolean), public.cancel_link_request(uuid) from public, anon;
grant execute on function public.find_student_for_link(text), public.request_student_link(uuid),
  public.respond_link_request(uuid, boolean), public.cancel_link_request(uuid) to authenticated;

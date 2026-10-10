-- ════════════════════════════════════════════════════════════════
-- Etapa 2 — Perfis, convites, vínculos Personal↔Aluno, transferências
-- e notificações. Toda mutação sensível passa por funções
-- SECURITY DEFINER; as tabelas têm RLS e só leitura direta.
-- ════════════════════════════════════════════════════════════════

create type public.user_role as enum ('personal', 'aluno');
create type public.link_role as enum ('responsavel', 'compartilhado');
create type public.link_status as enum ('ativo', 'revogado');
create type public.transfer_kind as enum ('compartilhamento', 'transferencia');
create type public.transfer_status as enum ('pendente', 'aceito', 'recusado', 'cancelado');

-- ─── updated_at ────────────────────────────────────────────────
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── profiles ──────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  phone text check (phone is null or phone ~ '^\d{10,13}$'),
  birth_date date,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── invites ───────────────────────────────────────────────────
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  label text check (label is null or char_length(label) <= 80),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index invites_personal_idx on public.invites (personal_id, created_at desc);

-- ─── personal_students ─────────────────────────────────────────
create table public.personal_students (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  role public.link_role not null,
  status public.link_status not null default 'ativo',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
-- No máximo um vínculo ativo por par e um responsável ativo por aluno.
create unique index personal_students_active_pair
  on public.personal_students (personal_id, student_id) where status = 'ativo';
create unique index personal_students_one_responsavel
  on public.personal_students (student_id) where status = 'ativo' and role = 'responsavel';
create index personal_students_student_idx on public.personal_students (student_id);

-- ─── student_transfers (histórico de compartilhamentos/transferências) ─
create table public.student_transfers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  from_personal_id uuid not null references public.profiles (id) on delete cascade,
  to_personal_id uuid not null references public.profiles (id) on delete cascade,
  kind public.transfer_kind not null,
  status public.transfer_status not null default 'pendente',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_personal_id <> to_personal_id)
);
create unique index student_transfers_one_pending
  on public.student_transfers (student_id, to_personal_id) where status = 'pendente';
create index student_transfers_to_idx on public.student_transfers (to_personal_id, status);

-- ─── notifications ─────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════
-- Funções auxiliares (usadas nas policies)
-- ════════════════════════════════════════════════════════════════

create function public.current_role_is(r public.user_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = r);
$$;

/** O usuário logado é Personal com vínculo ativo (responsável ou compartilhado) com o aluno? */
create function public.is_linked_personal(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.personal_students
    where student_id = p_student and personal_id = auth.uid() and status = 'ativo'
  );
$$;

/** O usuário logado é o Personal responsável ativo pelo aluno? */
create function public.is_responsible_personal(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.personal_students
    where student_id = p_student and personal_id = auth.uid()
      and status = 'ativo' and role = 'responsavel'
  );
$$;

create function public.notify(p_user uuid, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
  values (p_user, p_title, p_body, p_link);
$$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Criação do perfil ao cadastrar (auth.users)
--   metadata: role, full_name, phone, birth_date, invite_token, terms_accepted
--   Aluno só se cadastra com convite válido.
-- ════════════════════════════════════════════════════════════════

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_phone text := nullif(regexp_replace(coalesce(meta->>'phone', ''), '\D', '', 'g'), '');
  v_invite public.invites%rowtype;
begin
  if coalesce(meta->>'role', '') not in ('personal', 'aluno') then
    raise exception 'Perfil inválido' using errcode = 'P0001';
  end if;
  v_role := (meta->>'role')::public.user_role;

  if v_role = 'aluno' then
    select * into v_invite from public.invites
      where token = meta->>'invite_token'
      for update;
    if not found or v_invite.revoked_at is not null or v_invite.used_at is not null
       or v_invite.expires_at <= now() then
      raise exception 'Convite inválido ou expirado' using errcode = 'P0001';
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

  if v_role = 'aluno' then
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

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- RPCs
-- ════════════════════════════════════════════════════════════════

/** Dados públicos de um convite (tela de cadastro do aluno). */
create function public.get_invite_public(p_token text)
returns table (personal_name text, status text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.full_name,
         case
           when i.revoked_at is not null then 'revogado'
           when i.used_at is not null then 'usado'
           when i.expires_at <= now() then 'expirado'
           else 'pendente'
         end,
         i.expires_at
  from public.invites i
  join public.profiles p on p.id = i.personal_id
  where i.token = p_token;
$$;
grant execute on function public.get_invite_public(text) to anon, authenticated;

/** Personal gera um convite com validade em dias (1 a 90, padrão 7). */
create function public.create_invite(p_days int default 7, p_label text default null)
returns public.invites
language plpgsql security definer set search_path = '' as $$
declare
  v public.invites;
begin
  if not public.current_role_is('personal') then
    raise exception 'Apenas Personais podem convidar' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'Validade deve ser entre 1 e 90 dias' using errcode = 'P0001';
  end if;
  insert into public.invites (personal_id, label, expires_at)
    values (auth.uid(), nullif(trim(p_label), ''), now() + make_interval(days => p_days))
    returning * into v;
  return v;
end;
$$;

create function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.invites set revoked_at = now()
    where id = p_invite and personal_id = auth.uid()
      and revoked_at is null and used_at is null;
  if not found then
    raise exception 'Convite não encontrado ou já utilizado' using errcode = 'P0001';
  end if;
end;
$$;

/** Busca exata de Personal por e-mail (para compartilhar/transferir). */
create function public.find_personal_by_email(p_email text)
returns table (id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name from public.profiles p
  where public.current_role_is('personal')
    and p.role = 'personal'
    and lower(p.email) = lower(trim(p_email))
    and p.id <> auth.uid();
$$;

/** Responsável solicita compartilhamento ou transferência do aluno. */
create function public.request_student_transfer(
  p_student uuid, p_to_personal uuid, p_kind public.transfer_kind
) returns public.student_transfers
language plpgsql security definer set search_path = '' as $$
declare
  v public.student_transfers;
begin
  if not public.is_responsible_personal(p_student) then
    raise exception 'Apenas o Personal responsável pode fazer isso' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_to_personal and role = 'personal') then
    raise exception 'Personal de destino não encontrado' using errcode = 'P0001';
  end if;
  if p_kind = 'compartilhamento' and exists (
    select 1 from public.personal_students
    where student_id = p_student and personal_id = p_to_personal and status = 'ativo'
  ) then
    raise exception 'Esse Personal já acompanha o aluno' using errcode = 'P0001';
  end if;

  insert into public.student_transfers (student_id, from_personal_id, to_personal_id, kind)
    values (p_student, auth.uid(), p_to_personal, p_kind)
    returning * into v;

  perform public.notify(
    p_to_personal,
    case p_kind when 'compartilhamento' then 'Pedido de compartilhamento de aluno'
                else 'Pedido de transferência de aluno' end,
    (select full_name from public.profiles where id = auth.uid())
      || ' quer ' || case p_kind when 'compartilhamento' then 'compartilhar' else 'transferir' end
      || ' o aluno ' || (select full_name from public.profiles where id = p_student) || ' com você.',
    '/personal/solicitacoes'
  );
  return v;
exception when unique_violation then
  raise exception 'Já existe um pedido pendente para esse Personal' using errcode = 'P0001';
end;
$$;

/** Quem pediu pode cancelar enquanto estiver pendente. */
create function public.cancel_student_transfer(p_transfer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.student_transfers set status = 'cancelado', responded_at = now()
    where id = p_transfer and from_personal_id = auth.uid() and status = 'pendente';
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0001';
  end if;
end;
$$;

/** Personal de destino aceita ou recusa. */
create function public.respond_student_transfer(p_transfer uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.student_transfers;
  v_to_name text;
begin
  select * into t from public.student_transfers
    where id = p_transfer and to_personal_id = auth.uid() and status = 'pendente'
    for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.student_transfers set status = 'recusado', responded_at = now() where id = t.id;
    perform public.notify(t.from_personal_id, 'Pedido recusado',
      'Seu pedido de ' || t.kind::text || ' foi recusado.', '/personal/alunos/' || t.student_id);
    return;
  end if;

  -- O solicitante ainda precisa ser o responsável no momento do aceite.
  if not exists (
    select 1 from public.personal_students
    where student_id = t.student_id and personal_id = t.from_personal_id
      and status = 'ativo' and role = 'responsavel'
  ) then
    update public.student_transfers set status = 'cancelado', responded_at = now() where id = t.id;
    raise exception 'Este pedido não é mais válido' using errcode = 'P0001';
  end if;

  select full_name into v_to_name from public.profiles where id = t.to_personal_id;

  if t.kind = 'compartilhamento' then
    insert into public.personal_students (personal_id, student_id, role)
      values (t.to_personal_id, t.student_id, 'compartilhado')
      on conflict (personal_id, student_id) where status = 'ativo' do nothing;
    perform public.notify(t.student_id, 'Novo Personal acompanhando você',
      v_to_name || ' agora também acompanha seus treinos.', '/aluno/personais');
  else
    -- Anterior perde o acesso; se o novo já era compartilhado, vira responsável.
    update public.personal_students set status = 'revogado', ended_at = now()
      where student_id = t.student_id and status = 'ativo'
        and personal_id in (t.from_personal_id, t.to_personal_id);
    insert into public.personal_students (personal_id, student_id, role)
      values (t.to_personal_id, t.student_id, 'responsavel');
    perform public.notify(t.student_id, 'Seu Personal mudou',
      v_to_name || ' agora é seu Personal responsável.', '/aluno/personais');
  end if;

  update public.student_transfers set status = 'aceito', responded_at = now() where id = t.id;
  perform public.notify(t.from_personal_id, 'Pedido aceito',
    v_to_name || ' aceitou o ' || t.kind::text || '.', '/personal/alunos');
end;
$$;

/** Responsável revoga um compartilhamento ativo. */
create function public.revoke_student_share(p_student uuid, p_personal uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_responsible_personal(p_student) then
    raise exception 'Apenas o Personal responsável pode fazer isso' using errcode = '42501';
  end if;
  update public.personal_students set status = 'revogado', ended_at = now()
    where student_id = p_student and personal_id = p_personal
      and role = 'compartilhado' and status = 'ativo';
  if not found then
    raise exception 'Compartilhamento não encontrado' using errcode = 'P0001';
  end if;
  perform public.notify(p_personal, 'Compartilhamento encerrado',
    'Você não acompanha mais o aluno ' || (select full_name from public.profiles where id = p_student) || '.',
    '/personal/alunos');
  perform public.notify(p_student, 'Mudança nos seus Personais',
    (select full_name from public.profiles where id = p_personal) || ' não acompanha mais seus treinos.',
    '/aluno/personais');
end;
$$;

/** Personal arquiva/desarquiva um aluno na própria lista. */
create function public.set_student_archived(p_student uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.personal_students
    set archived_at = case when p_archived then now() end
    where student_id = p_student and personal_id = auth.uid() and status = 'ativo';
  if not found then
    raise exception 'Aluno não encontrado' using errcode = 'P0001';
  end if;
end;
$$;

-- Funções de escrita: só usuários logados.
revoke execute on function
  public.create_invite(int, text),
  public.revoke_invite(uuid),
  public.find_personal_by_email(text),
  public.request_student_transfer(uuid, uuid, public.transfer_kind),
  public.cancel_student_transfer(uuid),
  public.respond_student_transfer(uuid, boolean),
  public.revoke_student_share(uuid, uuid),
  public.set_student_archived(uuid, boolean)
from public, anon;
grant execute on function
  public.create_invite(int, text),
  public.revoke_invite(uuid),
  public.find_personal_by_email(text),
  public.request_student_transfer(uuid, uuid, public.transfer_kind),
  public.cancel_student_transfer(uuid),
  public.respond_student_transfer(uuid, boolean),
  public.revoke_student_share(uuid, uuid),
  public.set_student_archived(uuid, boolean)
to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.personal_students enable row level security;
alter table public.student_transfers enable row level security;
alter table public.notifications enable row level security;

-- Escrita direta bloqueada; mutações via RPC. Exceções por coluna abaixo.
revoke insert, update, delete, truncate on
  public.profiles, public.invites, public.personal_students,
  public.student_transfers, public.notifications
from anon, authenticated;
revoke all on public.profiles, public.invites, public.personal_students,
  public.student_transfers, public.notifications from anon;

grant update (full_name, phone, birth_date) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- profiles
create policy "perfil: o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: Personal vê seus alunos" on public.profiles
  for select to authenticated using (public.is_linked_personal(id));
create policy "perfil: aluno vê seus Personais" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.personal_students ps
            where ps.personal_id = profiles.id and ps.student_id = (select auth.uid())
              and ps.status = 'ativo')
  );
create policy "perfil: Personais de um mesmo aluno se veem" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.personal_students ps
            where ps.personal_id = profiles.id and ps.status = 'ativo'
              and public.is_linked_personal(ps.student_id))
  );
create policy "perfil: partes de um pedido de transferência" on public.profiles
  for select to authenticated using (
    exists (select 1 from public.student_transfers t
            where (select auth.uid()) in (t.from_personal_id, t.to_personal_id)
              and (profiles.id in (t.from_personal_id, t.to_personal_id)
                   or (profiles.id = t.student_id and t.status = 'pendente')))
  );
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- invites
create policy "convites: do próprio Personal" on public.invites
  for select to authenticated using (personal_id = (select auth.uid()));

-- personal_students
create policy "vínculos: Personal vê os próprios" on public.personal_students
  for select to authenticated using (personal_id = (select auth.uid()));
create policy "vínculos: aluno vê os seus" on public.personal_students
  for select to authenticated using (student_id = (select auth.uid()));
create policy "vínculos: Personais vinculados veem os do aluno" on public.personal_students
  for select to authenticated using (public.is_linked_personal(student_id));

-- student_transfers
create policy "transferências: envolvidos" on public.student_transfers
  for select to authenticated using (
    (select auth.uid()) in (from_personal_id, to_personal_id, student_id)
  );

-- notifications
create policy "notificações: as próprias" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notificações: marcar como lida" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
